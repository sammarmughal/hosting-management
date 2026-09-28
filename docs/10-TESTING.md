# 10 — Testing

## 1. Unit tests (Vitest, `tests/unit/`)

Domain functions in `src/lib/domain/` take `today` as a parameter, so tests never depend on the real date. Run them with `npm test`.

### dates.test.ts
| Case | Input | Expected |
|------|-------|----------|
| normal | addOneYear(2025-10-10) | 2026-10-10 |
| leap day | addOneYear(2024-02-29) | 2025-02-28 |
| leap day → leap year | addOneYear(2027-02-28) | 2028-02-28 |
| end of month | addOneYear(2025-01-31) | 2026-01-31 |
| daysLeft future | renewal 2026-10-12, today 2026-09-25 | 17 |
| daysLeft today | renewal = today | 0 |
| daysLeft past | renewal 2026-09-20, today 2026-09-25 | −5 |
| expiresAtIso | 2026-10-12 | `2026-10-12T23:59:59+05:00` |
| todayPK at UTC 2026-09-24T19:30Z | — | `2026-09-25` (already the next day in PK) |
| todayPK at UTC 2026-09-24T18:59Z | — | `2026-09-24` |
| DB round-trip | `fromDbDate(toDbDate('2026-10-12'))` | `2026-10-12` |

### status.test.ts (T_o=30, T_r=7)
31→green · 30→orange · 8→orange · 7→red · 1→red · 0→red · −1→expired · −365→expired. Also custom limits (T_o=45, T_r=10): 45→orange, 46→green, 10→red.

### stages.test.ts (stages 30,15,7,3,1,0,−3,−6,−9)
45→null · 31→null · 30→30 · 22→30 · 15→15 · 12→15 · 7→7 · 5→7 · 3→3 · 2→3 · 1→1 · 0→0 · −1→0 · −2→0 · −3→−3 · −5→−3 · −6→−6 · −9→−9 · −100→−9. With unsorted input "0,30,7" the stages are sorted first. Empty stages → always null.

### whatsapp.test.ts
Every row in `08-MESSAGES.md` §4, plus: `"0300-123 4567"` → `923001234567` · `"12345"` → null · `""` → null · `"+92 (300) 123-4567"` → `923001234567`. `buildWaLink` URL-encodes Urdu text, emojis and newlines (`%0A`).

### templates.test.ts
- Picks `[[before]]` for d>0, `[[today]]` for d=0 and `[[after]]` for d<0.
- `{days_text}`: 1 → "in 1 day", 7 → "in 7 days", 0 → "today", −1 → "1 day ago", −3 → "3 days ago".
- HTML mode escapes `<b>` in the client name. Text mode does not.
- Unknown `{foo}` is left unchanged.
- A template without section markers is used as-is for all cases.

### reminders.int.test.ts (integration, against a separate Neon test branch or a local Postgres in Docker)
Seed 5 services at d = 45, 30, 12, 0 and −4:
1. runCheck(today, force) → 4 services queued (45 is skipped). Stages 30, 15, 0 and −3. Notifications = 4.
2. runCheck again (force) → 0 new rows, 0 new notifications.
3. Move today +8 days → service@30 is now d=22 (stage 30, already queued → nothing new). Service@12 → d=4 → stage 7, and the old stage-15 row, if still pending, becomes skipped.
4. Renew service@0 → pending rows for the old cycle are skipped, and runCheck queues nothing for it (d = 365).
5. With a client that has no email → no client·email row, but the client·whatsapp row is created.
6. `post_expiry_to_client=0` → the −3 stage queues admin rows only.

### throttle.int.test.ts
The 6th failure in 15 min is blocked, and the block lifts after 15 min (fake clock). A success does not reset the IP counter for other usernames.

### Component tests (Testing Library)
- `TimerPill`: renders the static label first (no hydration mismatch), then the ticking text. The colour class matches `statusColour`. `vi.useFakeTimers()` + `vi.setSystemTime()` across the PK midnight flips the day and colour.
- `ReminderQueue`: send-all calls the action once per ID, in order, and shows failures with Retry.

