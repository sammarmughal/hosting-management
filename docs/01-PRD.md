# 01 — Product Requirements (PRD)

## 1. Problem

We host websites for many clients on one Hostinger plan. The first year is free, and from the second year each client pays a yearly renewal charge that differs from client to client. There is no central record of when each client's year ends, so renewals are missed, payments come in late, and clients are not warned before their hosting expires.

## 2. Goal

One private web app where the admin can:

1. See every client's hosting with its start date, renewal date and charge.
2. See at a glance how much time is left, using a live countdown coloured green, orange or red.
3. Send reminders to **the client and to the admin** by **email and WhatsApp** during the final month and after expiry.
4. Record payments and roll the renewal date forward by one year.

## 3. Constraints (approved)

- **No cron jobs and no scheduled server requests.** Reminder checks run only when the admin opens the app (see `04-BUSINESS-LOGIC.md` §4).
- **WhatsApp without the paid API.** Use `wa.me` click-to-chat links with pre-filled text. The admin taps Send in WhatsApp.
- **Single admin account**, fully authenticated, with nobody else able to access the app.
- Built with **Next.js**. Deployed on **Vercel** (primary), and it must also run on **Hostinger's Node.js hosting** without code changes.
- Keep it simple: one Next.js app, one database, and no extra services except the database and SMTP.

## 4. Users

| Role | Description |
|------|-------------|
| Admin (only user) | Business owner. Manages clients, sends reminders, records payments |
| Client (not a user) | Receives reminder emails and WhatsApp messages. Never logs in |

## 5. Glossary

| Term | Meaning |
|------|---------|
| Client | A person or business we host for |
| Service | One hosting item for a client (usually one domain). A client can have several services, each with its own dates and charge |
| Start date | The date the service began |
| Renewal date | The date the current paid or free period ends. Defaults to start date + 1 year |
| Days left | Whole days from today (Asia/Karachi) to the renewal date. 0 means it expires today, and a negative number means expired |
| Cycle | One yearly period, identified by its renewal date |
| Stage | A reminder point (30, 15, 7, 3, 1, 0, −3, −6 or −9 days) |
| Reminder queue | The list of reminders that are due and not yet sent |

## 6. Functional Requirements

### FR-1 Authentication
- FR-1.1 Log in with username/email and password, then a 6-digit TOTP code.
- FR-1.2 2FA is **mandatory**. On first login, the admin must scan a QR code and confirm a code before reaching any other page.
- FR-1.3 Provide 8 one-time recovery codes, shown once when 2FA is set up.
- FR-1.4 Lock the login for 15 minutes after 5 failed attempts from the same IP or for the same username.
- FR-1.5 Log out automatically after 30 minutes of inactivity. Force a new login after 12 hours in any case.
- FR-1.6 Password change requires the current password and a TOTP code.
- FR-1.7 Password reset works by an emailed link valid for 30 minutes, and still requires TOTP or a recovery code afterwards.
- FR-1.8 There is no registration page. The admin is created with `npm run create-admin`, a CLI script run locally against the production database.

### FR-2 Clients (CRUD)
- FR-2.1 Create a client with: name (required), company, email, WhatsApp phone, notes. At least one of email or phone is required.
- FR-2.2 View the client list with search (name, company, email, phone, domain), filters and sorting.
- FR-2.3 Edit any client field.
- FR-2.4 Delete a client after a confirmation modal. This also deletes their services, payments and reminders.
- FR-2.5 Client detail page shows the client info, their services with timers, payment history and reminder log.

### FR-3 Services (hosting items)
- FR-3.1 Add a service to a client with: domain (required), plan label (optional), start date (required), renewal date (auto = start + 1 year, editable), charge amount (required, ≥ 0), currency (default PKR), reminders on/off, notes.
- FR-3.2 Edit or delete a service.
- FR-3.3 Mark a service as **Cancelled**. It is then hidden from the dashboard and gets no reminders.
- FR-3.4 A "Quick add" form creates a client and their first service in one step.

### FR-4 Live countdown and colour status
- FR-4.1 Each active service shows a live countdown `DDd HHh MMm SSs` to the end of its renewal day (23:59:59 Asia/Karachi), updated every second.
- FR-4.2 Colour: **Green** for days left > 30, **Orange** for 8–30, **Red** for 0–7, **Expired** (dark red) for < 0, which shows "Expired N days ago".
- FR-4.3 The limits (30 and 7) can be changed in Settings.
- FR-4.4 When a timer crosses a limit while the page is open, its colour updates without a reload.

### FR-5 Dashboard
- FR-5.1 Stat cards: Total active services · Expiring in 30 days · Urgent (≤ 7 days) · Expired · Expected renewal income for the next 30 days.
- FR-5.2 **Reminder queue** panel: due reminders grouped by service, with per-row actions (Send email, Open WhatsApp, Skip) and bulk actions (Send all emails, Send admin summary).
- FR-5.3 "Due soon" table: services with days left ≤ 30 or expired, most urgent first.
- FR-5.4 A "Last checked: …" label and a **Check now** button.

