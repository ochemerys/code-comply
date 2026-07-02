-- CreateEnum
CREATE TYPE "InspectionStage" AS ENUM ('FOUNDATION', 'FRAMING', 'ROUGH_IN', 'INSULATION', 'FINAL', 'OTHER');

-- AlterTable
ALTER TABLE "permits" ADD COLUMN "reInspectionFeeFlagged" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "inspection_workflows" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "requestedDate" TIMESTAMP(3),
    "plannedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "stages" "InspectionStage"[] DEFAULT ARRAY[]::"InspectionStage"[],
    "otherStageDescription" TEXT,
    "noFurtherInspectionsRequired" BOOLEAN NOT NULL DEFAULT false,
    "firstNotificationDate" TIMESTAMP(3),
    "secondNotificationDate" TIMESTAMP(3),
    "unableToEnterComments" TEXT,
    "geofenceProof" JSONB,
    "reInspectionFeeFlagged" BOOLEAN NOT NULL DEFAULT false,
    "reInspectionFeeFlaggedAt" TIMESTAMP(3),
    "ownerNotificationSentAt" TIMESTAMP(3),
    "ownerNotificationEmail" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inspection_workflows_inspectionId_key" ON "inspection_workflows"("inspectionId");

-- CreateIndex
CREATE INDEX "inspection_workflows_reInspectionFeeFlagged_idx" ON "inspection_workflows"("reInspectionFeeFlagged");

-- CreateIndex
CREATE INDEX "permits_reInspectionFeeFlagged_idx" ON "permits"("reInspectionFeeFlagged");

-- AddForeignKey
ALTER TABLE "inspection_workflows" ADD CONSTRAINT "inspection_workflows_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "permit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
