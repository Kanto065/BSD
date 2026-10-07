-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RedeemMethod" AS ENUM ('QR', 'CODE');

-- CreateTable
CREATE TABLE "PrivilegeCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "secret" TEXT NOT NULL,
    "deviceHash" TEXT,
    "deviceBoundAt" TIMESTAMP(3),
    "deviceMoves" INTEGER NOT NULL DEFAULT 0,
    "deviceMovesResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivilegeCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivilegeOffer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "percent" DECIMAL(5,2),
    "terms" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivilegeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivilegeCode" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PrivilegeCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivilegeRedemption" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "scannedByUserId" TEXT NOT NULL,
    "method" "RedeemMethod" NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "billPence" INTEGER,
    "savingPence" INTEGER,

    CONSTRAINT "PrivilegeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrivilegeCard_userId_key" ON "PrivilegeCard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivilegeCard_cardNumber_key" ON "PrivilegeCard"("cardNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PrivilegeOffer_businessId_key" ON "PrivilegeOffer"("businessId");

-- CreateIndex
CREATE INDEX "PrivilegeCode_cardId_idx" ON "PrivilegeCode"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivilegeCode_offerId_code_key" ON "PrivilegeCode"("offerId", "code");

-- CreateIndex
CREATE INDEX "PrivilegeRedemption_businessId_scannedAt_idx" ON "PrivilegeRedemption"("businessId", "scannedAt");

-- CreateIndex
CREATE INDEX "PrivilegeRedemption_cardId_scannedAt_idx" ON "PrivilegeRedemption"("cardId", "scannedAt");

-- AddForeignKey
ALTER TABLE "PrivilegeCard" ADD CONSTRAINT "PrivilegeCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivilegeOffer" ADD CONSTRAINT "PrivilegeOffer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivilegeOffer" ADD CONSTRAINT "PrivilegeOffer_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivilegeCode" ADD CONSTRAINT "PrivilegeCode_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "PrivilegeCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivilegeCode" ADD CONSTRAINT "PrivilegeCode_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PrivilegeOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivilegeRedemption" ADD CONSTRAINT "PrivilegeRedemption_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "PrivilegeCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivilegeRedemption" ADD CONSTRAINT "PrivilegeRedemption_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PrivilegeOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

