-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('GENERAL', 'STUDENT');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "submittedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "ownerEditedAt" TIMESTAMP(3),
ADD COLUMN     "ownerUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Business_ownerUserId_idx" ON "Business"("ownerUserId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

