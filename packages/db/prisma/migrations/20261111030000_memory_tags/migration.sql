-- User-defined labels for namespace-scoped Memory retrieval.
-- JSONB keeps the existing append-only Memory shape compatible while allowing
-- PostgreSQL to use the ?| operator for any-tag filtering.
ALTER TABLE "memories"
  ADD COLUMN "tags" JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX "memories_namespace_tags_active_idx"
  ON "memories"("namespace", "isActive");
