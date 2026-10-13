# 03 — Database (Prisma + MySQL/MariaDB)

MySQL/MariaDB on the same Hostinger server as the app (host `localhost`; owner decision 13 Oct 2026, replacing Neon Postgres). Needs MariaDB 10.6+ or MySQL 8.0+ (for `FOR UPDATE SKIP LOCKED`). Prisma 7 with the `@prisma/adapter-mariadb` driver adapter; the pool is capped at 5 connections (`CONNECTION_LIMIT` in `src/lib/db-config.ts`) because Hostinger shared hosting limits connections per database user, and each connection runs `SET time_zone = '+00:00'`.

- Timestamps are `DATETIME(3)` stored in **UTC** (the pool pins the session time zone, so the server clock's zone doesn't matter).
- Business dates (`start_date`, `renewal_date`, `paid_on`, …) are `DATE` values in the Asia/Karachi calendar.
- Character set `utf8mb4`, collation `utf8mb4_unicode_ci` everywhere (case- and accent-insensitive comparisons).
- Prisma's MySQL default for `String` is `VARCHAR(191)`, so every long text column is an explicit `@db.Text`.
- `Json` columns: MariaDB stores JSON as `LONGTEXT` with a `JSON_VALID` check; Prisma reads and writes them as JSON either way.

## 1. Entity overview

```
Admin 1 ─── * Session
Admin 1 ─── * PasswordReset
LoginAttempt (by identifier/ip, no FK)

Client 1 ─── * Service 1 ─── * Payment
                      1 ─── * Reminder
                      1 ─── * Notification (nullable FK)
Client 1 ─── * Invoice * ─── 1 Service
               Invoice 1 ─── * InvoiceItem
               Invoice 1 ─── * InvoiceEvent
               Invoice 0..1 ─── 0..1 Payment

Setting (key/value)   MessageTemplate   AuditLog
InvoiceCounter (one row per year)   AppLock (named lock rows)   RateLimit
```

## 2. `prisma/schema.prisma`

Prisma 7 keeps the connection URL out of the schema: the CLI (migrations, seed) reads `DATABASE_URL` in `prisma.config.ts`, and the app passes it to the adapter in `src/lib/server/db.ts`. There is only one URL (`mysql://user:password@host:3306/db`), no separate direct URL.

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
  runtime  = "nodejs"
}

datasource db {
  provider = "mysql"
}

// ─────────────────────────── Auth ───────────────────────────
model Admin {
  id              Int       @id @default(autoincrement())
  username        String    @unique @db.VarChar(50)
  email           String    @unique @db.VarChar(190)
  passwordHash    String    @map("password_hash") @db.VarChar(255)
  totpSecretEnc   String?   @map("totp_secret_enc") @db.Text // AES-256-GCM, base64
  totpEnabled     Boolean   @default(false) @map("totp_enabled")
  totpLastStep    Int?      @map("totp_last_step")           // blocks code replay
  recoveryCodes   Json?     @map("recovery_codes")           // string[] of argon2 hashes
  lastLoginAt     DateTime? @map("last_login_at") @db.DateTime(3)
  lastLoginIp     String?   @map("last_login_ip") @db.VarChar(45)
  createdAt       DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.DateTime(3)
  sessions        Session[]
  passwordResets  PasswordReset[]
  @@map("admins")
}

enum SessionStage {
  password_ok
  full
}

model Session {
  id          String       @id @db.Char(64)            // sha256(cookie token), hex
  adminId     Int          @map("admin_id")
  stage       SessionStage
  userAgent   String?      @map("user_agent") @db.VarChar(300)
  ip          String?      @db.VarChar(45)
  createdAt   DateTime     @default(now()) @map("created_at") @db.DateTime(3)
  lastSeenAt  DateTime     @default(now()) @map("last_seen_at") @db.DateTime(3)
  expiresAt   DateTime     @map("expires_at") @db.DateTime(3)   // absolute limit
  pendingTotpSecretEnc String? @map("pending_totp_secret_enc") @db.Text // during 2FA setup only
  totpFailures Int         @default(0) @map("totp_failures")
  admin       Admin        @relation(fields: [adminId], references: [id], onDelete: Cascade)
  @@index([adminId])
  @@map("sessions")
}

enum AttemptStep {
  password
  totp
  recovery
  reset
}

model LoginAttempt {
  id          BigInt      @id @default(autoincrement())
  ip          String      @db.VarChar(45)
  identifier  String      @db.VarChar(190)
  step        AttemptStep @default(password)
  success     Boolean
  attemptedAt DateTime    @default(now()) @map("attempted_at") @db.DateTime(3)
  @@index([ip, attemptedAt])
  @@index([identifier, attemptedAt])
  @@map("login_attempts")
}

