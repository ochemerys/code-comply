-- CreateEnum
CREATE TYPE "VoCMethod" AS ENUM ('WRITTEN_ASSURANCE', 'SITE_VISIT', 'VERBAL_ASSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "VoCStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "verification_of_compliance" (
    "id" TEXT NOT NULL,
    "deficiencyId" TEXT NOT NULL,
    "verificationDate" TIMESTAMP(3) NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" "VoCMethod" NOT NULL,
    "comments" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "status" "VoCStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "verification_of_compliance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_of_compliance_deficiencyId_key" ON "verification_of_compliance"("deficiencyId");

-- CreateIndex
CREATE INDEX "verification_of_compliance_status_idx" ON "verification_of_compliance"("status");

-- CreateIndex
CREATE INDEX "verification_of_compliance_reviewedById_idx" ON "verification_of_compliance"("reviewedById");

-- AddForeignKey
ALTER TABLE "verification_of_compliance" ADD CONSTRAINT "verification_of_compliance_deficiencyId_fkey" FOREIGN KEY ("deficiencyId") REFERENCES "deficiencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_of_compliance" ADD CONSTRAINT "verification_of_compliance_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
