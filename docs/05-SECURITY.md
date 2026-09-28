# 05 — Security (Next.js)

Requirement: **exactly one admin, and nobody else can access anything.** The app holds client contact data, so treat it as private.

## 1. Admin account

- There is **no registration page or action**. The admin is created from the command line only:
  ```bash
  DATABASE_URL=… npm run create-admin     # prompts: username, email, password (hidden), confirm
  ```
  - `scripts/create-admin.ts` refuses if an admin already exists (`--force` is needed to replace one, and it asks for confirmation).
  - It prints a fresh `APP_KEY` suggestion if the env var is missing.
- Password policy: at least 12 characters, and not in a small built-in list of common passwords.
- Hashing: `@node-rs/argon2` `hash()` with the Argon2id defaults. Verify with `verify()`.

## 2. Sessions (database-backed, not JWT)

A database session is used so that logout, timeouts and "log out everywhere" really work.

```
Cookie  hrm_session = <random 32 bytes, base64url>        (the raw token only lives in the cookie)
DB      sessions.id  = sha256(token)                        (a DB leak does not give valid cookies)
```
Cookie options: `httpOnly: true, secure: true, sameSite: 'strict', path: '/'`, with no `maxAge` (browser-session cookie).

`requireAdmin()` in `lib/server/session.ts`:
```ts
export async function requireAdmin(): Promise<{ admin: Admin; session: Session }> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) redirect('/login');
  const session = await prisma.session.findUnique({ where: { id: sha256(token) }, include: { admin: true } });
  const now = Date.now();
  if (!session || session.stage !== 'full'
      || session.expiresAt.getTime() < now                        // absolute 12 h
      || now - session.lastSeenAt.getTime() > 30 * 60_000) {      // idle 30 min
    if (session) await prisma.session.delete({ where: { id: session.id } });
    redirect('/login?expired=1');
  }
  // touch at most once a minute to limit writes
  if (now - session.lastSeenAt.getTime() > 60_000)
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return { admin: session.admin, session };
}
```
- `requireAdmin()` is called in **`(app)/layout.tsx` AND at the top of every Server Action and route handler.** Layouts alone are not enough, because Server Actions can be called directly.
- `proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`) only does a fast "cookie present?" redirect for a better user experience. **It is not the security boundary.** `requireAdmin()` in the layout and in every Server Action and route handler is the real check.
- A new session ID is issued at login and again when 2FA passes (the old row is deleted).
- Logout → delete the session row and clear the cookie. Settings has a "Log out all sessions" button → deletes all rows.
- Expired rows are cleaned up opportunistically at login (`deleteMany where expiresAt < now`).

## 3. Login flow

```
/login  → loginAction(identifier, password)
   │ ok  → new session { stage: 'password_ok', expiresAt: now + 5 min }
   ├─ totpEnabled = false → /2fa/setup   (QR + key, confirm code, show 8 recovery codes once)
   └─ totpEnabled = true  → /2fa         (6-digit code or recovery code)
   │ ok  → rotate session → { stage: 'full', expiresAt: now + 12 h }
   ▼
/dashboard
```
- The `/2fa*` pages and actions require a session with `stage === 'password_ok'` that has not expired.
- The error message is always "Invalid credentials" and never reveals whether the username exists.
- TOTP (`otplib`): 30 s step, 6 digits, window ±1. Store `totpLastStep` and reject a code whose step is ≤ the last used one (replay protection).
- The TOTP secret is encrypted at rest (AES-256-GCM with `APP_KEY`, see `lib/server/crypto.ts`). During setup the pending secret lives in `sessions.pendingTotpSecretEnc`, not in a cookie.
- The QR code is generated **on our server** with `qrcode` → an SVG string rendered in the page. Never use an external QR service.
- Recovery codes: 8 codes of the form `xxxxx-xxxxx`, stored as argon2 hashes, each usable once, and they can be regenerated in Settings.

## 4. Brute-force protection (`lib/server/throttle.ts`, DB-backed since serverless has no shared memory)

| Rule | Limit | Lockout |
|------|-------|---------|
| Failed attempts per IP | 5 in 15 min | 15 min |
| Failed attempts per identifier | 5 in 15 min | 15 min |
| Failed TOTP/recovery per session | 5 (`sessions.totpFailures`) | Session deleted → /login |
| Failed attempts per IP in 24 h | 20 | 24 h |

- IP: from `x-forwarded-for` (first value), which Vercel and Hostinger's proxy set, falling back to `x-real-ip`.
- Record every attempt. Add a fixed 300 ms delay on failure.
- Email the admin after 10 failures in 1 hour ("Unusual login activity").

## 5. CSRF

