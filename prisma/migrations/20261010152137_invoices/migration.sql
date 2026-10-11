-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('issued', 'sent', 'paid', 'void');

-- CreateEnum
CREATE TYPE "InvoiceEventType" AS ENUM ('created', 'updated', 'email_sent', 'email_failed', 'whatsapp_opened', 'whatsapp_marked_sent', 'link_viewed', 'pdf_downloaded', 'paid', 'voided', 'link_regenerated');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'invoice_created';

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "number" VARCHAR(40) NOT NULL,
    "client_id" INTEGER NOT NULL,
    "service_id" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'issued',
    "bill_to" JSONB NOT NULL,
    "seller" JSONB NOT NULL,
    "notes" TEXT,
    "public_token" VARCHAR(64) NOT NULL,
    "public_token_revoked_at" TIMESTAMPTZ,
    "first_sent_at" TIMESTAMPTZ,
    "paid_at" DATE,
    "payment_id" INTEGER,
    "voided_at" TIMESTAMPTZ,
    "void_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "description" VARCHAR(300) NOT NULL,
    "period_label" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_amount" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_events" (
    "id" BIGSERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "type" "InvoiceEventType" NOT NULL,
    "details" JSONB,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" VARCHAR(120) NOT NULL,
    "window_start" TIMESTAMPTZ NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key","window_start")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_public_token_key" ON "invoices"("public_token");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payment_id_key" ON "invoices"("payment_id");

-- CreateIndex
CREATE INDEX "invoices_status_due_date_idx" ON "invoices"("status", "due_date");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

-- CreateIndex
CREATE INDEX "invoices_issue_date_idx" ON "invoices"("issue_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_service_id_period_start_key" ON "invoices"("service_id", "period_start");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_events_invoice_id_created_at_idx" ON "invoice_events"("invoice_id", "created_at");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_events" ADD CONSTRAINT "invoice_events_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
