-- NFR-M-04: Web Push subscriptions for inspector PWA re-engagement
CREATE TABLE "device_push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_push_subscriptions_endpoint_key" ON "device_push_subscriptions"("endpoint");

CREATE INDEX "device_push_subscriptions_userId_idx" ON "device_push_subscriptions"("userId");

CREATE UNIQUE INDEX "device_push_subscriptions_userId_deviceId_key" ON "device_push_subscriptions"("userId", "deviceId");

ALTER TABLE "device_push_subscriptions" ADD CONSTRAINT "device_push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