### FR-6 Reminder check (no cron)
- FR-6.1 On every dashboard load, run the reminder check if the last check was more than 60 minutes ago (configurable).
- FR-6.2 The **Check now** button always runs the check.
- FR-6.3 The check adds due reminders to the queue and creates in-app notifications. It never sends duplicates.
- FR-6.4 **Catch-up:** if the app was not opened for days, only the **latest** due stage per service is queued. Older missed stages are marked `skipped`, so the client is not spammed.
- FR-6.5 Optional setting **Auto-send emails on check** (default OFF). When ON, queued emails are sent during the check, in batches.

### FR-7 Email reminders
- FR-7.1 Client email uses an editable template with placeholders.
- FR-7.2 Admin summary email lists all services currently in the queue, as one email.
- FR-7.3 Each send is logged with status `sent` or `failed` and the error message.
- FR-7.4 "Send test email" button in Settings.

### FR-8 WhatsApp reminders (click-to-chat)
- FR-8.1 The "Open WhatsApp" button opens `https://wa.me/<digits>?text=<encoded message>` in a new tab or the app.
- FR-8.2 Clicking it marks the reminder `opened` (we cannot confirm WhatsApp delivery). The admin can then mark it `sent` or leave it.
- FR-8.3 "WhatsApp summary to me" opens `wa.me` to the admin's own number with the summary text.
- FR-8.4 Phone numbers are normalised to international format (see `08-MESSAGES.md` §4). Invalid numbers disable the button and show a warning.

### FR-9 In-app notifications
- FR-9.1 A bell icon with an unread count, and a dropdown of the latest 10.
- FR-9.2 A Notifications page with all items and "Mark all read".
- FR-9.3 Created by the check, for example "clientb.pk expires in 7 days" or "clienta.com expired 3 days ago".

### FR-10 Renewal and payments
- FR-10.1 The "Renew / Mark paid" modal takes: amount (prefilled from the charge), paid-on date (default today), method (Cash, Bank transfer, JazzCash, Easypaisa, Other), reference, notes, and "Extend from" (old renewal date by default, or today).
- FR-10.2 On save: create a payment row, set the new renewal date to extend-from + 1 year, skip pending reminders of the old cycle, and log it in the audit log.
- FR-10.3 The payment history is shown on the client detail page.

### FR-11 Import / Export
- FR-11.1 Import clients and services from CSV using a template, with a preview and a validation report before saving.
- FR-11.2 Export all services to CSV.

### FR-12 Settings
- FR-12.1 Business profile: business name, admin email, admin WhatsApp number, currency.
- FR-12.2 Colour limits, reminder stages (a comma list), whether post-expiry reminders go to the client, check interval, and auto-send emails on or off.
- FR-12.3 SMTP: host, port, encryption, username, password (stored encrypted), from name, from email.
- FR-12.4 Message templates: client email (subject and body), client WhatsApp, admin summary email, admin WhatsApp summary.
- FR-12.5 Security: change password, regenerate recovery codes, reset 2FA, view recent logins.

### FR-13 Audit log
- FR-13.1 Record logins (success and failure), creates, updates, deletes, renewals, reminder sends and settings changes, each with an IP address and timestamp.

## 7. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | HTTPS only. The app refuses to run over HTTP in production |
| NFR-2 | Pages load in under 1 s with 1,000 services |
| NFR-3 | Works on phones (≥ 360 px), tablets and desktops. The admin often uses it from a phone for WhatsApp |
| NFR-4 | No external CDNs at runtime. All CSS, JS, fonts and icons are served locally (for security/CSP) |
| NFR-5 | All dates are stored as `DATE`. Logic uses `Asia/Karachi`, and timestamps are stored in UTC `DATETIME` |
| NFR-6 | Node.js 20 LTS+, Next.js (App Router, latest stable), PostgreSQL 15+ (Neon) via Prisma |
| NFR-7 | Only the libraries listed in `02-ARCHITECTURE.md` §1. Anything else needs approval |
| NFR-8 | Search engines must not index the app (`noindex` and `robots.txt` disallow) |

## 8. Out of Scope (v1)

- Online payment collection (cards, JazzCash or Easypaisa gateways)
- Hostinger API integration (auto-suspend)
- Multiple users or roles, and a client portal
- WhatsApp Business API or other automated WhatsApp sending
- Cron jobs or any background workers
- Multi-language UI (English only in v1. Urdu is possible later)

## 9. Acceptance Criteria (release checklist)

- [ ] Nobody can see any page except `/login` without a full login including 2FA.
- [ ] Adding a service with start date 2025-10-10 sets renewal to 2026-10-10 automatically.
- [ ] Timer colours match the limits exactly at the boundaries (31 = green, 30 = orange, 8 = orange, 7 = red, 0 = red, −1 = expired).
- [ ] If the dashboard is opened twice in a row, no duplicate reminders are queued.
- [ ] If the app is closed for 20 days, only the latest stage per service is queued and the older ones are marked skipped.
- [ ] "Send all emails" sends to each client once, and failures show an error and stay retryable.
- [ ] The WhatsApp button opens the correct number with the correct pre-filled text on a phone.
- [ ] Renewing moves the date forward exactly one year and clears the old cycle's pending reminders.
- [ ] The app works fully on a 360 px wide phone screen.
