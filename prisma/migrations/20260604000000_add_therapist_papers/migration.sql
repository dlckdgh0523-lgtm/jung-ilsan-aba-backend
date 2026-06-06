-- Therapist publications/papers ([{ year, title }]). Non-breaking: NOT NULL with default '[]',
-- so all existing therapist rows get an empty list and are unaffected.
ALTER TABLE "therapists" ADD COLUMN "papers" JSONB NOT NULL DEFAULT '[]';
