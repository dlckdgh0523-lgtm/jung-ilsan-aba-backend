-- Blog sync now imports posts as blog ARTICLES (draft), not notices.
-- articles: same provenance columns notices got in 20260913200000_blog_sync.
-- The notice columns are kept (harmless, already deployed).

-- AlterTable
ALTER TABLE "articles" ADD COLUMN "source_url" TEXT;
ALTER TABLE "articles" ADD COLUMN "source_id" TEXT;
ALTER TABLE "articles" ADD COLUMN "synced_at" TIMESTAMP(3);

-- CreateIndex (dedupe key: an article with the same source_url is never re-imported)
CREATE UNIQUE INDEX "articles_source_url_key" ON "articles"("source_url");