model PasswordReset {
  id         Int       @id @default(autoincrement())
  adminId    Int       @map("admin_id")
  tokenHash  String    @unique @map("token_hash") @db.Char(64)
  expiresAt  DateTime  @map("expires_at") @db.DateTime(3)
  usedAt     DateTime? @map("used_at") @db.DateTime(3)
  createdAt  DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  admin      Admin     @relation(fields: [adminId], references: [id], onDelete: Cascade)
  @@map("password_resets")
}

// ─────────────────────────── Core data ───────────────────────────
model Client {
  id         Int       @id @default(autoincrement())
  name       String    @db.VarChar(150)
  company    String?   @db.VarChar(150)
  email      String?   @db.VarChar(190)
  phone      String?   @db.VarChar(20)                 // normalised digits: 923001234567
  address    String?   @db.VarChar(300)                // optional; printed on invoices (Bill to)
  currency   String    @db.Char(3)                     // ISO 4217; new services start in it
  notes      String? @db.Text
  createdAt  DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt  DateTime  @updatedAt @map("updated_at") @db.DateTime(3)
  services   Service[]
  invoices   Invoice[]
  @@index([name])
  @@index([email])
  @@index([phone])
  @@map("clients")
}

enum ServiceStatus {
  active
  cancelled
}

model Service {
  id               Int           @id @default(autoincrement())
  clientId         Int           @map("client_id")
  domain           String        @db.VarChar(190)
  planLabel        String?       @map("plan_label") @db.VarChar(100)
  startDate        DateTime      @map("start_date") @db.Date
  renewalDate      DateTime      @map("renewal_date") @db.Date   // end of current period (inclusive)
  chargeAmount     Decimal       @default(0) @map("charge_amount") @db.Decimal(15, 3)
  currency         String        @default("PKR") @db.Char(3)
  status           ServiceStatus @default(active)
  remindersEnabled Boolean       @default(true) @map("reminders_enabled")
  notes            String? @db.Text
  createdAt        DateTime      @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt        DateTime      @updatedAt @map("updated_at") @db.DateTime(3)
  client           Client        @relation(fields: [clientId], references: [id], onDelete: Cascade)
  payments         Payment[]
  reminders        Reminder[]
  notifications    Notification[]
  invoices         Invoice[]
  @@index([status, renewalDate])
  @@index([domain])
  @@map("services")
}

enum PaymentMethod {
  cash
  bank_transfer
  jazzcash
  easypaisa
  other
}

model Payment {
  id          Int           @id @default(autoincrement())
  serviceId   Int           @map("service_id")
  amount      Decimal       @db.Decimal(15, 3)
  currency    String        @default("PKR") @db.Char(3)
  paidOn      DateTime      @map("paid_on") @db.Date
  method      PaymentMethod @default(cash)
  reference   String?       @db.VarChar(100)
  periodFrom  DateTime      @map("period_from") @db.Date
  periodTo    DateTime      @map("period_to") @db.Date
  notes       String? @db.Text
  createdAt   DateTime      @default(now()) @map("created_at") @db.DateTime(3)
  service     Service       @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  invoice     Invoice?
  @@index([serviceId, paidOn])
  @@map("payments")
}

// ─────────────────────────── Reminders ───────────────────────────
enum ReminderChannel {
  email
  whatsapp
}
enum ReminderRecipient {
  client
  admin
}
enum ReminderStatus {
  pending
  sent
  opened
  failed
  skipped
}

model Reminder {
  id         BigInt            @id @default(autoincrement())
  serviceId  Int               @map("service_id")
  cycleDate  DateTime          @map("cycle_date") @db.Date   // service.renewalDate when queued
  stage      Int               @db.SmallInt                  // 30,15,7,3,1,0,-3,-6,-9
  channel    ReminderChannel
  recipient  ReminderRecipient
  status     ReminderStatus    @default(pending)
  attempts   Int               @default(0) @db.SmallInt
  lastError  String?           @map("last_error") @db.VarChar(500)
  sentAt     DateTime?         @map("sent_at") @db.DateTime(3)
  createdAt  DateTime          @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt  DateTime          @updatedAt @map("updated_at") @db.DateTime(3)
  service    Service           @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  @@unique([serviceId, cycleDate, stage, channel, recipient], name: "uq_reminder")
  @@index([status, createdAt])
  @@map("reminders")
}
// Admin reminders are sent as ONE summary (email/WhatsApp) covering all queued services;
// the per-service 'admin' rows record what the summary included and are marked sent together.

