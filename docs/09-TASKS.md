# 09 — Build Plan & Task Checklist (Next.js)

Tick items as they are done. Each phase ends with a **Done when** check. Estimates assume one developer working with an AI assistant in VS Code.

| Phase | Name | Estimate |
|-------|------|----------|
| 0 | Project setup | 0.5 day |
| 1 | **UI with mock data** | 3–4 days |
| 2 | Database + Prisma + domain logic | 1.5 days |
| 3 | Authentication + 2FA + security | 2 days |
| 4 | Clients & services (real data) | 1.5 days |
| 5 | Dashboard + reminder check (no cron) | 1.5 days |
| 6 | Email + WhatsApp | 1.5 days |
| 7 | Renewals, payments, notifications | 1 day |
| 8 | Import/export + settings | 1.5 days |
| 9 | Testing + hardening | 1.5 days |
| 10 | Deploy (Vercel, and optionally Hostinger) + handover | 1 day |
| | **Total** | **about 2.5–3 weeks** |

---

## Phase 0 — Project setup
- [x] `npx create-next-app@latest hosting-renewal --ts --tailwind --eslint --app --src-dir --import-alias "@/*"`
- [ ] `git init`, create a **private** GitHub repo, and push. `.gitignore` covers `.env*` (except `.env.example`).
- [x] Copy these docs into `docs/`, and `CLAUDE.md` to the root.
- [x] `npx shadcn@latest init`, then add: `button input label textarea select switch checkbox dialog sheet dropdown-menu tabs table badge card separator tooltip popover sonner skeleton radio-group`.
- [x] Install: `lucide-react zod react-hook-form @hookform/resolvers clsx tailwind-merge`.
- [x] Dev tools: `vitest @vitejs/plugin-react @testing-library/react jsdom`, and `prettier prettier-plugin-tailwindcss`.
- [x] `next.config.ts`: `output: 'standalone'`, `poweredByHeader: false`.
- [x] `tsconfig`: `strict: true`, `noUncheckedIndexedAccess: true`.
- [ ] VS Code extensions: ESLint, Prettier, Tailwind CSS IntelliSense, Prisma, and optionally Playwright Test.
- [ ] npm scripts: `dev`, `build`, `start`, `lint`, `test`, `test:e2e`, `db:migrate`, `db:seed`, `create-admin`, `reset-2fa`.

**Done when:** `npm run dev` shows the starter page and `npm run lint` passes.

---

## Phase 1 — UI with mock data ← START HERE IN VS CODE
Follow `06-UI-SPEC.md`. There is no database and no auth yet (the `(app)` layout does not check the session in this phase).

- [x] `globals.css`: design tokens (§1) mapped to Tailwind and shadcn variables, plus `.timer-pill` styles (all 5 states and the pulse, with `prefers-reduced-motion`).
- [x] Add the extra Button variants (`success`, `whatsapp`) via `cva`.
- [x] `lib/domain/dates.ts`, `status.ts`, `whatsapp.ts` and `templates.ts` (pure functions from `04`/`08`). Write them **now**, since the UI needs them, with Vitest unit tests (`10-TESTING.md` §1).
- [x] `types/view.ts` (UI spec §7.1).
- [ ] `lib/mock/data.ts`, `queries.ts` and `actions.ts`, plus `lib/data.ts` re-exporting the mock queries.
- [ ] `hooks/use-now.ts` and `components/timer-pill.tsx` (UI spec §5), and `SettingsProvider` with the thresholds.
- [ ] Layout components: `Sidebar`, `Topbar` (with the bell dropdown), `BottomNav` (mobile), the mobile drawer (`Sheet`) and the floating "+" button.
- [ ] Shared components: `StatCard`, `StatusBadge`, `ServicesTable` (desktop table + mobile cards), `ReminderQueue` (send-all dialog with a progress bar using the fake actions, WhatsApp buttons with real `wa.me` links, and skip), `RenewDialog` (live new-date preview and past-date warning), `ClientForm`/`ServiceForm` (auto renewal = start + 1 year, phone preview), `ConfirmDialog`, `EmptyState`, `OtpInput`.
- [ ] Pages (UI spec §4 and §7.3): login, 2fa, 2fa/setup, dashboard, clients, clients/new, clients/[id], clients/[id]/edit, reminders, payments, notifications, import (3 steps with a client-side CSV preview), settings (5 tabs), not-found and error.
- [ ] Test at 360, 390, 768, 1024 and 1440 px.
- [ ] Accessibility pass: keyboard navigation, focus rings, labels, dialog focus trap.
- [ ] Deploy the Phase 1 build to a **protected Vercel preview** and share it with the owner for review.

**Done when:** every screen works with mock data on phone and desktop, timers tick with the correct colours, WhatsApp links open correctly on a phone, and the owner approves the look.

---

## Phase 2 — Database + Prisma
- [ ] Create a Neon project (region close to the Vercel region, e.g. Singapore or Frankfurt). Create a `dev` branch database for local work.
- [ ] `npm i prisma @prisma/client`, then `npx prisma init`. Paste the schema from `03-DATABASE.md`.
- [ ] `npx prisma migrate dev --name init`.
- [ ] `prisma/seed.ts`: settings + default templates (+ demo data when `SEED_DEMO=1`).
- [ ] `lib/server/db.ts` (singleton), `db-dates.ts`, `settings.ts` (typed, React `cache()`), `clock.ts`, `crypto.ts` (AES-256-GCM).
- [ ] `lib/domain/stages.ts` and `validation.ts` (zod), with unit tests.

