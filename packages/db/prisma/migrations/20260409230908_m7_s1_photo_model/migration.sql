-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "deficiencyId" TEXT,
    "inspectionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT,
    "metadata" JSONB NOT NULL,
    "annotations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "photos_clientId_key" ON "photos"("clientId");

-- CreateIndex
CREATE INDEX "photos_clientId_idx" ON "photos"("clientId");

-- CreateIndex
CREATE INDEX "photos_inspectionId_idx" ON "photos"("inspectionId");

-- CreateIndex
CREATE INDEX "photos_deficiencyId_idx" ON "photos"("deficiencyId");

-- CreateIndex
CREATE INDEX "photos_storageKey_idx" ON "photos"("storageKey");

-- CreateIndex
CREATE INDEX "photos_syncedAt_idx" ON "photos"("syncedAt");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "permit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_deficiencyId_fkey" FOREIGN KEY ("deficiencyId") REFERENCES "deficiencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
