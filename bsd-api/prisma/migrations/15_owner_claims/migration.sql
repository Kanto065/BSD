-- AlterTable
ALTER TABLE "ListingClaimRequest" ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "linkedOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proofBytes" INTEGER,
ADD COLUMN     "proofKey" TEXT,
ADD COLUMN     "proofType" TEXT,
ADD COLUMN     "purgeAt" TIMESTAMP(3),
ADD COLUMN     "purgedAt" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "ListingClaimRequest_userId_idx" ON "ListingClaimRequest"("userId");

-- CreateIndex
CREATE INDEX "ListingClaimRequest_purgeAt_idx" ON "ListingClaimRequest"("purgeAt");

-- AddForeignKey
ALTER TABLE "ListingClaimRequest" ADD CONSTRAINT "ListingClaimRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand written, Prisma cannot express a partial index. One waiting claim per member per listing (anonymous rows have no userId and are not limited).
CREATE UNIQUE INDEX "ListingClaimRequest_one_pending" ON "ListingClaimRequest"("userId", "businessId") WHERE "status" = 'PENDING' AND "userId" IS NOT NULL;