**Done when:** the migration and seed work, and `npx prisma studio` shows the demo data.

---

## Phase 3 — Authentication + 2FA + security
- [ ] `npm i @node-rs/argon2 otplib qrcode` (+ `@types/qrcode`).
- [ ] `scripts/create-admin.ts` and `scripts/reset-2fa.ts` (run with `tsx`).
- [ ] `lib/server/session.ts` (DB sessions, `requireAdmin`, `requirePasswordStage`), `auth.ts` and `throttle.ts`.
- [ ] `actions/auth.ts`, and connect the login, 2FA, setup (real QR SVG + recovery codes), forgot and reset pages.
- [ ] `middleware.ts`: cookie-presence redirect + CSP nonce + security headers. Headers also go in `next.config.ts`.
- [ ] `(app)/layout.tsx` calls `requireAdmin()`. Add a lint rule or a code-review checklist item: **every action calls `requireAdmin()` first**.
- [ ] Audit log helper, with auth events logged.

**Done when:** no page or action works without password + TOTP, the lockout works, recovery codes work once each, and logout really kills the session.

---

## Phase 4 — Clients & services (real data)
- [ ] `lib/server/queries.ts`: the same function signatures as `lib/mock/queries.ts`, implemented with Prisma and returning the view-model types.
- [ ] Switch `lib/data.ts` to the server queries.
- [ ] `actions/clients.ts` and `actions/services.ts` (zod, phone and domain normalisation, renewal-date change → skip the old cycle).
- [ ] Clients list: search, filters, sort (whitelisted), pagination via `searchParams`.

**Done when:** full CRUD works on real data, and the UI is unchanged from Phase 1.

---

## Phase 5 — Dashboard + reminder check (no cron)
- [ ] `lib/server/reminders.ts`: `runCheck()` exactly as in `04-BUSINESS-LOGIC.md` §4 (transaction, advisory lock, skip superseded, `createMany skipDuplicates`, notifications, `last_check_at`).
- [ ] The dashboard page calls `runCheck({ force: false })` and then loads the stats, queue and due-soon list.
- [ ] `checkNowAction`, plus the "Last checked" label.
- [ ] The bell loads the latest notifications when opened (no polling), and the Notifications page works.

**Done when:** opening the dashboard queues the correct reminders once. Reloading adds nothing. `FAKE_TODAY` 20 days ahead shows the catch-up behaviour (only the latest stage).

---

## Phase 6 — Email + WhatsApp
- [ ] `npm i nodemailer` (+ `@types/nodemailer`). `lib/server/mail.ts` with the HTML wrapper and plain-text alternative, and the SMTP settings from the DB (decrypted).
- [ ] Reminder actions: send email, mark opened, mark sent, skip, admin summary email and WhatsApp, and manual email.
- [ ] The send-all dialog calls the real action one ID at a time, with progress and retry of the failed ones.
- [ ] Auto-send on check (setting), with the batch limit.
- [ ] Test with a real Hostinger mailbox and a real phone.

**Done when:** emails arrive with the correct content (not in spam), WhatsApp opens the right chat and text on Android and iPhone, and every state shows in the queue and the log.

---

## Phase 7 — Renewals, payments, notifications
- [ ] `lib/server/renewals.ts` + `renewServiceAction` (Prisma `$transaction`).
- [ ] The payments page with filters and per-currency totals, and `deletePaymentAction`.
- [ ] Client detail tabs: Payments, Reminder log, Activity.

**Done when:** renewing moves the date forward exactly one year, skips the old pending reminders, records the payment and creates a notification.

---

## Phase 8 — Import/export + settings
- [ ] `npm i papaparse` (+ types). The import preview and commit actions, and the export route handlers.
- [ ] Settings tabs wired to their actions (business, reminders with the stage chip editor and colour preview bar, email with a test send, templates with placeholder chips, live preview and reset, security with password, recovery codes, 2FA reset and sessions).

**Done when:** the owner's real client list imports cleanly, and every setting changes behaviour as expected.

---

## Phase 9 — Testing + hardening
- [ ] All Vitest unit and integration tests pass.
- [ ] Playwright smoke tests: login + 2FA (TOTP generated from the test secret), add a client, renew, send-all with a mocked SMTP.
- [ ] Manual QA checklist (`10-TESTING.md` §2) fully ticked.
- [ ] Security checklist (`05-SECURITY.md` §12) fully ticked.
- [ ] Performance: seed 1,000 services, and the dashboard's server response is under 1 s.
- [ ] Remove `src/lib/mock/` (or exclude it from the production build).

---

## Phase 10 — Deploy + handover
- [ ] Follow `11-DEPLOYMENT.md` (Vercel), and optionally the Hostinger section.
- [ ] Import the real client list and confirm the numbers with the owner.
- [ ] Walk the owner through the routine (below).
- [ ] Hand over: the URL, username, 2FA set up on the owner's phone, and the recovery codes saved offline.

### Owner's routine (also shown as a help tooltip on the dashboard)
1. Open the app at least **2–3 times a week** (it checks for reminders automatically).
2. In **Reminders due**, click **Send all emails**, then tap **Open WhatsApp** for each client and press Send in WhatsApp.
3. When a client pays, click **Renew / Mark paid**.
