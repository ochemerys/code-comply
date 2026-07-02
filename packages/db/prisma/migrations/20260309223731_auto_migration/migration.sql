-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "permit_inspections" ADD COLUMN     "permitId" TEXT;

-- CreateTable
CREATE TABLE "permits" (
    "id" TEXT NOT NULL,
    "permitNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "legalLandDesc" TEXT,
    "scope" TEXT NOT NULL,
    "status" "PermitStatus" NOT NULL DEFAULT 'ACTIVE',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permits_permitNumber_key" ON "permits"("permitNumber");

-- CreateIndex
CREATE INDEX "permits_permitNumber_idx" ON "permits"("permitNumber");

-- CreateIndex
CREATE INDEX "permits_status_idx" ON "permits"("status");

-- CreateIndex
CREATE INDEX "permits_latitude_longitude_idx" ON "permits"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "permits_address_idx" ON "permits"("address");

-- CreateIndex
CREATE INDEX "permit_inspections_permitId_idx" ON "permit_inspections"("permitId");

-- AddForeignKey
ALTER TABLE "permit_inspections" ADD CONSTRAINT "permit_inspections_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "permits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
