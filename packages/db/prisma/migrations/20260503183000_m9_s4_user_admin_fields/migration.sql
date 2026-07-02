-- M9-S4: Admin registry fields on users (disciplines already existed)
ALTER TABLE "users" ADD COLUMN     "certificationExpiry" TIMESTAMP(3),
ADD COLUMN     "authorities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deactivatedAt" TIMESTAMP(3);
