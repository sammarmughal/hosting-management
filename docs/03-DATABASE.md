# 03 — Database (Prisma + PostgreSQL)

PostgreSQL 15+ (Neon). Timestamps are `timestamptz` (UTC). Business dates (`start_date`, `renewal_date`, `paid_on`) are `date` values in the Asia/Karachi calendar.

## 1. Entity overview

```
Admin 1 ─── * Session
Admin 1 ─── * PasswordReset
LoginAttempt (by identifier/ip, no FK)

Client 1 ─── * Service 1 ─── * Payment
                      1 ─── * Reminder
                      1 ─── * Notification (nullable FK)

Setting (key/value)   MessageTemplate   AuditLog
```

## 2. `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ─────────────────────────── Auth ───────────────────────────
model Admin {
  id              Int       @id @default(autoincrement())
  username        String    @unique @db.VarChar(50)
  email           String    @unique @db.VarChar(190)
  passwordHash    String    @map("password_hash")
  totpSecretEnc   String?   @map("totp_secret_enc")          // AES-256-GCM, base64
  totpEnabled     Boolean   @default(false) @map("totp_enabled")
  totpLastStep    Int?      @map("totp_last_step")           // blocks code replay
  recoveryCodes   Json?     @map("recovery_codes")           // string[] of argon2 hashes
  lastLoginAt     DateTime? @map("last_login_at") @db.Timestamptz
  lastLoginIp     String?   @map("last_login_ip") @db.VarChar(45)
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  sessions        Session[]
  passwordResets  PasswordReset[]
  @@map("admins")
}

enum SessionStage { password_ok full }

model Session {
  id          String       @id                         // sha256(cookie token), hex
  adminId     Int          @map("admin_id")
  stage       SessionStage
  userAgent   String?      @map("user_agent") @db.VarChar(300)
  ip          String?      @db.VarChar(45)
  createdAt   DateTime     @default(now()) @map("created_at") @db.Timestamptz
  lastSeenAt  DateTime     @default(now()) @map("last_seen_at") @db.Timestamptz
  expiresAt   DateTime     @map("expires_at") @db.Timestamptz   // absolute limit
  pendingTotpSecretEnc String? @map("pending_totp_secret_enc") // during 2FA setup only
  totpFailures Int         @default(0) @map("totp_failures")
  admin       Admin        @relation(fields: [adminId], references: [id], onDelete: Cascade)
  @@index([adminId])
  @@map("sessions")
}

enum AttemptStep { password totp recovery reset }

model LoginAttempt {
  id          BigInt      @id @default(autoincrement())
  ip          String      @db.VarChar(45)
  identifier  String      @db.VarChar(190)
  step        AttemptStep @default(password)
  success     Boolean
  attemptedAt DateTime    @default(now()) @map("attempted_at") @db.Timestamptz
  @@index([ip, attemptedAt])
  @@index([identifier, attemptedAt])
  @@map("login_attempts")
}

model PasswordReset {
  id         Int       @id @default(autoincrement())
  adminId    Int       @map("admin_id")
  tokenHash  String    @unique @map("token_hash") @db.Char(64)
  expiresAt  DateTime  @map("expires_at") @db.Timestamptz
  usedAt     DateTime? @map("used_at") @db.Timestamptz
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz
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
  notes      String?
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  services   Service[]
  @@index([name])
  @@index([email])
  @@index([phone])
  @@map("clients")
}

enum ServiceStatus { active cancelled }

model Service {
  id               Int           @id @default(autoincrement())
  clientId         Int           @map("client_id")
  domain           String        @db.VarChar(190)
  planLabel        String?       @map("plan_label") @db.VarChar(100)
  startDate        DateTime      @map("start_date") @db.Date
  renewalDate      DateTime      @map("renewal_date") @db.Date   // end of current period (inclusive)
  chargeAmount     Decimal       @default(0) @map("charge_amount") @db.Decimal(12, 2)
  currency         String        @default("PKR") @db.Char(3)
  status           ServiceStatus @default(active)
  remindersEnabled Boolean       @default(true) @map("reminders_enabled")
  notes            String?
  createdAt        DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime      @updatedAt @map("updated_at") @db.Timestamptz
  client           Client        @relation(fields: [clientId], references: [id], onDelete: Cascade)
  payments         Payment[]
  reminders        Reminder[]
  notifications    Notification[]
  @@index([status, renewalDate])
  @@index([domain])
  @@map("services")
}

enum PaymentMethod { cash bank_transfer jazzcash easypaisa other }

