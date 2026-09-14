-- Naver blog → notice semi-automatic sync.
-- notices: provenance columns (nullable, additive — manual notices are untouched).
-- blog_sync_runs: one row per sync execution, for operations visibility.

-- AlterTable
ALTER TABLE "notices" ADD COLUMN "source_url" TEXT;
ALTER TABLE "notices" ADD COLUMN "source_id" TEXT;
ALTER TABLE "notices" ADD COLUMN "synced_at" TIMESTAMP(3);

-- CreateIndex (dedupe key: a notice with the same source_url is never re-imported)
CREATE UNIQUE INDEX "notices_source_url_key" ON "notices"("source_url");

-- CreateTable
CREATE TABLE "blog_sync_runs" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blog_sync_runs_started_at_idx" ON "blog_sync_runs"("started_at");
