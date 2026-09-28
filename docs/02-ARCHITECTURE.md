# 02 — Architecture (Next.js)

## 1. Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js (App Router, latest stable) + TypeScript (strict)** | Modern React UI, server components, server actions |
| Runtime | Node.js 20 LTS+ (**Node runtime only, not Edge**) | Needed for Prisma, argon2 and nodemailer, and it runs the same on Vercel and Hostinger |
| Hosting | **Vercel** (primary). **Hostinger Node.js hosting** (alternative) | `output: 'standalone'` build works on both |
| Database | **PostgreSQL on Neon** (serverless Postgres, TLS) | Reachable from both Vercel and Hostinger. Vercel has a native Neon integration. The free tier is enough to start |
| ORM | **Prisma** | Typed queries, migrations, seed script |
| Styling | **Tailwind CSS** + CSS variables (design tokens from `06-UI-SPEC.md`) | Fast to build and consistent |
| UI primitives | **shadcn/ui** (copied into the repo) + **lucide-react** icons | Accessible dialogs, dropdowns and tabs. No runtime CDN |
| Forms/validation | **zod** (+ `react-hook-form` on the bigger forms) | One schema validates on both client and server |
| Password hashing | **@node-rs/argon2** (Argon2id) | Fast and secure, works on Vercel |
| 2FA | **otplib** (TOTP) + **qrcode** (QR generated on our server) | The secret never goes to a third party |
| Email | **nodemailer** over Hostinger SMTP | Works from Vercel and Hostinger |
| CSV | **papaparse** | Import/export |
| Dates | Date-only ISO strings + `Intl` with `Asia/Karachi` (see `04-BUSINESS-LOGIC.md` §1) | No timezone bugs on UTC servers |
| Tests | **Vitest** (unit/integration) + **Playwright** (e2e smoke) | |

> **Why not MySQL on Hostinger?** When the app runs on Vercel, the database must be reachable over the internet with TLS. Opening Hostinger's shared MySQL to "any host" is weaker security. Neon works the same from both hosts.
> *If you later want everything on Hostinger:* change the Prisma `provider` to `mysql`, point `DATABASE_URL` to the Hostinger database, and re-run `prisma migrate`. The schema in `03-DATABASE.md` is written to be portable.

> **Vercel plan note:** Vercel's free **Hobby** plan is for non-commercial use. Since this is a business tool, plan for **Vercel Pro** (or host on Hostinger Node.js instead).

## 2. The "no-cron" design

```
Admin opens /dashboard
        │
        ▼
app/(app)/dashboard/page.tsx   (Server Component, dynamic = 'force-dynamic')
        │  await runCheck({ force: false })
        ▼
lib/server/reminders.ts → runCheck()
   ├─ if now − settings.last_check_at < check_interval_minutes → skip
   ├─ prisma.$transaction:
   │    ├─ pg_try_advisory_xact_lock(4242)  (skip if another tab is checking)
   │    ├─ load active services with reminders_enabled and days_left <= first stage
   │    ├─ compute due stage per service (lib/domain/stages.ts)
   │    ├─ mark superseded/old-cycle reminders 'skipped'
   │    ├─ createMany reminders  { skipDuplicates: true }   ← unique key blocks duplicates
   │    ├─ createMany notifications { skipDuplicates: true } ← dedupe_key
   │    └─ update last_check_at
   └─ if settings.auto_send_emails → send up to batch_size emails (after the transaction)
        │
        ▼
Dashboard renders: stats + <ReminderQueue/> + due-soon table

Client component <ReminderQueue/>:
  [Send all emails] → loops ids → await sendReminderEmailAction(id)  (one email per server action call)
  [Open WhatsApp]   → <a href="https://wa.me/…" target="_blank"> + markOpenedAction(id)
```

- There is **no background process and no Vercel Cron**. Everything runs inside the admin's own requests.
- Sending one email per action call keeps every request short (well under the Vercel function time limit).