## 1b. End-to-end (Playwright, `tests/e2e/`)
- Login → 2FA (the code is generated with `otplib` from a known test secret seeded for the e2e admin) → dashboard.
- Add a client and service → it appears with the correct colour.
- Renew → the date moves forward one year.
- Logged out: visiting `/clients` redirects to `/login`.
- Run against `npm run build && npm start` with a seeded test DB and SMTP pointed at a fake (e.g. a local `smtp4dev`/Mailpit container).

## 2. Manual QA checklist

### Auth
- [ ] Wrong password → generic error. The 6th attempt → lockout message.
- [ ] First login forces 2FA setup, and the QR scans in Google Authenticator / Microsoft Authenticator.
- [ ] Recovery codes download, and one code works once only.
- [ ] Typing `/dashboard` after the password step (before 2FA) → redirected to `/2fa`.
- [ ] Idle for 31 min → the next click goes to login.
- [ ] Logout, then the back button → no cached admin data shown (`no-store`), and any click redirects to login.
- [ ] Forgot password → email received → reset → 2FA still required.

### Clients & services
- [ ] Add a client with only a phone → OK. With neither email nor phone → error.
- [ ] A start date sets the renewal date to +1 year automatically, and a manual override sticks.
- [ ] A domain entered as `https://www.Example.com/` is saved as `example.com`.
- [ ] Phone `0300 1234567` shows as `+92 300 1234567`.
- [ ] Search finds by name, domain, email and phone (partial).
- [ ] Each filter chip shows the right count and rows.
- [ ] Deleting a client removes its services from the dashboard.
- [ ] A cancelled service has no timer and no reminders.

### Timers
- [ ] Colours are correct at 31/30/8/7/0/−1 days (edit dates to test).
- [ ] The timer counts down every second, with no layout jump (tabular numbers).
- [ ] A timer crossing midnight changes the day count and colour without a reload (test with a renewal date set to today, near 23:59 or with a changed system clock).
- [ ] Expired shows "Expired N days ago".

### Reminders
- [ ] Opening the dashboard twice → no duplicates in the queue.
- [ ] "Check now" shows a toast with the counts.
- [ ] Send all emails: the progress shows, and emails arrive in Gmail and Outlook (not spam), with correct names, domains, dates and amounts.
- [ ] A wrong SMTP password → the row shows Failed with the error, and Retry works after fixing it.
- [ ] Open WhatsApp on an Android phone and an iPhone → the correct chat and text. The row becomes "Opened", and Mark sent → "Sent".
- [ ] A client with an invalid phone → the WhatsApp button is disabled with a hint.
- [ ] Admin summary email and WhatsApp contain all queued services.
- [ ] Skip removes a row from the queue.

### Renewal & payments
- [ ] Renew → a payment is recorded, the date is +1 year, the timer turns green, and the queue row disappears.
- [ ] "Extend from today" gives today + 1 year.
- [ ] An old expiry extended from the old date that still lands in the past → a warning is shown.

### Import / export
- [ ] The template imports. Bad rows are flagged and not imported. Two rows with the same client give one client with 2 services.
- [ ] A cell starting with `=` in the export is prefixed with `'`.

### Hosting
- [ ] Works on the Vercel production URL.
- [ ] (If used) works on Hostinger Node.js with the same env vars and database.
- [ ] The server timezone is UTC on both, and dates and colours are still correct (PK midnight).

### Responsive / browsers
- [ ] 360 px (Android), 390 px (iPhone), 768 px, 1024 px and 1440 px.
- [ ] Chrome, Edge, Firefox and Safari (iOS).
- [ ] The bottom nav and the floating + button don't cover content.

### Security (see `05-SECURITY.md` §12)
- [ ] All items ticked.

## 3. Faking dates locally

`FAKE_TODAY=2026-10-20` in `.env.local` (honoured **only** when `NODE_ENV !== 'production'`) makes `clock.today()` return that date. JS timers still use the real time. Show a yellow banner "FAKE DATE ACTIVE: 2026-10-20" in the topbar when it is set.
