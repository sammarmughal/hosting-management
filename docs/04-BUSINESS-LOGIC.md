# 04 — Business Logic

All business rules live in `src/lib/domain/` as pure, unit-tested TypeScript functions. The **timezone for every business date is `Asia/Karachi`**.

## 1. Dates

### 1.1 Renewal date from start date
```
renewal_date = start_date + 1 year
```
- Work with **date-only strings `YYYY-MM-DD`** (never JS `Date` objects for business dates, because they carry a time and timezone). Handle 29 Feb: if the start is Feb 29 and the target year is not a leap year, use **Feb 28**. (JS `Date` would roll this to Mar 1, which is wrong here.)
- The admin can override the renewal date in the form. A server-side check requires `renewal_date > start_date`.

```ts
// src/lib/domain/dates.ts
export type ISODate = string; // 'YYYY-MM-DD'

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function addOneYear(d: ISODate): ISODate {
  const [y, m, day] = d.split('-').map(Number);
  const ny = y + 1;
  const nd = m === 2 && day === 29 && !isLeap(ny) ? 28 : day;
  return `${ny}-${String(m).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

// Whole-day difference between two ISO dates (UTC arithmetic on date-only values = safe)
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86_400_000);
}

// Today in Asia/Karachi as ISO date (server runs in UTC on Vercel)
export function todayPK(now = new Date()): ISODate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(now); // 'YYYY-MM-DD'
}

export const daysLeft = (renewal: ISODate, today: ISODate) => diffDays(renewal, today);
export const expiresAtIso = (renewal: ISODate) => `${renewal}T23:59:59+05:00`;

export function addDays(d: ISODate, n: number): ISODate {
  return new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
}

// '2026-09-30' → '30 Sep 2026', '2026-01-05' → '5 Jan 2026' (day without a leading zero).
// Built from a fixed month list, not Intl: newer ICU data prints "Sept" for en-GB.
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const formatDatePK = (d: ISODate) => {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
};
```

### 1.2 Days left
```
days_left = renewal_date − today      (whole days, both Asia/Karachi calendar dates)
```
| days_left | Meaning |
|-----------|---------|
| 45 | 45 days to go |
| 0 | **Expires today** (still valid until 23:59:59) |
| −1 | Expired yesterday |

### 1.3 Timer target
`expires_at = renewal_date 23:59:59 Asia/Karachi`, sent to the browser as `2026-10-12T23:59:59+05:00`.

## 2. Colour / status

Settings: `threshold_orange_days` (T_o, default 30) and `threshold_red_days` (T_r, default 7).

| Condition | Colour key | Label | Hex (see UI spec) |
|-----------|-----------|-------|-----|
| `days_left > T_o` | `green` | Active | `#1E9E57` |
| `T_r < days_left <= T_o` | `orange` | Expiring soon | `#E8870E` |
| `0 <= days_left <= T_r` | `red` | Urgent | `#D93636` |
| `days_left < 0` | `expired` | Expired | `#7A1C1C` |
| `status = cancelled` | `cancelled` | Cancelled | `#7A8290` (no timer) |

Boundary tests (defaults): 31→green, 30→orange, 8→orange, 7→red, 0→red, −1→expired.

The **same function** `statusColour(days, thresholds)` in `src/lib/domain/status.ts` is used on the server and in the client `<TimerPill>` component. The server reads the thresholds from settings and passes them to the client through a React context (`<SettingsProvider>`).

## 3. Reminder stages

Setting `reminder_stages` = `30,15,7,3,1,0,-3,-6,-9` (sorted descending when parsed). A stage is "days left at which this reminder is due".

### 3.1 Which stage is due now?
```
dueStage(d, stages) = MIN { s ∈ stages : d <= s }     (null if the set is empty)
```
| days_left d | due stage | Why |
|---|---|---|
| 45 | null | not yet inside 30 days |
| 30 | 30 | |
| 22 | 30 | still stage 30 (sent once) |
| 12 | 15 | |
| 7 | 7 | |
| 0 | 0 | expiry day |
| −2 | 0 | still the expiry-day stage |
| −4 | −3 | 1st overdue reminder |
| −8 | −6 | |
| −40 | −9 | last one. It is sent once, then nothing more |

