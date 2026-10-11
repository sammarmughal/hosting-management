# 11 — Deployment (Hostinger Node.js + Neon Postgres)

Owner decision (11 Oct 2026): the app runs on **Hostinger** as a Node.js app, and the database is **PostgreSQL on Neon**. There is no other host. Production URL: **https://renewals.abdulrehmaan.net**.

> Hosting dashboards change. The steps describe *what* to set up. Look for the matching option if a name differs.

## 1. Database (Neon), once
1. Create a Neon project → database `hrm`. Pick the region closest to the Hostinger server (check hPanel → the website's server location; for a server in Asia or Europe choose **Singapore** or **Frankfurt**).
2. Copy two connection strings from Neon → **Connect**:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL` (used by the app)
   - **Direct** → `DIRECT_URL` (used by migrations)
   Both end with `?sslmode=require`; keep it.
3. From your machine, run:
   ```bash
   DATABASE_URL=… DIRECT_URL=… npx prisma migrate deploy
   DATABASE_URL=… DIRECT_URL=… npx prisma db seed           # settings + templates
   DATABASE_URL=… npm run create-admin                        # the single admin
   ```
4. Neon keeps point-in-time restore history (how far back depends on the plan). Also do a monthly `pg_dump` (see §6).

## 2. Environment variables
Set these in hPanel → the Node.js app → **Environment variables** (never upload a `.env` file):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon **pooled** connection string |
| `DIRECT_URL` | Neon **direct** connection string |
| `APP_URL` | `https://renewals.abdulrehmaan.net` |
| `APP_KEY` | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts the TOTP secret and the SMTP password; don't change it later |
| `CRON_SECRET` | 32+ random characters (`openssl rand -hex 32`). Required: the daily check (§4) sends it |
| `SESSION_COOKIE_NAME` | e.g. `hrm_session` |
| `TRUSTED_IP_HEADER` | optional, default `x-forwarded-for` (§7) |

Do **not** set `FAKE_TODAY`, `SEED_DEMO`, `MAIL_TRANSPORT` or `ALLOW_LOCAL_APP_URL`.

`APP_URL` must be the real public **https** URL: invoice links (`/i/<token>`) and reset emails are built from it. In production the server **refuses to start** if it is missing, uses http, or points to localhost (`src/instrumentation.ts`); the app log then shows `Refusing to start: …`.

## 3. Hostinger Node.js app
Node.js apps are available on Hostinger **Business web hosting** and **Cloud** plans (not on lower shared plans). A VPS also works.

1. Push the repo to a **private** GitHub repository.
2. hPanel → **Websites → Add website → Node.js app** (the name may vary).
3. Deploy from **GitHub** (recommended: it rebuilds on every push to `main`) or **upload a .zip** (exclude `node_modules`, `.next`, `.git` and any `.env*` file).
4. Settings:
   | Field | Value |
   |-------|-------|
   | Framework preset | Next.js (auto-detected) |
   | Node.js version | 20 or 22 |
   | Install command | `npm ci` (runs `prisma generate` through `postinstall`) |
   | Build command | `npm run build` |
   | Entry file / start | `.next/standalone/server.js` (or `npm start`, which runs the same file). The `postbuild` script (`scripts/postbuild.mjs`) copies `public/` and `.next/static/` next to it and removes any `.env` file from the build output. The server listens on `PORT`, which Hostinger sets. |
5. Add the environment variables from §2, then redeploy.
6. **Domain:** connect `renewals.abdulrehmaan.net` to the app (hPanel → the app → **Domains**; if `abdulrehmaan.net` is managed in Hostinger, the DNS record is added for you, otherwise add the record hPanel shows at your DNS provider). Turn on the free SSL certificate and **Force HTTPS**.
7. Test: `https://renewals.abdulrehmaan.net/api/health` returns `ok`, and login + 2FA works.

> If you later want the database on Hostinger too, switch Prisma to MySQL (see `02-ARCHITECTURE.md` §1 note) and run a fresh migration on the Hostinger MySQL.

## 4. Daily check (hPanel Cron Jobs)
The app runs no background workers. Once a day a cron job calls `/api/cron/check`, which runs the same idempotent check as **Check now** (reminders queued, invoices created, under the same lock, so a double call does nothing extra). The endpoint accepts `POST` and `GET`, and needs `Authorization: Bearer <CRON_SECRET>` (compared in constant time). Without the header, or with a wrong secret, it answers **401**; if `CRON_SECRET` isn't set on the server it answers **503** and nothing runs.

1. hPanel → **Advanced → Cron Jobs** → **Custom** command (on a VPS: `crontab -e`).
2. Schedule: daily at 09:00 PKT. hPanel cron runs on the server clock, which is usually UTC: `0 4 * * *`. If the server clock is Asia/Karachi, use `0 9 * * *`.
3. Command (replace the secret with the value of `CRON_SECRET`):
   ```sh
   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://renewals.abdulrehmaan.net/api/cron/check > /dev/null
   ```
   `-f` makes curl exit non-zero on a 401/503, so hPanel's cron log shows a failure.
4. Test it once by hand from your machine:
   ```sh
   curl -sS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://renewals.abdulrehmaan.net/api/cron/check
   ```
   It prints the check's counts as JSON, and "Last checked" on the dashboard updates. With a wrong secret it prints `{"error":"Unauthorized"}` (HTTP 401).
5. Keep the secret out of shared screenshots. Anyone with it can only trigger the check, which is harmless and idempotent; still, rotate it (new value in the env vars **and** the cron command) if it leaks.

## 5. Configure in the app (first login)
1. Log in → scan the 2FA QR on the owner's phone → save the recovery codes offline.
2. Settings → **Business:** name, phone, admin email, admin WhatsApp. **Currencies:** PKR, USD and AED are on; add any other ISO currency a client pays in (e.g. SAR) with **Add currency**, and pick the default for new clients. A currency used by a client or service can't be turned off.
3. Create a mailbox in **hPanel → Emails** (e.g. `billing@abdulrehmaan.net`). Settings → **Email:** SMTP host/port/user/password → **Send test email**.
   - Hostinger SMTP works over port 465 (SSL) or 587 (STARTTLS). Check hPanel → Emails → Configuration for the exact host.
   - Make sure SPF/DKIM/DMARC are set for the sending domain (hPanel → Emails → DNS), otherwise the reminders may go to spam.
4. Settings → **Templates:** review the wording with the owner.
5. **Import** the real client list (CSV). Use `client_currency` for clients who don't pay in the default currency (e.g. `AED` for a UAE client); leave it blank for the default.

## 6. Backups
- Neon point-in-time restore (by plan).
- Monthly: `pg_dump "$DIRECT_URL" > hrm-YYYY-MM.sql` from your machine, stored privately (e.g. the owner's Google Drive).
- In-app **Export services CSV** + **Export payments CSV** monthly, as a human-readable backup.

## 7. Go-live checks
- [ ] HTTPS padlock on `renewals.abdulrehmaan.net`, http redirects to https, and the HSTS header is present.
- [ ] `/api/health` returns `ok`.
- [ ] Logged out → every page redirects to `/login`.
- [ ] Login + 2FA works on the owner's phone.
- [ ] A test email lands in the Gmail inbox (not spam).
- [ ] The WhatsApp button opens the right chat with the right text on the owner's phone (wa.me link; no WhatsApp API).
- [ ] Dashboard numbers match the owner's expectations after the import (totals per currency).
- [ ] `robots.txt` disallows everything, and the `X-Robots-Tag` header is present.
- [ ] The daily check runs: run the curl test from §4 and "Last checked" on the dashboard updates. A request without the secret gets 401. The next morning, hPanel's cron log shows a successful run.
- [ ] The client IP is read from a trusted header (below).

### Verify the client IP (TRUSTED_IP_HEADER)
Login throttling, the audit log and the `/i/*` rate limit use the visitor's IP from the header named by `TRUSTED_IP_HEADER` (default `x-forwarded-for`, first value). Only trust a header that Hostinger's proxy **sets or overwrites** itself: if a visitor can send it freely, they can dodge the per-IP limits (the per-username login lock still protects the admin account).

1. Sign in from a normal connection and open **Settings → Security → Recent logins**. The IP shown must be your real public IP (compare with any "what is my IP" page). If it shows the proxy's own address or `unknown`, the header is wrong.
2. Sign in once more with a browser extension (e.g. "ModHeader") adding `X-Forwarded-For: 203.0.113.99`. Recent logins must still show your real IP, not `203.0.113.99`.
3. If step 2 shows `203.0.113.99`, Hostinger's proxy appends to `x-forwarded-for` instead of overwriting it. Set `TRUSTED_IP_HEADER` to the header it does set itself (often `x-real-ip`), redeploy, and repeat steps 1–2.

## 8. Updating later
1. Work on a branch and test locally against a **Neon branch** database (never the production database). For a bigger change, a second Hostinger Node.js app on a staging subdomain (e.g. `staging.abdulrehmaan.net`) with its own Neon branch works the same way.
2. If `schema.prisma` changed: `npx prisma migrate dev` locally → commit the migration → run `npx prisma migrate deploy` against production (`DIRECT_URL`) **before** the new code goes live.
3. Merge to `main` → Hostinger rebuilds and restarts the app (GitHub deploy), or upload the new .zip.
