# 11 — Deployment (Hostinger Node.js + Hostinger MySQL/MariaDB)

Owner decision (13 Oct 2026, replaces the Neon plan of 11 Oct): **everything runs on Hostinger**. The app is a Hostinger Node.js app, and the database is the **MySQL/MariaDB database that comes with the same Hostinger plan, on the same server**. There is no other host. Production URL: **https://renewals.abdulrehmaan.net**.

> Hosting dashboards change. The steps describe *what* to set up. Look for the matching option if a name differs.

## 1. Database (hPanel), once
1. hPanel → **Databases → MySQL Databases** (called "Management" on some plans). Create:
   - a database, e.g. `hrm`. Hostinger adds your account prefix, so it becomes something like `u123456789_hrm`.
   - a user for it, e.g. `hrm`, which becomes `u123456789_hrm`, with a long random password. hPanel gives this user all rights on that one database, which is what the app and the migrations need.
2. **Check the host.** The list of databases in hPanel shows a **MySQL host** for each one. In phpMyAdmin (hPanel → Databases → phpMyAdmin → **Enter phpMyAdmin**), the **Database server** box on the home page shows it as **Server: Localhost via UNIX socket**, or similar.
   - If it says `localhost` (normal when the Node.js app and the database are on the same plan), use `localhost`.
   - If it shows a hostname or IP instead (e.g. `srv1234.hstgr.io`), the database is on another server. Use that host in the URL below. It may also need **Remote MySQL** (step 4).
3. **Note the version.** The same phpMyAdmin box shows **Server version** (e.g. `11.8.x-MariaDB` or `8.0.x - MySQL`). Set the same version in `docker-compose.yml` (`image: mariadb:11.8`, or `mysql:8.0` for MySQL) so local development and tests use the same server. The app needs **MariaDB 10.6+ or MySQL 8.0+**: `SKIP LOCKED` is used for the daily-check lock.
4. **Remote MySQL** (hPanel → Databases → Remote MySQL) stays **off** in normal use. The app connects locally. Turn it on for your own IP only if you must run a script from your PC (see §2), and turn it off again afterwards.
5. **Character set:** the migrations create every table as `utf8mb4` / `utf8mb4_unicode_ci`, whatever the database's default. In phpMyAdmin → the database → **Operations → Collation**, `utf8mb4_unicode_ci` is the right setting, but the app doesn't depend on it.
6. Set up the database with the production setup script (§2 below), not with `db:seed`. It applies the migrations and creates the admin, and loads **no demo or seed data**.

### The connection string
```
DATABASE_URL="mysql://u123456789_hrm:PASSWORD@localhost:3306/u123456789_hrm"
```
- User and database are the full names with the prefix, exactly as hPanel shows them.
- **URL-encode** special characters in the password: `@` → `%40`, `#` → `%23`, `/` → `%2F`, `:` → `%3A`, `%` → `%25`. A password made of letters and digits only avoids this.
- No `?sslmode` or other parameters are needed for `localhost`.

### Why the app uses at most 5 connections
Hostinger shared and Business hosting limit how many connections one database user may have open at a time. Over the limit, MySQL refuses new connections with `max_user_connections` errors, and pages fail. The app's pool is capped at **5 connections** in code (`CONNECTION_LIMIT` in `src/lib/db-config.ts`), not in the URL. That is plenty for one admin plus the daily check, and it leaves room for a migration or a backup to connect at the same time. Requests above 5 at once wait briefly for a free connection instead of opening more.

## 2. Environment variables
Set these in hPanel → the Node.js app → **Environment variables** (never upload a `.env` file):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `mysql://u123456789_hrm:PASSWORD@localhost:3306/u123456789_hrm` (§1) |
| `APP_URL` | `https://renewals.abdulrehmaan.net` |
| `APP_KEY` | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts the TOTP secret and the SMTP password; don't change it later |
| `CRON_SECRET` | 32+ random characters (`openssl rand -hex 32`). Required: the daily check (§4) sends it |
| `SESSION_COOKIE_NAME` | e.g. `hrm_session` |
| `TRUSTED_IP_HEADER` | optional, default `x-forwarded-for` (§7) |
| `GOOGLE_CLIENT_ID` | optional: the OAuth client ID for **Sign in with Google** (§2a) |
| `GOOGLE_CLIENT_SECRET` | optional: its client secret (§2a). Secret |
| `ADMIN_EMAILS` | optional: `abdulrehmaan060@gmail.com`, the only Google account(s) allowed to sign in, comma-separated (§2a) |
| `PASSWORD_LOGIN_ENABLED` | optional, default `1`. `0` leaves only Sign in with Google (§2a, step 8) |