This single rule also gives the **catch-up behaviour**: if the app was not opened between day 30 and day 5, the check at d = 5 returns stage 3 only. Stages 30, 15 and 7 were never queued, so they are not sent late. Nothing is spammed.

### 3.2 Recipients and channels per stage

For each due stage the check queues these rows (unique key: `service_id, cycle_date, stage, channel, recipient`):

| Row | Queued when |
|-----|-------------|
| client · email | client has an email |
| client · whatsapp | client has a valid phone |
| admin · email | `admin_email` is set |
| admin · whatsapp | `admin_whatsapp` is set |

For **negative stages** (after expiry), the client rows are only queued if `post_expiry_to_client = 1`. The admin rows are always queued.

## 4. The reminder check (no cron)

`runCheck({ force = false }): Promise<CheckResult>` in `src/lib/server/reminders.ts`

```
1. If !force and now − last_check_at < check_interval_minutes → return (skipped).
2. Inside the transaction, take a Postgres advisory lock: `SELECT pg_try_advisory_xact_lock(4242)`. If it returns false → return (another tab is checking). The unique keys also block duplicates, so the lock is only an optimisation.
3. today = PK date.  stages = parsed setting.  maxStage = stages[0] (e.g. 30).
4. services = active, reminders_enabled = 1, days_left <= maxStage.
5. BEGIN TRANSACTION
   For each service:
     d     = days_left
     stage = dueStage(d, stages);  if null → continue
     cycle = service.renewal_date
     a) UPDATE reminders SET status='skipped'
          WHERE service_id=? AND cycle_date=? AND status IN ('pending','failed','opened') AND stage > stage_now
        (older, superseded stages of this cycle)
     b) UPDATE reminders SET status='skipped'
          WHERE service_id=? AND cycle_date <> cycle AND status IN ('pending','failed','opened')
        (leftovers from a previous cycle, e.g. renewal date was edited)
     c) prisma.reminder.createMany({ data: rows per §3.2 (status pending), skipDuplicates: true })
     d) prisma.notification.createMany({ skipDuplicates: true }) with dedupe_key "stage:{service_id}:{cycle}:{stage}"
        title: d>0 "{domain} expires in {d} days" | d=0 "{domain} expires today" | d<0 "{domain} expired {|d|} days ago"
   UPDATE settings SET value = NOW_UTC WHERE key='last_check_at'
   COMMIT
6. RELEASE_LOCK('hrm_check')
7. If auto_send_emails = 1 → MailService sends up to auto_send_batch_size pending client-email rows,
   then sends the admin summary email if any admin-email rows are pending.
8. Return counts {services_checked, queued_new, skipped, notifications_new, emails_sent, emails_failed}.
```

Calling points:
- The dashboard page (`app/(app)/dashboard/page.tsx`, a Server Component) → `await runCheck({ force: false })` before loading data.
- The **Check now** button → Server Action `checkNowAction()` → `runCheck({ force: true })`, which returns the counts. The UI shows a toast and reloads the queue.

The check must finish in under 2 s for 1,000 services: one select, a few updateMany calls and two createMany calls, all inside one transaction.

## 5. Sending

### 5.1 Client email (one reminder row)
Server Action `sendReminderEmailAction(id)`
1. Load the row and check `channel=email, recipient=client` and status ∈ {pending, failed}.
2. Render the `client_email` template (see `08-MESSAGES.md`).
3. Nodemailer send → on success: `status='sent', sent_at=now`. On failure: `status='failed', attempts++, last_error=msg`, plus a notification of type `email_failed`.
4. Write an audit log entry. Return `{ ok, status, error? }`.

