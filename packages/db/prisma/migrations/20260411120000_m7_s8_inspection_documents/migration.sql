-- CreateTable
CREATE TABLE "inspection_documents" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inspection_documents_inspectionId_idx" ON "inspection_documents"("inspectionId");

-- CreateIndex
CREATE INDEX "inspection_documents_storageKey_idx" ON "inspection_documents"("storageKey");

-- AddForeignKey
ALTER TABLE "inspection_documents" ADD CONSTRAINT "inspection_documents_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "permit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
