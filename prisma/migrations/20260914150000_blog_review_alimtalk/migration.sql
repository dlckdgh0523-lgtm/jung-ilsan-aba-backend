-- Stage 2 of the blog sync: alimtalk review notifications + LLM-cleaned titles.
-- Additive only.

-- AlterTable: keep the original blog title next to the cleaned one
ALTER TABLE "articles" ADD COLUMN "source_title" TEXT;

-- AlterTable: how many review alimtalks went out in a run
ALTER TABLE "blog_sync_runs" ADD COLUMN "notified" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "article_reviews" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "summary" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "decided_at" TIMESTAMP(3),
    "decision" TEXT,
    "decided_via" TEXT,
    "notified_at" TIMESTAMP(3),
    "notify_error" TEXT,
    "provider_message_ids" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "article_reviews_article_id_key" ON "article_reviews"("article_id");
CREATE UNIQUE INDEX "article_reviews_token_hash_key" ON "article_reviews"("token_hash");

-- AddForeignKey
ALTER TABLE "article_reviews" ADD CONSTRAINT "article_reviews_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
