# 06 — UI Specification

The UI is built with **Next.js (App Router) + Tailwind CSS + shadcn/ui + lucide-react icons**. It must look clean and professional on a phone (the admin sends WhatsApp reminders from the phone) and on a desktop.

> **Phase 1 builds every screen in the real Next.js app, backed by mock data** (`src/lib/mock/`) and fake actions that only show toasts. No database or auth yet. In later phases the mock layer is swapped for Prisma and real Server Actions, and the components stay the same. So build components with the **same props they will receive from real data** (`ServiceRow`, `ReminderRow`, etc., see §7).

## 1. Design tokens (`src/app/globals.css`)

Define the tokens as CSS variables in `:root`, then expose them to Tailwind (Tailwind v4: `@theme inline { --color-brand-700: var(--brand-700); … }`; or v3: `theme.extend.colors` in `tailwind.config.ts`). Map shadcn's variables (`--primary`, `--destructive`, `--border`, `--ring`, …) to these tokens, so the shadcn components use our palette.

```css
:root {
  /* Brand */
  --brand-900: #0F2A44;
  --brand-700: #1F4E79;
  --brand-500: #2E75B6;
  --brand-100: #E6EFF8;

  /* Neutrals */
  --ink:        #1B2430;   /* main text */
  --ink-muted:  #5B6675;   /* secondary text */
  --line:       #DFE4EA;   /* borders */
  --surface:    #FFFFFF;   /* cards */
  --bg:         #F4F6F9;   /* page background */
  --sidebar-bg: #0F2A44;

  /* Status (timer + badges) — keep in sync with 04-BUSINESS-LOGIC §2 */
  --green:        #1E9E57;  --green-bg:   #E7F6EE;
  --orange:       #E8870E;  --orange-bg:  #FDF1E1;
  --red:          #D93636;  --red-bg:     #FCE9E9;
  --expired:      #7A1C1C;  --expired-bg: #F3E3E3;
  --cancelled:    #7A8290;  --cancelled-bg:#EEF0F3;

  /* Feedback */
  --success: var(--green);  --warning: var(--orange);  --danger: var(--red);  --info: var(--brand-500);

  /* Type */
  --font: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --fs-xs: 12px; --fs-sm: 13px; --fs-base: 14px; --fs-md: 16px; --fs-lg: 20px; --fs-xl: 24px; --fs-2xl: 30px;

  /* Space (4px scale) */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 20px; --s6: 24px; --s8: 32px; --s10: 40px;

  /* Shape */
  --radius-sm: 6px; --radius: 10px; --radius-lg: 14px; --radius-pill: 999px;
  --shadow-sm: 0 1px 2px rgba(16,24,40,.06);
  --shadow:    0 4px 12px rgba(16,24,40,.08);
  --shadow-lg: 0 12px 32px rgba(16,24,40,.16);

  --sidebar-w: 240px; --topbar-h: 60px;
}
```

- The live timer uses `--font-mono` with `font-variant-numeric: tabular-nums` so the digits don't jump.
- Contrast: white text on `--green`, `--orange`, `--red` and `--expired` pills must be ≥ 4.5:1. If orange fails, use `#B86200` for text on light backgrounds, or dark text on the orange pill.
- Dark mode is **not** in v1. Keep all colours as tokens so it can be added later.

## 2. Layout

### Desktop (≥ 1024 px)
```
┌──────────────┬──────────────────────────────────────────────────────┐
│  LOGO        │  Page title                    [Search…] 🔔3  Admin ▾ │ ← topbar 60px
│              ├──────────────────────────────────────────────────────┤
│  ▣ Dashboard │                                                      │
│  👥 Clients   │                 page content (max-width 1280px)      │
│  🔔 Reminders │                                                      │
│  🧾 Payments  │                                                      │
│  ⇅ Import    │                                                      │
│  ⚙ Settings  │                                                      │
│              │                                                      │
│  ─────────── │                                                      │
│  ⎋ Logout    │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
   sidebar 240px, --sidebar-bg, white text, active item = brand-500 bg
```

