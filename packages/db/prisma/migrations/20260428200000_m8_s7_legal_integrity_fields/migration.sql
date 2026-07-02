-- M8-S7: Legal integrity fields on permit_inspections

ALTER TABLE "permit_inspections"
ADD COLUMN     "uniqueId" TEXT,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "inspectorId" TEXT,
ADD COLUMN     "certificationSnapshot" JSONB,
ADD COLUMN     "startGps" JSONB,
ADD COLUMN     "finalizeGps" JSONB,
ADD COLUMN     "documentHash" TEXT;

CREATE UNIQUE INDEX "permit_inspections_uniqueId_key" ON "permit_inspections"("uniqueId");
CREATE INDEX "permit_inspections_inspectorId_idx" ON "permit_inspections"("inspectorId");

ALTER TABLE "permit_inspections"
ADD CONSTRAINT "permit_inspections_inspectorId_fkey"
FOREIGN KEY ("inspectorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

