-- Business email visibility. The address is always stored and always visible to admin; the public pages show it only when showEmail is true.

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "showEmail" BOOLEAN NOT NULL DEFAULT false;

-- Listings that already show an email keep showing it. New listings default to hidden.
UPDATE "Business" SET "showEmail" = true WHERE "email" IS NOT NULL AND "email" <> '';
