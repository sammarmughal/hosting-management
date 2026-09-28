# Hosting Renewal Manager — Development Docs

A secure, single-admin web app for tracking which clients' hosting (on our Hostinger plan) is due for its yearly renewal. It shows colour-coded live countdowns and helps send renewal reminders to the client and the admin by **email** and **WhatsApp**.

**Approved approach: Option 1, "check on login" with no cron job.**
The app never runs background jobs. It checks for due reminders when the admin opens the dashboard. Emails go out with one click (auto-send can be turned on). WhatsApp uses free click-to-chat links (`wa.me`) with a pre-filled message, so there is no Meta API, no extra number and no per-message cost.

**Stack: Next.js + TypeScript + Tailwind/shadcn + Prisma + PostgreSQL (Neon).** Deployed on **Vercel**, and it also runs on **Hostinger Node.js hosting**.

---

## Read in this order

| # | File | What it covers |
|---|------|----------------|
| 1 | [docs/01-PRD.md](docs/01-PRD.md) | Product requirements, user stories, acceptance criteria |
| 2 | [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md) | Stack, folder structure, "no-cron" flow, env vars |
| 3 | [docs/03-DATABASE.md](docs/03-DATABASE.md) | Full Prisma schema (copy-paste ready), date handling, seed |
| 4 | [docs/04-BUSINESS-LOGIC.md](docs/04-BUSINESS-LOGIC.md) | Days left, colours, reminder stages, check on login, renewals |
| 5 | [docs/05-SECURITY.md](docs/05-SECURITY.md) | Single-admin auth, DB sessions, 2FA, CSP, hardening |
| 6 | [docs/06-UI-SPEC.md](docs/06-UI-SPEC.md) | Design tokens, layout, every screen, components, live timer, mock-data plan |
| 7 | [docs/07-ROUTES.md](docs/07-ROUTES.md) | Pages, Server Actions, route handlers |
| 8 | [docs/08-MESSAGES.md](docs/08-MESSAGES.md) | Email and WhatsApp templates, placeholders, phone formatting |
| 9 | [docs/09-TASKS.md](docs/09-TASKS.md) | Phase-by-phase build checklist (start here when coding) |
| 10 | [docs/10-TESTING.md](docs/10-TESTING.md) | Vitest, Playwright, manual QA checklist |
| 11 | [docs/11-DEPLOYMENT.md](docs/11-DEPLOYMENT.md) | Neon + Vercel + Hostinger Node.js, go-live, backups |
| — | [CLAUDE.md](CLAUDE.md) | Rules for the AI coding assistant in VS Code |

## Next step

Create the Next.js project (Phase 0), then build **Phase 1: UI with mock data** from `docs/09-TASKS.md`, following `docs/06-UI-SPEC.md`. All screens are built in the real app with mock data, before the database and auth.

## Key decisions at a glance

| Topic | Decision |
|-------|----------|
| Framework | Next.js (App Router, latest stable), TypeScript strict, Node runtime (not Edge) |
| UI | Tailwind CSS + shadcn/ui + lucide-react. No external CDNs |
| Database | PostgreSQL on Neon via Prisma. Reachable from both Vercel and Hostinger |
| Hosting | Vercel (production, **Pro plan** for business use). Hostinger Node.js (Business/Cloud plan) as an alternative |
| Users | Exactly one admin. No sign-up. Created with `npm run create-admin` |
| Auth | Argon2id password + mandatory TOTP 2FA + DB-backed sessions + login throttling |
| Mutations | Server Actions, each starting with `requireAdmin()` |
| Background jobs | **None.** Checks run on dashboard load (throttled) and via a "Check now" button |
| Email | nodemailer over Hostinger SMTP. Sent one per request (safe for serverless) |
| WhatsApp | `https://wa.me/<number>?text=<message>` links, sent by the admin with one tap |
| Colours | Green > 30 days · Orange 8–30 · Red 0–7 · Expired < 0 (limits configurable) |
| Reminder stages | 30, 15, 7, 3, 1, 0 days before; after expiry at 3, 6 and 9 days overdue |
| Dates | `YYYY-MM-DD` strings in code, `Asia/Karachi` "today", `@db.Date` in the DB |
| Currency | PKR by default. Each service stores its own amount and currency |

## Running costs (approximate, check current pricing)

| Item | Cost |
|------|------|
| Vercel Pro | paid monthly per member (required for commercial use). Alternatively Hostinger Business/Cloud, which may already be paid for |
| Neon Postgres | free tier is enough to start |
| Email | the existing Hostinger mailbox |
| WhatsApp | free (click-to-chat) |
