-- 블로그 동기화 GEO 검수 결과 저장 컬럼 (추가 전용)
ALTER TABLE "articles" ADD COLUMN "geo_analysis" JSONB;
