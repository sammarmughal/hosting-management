# CLAUDE.md — Instructions for the AI coding assistant

You are helping build **Hosting Renewal Manager**, a single-admin **Next.js** app that tracks client hosting renewals, shows colour-coded live countdowns, and helps send reminders by email and WhatsApp click-to-chat links. **There is no cron.**

## Always read first
- `README.md` → key decisions
- `docs/09-TASKS.md` → which phase we are in, and tick items when they are done
- The spec file for the area you are touching (`docs/0X-*.md`). **The docs are the source of truth. If code and docs disagree, ask before changing either.**

## Stack (don't add anything else without asking)
Next.js App Router · TypeScript strict · Tailwind + shadcn/ui + lucide-react · Prisma + PostgreSQL (Neon) · zod · react-hook-form · @node-rs/argon2 · otplib · qrcode · nodemailer · papaparse · sonner · Vitest · Playwright.

## Hard rules
1. **No cron, no Vercel Cron, no background workers, no polling loops.** Reminder checks run only through `runCheck()` from the dashboard page or `checkNowAction`.
2. **No WhatsApp API.** Only `https://wa.me/<digits>?text=<encodeURIComponent(msg)>` links.
3. **Security** (`docs/05-SECURITY.md`):
   - **Every Server Action and route handler starts with `await requireAdmin()`** (the auth actions use the password-stage guard). The layout check alone is NOT enough.
   - `middleware.ts` is only a convenience redirect, never the security boundary.
   - Validate every action input with zod. Prisma only, and never `$queryRawUnsafe`.
   - Never use `dangerouslySetInnerHTML`, except for the locally generated QR SVG.
   - No third-party scripts, fonts, analytics or QR services. No secrets in `NEXT_PUBLIC_*`.
   - Server-only modules start with `import 'server-only'`.
4. **Runtime:** Node.js only (`export const runtime = 'nodejs'` where relevant). Never Edge for anything touching Prisma, argon2 or nodemailer.
5. **Dates:** business dates are `'YYYY-MM-DD'` strings everywhere in code. "Today" = `todayPK()` (`Asia/Karachi`). Convert at the DB boundary with `toDbDate`/`fromDbDate`. Never use `new Date()` arithmetic on business dates, and never use `CURRENT_DATE` in SQL.
6. **Money:** Prisma `Decimal`. Pass it to components as a string, format it with `formatMoney()`, and never sum JS floats.
7. Thresholds and reminder stages come from **settings** (defaults 30/7 and `30,15,7,3,1,0,-3,-6,-9`). The server and `TimerPill` use the same `statusColour()` function.
8. `src/lib/domain/*` stays **pure** (no Prisma, no env, no implicit `Date.now()`) and fully unit-tested.
9. Pages are server components by default. Add `'use client'` only for interactive pieces.
10. Keep every server request short: one email per action call (serverless time limits).

## Style
- Prettier with the Tailwind plugin. ESLint clean.
- Files are kebab-case, components PascalCase, and hooks `use-*.ts`.
- Use Tailwind classes from the design tokens (`bg-brand-700`, `text-ink-muted`, …) and don't hard-code hex values in components.
- UI text is in English, short and friendly. Dates show as `30 Sep 2026`, and money as `PKR 6,500`.
- Mobile-first. Test at 360 px.

## Workflow
- Work one checklist item at a time from `docs/09-TASKS.md`. After each item: `npm run lint && npm test`, then tick the box.
- For domain logic, write or update the Vitest test first (`docs/10-TESTING.md` lists the cases).
- Don't add features that aren't in the docs. Suggest them instead.
- When unsure about behaviour, check `docs/04-BUSINESS-LOGIC.md`. If it isn't covered there, ask.

## Current phase
**Phase 1 — UI with mock data** (`docs/06-UI-SPEC.md` §4, §5 and §7). Components must use the view-model types in `src/types/view.ts`, so the mock data can later be swapped for Prisma without UI changes.
