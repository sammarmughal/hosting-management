# Hosting Renewal Manager

A secure, single-admin web app for tracking which clients' hosting (on our Hostinger plan) is due for its yearly renewal. It shows colour-coded live countdowns, creates an **invoice** for every renewal, and sends reminders and invoices to clients by **email** (PDF attached) and **WhatsApp** (with a secure invoice link).

**Approach: "check on login" plus one daily scheduled check.**
The app runs no background workers. It checks for due reminders and invoices when the admin opens the dashboard, on **Check now**, and once a day at 09:00 PKT from an hPanel cron job. Emails go out with one click (auto-send can be turned on). WhatsApp uses free click-to-chat links (`wa.me`) with a pre-filled message, so there is no Meta API, no extra number and no per-message cost.

**Stack: Next.js 16 + TypeScript + Tailwind/shadcn + Prisma 7 + PostgreSQL (Neon).** Runs on **Hostinger Node.js hosting** (`output: "standalone"`) at https://renewals.abdulrehmaan.net, with the database on **Neon**.

---

## Read in this order

| # | File | What it covers |
|---|------|----------------|
| 1 | [docs/01-PRD.md](docs/01-PRD.md) | Product requirements, user stories, acceptance criteria |
| 2 | [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) | Stack, folder structure, "no-cron" flow, env vars |
| 3 | [docs/03-DATABASE.md](docs/03-DATABASE.md) | Prisma schema, date handling, seed |
| 4 | [docs/04-BUSINESS-LOGIC.md](docs/04-BUSINESS-LOGIC.md) | Days left, colours, reminder stages, check on login, renewals |
| 5 | [docs/05-SECURITY.md](docs/05-SECURITY.md) | Single-admin auth, DB sessions, 2FA, CSP, hardening |
| 6 | [docs/06-UI-SPEC.md](docs/06-UI-SPEC.md) | Design tokens, layout, every screen, components, live timer |
| 7 | [docs/07-ROUTES.md](docs/07-ROUTES.md) | Pages, Server Actions, route handlers |
| 8 | [docs/08-MESSAGES.md](docs/08-MESSAGES.md) | Email and WhatsApp templates, placeholders, phone formatting |
| 9 | [docs/09-TASKS.md](docs/09-TASKS.md) | Phase-by-phase build checklist |
| 10 | [docs/10-TESTING.md](docs/10-TESTING.md) | Vitest, Playwright, manual QA checklist |
| 11 | [docs/11-DEPLOYMENT.md](docs/11-DEPLOYMENT.md) | Neon + Hostinger Node.js, daily cron, go-live, backups |
| 12 | [docs/12-DESIGN-DIRECTION.md](docs/12-DESIGN-DIRECTION.md) | Visual quality bar (wins on visuals) |
| 13 | [docs/13-INVOICES-AND-SHARING.md](docs/13-INVOICES-AND-SHARING.md) | Invoices, PDF, public links, sharing, currency (wins on these) |
| — | [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | Owner's guide in simple English: daily routine, clients, invoices, colours, failed emails |
| — | [docs/ui-review.md](docs/ui-review.md) | UI review log, including the one-month owner walkthrough |
| — | [CLAUDE.md](CLAUDE.md) | Rules for the AI coding assistant |

## Setup (local)

Needs **Node.js 20.9+** (22 recommended) and **PostgreSQL 15+** (local, or a Neon dev branch).

```sh
npm ci                          # also runs `prisma generate` (postinstall)
cp .env.example .env            # fill in the variables below
npm run db:migrate              # applies prisma/migrations
SEED_DEMO=1 npm run db:seed     # settings + templates, plus demo clients and a demo admin
npm run dev                     # http://localhost:3000
```

With `SEED_DEMO=1` the demo admin is `rehman` / `Renewals2026!` (**development only**; never seed demo data in production). The first sign-in asks you to scan a QR code with an authenticator app and to save the recovery codes.

For **production**, don't seed anything: `npm run setup:prod -- --env-file .env.production` checks the environment, applies the migrations and creates the single admin (from `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD` or by asking). No demo or seed data (docs/11 §2). Other admin scripts (there is no sign-up page):

```sh
npm run create-admin            # prompts for username, email, password (-- --force replaces the admin)
npm run reset-2fa               # emergency: turn 2FA off if the phone is lost
npm run backup                  # pg_dump of DIRECT_URL to backups/hrm-YYYY-MM-DD-HHMM.dump (docs/11 §6)
```

After pulling changes to `prisma/schema.prisma`, run `npm run db:migrate` (it applies the migration; with Prisma 7 also run `npx prisma generate` if the client wasn't regenerated).

### Local database without admin rights (Windows)

The official PostgreSQL zip runs from a user folder, with no Windows service:

```powershell
# once: download postgresql-17.x-windows-x64-binaries.zip from enterprisedb.com and unzip to %LOCALAPPDATA%\pgsql17
$pg = "$env:LOCALAPPDATA\pgsql17\pgsql\bin"
& "$pg\initdb.exe" -D "$env:LOCALAPPDATA\pgsql17\data" -U postgres -W -E UTF8 --locale=C   # once
& "$pg\pg_ctl.exe" -D "$env:LOCALAPPDATA\pgsql17\data" -l "$env:LOCALAPPDATA\pgsql17\server.log" start
& "$pg\psql.exe" -U postgres -c "CREATE DATABASE hrm" -c "CREATE DATABASE hrm_test"        # once
```

It does not start with Windows: run the `pg_ctl ... start` line again after a reboot (`pg_ctl ... stop` to stop it).

## Environment variables

| Variable | Required | Used for |
|----------|----------|----------|
| `DATABASE_URL` | yes | The app's database connection. On Neon, the **pooled** URL (`…-pooler…`, `?sslmode=require`). |
| `DIRECT_URL` | yes | Migrations (`prisma migrate deploy`). On Neon, the **direct** URL. |
| `APP_URL` | yes | Public base URL, in production `https://renewals.abdulrehmaan.net`. Used in invoice links (`/i/<token>`) and password-reset emails. In production the server **refuses to start** if it's missing, uses http, or points to localhost. Choose the final domain before sending invoices: old links keep the old domain. |
| `APP_KEY` | yes | `base64:` + 32 random bytes (`openssl rand -base64 32`). Encrypts the TOTP secret and the SMTP password (AES-256-GCM). |
| `SESSION_COOKIE_NAME` | no | Defaults to `hrm_session`. |
| `CRON_SECRET` | yes (production) | 32+ random characters (`openssl rand -hex 32`). The daily check (`/api/cron/check`) requires `Authorization: Bearer <CRON_SECRET>`; the hPanel cron job sends it with curl (docs/11 §4). Without it the route answers 503 and the daily check doesn't run. |
| `TRUSTED_IP_HEADER` | no | The request header holding the visitor's IP, for login throttling and the `/i/*` rate limit. Default `x-forwarded-for` (first value). Verify after deploy (docs/11 §7). |
| `ALLOW_LOCAL_APP_URL` | local only | `1` lets the production build run on this machine with a localhost `APP_URL` (`npm start`, e2e). **Never set on a host**: in production the server refuses to start unless `APP_URL` is the public https URL. |
| `TEST_DATABASE_URL` | dev/CI | A separate, disposable database for integration tests. Wiped by the tests. |
| `E2E_DATABASE_URL` | dev/CI | Disposable database for Playwright; falls back to `TEST_DATABASE_URL`. Wiped by the e2e setup. |
| `MAIL_TRANSPORT` | dev only | `json` = build emails but send nothing (logged). Ignored in production. |
| `FAKE_TODAY` | dev only | e.g. `2026-10-20`, to test reminders and invoices on another date. Ignored in production. |
| `SEED_DEMO` | dev only | `1` loads demo data on `db:seed`. Ignored in production. |

No variable may use the `NEXT_PUBLIC_` prefix: nothing secret is sent to the browser (a test enforces it).

**Rotating `APP_KEY`** makes the stored SMTP password and the TOTP secret unreadable: re-enter the SMTP password in Settings → Email and run `npm run reset-2fa`, then set up 2FA again.

## Configure email (SMTP)

1. Create a mailbox in **hPanel → Emails** (e.g. `billing@abdulrehmaan.net`) and set SPF, DKIM and DMARC for the domain there, so reminders don't land in spam.
2. In the app, **Settings → Email**: host `smtp.hostinger.com`, port `465` with **SSL** (or `587` with **TLS**), username = the full email address, the mailbox password, from email and from name. Check the exact host in hPanel → Emails → Configuration.
3. Press **Send test email**: it goes to the admin email from Settings → Business, using the saved settings.

The password is stored encrypted and never shown again (leave the field empty to keep it). A failed send keeps the mail server's own error on the reminder row (shown in the queue and in the reminder log) and in the invoice history.

**In development**, nothing should reach real clients. Either set `MAIL_TRANSPORT="json"`, or run [Mailpit](https://mailpit.axllent.org/) (`docker run -p 8025:8025 -p 1025:1025 axllent/mailpit`) and point Settings → Email at host `localhost`, port `1025`, encryption `None`; messages appear at http://localhost:8025.

## Configure invoices

**Settings → Business**: business name, an optional **tagline** (e.g. "Senior UI/UX & Product Designer"), phone, admin email and WhatsApp; the **currencies** you bill in (any ISO 4217 currency, from a searchable list; PKR, USD and AED are on by default) and the default currency for new clients. A currency used by a client or service can't be turned off.

**Currency** (docs/13 §6): no conversion. Each client has their own currency (e.g. PKR for a Pakistani client, AED for a UAE client); new services, and so their invoices and payments, start in it, and a service can override it. Decimal places follow the currency (`PKR 6,500`, `USD 49.99`, `KWD 12.500`). Totals are always shown per currency. In the CSV import, `client_currency` blank means the app default and `currency` blank means the client's currency.

**Settings → Invoices** (docs/13 §11):

- **Number prefix** (default `INV`) → numbers like `INV-2026-0012`, a new sequence each year. The **next number** can be set until the first invoice exists.
- **Create invoices** 15 or 30 days (default) before the renewal date, or a custom number of days. The check creates one invoice per active service per renewal; cancelled services never get one. "Create invoice now" on a service card works any time.
- **Logo** (optional, PNG or JPEG under 200 KB; without one the business name and tagline are shown as a text wordmark on the invoice, PDF, public page and emails, and the sidebar shows the business initials), **business address**, **NTN**, **payment instructions** (bank, account title, account number / IBAN, JazzCash / Easypaisa) and the **footer note**: printed on the invoice and the PDF.
- **Tax** on/off and rate, applied after any discount.

Invoices keep a copy of these details from the moment they're created, so later changes don't alter old invoices. Fill in Settings → Invoices **before** the first check that creates invoices.

**Settings → Templates → Invoice email / Invoice WhatsApp** hold the Share invoice messages, with `{{invoice_number}}`, `{{invoice_link}}`, `{{invoice_total}}` and `{{due_date}}`. The email always attaches the PDF; reminder emails attach the cycle's invoice too, and reminder WhatsApp messages include its link.

Each invoice has a secret public link (`/i/<token>`, 32 random bytes): no login, not indexed, rate limited. **Regenerate link** on the invoice page stops the old link at once.

## Reminders and the daily check

The check runs when the dashboard opens (at most once per *check interval*, Settings → Reminders), from **Check now**, and **once a day at 04:00 UTC (09:00 PKT)** through `/api/cron/check`, called by an hPanel cron job with curl (docs/11 §4). All of them call the same idempotent `runCheck()` under the same database lock: running it twice queues nothing new and creates no duplicate invoices. The route accepts GET and POST and requires `Authorization: Bearer <CRON_SECRET>` (constant-time compare).

WhatsApp uses `wa.me` click-to-chat links only (`WhatsAppProvider` "link" in `src/lib/domain/whatsapp.ts`): the link is built on the server, the browser opens it in the click handler, and the admin presses Send in WhatsApp.

## Tests

```sh
npm run lint
npm test                         # unit tests + integration tests (when TEST_DATABASE_URL is set)
npm run build && npm run test:e2e   # Playwright against the standalone production build
```

- Integration tests (`tests/integration`) use `TEST_DATABASE_URL`, migrated automatically and truncated by the tests; mail uses `jsonTransport`, and one test uses a closed port to check that real SMTP errors are stored.
- The e2e tests (`tests/e2e`, docs/13 §12) migrate and wipe `E2E_DATABASE_URL`, seed an admin with a known TOTP secret, start a local SMTP catcher and the standalone server on port 3200, then walk client → check → invoice → email with PDF → public link → PDF download → mark as paid, and the currency flow (add a currency in Settings → a client in AED → the in-use lock).
- `tests/unit/action-guards.test.ts` fails if a Server Action or route handler is added without its `requireAdmin()` guard.

## Production build

```sh
npm run build    # next build + postbuild (copies public/ and .next/static into .next/standalone, removes .env from it)
npm start        # node .next/standalone/server.js, with ./.env loaded if present; PORT sets the port
```

See [docs/11-DEPLOYMENT.md](docs/11-DEPLOYMENT.md) for Neon, Hostinger and the daily cron job.

## Key decisions at a glance

| Topic | Decision |
|-------|----------|
| Framework | Next.js (App Router), TypeScript strict, Node runtime (not Edge) |
| UI | Tailwind CSS + shadcn/ui + lucide-react. No external CDNs |
| Database | PostgreSQL on Neon via Prisma 7 (`@prisma/adapter-pg`), TLS, point-in-time restore |
| Hosting | Hostinger Node.js app (Business/Cloud plan), `https://renewals.abdulrehmaan.net`. No other host |
| Users | Exactly one admin. No sign-up. Created with `npm run create-admin` |
| Auth | Argon2id password + mandatory TOTP 2FA + DB-backed sessions + login throttling |
| Mutations | Server Actions, each starting with `requireAdmin()` (enforced by a test) |
| Background jobs | No workers. Checks run on dashboard load (throttled), via "Check now", and once a day from an hPanel cron job calling `/api/cron/check` with curl |
| Email | nodemailer over Hostinger SMTP. One email per request (keeps each request short) |
| WhatsApp | `wa.me` links with the invoice link in the text, sent by the admin with one tap. No paid API for now |
| Invoices | One per service per renewal, numbered per year, PDF generated on demand (`@react-pdf/renderer`, Geist) |
| Colours | Green > 30 days · Orange 8–30 · Red 0–7 · Expired < 0 (limits configurable) |
| Reminder stages | 30, 15, 7, 3, 1, 0 days before; after expiry at 3, 6 and 9 days overdue |
| Dates | `YYYY-MM-DD` strings in code, `Asia/Karachi` "today", `@db.Date` in the DB |
| Currency | Any ISO 4217 currency, no conversion. Each client has their own currency; services start in it and can override it; totals are always per currency, never added across |

## Running costs (approximate, check current pricing)

| Item | Cost |
|------|------|
| Hostinger Business/Cloud | the existing plan (Node.js apps need Business or Cloud) |
| Neon Postgres | free tier is enough to start |
| Email | the existing Hostinger mailbox |
| WhatsApp | free (click-to-chat) |
