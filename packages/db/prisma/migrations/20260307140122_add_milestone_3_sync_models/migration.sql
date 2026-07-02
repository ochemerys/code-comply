-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeficiencySeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DeficiencyStatus" AS ENUM ('OPEN', 'VOC_SUBMITTED', 'VOC_ACCEPTED', 'VOC_REJECTED', 'CLOSED');

-- CreateTable
CREATE TABLE "permit_inspections" (
    "id" TEXT NOT NULL,
    "esiteId" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "notes" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permit_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_schedules" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inspection_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deficiencies" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "esiteId" TEXT,
    "inspectionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "severity" "DeficiencySeverity" NOT NULL,
    "status" "DeficiencyStatus" NOT NULL DEFAULT 'OPEN',
    "codeReference" JSONB,
    "vocSubmittedAt" TIMESTAMP(3),
    "vocAcceptedAt" TIMESTAMP(3),
    "vocRejectedAt" TIMESTAMP(3),
    "vocNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3),
    "etag" TEXT,

    CONSTRAINT "deficiencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permit_inspections_esiteId_key" ON "permit_inspections"("esiteId");

-- CreateIndex
CREATE INDEX "permit_inspections_esiteId_idx" ON "permit_inspections"("esiteId");

-- CreateIndex
CREATE INDEX "permit_inspections_status_idx" ON "permit_inspections"("status");

-- CreateIndex
CREATE INDEX "permit_inspections_lastSyncedAt_idx" ON "permit_inspections"("lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_schedules_inspectionId_key" ON "inspection_schedules"("inspectionId");

-- CreateIndex
CREATE INDEX "inspection_schedules_assignedToId_idx" ON "inspection_schedules"("assignedToId");

-- CreateIndex
CREATE INDEX "inspection_schedules_assignedDate_idx" ON "inspection_schedules"("assignedDate");

-- CreateIndex
CREATE UNIQUE INDEX "deficiencies_clientId_key" ON "deficiencies"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "deficiencies_esiteId_key" ON "deficiencies"("esiteId");

-- CreateIndex
CREATE INDEX "deficiencies_clientId_idx" ON "deficiencies"("clientId");

-- CreateIndex
CREATE INDEX "deficiencies_esiteId_idx" ON "deficiencies"("esiteId");

-- CreateIndex
CREATE INDEX "deficiencies_inspectionId_idx" ON "deficiencies"("inspectionId");

-- CreateIndex
CREATE INDEX "deficiencies_status_idx" ON "deficiencies"("status");

-- CreateIndex
CREATE INDEX "deficiencies_syncedAt_idx" ON "deficiencies"("syncedAt");

-- AddForeignKey
ALTER TABLE "inspection_schedules" ADD CONSTRAINT "inspection_schedules_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "permit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_schedules" ADD CONSTRAINT "inspection_schedules_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deficiencies" ADD CONSTRAINT "deficiencies_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "permit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deficiencies" ADD CONSTRAINT "deficiencies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
