-- CreateEnum
CREATE TYPE "SessionStage" AS ENUM ('password_ok', 'full');

-- CreateEnum
CREATE TYPE "AttemptStep" AS ENUM ('password', 'totp', 'recovery', 'reset');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('active', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'bank_transfer', 'jazzcash', 'easypaisa', 'other');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('email', 'whatsapp');

-- CreateEnum
CREATE TYPE "ReminderRecipient" AS ENUM ('client', 'admin');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('pending', 'sent', 'opened', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('expiring', 'expired', 'renewed', 'email_failed', 'system');

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(190) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret_enc" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_last_step" INTEGER,
    "recovery_codes" JSONB,
    "last_login_at" TIMESTAMPTZ,
    "last_login_ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "stage" "SessionStage" NOT NULL,
    "user_agent" VARCHAR(300),
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "pending_totp_secret_enc" TEXT,
    "totp_failures" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" BIGSERIAL NOT NULL,
    "ip" VARCHAR(45) NOT NULL,
    "identifier" VARCHAR(190) NOT NULL,
    "step" "AttemptStep" NOT NULL DEFAULT 'password',
    "success" BOOLEAN NOT NULL,
    "attempted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" SERIAL NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "company" VARCHAR(150),
    "email" VARCHAR(190),
    "phone" VARCHAR(20),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "domain" VARCHAR(190) NOT NULL,
    "plan_label" VARCHAR(100),
    "start_date" DATE NOT NULL,
    "renewal_date" DATE NOT NULL,
    "charge_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "status" "ServiceStatus" NOT NULL DEFAULT 'active',
    "reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "service_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "paid_on" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "reference" VARCHAR(100),
    "period_from" DATE NOT NULL,
    "period_to" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" BIGSERIAL NOT NULL,
    "service_id" INTEGER NOT NULL,
    "cycle_date" DATE NOT NULL,
    "stage" SMALLINT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "recipient" "ReminderRecipient" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'pending',
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "service_id" INTEGER,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(190) NOT NULL,
    "body" VARCHAR(500),
    "dedupe_key" VARCHAR(120) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "key" VARCHAR(50) NOT NULL,
    "subject" VARCHAR(190),
    "body" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "entity" VARCHAR(30),
    "entity_id" INTEGER,
    "details" JSONB,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "sessions_admin_id_idx" ON "sessions"("admin_id");

-- CreateIndex
CREATE INDEX "login_attempts_ip_attempted_at_idx" ON "login_attempts"("ip", "attempted_at");

-- CreateIndex
CREATE INDEX "login_attempts_identifier_attempted_at_idx" ON "login_attempts"("identifier", "attempted_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- CreateIndex
CREATE INDEX "clients_email_idx" ON "clients"("email");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "services_status_renewal_date_idx" ON "services"("status", "renewal_date");

-- CreateIndex
CREATE INDEX "services_domain_idx" ON "services"("domain");

-- CreateIndex
CREATE INDEX "payments_service_id_paid_on_idx" ON "payments"("service_id", "paid_on");

-- CreateIndex
CREATE INDEX "reminders_status_created_at_idx" ON "reminders"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reminders_service_id_cycle_date_stage_channel_recipient_key" ON "reminders"("service_id", "cycle_date", "stage", "channel", "recipient");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_is_read_created_at_idx" ON "notifications"("is_read", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_action_created_at_idx" ON "audit_log"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
