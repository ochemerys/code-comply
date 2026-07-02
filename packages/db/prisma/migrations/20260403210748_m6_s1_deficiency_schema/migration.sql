-- AlterTable
ALTER TABLE "deficiencies" ADD COLUMN     "checklistItemId" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "isStopWork" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isUnsafe" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "deficiencies_checklistItemId_idx" ON "deficiencies"("checklistItemId");

-- CreateIndex
CREATE INDEX "deficiencies_isStopWork_idx" ON "deficiencies"("isStopWork");
