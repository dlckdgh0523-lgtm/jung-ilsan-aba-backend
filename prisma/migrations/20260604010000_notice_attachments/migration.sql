-- Notice cover image + downloadable file attachments ([{ name, url, size }]).
-- Non-breaking: image is nullable; attachments is NOT NULL with default '[]'.
ALTER TABLE "notices" ADD COLUMN "image" TEXT;
ALTER TABLE "notices" ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '[]';
