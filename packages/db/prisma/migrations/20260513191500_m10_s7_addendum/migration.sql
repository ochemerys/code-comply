-- CreateTable
CREATE TABLE "addendums" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT,

    CONSTRAINT "addendums_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "addendums_inspectionId_idx" ON "addendums"("inspectionId");

-- CreateIndex
CREATE INDEX "addendums_createdById_idx" ON "addendums"("createdById");

-- CreateIndex
CREATE INDEX "addendums_createdAt_idx" ON "addendums"("createdAt");

-- AddForeignKey
ALTER TABLE "addendums" ADD CONSTRAINT "addendums_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "permit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addendums" ADD CONSTRAINT "addendums_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