## 3. Folder structure

```
hosting-renewal/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                     ← default settings + templates (+ demo data when SEED_DEMO=1)
├── scripts/
│   ├── create-admin.ts             ← CLI: npm run create-admin
│   └── reset-2fa.ts                ← CLI: npm run reset-2fa
├── src/
│   ├── middleware.ts               ← auth gate (cookie present?) + security headers + CSP nonce
│   ├── app/
│   │   ├── layout.tsx              ← <html>, fonts (local/system), Toaster
│   │   ├── globals.css             ← Tailwind + design tokens
│   │   ├── (auth)/                 ← centred card layout, no sidebar
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── 2fa/page.tsx
│   │   │   ├── 2fa/setup/page.tsx
│   │   │   ├── forgot/page.tsx
│   │   │   └── reset/[token]/page.tsx
│   │   ├── (app)/                  ← sidebar + topbar layout, requires full auth
│   │   │   ├── layout.tsx          ← await requireAdmin(); <SettingsProvider>
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── clients/page.tsx
│   │   │   ├── clients/new/page.tsx
│   │   │   ├── clients/[id]/page.tsx
│   │   │   ├── clients/[id]/edit/page.tsx
│   │   │   ├── clients/[id]/services/new/page.tsx
│   │   │   ├── services/[id]/edit/page.tsx
│   │   │   ├── reminders/page.tsx
│   │   │   ├── payments/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   ├── import/page.tsx
│   │   │   └── settings/page.tsx   ← tabs via ?tab=
│   │   ├── api/                    ← route handlers ONLY where server actions don't fit
│   │   │   ├── export/services/route.ts   (CSV download)
│   │   │   ├── export/payments/route.ts
│   │   │   ├── import/template/route.ts
│   │   │   └── health/route.ts            (returns 200 "ok", no data)
│   │   ├── not-found.tsx
│   │   └── error.tsx
│   ├── actions/                    ← 'use server' files, one per area
│   │   ├── auth.ts  clients.ts  services.ts  reminders.ts  payments.ts
│   │   ├── notifications.ts  settings.ts  import.ts
│   ├── components/
│   │   ├── ui/                     ← shadcn/ui primitives (button, dialog, dropdown-menu, tabs, input, select, switch, toast…)
│   │   ├── layout/                 ← sidebar.tsx, topbar.tsx, bottom-nav.tsx, notification-bell.tsx
│   │   ├── timer-pill.tsx          ← client component, live countdown
│   │   ├── status-badge.tsx
│   │   ├── stat-card.tsx
│   │   ├── reminder-queue.tsx      ← client component (send-all, WhatsApp, skip)
│   │   ├── services-table.tsx      ← table on desktop, cards on mobile
│   │   ├── renew-dialog.tsx
│   │   ├── client-form.tsx  service-form.tsx
│   │   ├── confirm-dialog.tsx  empty-state.tsx  otp-input.tsx
│   ├── hooks/
│   │   └── use-now.ts              ← one shared 1-second ticker for all timers
│   ├── lib/
│   │   ├── domain/                 ← PURE functions, no DB, fully unit-tested
│   │   │   ├── dates.ts            ← todayPK, addOneYear, daysLeft, expiresAtIso
│   │   │   ├── status.ts           ← statusColour
│   │   │   ├── stages.ts           ← parseStages, dueStage
│   │   │   ├── whatsapp.ts         ← normalisePhone, formatPhone, buildWaLink
│   │   │   ├── templates.ts        ← renderTemplate, pickSection, daysText
│   │   │   ├── default-templates.ts
│   │   │   ├── money.ts            ← formatMoney (Decimal-safe)
│   │   │   └── validation.ts       ← zod schemas (client, service, payment, settings)
│   │   ├── server/                 ← 'server-only' modules
│   │   │   ├── db.ts               ← Prisma client singleton
│   │   │   ├── session.ts          ← create/read/destroy session, requireAdmin()
│   │   │   ├── auth.ts             ← password verify, TOTP, recovery codes
│   │   │   ├── throttle.ts         ← login attempt limits (DB-backed)
│   │   │   ├── crypto.ts           ← AES-256-GCM encrypt/decrypt with APP_KEY
│   │   │   ├── settings.ts         ← typed getSettings()/updateSettings()
│   │   │   ├── reminders.ts        ← runCheck, queue queries
│   │   │   ├── mail.ts             ← nodemailer send + HTML wrapper
│   │   │   ├── renewals.ts
│   │   │   ├── audit.ts
│   │   │   └── clock.ts            ← today(); honours FAKE_TODAY only in development
│   │   └── mock/                   ← Phase 1 only: mock data + fake actions (deleted later)
│   └── types/
├── tests/
│   ├── unit/                       ← vitest: dates, status, stages, whatsapp, templates
│   ├── integration/                ← vitest against a test DB: runCheck, renew
│   └── e2e/                        ← playwright: login+2FA, add client, renew
├── public/
│   ├── robots.txt                  ← Disallow: /
│   └── logo.svg
├── .env.example
├── next.config.ts                  ← output: 'standalone', security headers, poweredByHeader: false
├── tailwind / postcss config
├── package.json
├── CLAUDE.md
└── docs/
```

