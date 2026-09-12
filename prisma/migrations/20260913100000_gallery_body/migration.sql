-- Gallery items gain an optional long-form description (shown in the lightbox).
-- Additive & nullable: existing rows are unaffected.
ALTER TABLE "gallery_items" ADD COLUMN "body" TEXT;