enum NotificationType {
  expiring
  expired
  renewed
  email_failed
  system
  invoice_created
}

model Notification {
  id         BigInt           @id @default(autoincrement())
  serviceId  Int?             @map("service_id")
  type       NotificationType
  title      String           @db.VarChar(190)
  body       String?          @db.VarChar(500)
  dedupeKey  String           @unique @map("dedupe_key") @db.VarChar(120)  // "stage:12:2026-10-12:7"
  isRead     Boolean          @default(false) @map("is_read")
  createdAt  DateTime         @default(now()) @map("created_at") @db.DateTime(3)
  service    Service?         @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  @@index([isRead, createdAt])
  @@map("notifications")
}

// ─────────────────────────── Config ───────────────────────────
model Setting {
  key        String   @id @db.VarChar(80)
  value      String?  @db.Text
  updatedAt  DateTime @updatedAt @map("updated_at") @db.DateTime(3)
  @@map("settings")
}

model MessageTemplate {
  key        String   @id @db.VarChar(50)   // client_email | client_whatsapp | admin_email | admin_whatsapp
  subject    String?  @db.VarChar(190)
  body       String   @db.Text
  updatedAt  DateTime @updatedAt @map("updated_at") @db.DateTime(3)
  @@map("message_templates")
}

model AuditLog {
  id        BigInt   @id @default(autoincrement())
  action    String   @db.VarChar(50)        // login.success, client.create, service.renew, …
  entity    String?  @db.VarChar(30)
  entityId  Int?     @map("entity_id")
  details   Json?
  ip        String?  @db.VarChar(45)
  createdAt DateTime @default(now()) @map("created_at") @db.DateTime(3)
  @@index([action, createdAt])
  @@index([entity, entityId])
  @@map("audit_log")
}

// ─────────────────────────── Invoices (docs/13 §2–§3, §8) ───────────────────────────
enum InvoiceStatus {
  issued
  sent
  paid
  void
}

// Overdue is derived (dueDate passed and not paid), never stored.
model Invoice {
  id                   Int           @id @default(autoincrement())
  number               String        @unique @db.VarChar(40)       // INV-2026-0012
  clientId             Int           @map("client_id")
  serviceId            Int           @map("service_id")
  periodStart          DateTime      @map("period_start") @db.Date  // the renewal date of the cycle
  periodEnd            DateTime      @map("period_end") @db.Date    // periodStart + 1 year
  issueDate            DateTime      @map("issue_date") @db.Date
  dueDate              DateTime      @map("due_date") @db.Date      // = renewal date
  currency             String        @db.Char(3)
  subtotal             Decimal       @db.Decimal(15, 3)
  discount             Decimal       @default(0) @db.Decimal(15, 3)
  taxRate              Decimal       @default(0) @map("tax_rate") @db.Decimal(5, 2) // percent
  taxAmount            Decimal       @default(0) @map("tax_amount") @db.Decimal(15, 3)
  total                Decimal       @db.Decimal(15, 3)
  status               InvoiceStatus @default(issued)
  billTo               Json          @map("bill_to")   // snapshot at issue time
  seller               Json                            // snapshot at issue time
  notes                String? @db.Text
  publicToken          String        @unique @map("public_token") @db.VarChar(64)
  publicTokenRevokedAt DateTime?     @map("public_token_revoked_at") @db.DateTime(3)
  firstSentAt          DateTime?     @map("first_sent_at") @db.DateTime(3)
  paidAt               DateTime?     @map("paid_at") @db.Date
  paymentId            Int?          @unique @map("payment_id")
  voidedAt             DateTime?     @map("voided_at") @db.DateTime(3)
  voidReason           String?       @map("void_reason") @db.VarChar(300)
  createdAt            DateTime      @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt            DateTime      @updatedAt @map("updated_at") @db.DateTime(3)
  client               Client        @relation(fields: [clientId], references: [id], onDelete: Cascade)
  service              Service       @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  payment              Payment?      @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  items                InvoiceItem[]
  events               InvoiceEvent[]
  @@unique([serviceId, periodStart], name: "uq_invoice_cycle")
  @@index([status, dueDate])
  @@index([clientId])
  @@index([issueDate])
  @@map("invoices")
}