Do **not** set `FAKE_TODAY`, `SEED_DEMO`, `MAIL_TRANSPORT` or `ALLOW_LOCAL_APP_URL`.

`APP_URL` must be the real public **https** URL: invoice links (`/i/<token>`) and reset emails are built from it. In production the server **refuses to start** if it is missing, uses http, or points to localhost (`src/instrumentation.ts`); the app log then shows `Refusing to start: …`.

### Where to run the database scripts
`setup:prod`, `npm run backup` and `prisma migrate deploy` need to reach the database. With the host `localhost`, that works **only on the Hostinger server itself**, not from your PC. Two ways:

- **Over SSH (recommended).** hPanel → **Advanced → SSH Access** → enable it and note the command (e.g. `ssh -p 65002 u123456789@1.2.3.4`). On the server, use a separate checkout of the repo for these tools, not the live app folder:
  ```sh
  git clone git@github.com:<you>/hosting-management.git ~/hrm-tools   # or upload a .zip
  cd ~/hrm-tools && npm ci
  ```
  Put `.env.production` there (below) and run the scripts from that folder. `node -v` must show 20 or newer. If it doesn't, pick the version in hPanel's Node.js settings or use the full path hPanel shows.
- **From your PC, temporarily.** Turn on hPanel → Databases → **Remote MySQL** for your own IP. Use the server's MySQL hostname (shown on that page) instead of `localhost` in `.env.production`, run the script, then **remove the IP again**.

### First-time database setup: `npm run setup:prod`
Run once, over SSH (above), before the first deploy goes live:

1. Create `.env.production` in that folder (it is git-ignored; delete it afterwards or keep it somewhere private) with the same values as the table above, plus the admin's details:
   ```sh
   DATABASE_URL="mysql://u123456789_hrm:PASSWORD@localhost:3306/u123456789_hrm"
   APP_URL="https://renewals.abdulrehmaan.net"
   APP_KEY="base64:…"
   CRON_SECRET="…"
   ADMIN_USERNAME="rehman"            # optional: leave the three ADMIN_ lines out
   ADMIN_EMAIL="billing@abdulrehmaan.net"   # to be asked in the terminal instead
   ADMIN_PASSWORD="…12+ characters…"
   ```
2. Run:
   ```sh
   npm run setup:prod -- --env-file .env.production
   ```
   It checks the variables (and stops with a list of what to fix), shows the database host and asks you to type `yes`, applies the migrations (`prisma migrate deploy` with `DATABASE_URL`; the first one also inserts the `app_locks` row the daily check uses), then creates the admin from the `ADMIN_` variables or by asking for username, email and password (hidden). Add `--yes` to skip the confirmation in a non-interactive shell.
3. Remove `ADMIN_PASSWORD` from the file. Sign in at `/login` and set up two-step verification.

It never loads demo or seed data: there are no clients, and settings and message templates use their built-in defaults until you save them in the app. Running it again is safe: applied migrations are skipped and an existing admin is left unchanged (`npm run create-admin -- --force` replaces the admin; `npm run reset-2fa` turns 2FA off if the phone is lost).

## 2a. Sign in with Google (Google Cloud Console)

