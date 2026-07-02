-- LSC-A-06: electronic signing metadata on generated reports (Prisma field names)
ALTER TABLE "reports" ADD COLUMN "signedAt" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN "signatureImage" TEXT;
ALTER TABLE "reports" ADD COLUMN "signedByUserId" TEXT;
