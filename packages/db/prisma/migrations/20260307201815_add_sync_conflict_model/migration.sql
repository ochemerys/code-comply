-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "clientVersion" JSONB NOT NULL,
    "serverVersion" JSONB NOT NULL,
    "resolution" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_conflicts_entityType_idx" ON "sync_conflicts"("entityType");

-- CreateIndex
CREATE INDEX "sync_conflicts_entityId_idx" ON "sync_conflicts"("entityId");

-- CreateIndex
CREATE INDEX "sync_conflicts_resolution_idx" ON "sync_conflicts"("resolution");

-- CreateIndex
CREATE INDEX "sync_conflicts_resolvedAt_idx" ON "sync_conflicts"("resolvedAt");