**"Send all emails"** is done in the browser: the client component loops through the pending client-email IDs and calls the action above **one at a time** (this also keeps each request well inside Vercel's function time limit), showing progress ("Sending 4 / 11…"). The admin summary is sent at the end.

### 5.2 Admin summary email
Server Action `sendAdminSummaryEmailAction()`
- Collects all admin-email rows with status ∈ {pending, failed}.
- Builds **one** email with a table of domain, client, renewal date, days left, amount and colour.
- On success it marks all of those rows `sent`.

### 5.3 WhatsApp (click-to-chat)
- The link is built server-side and put on the button as `href`: `https://wa.me/{digits}?text={encodeURIComponent(message)}`.
- The button has `target="_blank" rel="noopener"`. On click, the client calls the Server Action `markOpenedAction(id)` → `status='opened'`.
- The queue row then shows "Opened · Mark as sent ✓ / Skip". The admin confirms, and it becomes `status='sent'`.
- The admin WhatsApp summary works the same way: one link to `admin_whatsapp` with the summary text, and it marks all admin-WhatsApp rows opened, then sent.
- If a phone is invalid, the button is disabled with the tooltip "Invalid WhatsApp number", and a link to edit the client is shown.

### 5.4 Skip
Server Action `skipReminderAction(id)` → `status='skipped'`, for example when the client has already paid in cash.

## 6. Renewal

`renewService({ serviceId, amount, paidOn, method, reference, notes, extendFrom: 'renewal' | 'today' })` in `src/lib/server/renewals.ts` (Prisma `$transaction`)

```
BEGIN
  s = service FOR UPDATE
  from = extendFrom == 'today' ? today : s.renewal_date
  newRenewal = addOneYear(from)
  INSERT payments (amount, currency=s.currency, paid_on, method, reference, period_from=from, period_to=newRenewal, notes)
  UPDATE services SET renewal_date = newRenewal WHERE id = s.id
  UPDATE reminders SET status='skipped' WHERE service_id=s.id AND cycle_date = s.renewal_date AND status IN ('pending','failed','opened')
  INSERT notification type 'renewed' "{domain} renewed until {newRenewal}" (dedupe "renew:{id}:{newRenewal}")
  audit 'service.renew'
COMMIT
```
- The default "Extend from" is the **old renewal date**, so late payers do not get free days. Choose "today" if the service was actually suspended and restarted.
- Guard: if `newRenewal <= today`, for example a very old expiry extended from the old date, show a warning in the modal: "New date is still in the past. Extend from today instead?"

## 7. Dashboard stats

| Card | Query |
|------|-------|
| Active services | `status='active'` |
| Expiring ≤ 30 days | `0 <= days_left <= T_o` |
| Urgent ≤ 7 days | `0 <= days_left <= T_r` |
| Expired | `days_left < 0` and active |
| Expected income (30 days) | sum of `charge_amount` where `0 <= days_left <= 30`, grouped by currency |

## 8. Validation rules

| Field | Rule |
|-------|------|
| client.name | required, 2–150 chars |
| client.email | optional, valid email, ≤190 |
| client.phone | optional, must normalise to 10–15 digits (see `08-MESSAGES.md`) |
| client | at least one of email or phone |
| service.domain | required, normalised, valid hostname (`/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/`) |
| service.start_date | required, valid date, not more than 1 day in the future (warn only) |
| service.renewal_date | required, > start_date |
| service.charge_amount | required, ≥ 0, ≤ 99,999,999.99 |
| service.currency | `PKR`, `USD`, `AED`, `GBP`, `EUR` (configurable list) |
| payment.amount | required, > 0 |
| payment.paid_on | required, ≤ today + 1 |

## 9. CSV import

Template headers:
```
client_name,company,email,phone,domain,plan_label,start_date,renewal_date,charge_amount,currency,notes
```
- Dates are accepted as `YYYY-MM-DD` or `DD/MM/YYYY`.
- An empty `renewal_date` becomes start + 1 year.
- Rows with the same `client_name` + (`email` or `phone`) are grouped into **one client** with several services.
- Step 1 uploads (≤ 2 MB, `.csv` only, parsed with `papaparse` on the server) → Step 2 shows a preview table with a status per row (✓ ok / ⚠ warning / ✗ error) → Step 3 imports only the valid rows, all in one transaction.
- A duplicate domain that already exists shows a warning and is skipped unless "update existing" is ticked.
