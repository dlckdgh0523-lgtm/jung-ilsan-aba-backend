-- Idempotency key for POST /consultations (dedup double-click / network retry / browser resend).
-- Nullable + unique: Postgres allows multiple NULLs, so existing rows are unaffected.
ALTER TABLE "consultations" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "consultations_idempotency_key_key" ON "consultations"("idempotency_key");
