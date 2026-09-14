-- Articles can now link MULTIPLE related programs/locations.
-- Additive: new JSONB array columns, backfilled from the legacy single columns
-- (which stay and keep mirroring the first array element).

-- AlterTable
ALTER TABLE "articles" ADD COLUMN "related_programs" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "articles" ADD COLUMN "related_locations" JSONB NOT NULL DEFAULT '[]';

-- Backfill from legacy single-value columns
UPDATE "articles"
SET "related_programs" = to_jsonb(ARRAY["related_program"])
WHERE "related_program" IS NOT NULL AND "related_program" <> '';

UPDATE "articles"
SET "related_locations" = to_jsonb(ARRAY["related_location"])
WHERE "related_location" IS NOT NULL AND "related_location" <> '';
