-- AI/검색 크롤러 방문 기록 테이블 (추가 전용)
CREATE TABLE "bot_visits" (
    "id" TEXT NOT NULL,
    "bot" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bot_visits_bot_created_at_idx" ON "bot_visits"("bot", "created_at");
CREATE INDEX "bot_visits_created_at_idx" ON "bot_visits"("created_at");