model InvoiceItem {
  id          Int     @id @default(autoincrement())
  invoiceId   Int     @map("invoice_id")
  position    Int     @default(0)
  description String  @db.VarChar(300)   // "Hosting renewal — noordental.pk"
  periodLabel String  @map("period_label") @db.VarChar(100) // "30 Sep 2026 → 30 Sep 2027"
  quantity    Int     @default(1)
  unitAmount  Decimal @map("unit_amount") @db.Decimal(15, 3)
  amount      Decimal @db.Decimal(15, 3)
  invoice     Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  @@index([invoiceId])
  @@map("invoice_items")
}

enum InvoiceEventType {
  created
  updated
  email_sent
  email_failed
  whatsapp_opened
  whatsapp_marked_sent
  link_viewed
  pdf_downloaded
  paid
  voided
  link_regenerated
  details_refreshed
}

model InvoiceEvent {
  id        BigInt           @id @default(autoincrement())
  invoiceId Int              @map("invoice_id")
  type      InvoiceEventType
  details   Json?
  ip        String?          @db.VarChar(45)
  createdAt DateTime         @default(now()) @map("created_at") @db.DateTime(3)
  invoice   Invoice          @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  @@index([invoiceId, createdAt])
  @@map("invoice_events")
}

// One row per year; the next sequence number is taken inside a transaction.
model InvoiceCounter {
  year      Int      @id
  next      Int      @default(1)
  updatedAt DateTime @updatedAt @map("updated_at") @db.DateTime(3)
  @@map("invoice_counters")
}

// Named lock rows, locked with SELECT … FOR UPDATE SKIP LOCKED inside a
// transaction (released when it ends). The init migration inserts 'check',
// which runCheck() uses so two checks never run at once.
model AppLock {
  name String @id @db.VarChar(40)
  @@map("app_locks")
}

// Fixed-window counters for public routes (/i/*), DB-backed like login throttling.
model RateLimit {
  key         String   @db.VarChar(120)
  windowStart DateTime @map("window_start") @db.DateTime(3)
  count       Int      @default(0)
  @@id([key, windowStart])
  @@map("rate_limits")
}
```

### How the MySQL-specific parts work

- **Check lock** (`app_locks`): the first statement of `runCheck()`'s transaction (READ COMMITTED) is `SELECT name FROM app_locks WHERE name = 'check' FOR UPDATE SKIP LOCKED`. No row back means another check holds it, so this one returns `ran: false`. The lock ends with the transaction. See `04-BUSINESS-LOGIC.md` §4.
- **Invoice numbers** (`invoice_counters`): `INSERT … ON DUPLICATE KEY UPDATE next = next + 1`, then `SELECT next - 1` in the same transaction. The row lock serialises parallel requests, and a rollback gives the number back. Two parallel "Create invoice now" clicks: the loser hits the `uq_invoice_cycle` unique key, its transaction (and number) rolls back, and it returns the existing invoice.
- **Rate limit** (`rate_limits`): `INSERT … ON DUPLICATE KEY UPDATE count = count + 1` plus a `SELECT` of the count, in one transaction.
- **Public invoice tokens** are 64 lowercase hex characters (32 random bytes), so the case-insensitive collation can't make two tokens equal; the lookup also compares the token exactly.

## 3. Default settings (inserted by `prisma/seed.ts`)

| key | default |
|-----|---------|
| `business_name` | `Our Hosting` |
| `business_phone` | `` |
| `admin_email` | `` |
| `admin_whatsapp` | `` |
| `default_currency` | `PKR` (default currency for new clients) |
| `enabled_currencies` | `AED,PKR,USD` (any ISO 4217 codes) |
| `threshold_orange_days` | `30` |
| `threshold_red_days` | `7` |
| `reminder_stages` | `30,15,7,3,1,0,-3,-6,-9` |
| `post_expiry_to_client` | `1` |
| `check_interval_minutes` | `60` |
| `auto_send_emails` | `0` |
| `auto_send_batch_size` | `10` (kept small so each request stays short) |
| `last_check_at` | null |
| `smtp_host` | `smtp.hostinger.com` |
| `smtp_port` | `465` |
| `smtp_secure` | `1` |
| `smtp_username` | `` |
| `smtp_password_enc` | `` |
| `mail_from_email` | `` |
| `mail_from_name` | `Our Hosting` |
| `payment_accounts` | `[]`: JSON array of payment accounts (label, bank, title, account number, IBAN, SWIFT/BIC, branch code, currencies, isDefault), docs/13 §6a |
| `pay_wallet` | `` (JazzCash / Easypaisa number, printed on PKR invoices) |

The invoice settings (`invoice_prefix`, `invoice_lead_days`, `business_address`, `invoice_ntn`, `invoice_logo`, `invoice_footer`, `tax_enabled`, `tax_rate`) are listed with their defaults in `src/lib/server/settings-keys.ts`.

`lib/server/settings.ts` exposes a typed `getSettings()` (parsed numbers and booleans, cached per request with React `cache()`), plus `updateSettings(partial)`.

Default templates come from `src/lib/domain/default-templates.ts` (see `08-MESSAGES.md`).

## 4. ⚠ Date columns in Prisma

Prisma maps `@db.Date` to a JS `Date` at **UTC midnight**. To avoid off-by-one bugs:

```ts
// lib/server/db-dates.ts
export const toDbDate  = (d: ISODate) => new Date(d + 'T00:00:00.000Z');
export const fromDbDate = (d: Date): ISODate => d.toISOString().slice(0, 10);
```
- **Always** convert at the boundary. Components and domain functions only ever see `'YYYY-MM-DD'` strings.
- Never call `.getDate()`/`.toLocaleDateString()` on these values without `timeZone: 'UTC'`.

## 5. Derived values (not stored)

| Value | How |
|-------|-----|
| `daysLeft` | `daysLeft(fromDbDate(s.renewalDate), todayPK())` in TS. In SQL filters, pass `today` as a parameter (`DATEDIFF(renewal_date, ?)`). **Never use `CURRENT_DATE`**, because the DB session runs in UTC |
| `colour` | `statusColour(daysLeft, thresholds)` |
| `expiresAt` (timer target) | `expiresAtIso(renewal)` = `YYYY-MM-DDT23:59:59+05:00` |

### Useful queries (Prisma)

```ts
// Due soon / expired (dashboard)
const today = todayPK();
const limit = addDays(today, settings.thresholdOrangeDays);   // ISO string
prisma.service.findMany({
  where: { status: 'active', renewalDate: { lte: toDbDate(limit) } },
  include: { client: true },
  orderBy: { renewalDate: 'asc' },
});

