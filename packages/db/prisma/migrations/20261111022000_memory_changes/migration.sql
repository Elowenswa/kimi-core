CREATE TABLE "memory_changes" (
    "id" TEXT NOT NULL,
    "changeId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "versionVector" JSONB,
    "snapshot" JSONB NOT NULL,
    "emittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_changes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "memory_changes_changeId_key" ON "memory_changes"("changeId");
CREATE INDEX "memory_changes_namespace_emittedAt_id_idx" ON "memory_changes"("namespace", "emittedAt", "id");
CREATE INDEX "memory_changes_memoryId_emittedAt_idx" ON "memory_changes"("memoryId", "emittedAt");
