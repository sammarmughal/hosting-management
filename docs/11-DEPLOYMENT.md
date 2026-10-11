# 11 — Deployment (Vercel primary · Hostinger Node.js alternative)

The same code and the same Neon database work on both hosts. Pick one as **production** (Vercel) and keep the other as an option. Don't run both against the same database at the same time unless you understand that they share the data (which is fine, but confusing).

> Hosting dashboards change. The steps describe *what* to set up. Look for the matching option if a name differs.

## 1. Database (Neon), once
1. Create a Neon project → database `hrm`. Choose a region near the app region (Vercel functions default to US East; set the Vercel function region to **Singapore (sin1)** or Frankfurt for lower latency from Pakistan, and put Neon in the same region).
2. Copy two connection strings:
   - **Pooled** (`…-pooler…`) → `DATABASE_URL` (used by the app)
   - **Direct** → `DIRECT_URL` (used by migrations)
3. From your machine, run:
   ```bash
   DATABASE_URL=… DIRECT_URL=… npx prisma migrate deploy
   DATABASE_URL=… DIRECT_URL=… npx prisma db seed           # settings + templates
   DATABASE_URL=… npm run create-admin                        # the single admin
   ```
4. Neon keeps point-in-time restore history (how far back depends on the plan). Also do a monthly `pg_dump` (see §5).

## 2. Vercel (production)
1. Push the repo to a **private** GitHub repository.
2. Vercel → **Add New Project** → import the repo. The framework is detected as Next.js, the build command is `npm run build`, and the output is the default.
3. **Environment Variables** (Production scope):
   `DATABASE_URL`, `DIRECT_URL`, `APP_URL=https://renewals.ourdomain.com`, `APP_KEY`, `CRON_SECRET` (`openssl rand -hex 32`), `SESSION_COOKIE_NAME`, and optionally `TRUSTED_IP_HEADER` (§5). Do **not** set `FAKE_TODAY`, `SEED_DEMO`, `MAIL_TRANSPORT` or `ALLOW_LOCAL_APP_URL`.
   - `APP_URL` must be the real public **https** URL: invoice links (`/i/<token>`) and reset emails are built from it. In production the server **refuses to start** if it is missing, uses http, or points to localhost (`src/instrumentation.ts`); the logs then show `Refusing to start: …`.
4. `package.json` already has `"postinstall": "prisma generate"` (Prisma Client is generated into `src/generated/prisma` on every install, including on Vercel).
5. Settings → **Functions** → region `sin1` (or the one matching Neon).
6. Settings → **Deployment Protection** → turn on for Preview deployments.
7. **Custom domain:** add `renewals.ourdomain.com` in Vercel → it shows a DNS record (a CNAME to Vercel) → add that record in **Hostinger hPanel → Domains → DNS Zone** for `ourdomain.com`. SSL is automatic.
8. **Plan:** this is business use, so use **Vercel Pro**. The free Hobby plan is for non-commercial projects.
9. **Daily check (Vercel Cron):** `vercel.json` schedules `/api/cron/check` at `0 4 * * *` (04:00 UTC = 09:00 PKT). Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when the `CRON_SECRET` env var is set. After the first deploy, Vercel → Project → **Settings → Cron Jobs** lists the job and **Run** triggers it; the response is the check's counts (JSON). Without `CRON_SECRET` the route answers 503 and nothing runs.

Migrations on later releases: run `npx prisma migrate deploy` from your machine (or a GitHub Action) **before** promoting the new deployment.

## 3. Hostinger Node.js (alternative / backup host)
Available on Hostinger **Business web hosting** and **Cloud** plans (not on lower shared plans). A VPS also works.

1. hPanel → **Websites → Add website → Node.js app** (the name may vary).
2. Deploy from **GitHub** (recommended, as it rebuilds automatically on push) or **upload a .zip** (exclude `node_modules`, `.next` and `.git`).
3. Settings:
   | Field | Value |
   |-------|-------|
   | Framework preset | Next.js (auto-detected) |
   | Node.js version | 20 or 22 |
   | Build command | `npm run build` |
   | Output / entry | Use what the Next.js preset suggests. If it asks for an entry file with the `standalone` output, use `.next/standalone/server.js`. The `postbuild` script (`scripts/postbuild.mjs`) already copies `public/` and `.next/static/` next to it and removes any `.env` file from the build output, so never upload a local `.env`; set the variables in hPanel. The server listens on `PORT`. |
