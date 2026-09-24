-- v2 schema: coverage zones and localities, postcode and zone on Business, community
-- verification status, claim requests, VOLUNTEER role and the four v2 contact mailboxes.
--
-- Generated with `prisma migrate diff` from the 0_init schema to the v2 schema, then edited by hand:
--   1. a guard that aborts cleanly if the tables it cannot backfill have any rows,
--   2. the ContactType change rewritten without a nested transaction,
--   3. the whole script wrapped in one transaction so it applies fully or not at all.
--
-- Production had zero rows in "Business", "BusinessPhoto" and "ContactMessage" on 2026-09-25.
-- The old CoverageArea rows (8 towns) are dropped. Their replacements are seeded by prisma/seed.ts.

BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM "Business") > 0 THEN
    RAISE EXCEPTION 'v2 migration aborted: "Business" has rows. Add a backfill for postcode, postcodeDistrict and zoneId first.';
  END IF;
  IF (SELECT count(*) FROM "ContactMessage") > 0 THEN
    RAISE EXCEPTION 'v2 migration aborted: "ContactMessage" has rows. Map the old ContactType values to the v2 mailboxes first.';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NEWLY_LISTED', 'PENDING_VERIFICATION', 'COMMUNITY_VERIFIED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AdminRole" ADD VALUE 'VOLUNTEER';

-- AlterEnum
ALTER TYPE "ContactType" RENAME TO "ContactType_old";
CREATE TYPE "ContactType" AS ENUM ('SUPPORT', 'COMPLIANCE', 'COMMUNITY', 'ADMIN');
ALTER TABLE "ContactMessage" ALTER COLUMN "type" TYPE "ContactType" USING ("type"::text::"ContactType");
DROP TYPE "ContactType_old";

-- DropForeignKey
ALTER TABLE "BusinessCoverageArea" DROP CONSTRAINT "BusinessCoverageArea_businessId_fkey";

-- DropForeignKey
ALTER TABLE "BusinessCoverageArea" DROP CONSTRAINT "BusinessCoverageArea_coverageAreaId_fkey";

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "postcode" TEXT NOT NULL,
ADD COLUMN     "postcodeDistrict" TEXT NOT NULL,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NEWLY_LISTED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT,
ADD COLUMN     "whatsapp" TEXT,
ADD COLUMN     "zoneId" TEXT NOT NULL;

-- DropTable
DROP TABLE "CoverageArea";

-- DropTable
DROP TABLE "BusinessCoverageArea";

-- CreateTable
CREATE TABLE "CoverageZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "postcodeDistricts" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CoverageZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Locality" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "Locality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessLocality" (
    "businessId" TEXT NOT NULL,
    "localityId" TEXT NOT NULL,

    CONSTRAINT "BusinessLocality_pkey" PRIMARY KEY ("businessId","localityId")
);

-- CreateTable
CREATE TABLE "BusinessServedZone" (
    "businessId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,

    CONSTRAINT "BusinessServedZone_pkey" PRIMARY KEY ("businessId","zoneId")
);

-- CreateTable
CREATE TABLE "ListingClaimRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "claimantName" TEXT NOT NULL,
    "claimantEmail" TEXT NOT NULL,
    "claimantPhone" TEXT,
    "proofText" TEXT NOT NULL,
    "proofFileUrl" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "ListingClaimRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoverageZone_name_key" ON "CoverageZone"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageZone_slug_key" ON "CoverageZone"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Locality_slug_key" ON "Locality"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Locality_zoneId_name_key" ON "Locality"("zoneId", "name");

-- CreateIndex
CREATE INDEX "Business_status_verificationStatus_idx" ON "Business"("status", "verificationStatus");

-- CreateIndex
CREATE INDEX "Business_zoneId_idx" ON "Business"("zoneId");

-- CreateIndex
CREATE INDEX "Business_postcodeDistrict_idx" ON "Business"("postcodeDistrict");

-- CreateIndex
CREATE INDEX "Business_categoryId_idx" ON "Business"("categoryId");

-- AddForeignKey
ALTER TABLE "Locality" ADD CONSTRAINT "Locality_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "CoverageZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "CoverageZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessLocality" ADD CONSTRAINT "BusinessLocality_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessLocality" ADD CONSTRAINT "BusinessLocality_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessServedZone" ADD CONSTRAINT "BusinessServedZone_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessServedZone" ADD CONSTRAINT "BusinessServedZone_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "CoverageZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingClaimRequest" ADD CONSTRAINT "ListingClaimRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingClaimRequest" ADD CONSTRAINT "ListingClaimRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