## 4. Request lifecycle

1. **`middleware.ts`** (runs on every request except static assets):
   - Adds the security headers and a per-request **CSP nonce**.
   - If there is no session cookie and the path is not public (`/login`, `/2fa*`, `/forgot`, `/reset/*`, `/api/health`), redirect to `/login`.
   - Middleware only checks that the cookie **exists**. The real validation happens in the server (see the next step), because middleware cannot use Prisma reliably.
2. **`(app)/layout.tsx`** calls `await requireAdmin()`, which loads the session from the DB, checks the idle and absolute timeouts and `stage === 'full'`, then refreshes `last_seen_at`. Otherwise it calls `redirect('/login')`.
3. Pages are **Server Components** that read data directly through `lib/server/*`.
4. Mutations are **Server Actions** in `src/actions/*`. **Every action starts with `await requireAdmin()`**, then validates the input with zod, runs the logic, calls `revalidatePath()` and returns `{ ok, error?, data? }`.
5. Client components (timers, queue, dialogs, forms) call the actions and show toasts.

## 5. Environment variables (`.env.example`)

```dotenv
# Database (Neon: use the pooled URL for the app, the direct URL for migrations)
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/hrm?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/hrm?sslmode=require"

APP_URL="https://renewals.example.com"
APP_KEY="base64:…32 random bytes…"     # encrypts TOTP secrets + SMTP password. Generate: openssl rand -base64 32
SESSION_COOKIE_NAME="hrm_session"
TZ="Asia/Karachi"                       # informational; code never relies on process TZ

# Development only
FAKE_TODAY=""                           # e.g. 2026-10-20, ignored when NODE_ENV=production
SEED_DEMO="0"
```
SMTP settings and templates live in the DB (`settings` table, with the password encrypted) so they can be edited from the UI.

## 6. Coding conventions

- TypeScript `strict: true`. No `any` without a comment explaining why.
- Files are kebab-case, components PascalCase, functions camelCase, and DB models PascalCase with snake_case columns via `@map`.
- `lib/domain/*` must stay pure: no Prisma, no `Date.now()` without a parameter, no env access.
- `lib/server/*` starts with `import 'server-only'`.
- Money is Prisma `Decimal` in the DB. Convert with `Decimal.js` (bundled with Prisma), and never add floats.
- Business dates are always `YYYY-MM-DD` strings in code and `@db.Date` in the DB (see `03-DATABASE.md` §4).
- Only use `'use client'` where interaction is needed. Keep data fetching in server components.
