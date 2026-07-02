-- A-02: External municipal permit feed (separate from agency permit catalog)

CREATE TABLE "municipal_permit_feed" (
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

    CONSTRAINT "municipal_permit_feed_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "municipal_permit_feed_permitNumber_key" ON "municipal_permit_feed"("permitNumber");
CREATE INDEX "municipal_permit_feed_status_idx" ON "municipal_permit_feed"("status");
CREATE INDEX "municipal_permit_feed_permitNumber_idx" ON "municipal_permit_feed"("permitNumber");
