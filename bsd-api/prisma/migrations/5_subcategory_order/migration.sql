-- Subcategories get an admin-set position within their category. Additive: existing rows keep working.

-- AlterTable
ALTER TABLE "Subcategory" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Start from the order the site shows today (alphabetical within each category), so nothing moves on deploy.
UPDATE "Subcategory" AS s
SET "sortOrder" = ranked.position
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "categoryId" ORDER BY name) - 1 AS position
  FROM "Subcategory"
) AS ranked
WHERE s.id = ranked.id;
