-- Currency per client (docs/13 §6) and money columns wide enough for every
-- ISO 4217 minor unit (KWD, BHD, OMR, JOD, TND, LYD use 3 decimals).

-- AlterTable: widening only, existing values are unchanged.
ALTER TABLE "invoice_items" ALTER COLUMN "unit_amount" SET DATA TYPE DECIMAL(15,3),
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(15,3);

ALTER TABLE "invoices" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(15,3),
ALTER COLUMN "discount" SET DATA TYPE DECIMAL(15,3),
ALTER COLUMN "tax_amount" SET DATA TYPE DECIMAL(15,3),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(15,3);

ALTER TABLE "payments" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(15,3);

ALTER TABLE "services" ALTER COLUMN "charge_amount" SET DATA TYPE DECIMAL(15,3);

-- AlterTable: add the column empty, fill it, then make it required.
ALTER TABLE "clients" ADD COLUMN "currency" CHAR(3);

-- backfill:begin
-- Each client gets the currency most of their services use. Ties go to the
-- app default, then alphabetical. Clients without services get the app
-- default (the default_currency setting, else PKR).
UPDATE "clients" AS c
SET "currency" = COALESCE(
  (
    SELECT s."currency"
    FROM "services" AS s
    WHERE s."client_id" = c."id"
    GROUP BY s."currency"
    ORDER BY COUNT(*) DESC, (s."currency" = d."code") DESC, s."currency" ASC
    LIMIT 1
  ),
  d."code"
)
FROM (
  SELECT COALESCE(
    (SELECT UPPER(NULLIF(TRIM("value"), '')) FROM "settings" WHERE "key" = 'default_currency'),
    'PKR'
  )::CHAR(3) AS "code"
) AS d;
-- backfill:end

ALTER TABLE "clients" ALTER COLUMN "currency" SET NOT NULL;
