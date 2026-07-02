-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionHash" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_executions" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionHash" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_library" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "code_library_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checklist_templates_versionHash_key" ON "checklist_templates"("versionHash");

-- CreateIndex
CREATE INDEX "checklist_templates_discipline_idx" ON "checklist_templates"("discipline");

-- CreateIndex
CREATE INDEX "checklist_templates_isActive_idx" ON "checklist_templates"("isActive");

-- CreateIndex
CREATE INDEX "checklist_templates_discipline_isActive_idx" ON "checklist_templates"("discipline", "isActive");

-- CreateIndex
CREATE INDEX "checklist_executions_inspectionId_idx" ON "checklist_executions"("inspectionId");

-- CreateIndex
CREATE INDEX "checklist_executions_templateId_idx" ON "checklist_executions"("templateId");

-- CreateIndex
CREATE INDEX "checklist_executions_versionHash_idx" ON "checklist_executions"("versionHash");

-- CreateIndex
CREATE INDEX "checklist_executions_inspectionId_templateId_idx" ON "checklist_executions"("inspectionId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "code_library_code_section_key" ON "code_library"("code", "section");

-- CreateIndex
CREATE INDEX "code_library_section_idx" ON "code_library"("section");

-- AddForeignKey
ALTER TABLE "checklist_executions" ADD CONSTRAINT "checklist_executions_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "permit_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_executions" ADD CONSTRAINT "checklist_executions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
