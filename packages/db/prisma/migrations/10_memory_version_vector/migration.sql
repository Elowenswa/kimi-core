-- Multi-device causal version vectors for Memory conflict detection.
-- NULL keeps legacy rows compatible; new clients write a JSON object keyed by device id.
ALTER TABLE "memories" ADD COLUMN "versionVector" JSONB;
