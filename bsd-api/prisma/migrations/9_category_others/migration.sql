-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "status" "CategoryStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "submittedAt" TIMESTAMP(3);