### Tablet (768–1023 px)
The sidebar collapses to a 72 px icon rail with tooltips.

### Mobile (< 768 px)
- The topbar shows the page title, the bell and a ☰ menu, which opens the sidebar as an off-canvas drawer.
- A **bottom nav** with 4 items: Dashboard · Clients · Reminders · More.
- Tables become **cards** (see §5.3).
- Primary actions use a floating "+" button (bottom-right, above the bottom nav) for "Add client".
- Touch targets are ≥ 44 px.

## 3. Components

### 3.1 Timer pill `components/timer-pill.tsx` (client component)
```tsx
<TimerPill renewalDate="2026-10-12" status="active" size="md" />   // size: 'sm' | 'md' | 'lg'
```
It renders:
```html
<span class="timer-pill is-orange" title="Expires on 12 Oct 2026 · 17 days left">
  <span class="timer-dot"></span>
  <span aria-hidden="true">17d 11h 42m 05s</span>
  <span class="sr-only">Expires on 12 Oct 2026, 17 days left</span>
</span>
```
| State | Class | Text format |
|-------|-------|-------------|
| > T_o | `is-green` | `112d 06h 09m 50s` |
| T_r < d ≤ T_o | `is-orange` | `17d 11h 42m 05s` |
| 0 ≤ d ≤ T_r | `is-red` | `02d 08h 14m 31s`, and the dot pulses (CSS animation, disabled for `prefers-reduced-motion`) |
| < 0 | `is-expired` | `Expired 4 days ago` (under 1 day: `Expired 5h ago`) |
| cancelled | `is-cancelled` | `Cancelled` |

- `size="sm"` shows only `17d 11h` (for dense tables on mobile). `size="lg"` is used on the client detail page.
- **No hydration mismatch:** before the component mounts, it shows a static label computed only from dates ("17 days left", "Expires today", "Expired 4 days ago"). After mount it switches to the live ticking text (see §5).
- It has `title` and `aria-label` ("Expires on 12 Oct 2026, 17 days left"). The live-updating text is `aria-hidden="true"` (screen readers should not get per-second updates). A hidden static label is read instead.

### 3.2 Status badge
A small rounded label: `Active`, `Expiring soon`, `Urgent`, `Expired` or `Cancelled`, using the matching `*-bg` background and status text colour.

### 3.3 Stat card
```
┌─────────────────────────┐
│ ● Expiring in 30 days    │  ← label (ink-muted, fs-sm) with a status dot
│ 11                       │  ← value (fs-2xl, bold, status colour)
│ PKR 86,500 expected      │  ← sub-text (optional)
└─────────────────────────┘
```
The whole card is a link to a filtered client list (e.g. `/clients?filter=orange`).

### 3.4 Buttons
| Variant | Use |
|---------|-----|
Use the shadcn `<Button>` with extra variants added via `cva`:

