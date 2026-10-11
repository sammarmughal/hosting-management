-- AlterEnum
ALTER TYPE "InvoiceEventType" ADD VALUE 'details_refreshed';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "address" VARCHAR(300);