model Payment {
  id          Int           @id @default(autoincrement())
  serviceId   Int           @map("service_id")
  amount      Decimal       @db.Decimal(12, 2)
  currency    String        @default("PKR") @db.Char(3)
  paidOn      DateTime      @map("paid_on") @db.Date
  method      PaymentMethod @default(cash)
  reference   String?       @db.VarChar(100)
  periodFrom  DateTime      @map("period_from") @db.Date
  periodTo    DateTime      @map("period_to") @db.Date
  notes       String?
  createdAt   DateTime      @default(now()) @map("created_at") @db.Timestamptz
  service     Service       @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  @@index([serviceId, paidOn])
  @@map("payments")
}

// ─────────────────────────── Reminders ───────────────────────────
enum ReminderChannel   { email whatsapp }
enum ReminderRecipient { client admin }
enum ReminderStatus    { pending sent opened failed skipped }

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
  sentAt     DateTime?         @map("sent_at") @db.Timestamptz
  createdAt  DateTime          @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime          @updatedAt @map("updated_at") @db.Timestamptz
  service    Service           @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  @@unique([serviceId, cycleDate, stage, channel, recipient], name: "uq_reminder")
  @@index([status, createdAt])
  @@map("reminders")
}
// Admin reminders are sent as ONE summary (email/WhatsApp) covering all queued services;
// the per-service 'admin' rows record what the summary included and are marked sent together.

enum NotificationType { expiring expired renewed email_failed system }

model Notification {
  id         BigInt           @id @default(autoincrement())
  serviceId  Int?             @map("service_id")
  type       NotificationType
  title      String           @db.VarChar(190)
  body       String?          @db.VarChar(500)
  dedupeKey  String           @unique @map("dedupe_key") @db.VarChar(120)  // "stage:12:2026-10-12:7"
  isRead     Boolean          @default(false) @map("is_read")
  createdAt  DateTime         @default(now()) @map("created_at") @db.Timestamptz
  service    Service?         @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  @@index([isRead, createdAt])
  @@map("notifications")
}

// ─────────────────────────── Config ───────────────────────────
model Setting {
  key        String   @id @db.VarChar(80)
  value      String?
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz
  @@map("settings")
}

model MessageTemplate {
  key        String   @id @db.VarChar(50)   // client_email | client_whatsapp | admin_email | admin_whatsapp
  subject    String?  @db.VarChar(190)
  body       String
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz
  @@map("message_templates")
}

model AuditLog {
  id        BigInt   @id @default(autoincrement())
  action    String   @db.VarChar(50)        // login.success, client.create, service.renew, …
  entity    String?  @db.VarChar(30)
  entityId  Int?     @map("entity_id")
  details   Json?
  ip        String?  @db.VarChar(45)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  @@index([action, createdAt])
  @@index([entity, entityId])
  @@map("audit_log")
}
```

## 3. Default settings (inserted by `prisma/seed.ts`)

| key | default |
|-----|---------|
| `business_name` | `Our Hosting` |
| `business_phone` | `` |
| `admin_email` | `` |
| `admin_whatsapp` | `` |
| `default_currency` | `PKR` |
| `threshold_orange_days` | `30` |
| `threshold_red_days` | `7` |
| `reminder_stages` | `30,15,7,3,1,0,-3,-6,-9` |
| `post_expiry_to_client` | `1` |
| `check_interval_minutes` | `60` |
| `auto_send_emails` | `0` |
| `auto_send_batch_size` | `10` (kept small for serverless time limits) |
| `last_check_at` | null |
| `smtp_host` | `smtp.hostinger.com` |
| `smtp_port` | `465` |
| `smtp_secure` | `1` |
| `smtp_username` | `` |
| `smtp_password_enc` | `` |
| `mail_from_email` | `` |
| `mail_from_name` | `Our Hosting` |

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
| `daysLeft` | `daysLeft(fromDbDate(s.renewalDate), todayPK())` in TS. In SQL filters, pass `today` as a parameter (`renewal_date - $1::date`). **Never use `CURRENT_DATE`**, because the DB runs in UTC |
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

Client search (name/company/email/phone/domain) uses `contains` with `mode: 'insensitive'` and an `OR` across client and service fields. That is fine up to thousands of rows. Add a `pg_trgm` index later only if it gets slow.

## 6. Data rules

- On delete: `Client` → cascades to services → cascades to payments, reminders and notifications.
- Changing `renewalDate` by hand: in the same transaction, set the pending/failed/opened reminders with the old `cycleDate` to `skipped`.
- `phone` is stored normalised (digits with country code). Show it formatted.
- `domain` is stored lowercase without `http(s)://`, `www.` or a trailing slash.

## 7. Seed & demo data

- `npx prisma db seed` → default settings + templates (idempotent `upsert`).
- `SEED_DEMO=1 npx prisma db seed` (development only) → about 12 clients / 15 services with dates **relative to today**: 3 green (60–300 days), 4 orange (10–30), 3 red (0–7), 2 expired (−2, −12), 1 cancelled, and 2 clients with 2 services each. It also adds a few payments and notifications.