Owner decision (13 Oct 2026): `/login` offers **Sign in with Google**, but only for the addresses in `ADMIN_EMAILS` (to start, just `abdulrehmaan060@gmail.com`, the owner's own Google account). Any other Google account gets the same "Invalid credentials." as a wrong password, and the attempt is logged (`login.google_rejected` in the audit log). Google must report the email as verified. Email + password + our 2FA stays available as a fallback (step 8). How it works: docs/05 §3a.

> **Google sign-in skips our own two-step code. Google's 2-Step Verification protects the account instead, so it must be on.** Before you rely on Google sign-in, open https://myaccount.google.com/security with the owner's Google account → **2-Step Verification** → turn it on (an authenticator app or passkey is better than SMS). Do the same for any address you add to `ADMIN_EMAILS` later. Google doesn't tell the app whether it's on, so the app can't check it for you.

Do this once, signed in to Google **as the owner** (abdulrehmaan060@gmail.com), so the project belongs to the owner's account. Google renames these screens from time to time; look for the matching option if a name differs.

1. **Project.** Open https://console.cloud.google.com → the project picker at the top → **New project** → name `Renewals` → **Create**. Select it in the project picker.
2. **OAuth consent screen.** It's called **Google Auth Platform** in the newer console (menu → **APIs & Services → OAuth consent screen**). Press **Get started**:
   - **App information:** App name `Renewals`; User support email: the owner's address.
   - **Audience:** **External**.
   - **Contact information:** the owner's address. Agree to the policy → **Create**.
   - **Branding** (optional): add `abdulrehmaan.net` under **Authorized domains**. No logo is needed; a logo would require Google's review.
   - **Data access:** add the scopes `openid` and `.../auth/userinfo.email`. Both are non-sensitive, so no Google verification is needed. The app asks for nothing else.
   - **Audience → Publishing status:** press **Publish app** to move it to **In production**. With only these two scopes there is no review, and no "unverified app" warning. (While it stays in **Testing**, only the **Test users** listed there can sign in, and Google shows a warning screen. The allowlist protects the app either way.)
3. **OAuth client.** **Clients** (older console: **APIs & Services → Credentials → Create credentials → OAuth client ID**) → **Create client**:
   - **Application type:** **Web application**. **Name:** `Renewals web`.
   - **Authorized JavaScript origins:** leave empty. The sign-in runs on the server.
   - **Authorized redirect URIs:** add both, exactly as written (http for localhost, https for the live site, no trailing slash):
     ```
     https://renewals.abdulrehmaan.net/api/auth/google/callback
     http://localhost:3000/api/auth/google/callback
     ```
   - **Create.**
4. **Copy the Client ID and the Client secret.** The newer console shows the secret **only once**, so copy it now or download the JSON. If it's lost, open the client → **Add secret**, then delete the old one.
5. **hPanel → the Node.js app → Environment variables:** add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ADMIN_EMAILS=abdulrehmaan060@gmail.com`, then **redeploy**. The app builds the redirect URI from `APP_URL`, so `APP_URL` must be exactly `https://renewals.abdulrehmaan.net`.
6. **Test** in a private window:
   - Open `/login` → **Sign in with Google** → choose the owner's account. You land on the dashboard **without** our 6-digit code. Settings → Security → Recent logins shows the sign-in.
   - Sign out → **Sign in with Google** with any other Google account. You get "Invalid credentials.", and the audit log has a `login.google_rejected` row with that address.
   - If Google shows **Error 400: redirect_uri_mismatch**, the redirect URI in step 3 doesn't exactly match `APP_URL` + `/api/auth/google/callback`. Check https vs http, `www`, and the trailing slash.
7. **Locally:** set `APP_URL="http://localhost:3000"` in `.env` (plus the same three Google variables), run `npm run dev`, and open http://localhost:3000/login. The localhost redirect URI from step 3 is used.
8. **Optional: Google only.** Once Google sign-in works on the owner's laptop and phone, set `PASSWORD_LOGIN_ENABLED=0` in hPanel and redeploy. The password form, `/forgot` and password reset are then off. The flag is ignored unless all three Google variables are set, so a typo can't lock everyone out, and `setup:prod` reports the mistake. To bring the password back (e.g. no access to the Google account), set it to `1` and redeploy, then sign in with the password and our 2FA as before.

To add another Google account later, add it to `ADMIN_EMAILS` (comma-separated) and redeploy. To remove one, take it out and redeploy. Sessions already open stay open until they expire; Settings → Security → **Log out all sessions** ends them now.

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
7. Test: `https://renewals.abdulrehmaan.net/api/health` returns `{"status":"ok","db":"ok"}`, login + 2FA works, and Sign in with Google works (§2a, step 6).
8. **Uptime monitoring (recommended):** add `https://renewals.abdulrehmaan.net/api/health` to a free uptime monitor (e.g. UptimeRobot, every 5 minutes, alert by email). The endpoint needs no login and returns no data: HTTP 200 `{"status":"ok","db":"ok"}` when the app and the database are up, HTTP 503 `{"status":"error","db":"unreachable"}` when the database doesn't answer within 3 seconds. Alert on anything other than 200.

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
Three layers, from automatic to manual:

1. **Hostinger's automatic backups** (automatic; how often and how far back depends on the plan, usually weekly or daily). hPanel → **Files → Backups → Database backups**: pick the database and a date, then **Download** (a `.sql.gz` file) or **Restore**. Restoring there overwrites the live database, so take a fresh `npm run backup` first.
2. **Database dump: `npm run backup`** (the developer, monthly and before every migration). Over SSH in `~/hrm-tools` (§2, *Where to run the database scripts*). The MariaDB client tools are installed on Hostinger servers. Elsewhere, install them, or set `MYSQL_DUMP` to the full path of `mariadb-dump` or `mysqldump`.
   ```sh
   npm run backup -- --env-file .env.production
   ```
   It dumps the database in `DATABASE_URL` with `mariadb-dump` (or `mysqldump`) using `--single-transaction`, so the app keeps working during the dump. The file goes to `backups/hrm-YYYY-MM-DD-HHMM.sql.gz`, dated in Pakistan time and gzipped. `--sql` writes plain `.sql` instead, and `--out <folder>` picks another folder. The script checks that the file is a real dump and prints its size. The password is passed through the environment and never printed or put on the command line.
   - Download the file to your PC (e.g. `scp -P 65002 u123456789@1.2.3.4:hrm-tools/backups/hrm-….sql.gz .`) and copy it somewhere private (e.g. the owner's Google Drive). `backups/` is git-ignored. Delete server copies you don't need.
   - **Restore** into an empty database (e.g. a second database created in hPanel): `gunzip -c hrm-….sql.gz | mariadb -h localhost -u u123456789_hrm2 -p u123456789_hrm2`. Check it, then point `DATABASE_URL` at it, or restore into the live database in a quiet moment. phpMyAdmin → **Import** also accepts the `.sql.gz` file for small databases.
3. **Weekly CSV export from the app** (the owner, every week, 2 minutes): **Settings → Backup** has four downloads: **Clients**, **Services**, **Payments** and **Invoices**. Click each **CSV** button and save the four files into a dated folder (e.g. `Renewals backup 2026-10-12`) in Google Drive. They open in Excel, so the business can keep going from them even without the app. The same exports are also on the Clients page (services) and the Payments page (payments for the selected dates). Every download is recorded in the audit log.

## 7. Go-live checks
- [ ] HTTPS padlock on `renewals.abdulrehmaan.net`, http redirects to https, and the HSTS header is present.
- [ ] `/api/health` returns `{"status":"ok","db":"ok"}`, and an uptime monitor watches it.
- [ ] `npm run backup` works over SSH, hPanel → Backups lists database backups, and Settings → Backup downloads all four CSV files.
- [ ] hPanel → Remote MySQL has no IPs left on it (unless you need one right now).
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
1. Work on a branch and test locally against the local MariaDB (`npm run db:up` or `npm run db:local:start`, README → Local database), never the production database. For a bigger change, a second Hostinger Node.js app on a staging subdomain (e.g. `staging.abdulrehmaan.net`) with its own hPanel database works the same way.
2. If `schema.prisma` changed: `npx prisma migrate dev` locally → commit the migration → take a backup (§6) → over SSH in `~/hrm-tools`: `git pull && npm ci && npx prisma migrate deploy` (with `DATABASE_URL` from `.env.production`, e.g. `node --env-file=.env.production node_modules/prisma/build/index.js migrate deploy`, or export it first) **before** the new code goes live. MySQL can't roll back a half-applied migration (DDL commits as it goes), which is why the backup comes first.
3. Merge to `main` → Hostinger rebuilds and restarts the app (GitHub deploy), or upload the new .zip.
