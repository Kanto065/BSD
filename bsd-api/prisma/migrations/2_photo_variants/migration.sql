-- Stored images get a thumbnail URL and their pixel dimensions (see BusinessPhoto in schema.prisma).
-- Additive and nullable, so it applies cleanly on top of existing rows.

-- AlterTable
ALTER TABLE "BusinessPhoto" ADD COLUMN     "height" INTEGER,
ADD COLUMN     "thumbUrl" TEXT,
ADD COLUMN     "width" INTEGER;

