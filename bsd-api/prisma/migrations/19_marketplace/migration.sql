-- CreateEnum
CREATE TYPE "MarketKind" AS ENUM ('SELL', 'BUY', 'GIVEAWAY', 'SERVICE');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('PENDING', 'ACTIVE', 'RESERVED', 'SOLD', 'ARCHIVED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('BRAND_NEW', 'LIKE_NEW', 'USED_GOOD', 'FOR_PARTS');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "MarketCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "staged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MarketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafeSpot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postcodeDistrict" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SafeSpot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "kind" "MarketKind" NOT NULL,
    "isB2B" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pricePence" INTEGER,
    "negotiable" BOOLEAN NOT NULL DEFAULT false,
    "condition" "ItemCondition",
    "categoryId" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "postcodeDistrict" TEXT NOT NULL,
    "hideFullAddress" BOOLEAN NOT NULL DEFAULT true,
    "spotId" TEXT,
    "whatsapp" TEXT NOT NULL,
    "phone" TEXT,
    "offerPassDiscount" BOOLEAN NOT NULL DEFAULT false,
    "passDiscountNote" TEXT,
    "vatInvoice" BOOLEAN NOT NULL DEFAULT false,
    "bulkTerms" TEXT,
    "directoryBusinessId" TEXT,
    "status" "MarketStatus" NOT NULL DEFAULT 'PENDING',
    "removalReason" TEXT,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bumpedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketImage" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "thumbKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MarketImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSave" (
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSave_pkey" PRIMARY KEY ("userId","listingId")
);

-- CreateTable
CREATE TABLE "MarketReport" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "listingId" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "adminReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketCategory_name_key" ON "MarketCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MarketCategory_slug_key" ON "MarketCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MarketListing_slug_key" ON "MarketListing"("slug");

-- CreateIndex
CREATE INDEX "MarketListing_status_categoryId_bumpedAt_idx" ON "MarketListing"("status", "categoryId", "bumpedAt");

-- CreateIndex
CREATE INDEX "MarketListing_postcodeDistrict_idx" ON "MarketListing"("postcodeDistrict");

-- CreateIndex
CREATE INDEX "MarketListing_ownerUserId_idx" ON "MarketListing"("ownerUserId");

-- CreateIndex
CREATE INDEX "MarketImage_listingId_idx" ON "MarketImage"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketReport_listingId_reporterUserId_key" ON "MarketReport"("listingId", "reporterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_number_key" ON "SupportTicket"("number");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MarketCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "SafeSpot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_directoryBusinessId_fkey" FOREIGN KEY ("directoryBusinessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketImage" ADD CONSTRAINT "MarketImage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSave" ADD CONSTRAINT "MarketSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSave" ADD CONSTRAINT "MarketSave_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketReport" ADD CONSTRAINT "MarketReport_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketReport" ADD CONSTRAINT "MarketReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Ticket numbers (#BC-0001 style) come from this sequence. Prisma cannot express sequences.
CREATE SEQUENCE "support_ticket_seq" START 1;

-- The client's 11 tile grid, in order. Housing and Jobs are staged (hidden) until their own anti scam modules exist.
INSERT INTO "MarketCategory" ("id", "name", "slug", "sortOrder", "staged") VALUES
  ('mcat-buy-and-sell', 'Buy & Sell', 'buy-and-sell', 0, false),
  ('mcat-b2b-equipment', 'B2B Equipment', 'b2b-equipment', 1, false),
  ('mcat-home-cooks-and-halal-goods', 'Home Cooks & Halal Goods', 'home-cooks-and-halal-goods', 2, false),
  ('mcat-vehicles', 'Vehicles', 'vehicles', 3, false),
  ('mcat-cultural-goods', 'Cultural Goods', 'cultural-goods', 4, false),
  ('mcat-give-away', 'Give Away', 'give-away', 5, false),
  ('mcat-wanted-items-gigs', 'Wanted Items / Gigs', 'wanted-items-gigs', 6, false),
  ('mcat-housing-and-accommodation', 'Housing & Accommodation', 'housing-and-accommodation', 7, true),
  ('mcat-jobs-and-opportunities', 'Jobs & Opportunities', 'jobs-and-opportunities', 8, true),
  ('mcat-local-services', 'Local Services', 'local-services', 9, false),
  ('mcat-student-essentials', 'Student Essentials', 'student-essentials', 10, false);