- **Server Actions:** Next.js compares the `Origin` header with the host and rejects cross-site POSTs. Keep that protection on and set `experimental.serverActions.allowedOrigins` only if a custom domain proxy needs it.
- **Session cookie** `SameSite=Strict` is a second layer.
- **Route handlers** (`/api/*`) are GET downloads only and change no state. If a POST route handler is ever added, it must check `Origin` === `APP_URL`.
- **No state changes in GET requests or during page render**, except the reminder check. That runs during the dashboard render by design, and it is idempotent and safe.

## 6. Injection and output

- **SQL:** Prisma only. `$queryRaw` is allowed only with tagged template parameters (never `$queryRawUnsafe`). Sort and filter options map from a whitelist.
- **XSS:** React escapes output by default. **`dangerouslySetInnerHTML` is forbidden**, except for the locally generated QR SVG (built from our own data) and the template preview, which must pass through the same `escapeHtml` renderer as emails.
- **Input:** every Server Action validates with zod (`safeParse`). Reject unknown keys.
- **Email:** strip `\r\n` from names and subjects. Nodemailer handles the addresses.
- **CSV import:** ≤ 2 MB, `.csv` only, parsed server-side with papaparse. **On export**, prefix any cell starting with `= + - @ \t \r` with `'`.

## 7. HTTP security headers

Set in `next.config.ts` → `headers()` for all routes, with the CSP generated in `proxy.ts` using a nonce:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Robots-Tag: noindex, nofollow
```
- `poweredByHeader: false` in `next.config.ts`.
- `style-src 'unsafe-inline'` is accepted because Next/Tailwind inject styles. Scripts stay nonce-locked.
- All `(app)` pages use `export const dynamic = 'force-dynamic'` and send `Cache-Control: private, no-store`. Never cache admin data at the edge.
- Use no third-party scripts, analytics or fonts. Next's `next/font/local` or the system font stack is fine.

## 8. Platform hardening

- **Vercel:** turn on **Deployment Protection** for Preview deployments (so preview URLs are not public). Keep env vars in Vercel → Settings → Environment Variables (Production only for secrets). Don't expose any env var with the `NEXT_PUBLIC_` prefix except harmless ones (none are needed).
- **Hostinger Node.js:** keep `.env` outside any public folder, and run `node .next/standalone/server.js` behind Hostinger's proxy with HTTPS enabled.
- `NODE_ENV=production` → the Next.js error overlay is off, and errors are logged server-side. Users see `error.tsx` with no stack trace.
- `FAKE_TODAY` is ignored when `NODE_ENV === 'production'`.
- `/api/health` returns only `ok`.

## 9. Password reset

1. `/forgot` → email → always shows "If that email exists, a link was sent."
2. Token = 32 random bytes (base64url). Only `sha256(token)` is stored. It is valid for 30 minutes and works once.
3. `/reset/[token]` → new password → **all sessions deleted** → a normal login is still needed, **including 2FA**.
4. Emergency: `npm run reset-2fa` (CLI, needs DB access) disables 2FA so it is set up again at the next login.

## 10. Secrets

| Secret | Where |
|--------|-------|
| `DATABASE_URL`, `DIRECT_URL`, `APP_KEY` | Env vars (Vercel dashboard / Hostinger env). Never in git. `.env.example` has placeholders |
| SMTP password | `settings.smtp_password_enc` (AES-256-GCM with APP_KEY). The UI never shows it back (empty field = unchanged) |
| TOTP secret | `admins.totp_secret_enc` (encrypted) |

Rotating `APP_KEY` requires re-entering the SMTP password and re-doing the 2FA setup. Document this in the README.

## 11. Audit

Log these to `audit_log`: `login.success`, `login.failed`, `login.locked`, `2fa.setup`, `2fa.failed`, `password.changed`, `password.reset`, `sessions.revoked`, `client.create|update|delete`, `service.create|update|delete|renew|cancel`, `reminder.email.sent|failed`, `reminder.whatsapp.opened|sent`, `reminder.skipped`, `settings.update`, `export.csv`, `import.csv`.

The Settings → Security tab shows the last 20 login events and the active sessions.

## 12. Security checklist (before go-live)

- [ ] Every `(app)` page redirects to `/login` when logged out, including direct URLs and the browser back button after logout.
- [ ] After the password step, typing `/dashboard` → redirected (stage `password_ok` is not enough).
- [ ] Calling any Server Action without a session (e.g. a replayed request with the cookie removed) → rejected.
- [ ] The 6th wrong password → lockout, and it works across different serverless instances (DB-backed).
- [ ] A client name `<img src=x onerror=alert(1)>` is shown as text everywhere, including the template preview.
- [ ] The CSP header is present, and there are no CSP errors in the console on any page.
- [ ] Preview deployments on Vercel are protected, and there is no `NEXT_PUBLIC_` secret in the JS bundle (search the build output).
- [ ] HTTPS only, and the HSTS header is present.
- [ ] `robots.txt` disallows everything, and the `X-Robots-Tag` header is present.
