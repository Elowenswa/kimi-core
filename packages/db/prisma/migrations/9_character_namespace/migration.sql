-- Character/workspace isolation for chat events and memories.
-- Existing rows intentionally remain NULL (legacy/global) and are not copied
-- into any character namespace.
ALTER TABLE "memories" ADD COLUMN "namespace" TEXT;
ALTER TABLE "events" ADD COLUMN "namespace" TEXT;

CREATE INDEX "memories_namespace_isActive_memoryType_idx"
  ON "memories"("namespace", "isActive", "memoryType");
CREATE INDEX "memories_namespace_createdAt_idx"
  ON "memories"("namespace", "createdAt");
CREATE INDEX "events_namespace_eventType_source_createdAt_idx"
  ON "events"("namespace", "eventType", "source", "createdAt");