// Expected income next 30 days, per currency
prisma.service.groupBy({
  by: ['currency'],
  where: { status: 'active', renewalDate: { gte: toDbDate(today), lte: toDbDate(addDays(today, 30)) } },
  _sum: { chargeAmount: true },
});

// Reminder queue
prisma.reminder.findMany({
  where: { status: { in: ['pending', 'failed', 'opened'] } },
  include: { service: { include: { client: true } } },
  orderBy: [{ stage: 'asc' }, { service: { renewalDate: 'asc' } }],
});
```

Client search (name/company/email/phone/domain) uses `contains` with an `OR` across client and service fields. It is case-insensitive through the `utf8mb4_unicode_ci` collation (no `mode: 'insensitive'` needed); note that the collation is also accent-insensitive (`e` matches `é`). That is fine up to thousands of rows. Add a `FULLTEXT` index later only if it gets slow.

## 6. Data rules

- On delete: `Client` → cascades to services → cascades to payments, reminders and notifications.
- Changing `renewalDate` by hand: in the same transaction, set the pending/failed/opened reminders with the old `cycleDate` to `skipped`.
- `phone` is stored normalised (digits with country code). Show it formatted.
- `domain` is stored lowercase without `http(s)://`, `www.` or a trailing slash.
- **Currency (no conversion, 11 Oct 2026):** every client has a required `currency` (ISO 4217). A new service starts in the client's currency and can override it; payments and invoices take the service's currency. A currency used by any client or service can't be removed from `enabled_currencies`. Amounts may not have more decimals than the currency allows (from `Intl`: JPY/PKR 0, USD 2, KWD 3). Totals are grouped per currency, never added together.
- **Money columns are `DECIMAL(15,3)`** (were 12,2): `services.charge_amount`, `payments.amount`, `invoices.subtotal/discount/tax_amount/total`, `invoice_items.unit_amount/amount` (invoice tables: see `13-INVOICES-AND-SHARING.md`). `tax_rate` stays `DECIMAL(5,2)`.
- When per-client currency was added (11 Oct 2026), each existing client's currency was set to the one most of their services use (ties go to the app default, then alphabetical), or the app default if they had no services.

## 7. Seed & demo data

- `npx prisma db seed` → default settings + templates (idempotent `upsert`).
- `SEED_DEMO=1 npx prisma db seed` (development only) → about 12 clients / 15 services with dates **relative to today**: 3 green (60–300 days), 4 orange (10–30), 3 red (0–7), 2 expired (−2, −12), 1 cancelled, and 2 clients with 2 services each. It also adds a few payments and notifications.