4. Add the **same environment variables** as on Vercel (with `APP_URL` = the Hostinger domain).
5. Connect the domain or subdomain and turn on the free SSL. Force HTTPS.
6. Test: `/api/health` returns `ok`, and login + 2FA works.
7. **Daily check (cron entry).** Hostinger doesn't read `vercel.json`, so add a cron job that calls the endpoint with the secret: hPanel → **Advanced → Cron Jobs** (or `crontab -e` on a VPS), daily at 09:00 PKT, i.e. `0 4 * * *` if the server clock is UTC or `0 9 * * *` if it is Asia/Karachi. Command:
   ```sh
   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://renewals.ourdomain.com/api/cron/check > /dev/null
   ```
   Test it once by hand: it prints nothing and exits 0; with a wrong secret `curl -f` exits 22 (HTTP 401). Keep the secret out of shared screenshots (anyone with it can trigger the check, which is harmless and idempotent). If the plan has no cron, any external scheduler that can send that header works the same way.

> If you later want the database on Hostinger too, switch Prisma to MySQL (see `02-ARCHITECTURE.md` §1 note) and run a fresh migration on the Hostinger MySQL.

## 4. Configure in the app (first login)
1. Log in → scan the 2FA QR on the owner's phone → save the recovery codes offline.
2. Settings → **Business:** name, phone, admin email, admin WhatsApp.
3. Create a mailbox in **hPanel → Emails** (e.g. `billing@ourdomain.com`). Settings → **Email:** SMTP host/port/user/password → **Send test email**.
   - SMTP from Vercel works over port 465 (SSL) or 587 (STARTTLS). Check hPanel → Emails → Configuration for the exact host.
   - Make sure SPF/DKIM/DMARC are set for `ourdomain.com` (hPanel → Emails → DNS), otherwise the reminders may go to spam.
4. Settings → **Templates:** review the wording with the owner.
5. **Import** the real client list (CSV).

## 5. Go-live checks
- [ ] HTTPS padlock on the custom domain, and the HSTS header is present.
- [ ] Logged out → every page redirects to `/login`.
- [ ] Login + 2FA works on the owner's phone.
- [ ] A test email lands in the Gmail inbox (not spam).
- [ ] The WhatsApp button opens the right chat with the right text on the owner's phone.
- [ ] Dashboard numbers match the owner's expectations after the import.
- [ ] Vercel preview deployments require login (Deployment Protection).
- [ ] `robots.txt` disallows everything, and the `X-Robots-Tag` header is present.
- [ ] The daily check runs: trigger it once (Vercel → Cron Jobs → Run, or the curl command) and "Last checked" on the dashboard updates. A request without the secret gets 401.
- [ ] The client IP is read from a trusted header (below).

### Verify the client IP (TRUSTED_IP_HEADER)
Login throttling, the audit log and the `/i/*` rate limit use the visitor's IP from the header named by `TRUSTED_IP_HEADER` (default `x-forwarded-for`, first value). Only trust a header that your host's proxy **sets or overwrites** itself: if a visitor can send it freely, they can dodge the per-IP limits (the per-username login lock still protects the admin account).

1. Sign in from a normal connection and open **Settings → Security → Recent logins**. The IP shown must be your real public IP (compare with any "what is my IP" page). If it shows the proxy's own address or `unknown`, the header is wrong.
2. Sign in once more with a browser extension (e.g. "ModHeader") adding `X-Forwarded-For: 203.0.113.99`. Recent logins must still show your real IP, not `203.0.113.99`.
3. **Vercel:** the default works (Vercel overwrites `x-forwarded-for` with the real client IP; `x-vercel-forwarded-for` also works). **Hostinger:** if step 2 shows `203.0.113.99`, the proxy appends instead of overwriting. Set `TRUSTED_IP_HEADER` to the header it does set itself (often `x-real-ip`), redeploy, and repeat.

## 6. Backups
- Neon point-in-time restore (by plan).
- Monthly: `pg_dump "$DIRECT_URL" > hrm-YYYY-MM.sql` from your machine, stored privately (e.g. the owner's Google Drive).
- In-app **Export services CSV** + **Export payments CSV** monthly, as a human-readable backup.

## 7. Updating later
1. Work on a branch → the Vercel preview deploy is tested (against a **Neon branch** database, never production).
2. If `schema.prisma` changed: `npx prisma migrate dev` locally → commit the migration → `npx prisma migrate deploy` on production before or with the release.
3. Merge to `main` → Vercel deploys to production. (Hostinger, if connected to GitHub, rebuilds too.)