| `variant` | Use |
|-----------|-----|
| `default` (brand-700) | Main action: Save, Send all emails |
| `outline` (white, border) | Cancel, secondary |
| `success` (green) | Renew / Mark paid |
| `whatsapp` (#25D366, white text + `MessageCircle` icon) | Open WhatsApp |
| `destructive` (red) | Delete (only inside the confirm dialog) |
| `ghost` | Icon buttons, table row actions |
| `size`: `sm`, `default`, `lg`, `icon`. Use full width on mobile via `className="w-full sm:w-auto"` | |

Loading state: the `loading` prop (or `useFormStatus().pending`) shows a `Loader2` spinner, disables the button and keeps its width.

### 3.5 Forms
- Label above the field, a red `*` for required fields, and help text below in `ink-muted`.
- Errors: red border, a message below, and focus moves to the first invalid field. Keep the old values after an error.
- Date inputs: `<input type="date">`. Show the format "DD MMM YYYY" in read views.
- Phone input: placeholder `03001234567 or +923001234567`, with a live preview "WhatsApp: +92 300 1234567 ✓" or "✗ invalid".
- Money input: `inputmode="decimal"`, with the currency select next to it.

### 3.6 Modal
Used for: delete confirmation, Renew / Mark paid, and the send-all progress. Closes on `Esc` or a backdrop click (not during sending), traps focus, and becomes a **full-screen sheet** on mobile.

### 3.7 Toasts
Top-right on desktop, top-centre on mobile. Success (green) and error (red) toasts auto-hide after 4 s, and errors stay until closed.

### 3.8 Notification bell
The icon has a red count badge (hidden at 0, "9+" for more than 9). Clicking it opens a dropdown of the 10 latest: an icon by type, the title, a relative time ("2h ago") and an unread dot, plus "Mark all read" and "View all". On mobile, it opens the full Notifications page.

### 3.9 Empty states
An icon, one line and one action. Examples: "No clients yet · [Add your first client]" and "All caught up, no reminders due 🎉".

### 3.10 Action feedback
Server Actions return `{ ok, error? }`. The calling component shows a toast (`sonner`): "Client saved.", or an error. For create/edit forms, the action ends with `redirect()` and the target page shows the toast from a `?saved=1` search param.

## 4. Screens

### 4.1 Login `/login` (auth layout)
A centred card 400 px wide on a `--bg` background, with the logo and "Hosting Renewal Manager" above.
Fields: Username or email, Password (with a show/hide eye), a **Sign in** button (full width) and a "Forgot password?" link.
There is **no** sign-up link. Error: a red inline alert "Invalid credentials." The lockout message appears in the same alert.

### 4.2 2FA code `/2fa`
The title "Two-step verification" and the text "Enter the 6-digit code from your authenticator app."
Six separate digit boxes (auto-advance, paste fills all, `inputmode="numeric"`, `autocomplete="one-time-code"`) → **Verify**.
The link "Use a recovery code instead" switches to a single text input.

### 4.3 2FA setup `/2fa/setup` (first login only)
Step 1: Scan the QR (SVG, 200 px), plus "Can't scan? Enter this key: XXXX XXXX …" with a copy button.
Step 2: Enter the 6-digit code → Confirm.
Step 3: **Recovery codes**, shown in a 2×4 grid with [Copy all], [Download .txt] and a checkbox "I have saved these codes" that enables **Continue**.

### 4.4 Dashboard `/dashboard`
```
Header:  "Dashboard"                                  Last checked 10 min ago  [↻ Check now]

Row 1 — 5 stat cards (desktop 5 columns, tablet 3+2, mobile 2 columns, horizontal scroll not allowed):
 [Active services 124] [Expiring ≤30d 11 (orange)] [Urgent ≤7d 3 (red)] [Expired 2 (expired)] [Expected 30d PKR 86,500]

Row 2 — REMINDER QUEUE card (the heart of the app)
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ Reminders due (7)            [✉ Send all emails (5)]  [Admin summary ▾]        │
 │                                                        ├ ✉ Email me summary   │
 │                                                        └ 🟢 WhatsApp me summary│
 ├───────────────────────────────────────────────────────────────────────────────┤
 │ ● clientb.pk · Client B            7 days left · 30 Sep 2026 · PKR 6,500      │
 │   Stage: 7 days before                                                        │
 │   ✉ Email   [Sent ✓ 10:42]      🟢 WhatsApp  [Open WhatsApp]      [Skip] [Renew]│
 ├───────────────────────────────────────────────────────────────────────────────┤
 │ ● clienta.com · Client A           Expired 4 days ago · PKR 8,000             │
 │   ✉ Email   [Failed ⚠ Retry]    🟢 WhatsApp  [Opened · Mark sent ✓]  [Skip]   │
 └───────────────────────────────────────────────────────────────────────────────┘
 Each row: coloured left border (status colour). Per-channel state chip: Pending / Sent ✓ / Opened / Failed ⚠ / —(no email/phone).
 Empty: "All caught up — no reminders due."

Row 3 — DUE SOON table (days_left ≤ 30 or expired; most urgent first; max 15, "View all →")
 Columns: Client · Domain · Renewal date · Charge · Time left (timer pill) · Actions (⋯ menu: View, Edit, Renew, WhatsApp)
```

**Send all emails flow:** click → modal "Send 5 reminder emails?" with a list of recipients → **Send** → progress bar "Sending 2 / 5…" plus a live list with ✓/⚠ per recipient → at the end "4 sent, 1 failed", with [Retry failed] and [Close]. Also offer "Also email me the summary" (checked by default).

### 4.5 Clients list `/clients`
```
Header: "Clients"                                   [⇅ Import] [⭳ Export CSV] [+ Add client]
Toolbar: [🔍 Search name, email, phone, domain…]  Status: [All ▾]  Renews in: [Any month ▾]  Sort: [Days left ↑ ▾]
Filter chips (quick): All (124) · 🟢 Active (100) · 🟠 Expiring (11) · 🔴 Urgent (3) · ⚫ Expired (2) · Cancelled (8)

Table (one row per SERVICE; client name links to client detail):
 Client (name + company small) | Domain | Start date | Renewal date | Charge | Time left | ⋯
Pagination 25/page. Search is server-side with 300ms debounce (GET params so URLs are shareable/bookmarkable).
```
Mobile card:
```
┌─────────────────────────────────────┐
│ Client B                  [⋯]       │
│ clientb.pk                          │
│ Renews 30 Sep 2026 · PKR 6,500      │
│ [● 02d 08h 14m 31s]  (red pill)     │
│ [🟢 WhatsApp]  [Renew]               │
└─────────────────────────────────────┘
```

### 4.6 Add / Edit client `/clients/new`, `/clients/{id}/edit`
Two sections on one page:
1. **Client details:** Name*, Company, Email, WhatsApp phone, Notes.
2. **Hosting service** (on "new" only, with an "Add another service" option on the detail page): Domain*, Plan label, Start date*, Renewal date* (auto-fills to start + 1 year when the start changes, unless it was edited by hand, with the hint "Auto: start + 1 year"), Charge*, Currency, Reminders on/off toggle, Notes.

A live preview under the dates shows the timer pill for the entered renewal date.
Buttons: [Cancel] [Save client].

### 4.7 Client detail `/clients/{id}`
```
Header: Client B  (company)                      [Edit] [⋯ Delete]
Contact card: ✉ email (mailto) · 📞 phone (tel) · 🟢 WhatsApp (wa.me without text) · Notes
Services (cards, one per service):
  clientb.pk   Plan: Shared 10GB     [status badge]
  Started 30 Sep 2025 · Renews 30 Sep 2026 · PKR 6,500
  [big timer pill]
  [Renew / Mark paid] [Send email reminder] [Open WhatsApp] [Edit] [⋯ Cancel service / Delete]
  [+ Add service]
Tabs: Payments | Reminder log | Activity
  Payments: Paid on · Amount · Method · Reference · Period (from → to)
  Reminder log: Date · Stage · Channel · Recipient · Status · Error
  Activity: audit entries for this client
```

### 4.8 Renew / Mark paid modal
```
Renew clientb.pk
Current renewal date: 30 Sep 2026 (2 days left)
Amount*        [ 6,500.00 ] PKR
Paid on*       [ 2026-09-28 ]
Method*        ( Cash | Bank transfer | JazzCash | Easypaisa | Other )   ← segmented / select
Reference      [           ]
Extend from    (•) Current renewal date → new date 30 Sep 2027
               ( ) Today                → new date 28 Sep 2027
Notes          [           ]
                                         [Cancel] [✓ Confirm renewal]
```
The new date updates live when the option changes. A warning appears if the new date would still be in the past.

### 4.9 Reminders `/reminders`
Tabs: **Queue** (the same component as the dashboard, full list) | **Log** (all reminders with filters: channel, status, date range, search domain).

### 4.10 Payments `/payments`
A list of all payments with a date-range filter and a total at the bottom (per currency), plus CSV export.

### 4.11 Notifications `/notifications`
A list grouped by day (Today, Yesterday, date). Each item has an icon, title, time, and links to the service. [Mark all read].

### 4.12 Import `/import`
Step indicator 1 Upload → 2 Preview → 3 Done.
1. A drop zone plus [Download CSV template].
2. A preview table with a status column (✓ / ⚠ / ✗ plus the message), summary chips "42 valid · 3 warnings · 2 errors", an "Update existing domains" checkbox, and [Import 45 rows].
3. A result summary with a link to the clients list.

### 4.13 Settings `/settings`
Vertical tabs on desktop, a select dropdown on mobile:
- **Business:** name, phone, admin email, admin WhatsApp, default currency.
- **Reminders:** orange limit (days), red limit (days), stages (a chip editor: add/remove numbers, negative = after expiry), "Send post-expiry reminders to clients" toggle, check interval (minutes), "Auto-send emails when checking" toggle and batch size. It also shows a live **colour preview bar** (green | orange | red | expired with the day marks).
- **Email (SMTP):** host, port, encryption (SSL/TLS/None), username, password (blank = unchanged), from email, from name. [Save] [Send test email to admin].
- **Templates:** four editors (client email subject/body, client WhatsApp, admin email, admin WhatsApp), with placeholder chips that insert on click and a live preview using a sample client. [Reset to default].
- **Security:** change password (current + new + confirm + TOTP), recovery codes [Regenerate], "Reset 2FA" (requires the password), and a recent logins table.

### 4.14 Error pages
403, 404, 419 (session expired, with [Reload]) and 500, each a simple centred card with a link to the Dashboard.

## 5. Live timer (`hooks/use-now.ts` + `components/timer-pill.tsx`)

One shared 1-second ticker drives every timer on the page (no `setInterval` per pill).

```ts
// src/hooks/use-now.ts
'use client';
import { useSyncExternalStore } from 'react';

let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => { now = Date.now(); listeners.forEach(l => l()); }, 1000);
  }
  return () => { listeners.delete(cb); if (!listeners.size && timer) { clearInterval(timer); timer = null; } };
}

/** Returns the current epoch ms on the client (ticking each second), and null during SSR/hydration. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, () => now || null, () => null);
}
```

```tsx
// src/components/timer-pill.tsx
'use client';
import { useNow } from '@/hooks/use-now';
import { useThresholds } from '@/components/settings-provider';
import { daysLeft, expiresAtIso, todayPK, formatDatePK, type ISODate } from '@/lib/domain/dates';
import { statusColour } from '@/lib/domain/status';
import { cn } from '@/lib/utils';

const DAY = 86_400_000, pad = (n: number) => String(n).padStart(2, '0');

export function TimerPill({ renewalDate, status = 'active', size = 'md' }:
  { renewalDate: ISODate; status?: 'active' | 'cancelled'; size?: 'sm' | 'md' | 'lg' }) {
  const now = useNow();
  const t = useThresholds();                             // { orange: 30, red: 7 } from settings
  if (status === 'cancelled') return <span className="timer-pill is-cancelled">Cancelled</span>;

  const today = todayPK(now ? new Date(now) : undefined);
  const days = daysLeft(renewalDate, today);
  const colour = statusColour(days, t);                  // same function as the server
  const exp = Date.parse(expiresAtIso(renewalDate));

  let text: string;
  if (now === null) {                                    // SSR / first paint: static, hydration-safe
    text = days > 0 ? `${days} days left` : days === 0 ? 'Expires today' : `Expired ${-days} days ago`;
  } else if (exp - now < 0) {
    const ago = now - exp;
    text = ago >= DAY ? `Expired ${Math.floor(ago / DAY)} day${ago >= 2 * DAY ? 's' : ''} ago`
                      : `Expired ${Math.max(1, Math.floor(ago / 3_600_000))}h ago`;
  } else {
    let ms = exp - now;
    const d = Math.floor(ms / DAY); ms -= d * DAY;
    const h = Math.floor(ms / 3_600_000); ms -= h * 3_600_000;
    const m = Math.floor(ms / 60_000); const s = Math.floor((ms - m * 60_000) / 1000);
    text = size === 'sm' ? `${pad(d)}d ${pad(h)}h` : `${pad(d)}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  }
  const label = `Expires on ${formatDatePK(renewalDate)}, ${
    days > 0 ? `${days} days left` : days === 0 ? 'expires today' : `expired ${-days} days ago`}`;

  return (
    <span className={cn('timer-pill', `is-${colour}`, `timer-pill--${size}`)} title={label}>
      <span className="timer-dot" />
      <span aria-hidden="true" className="tabular-nums font-mono">{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
```
- `todayPK()` uses `Intl` with `Asia/Karachi`, so the colour flips at Pakistani midnight whatever the device timezone is.
- "Expired N days ago" counts from the end of the renewal day, so right after midnight it says "Expired 1h ago". This matches `daysLeft = −1`.
- The timer classes (`.timer-pill`, `.is-green`, `.timer-dot`, the pulse keyframes) live in `globals.css` under `@layer components`.

## 6. Accessibility

- Colour is **never** the only signal: always show text ("Urgent", "Expired", days) next to the colour.
- Keyboard: every action can be reached with Tab. Focus rings are visible (`outline: 2px solid var(--brand-500)`).
- Forms have `<label for>` and error messages use `aria-describedby`.
- Modals use `role="dialog"`, `aria-modal`, a focus trap, and return focus when they close.
- Respect `prefers-reduced-motion` (no pulse, no animated progress).

## 7. Phase 1: UI with mock data

### 7.1 View-model types (`src/types/view.ts`)
Components receive these shapes. The mock layer builds them now, and the real server layer builds them later.
```ts
export type Colour = 'green' | 'orange' | 'red' | 'expired' | 'cancelled';

export interface ServiceRow {
  id: number; clientId: number; clientName: string; company?: string | null;
  email?: string | null; phone?: string | null;           // phone = normalised digits
  domain: string; planLabel?: string | null;
  startDate: ISODate; renewalDate: ISODate;
  chargeAmount: string; currency: string;                 // amount as string (Decimal-safe)
  status: 'active' | 'cancelled'; remindersEnabled: boolean;
  daysLeft: number; colour: Colour;
}

export interface ReminderRow {
  id: string; serviceId: number; stage: number;
  channel: 'email' | 'whatsapp'; recipient: 'client' | 'admin';
  status: 'pending' | 'sent' | 'opened' | 'failed' | 'skipped';
  lastError?: string | null; sentAt?: string | null;
  waLink?: string | null;                                  // prebuilt for whatsapp rows
  service: ServiceRow;
}

export interface DashboardStats {
  active: number; expiring30: number; urgent7: number; expired: number;
  expected30: { currency: string; total: string }[];
}

export interface NotificationItem { id: string; type: string; title: string; createdAt: string; isRead: boolean; href?: string }
export interface PaymentRow { id: number; serviceId: number; domain: string; clientName: string; amount: string; currency: string; paidOn: ISODate; method: string; reference?: string | null; periodFrom: ISODate; periodTo: ISODate }
```

### 7.2 Mock layer (`src/lib/mock/`)
```
src/lib/mock/
├── data.ts        ← 12 clients / 15 services with dates RELATIVE TO todayPK()
│                    (3 green, 4 orange, 3 red, 2 expired, 1 cancelled, 2 clients × 2 services),
│                    10 reminder rows in mixed states, 8 notifications, 10 payments
├── queries.ts     ← getDashboard(), listServices(filters), getClient(id), listReminders(), … (same signatures as lib/server later)
└── actions.ts     ← fake actions: await sleep(400); return { ok: true } (randomly fail 1 of 5 emails to show the error state)
```
The pages import from `@/lib/data` (a tiny re-export file). In Phase 1 it re-exports `mock/queries`, and in Phase 4+ it re-exports `server/queries`. Nothing else changes.

### 7.3 Screens to build in Phase 1
`/login`, `/2fa`, `/2fa/setup` (placeholder QR), `/dashboard`, `/clients`, `/clients/new`, `/clients/[id]` (with the Renew dialog), `/clients/[id]/edit`, `/reminders`, `/payments`, `/notifications`, `/import` (3 steps), `/settings` (5 tabs), plus `not-found` and `error`.

The WhatsApp buttons build **real** `wa.me` links from the mock data (using `lib/domain/whatsapp.ts`), so they can be tested on a phone.
