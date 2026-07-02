-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('INSPECTION', 'DEFICIENCY', 'NO_ENTRY', 'STOP_WORK');

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "distributedAt" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_inspectionId_idx" ON "reports"("inspectionId");

-- CreateIndex
CREATE INDEX "reports_storageKey_idx" ON "reports"("storageKey");

-- CreateIndex
CREATE INDEX "reports_hash_idx" ON "reports"("hash");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "permit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
