-- A-05 Stop Work escalation tracking (service date, appeal deadline, lock-out)
CREATE TABLE "stop_work_escalations" (
    "id" TEXT NOT NULL,
    "deficiencyId" TEXT NOT NULL,
    "servedAt" TIMESTAMP(3) NOT NULL,
    "appealDeadline" TIMESTAMP(3) NOT NULL,
    "lockedOut" BOOLEAN NOT NULL DEFAULT true,
    "lockOutOverriddenAt" TIMESTAMP(3),
    "lockOutOverriddenById" TEXT,
    "lockOutOverrideReason" TEXT,
    "emailDeliveries" JSONB NOT NULL DEFAULT '[]',
    "smsDeliveredAt" TIMESTAMP(3),
    "smsDeliveryLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stop_work_escalations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stop_work_escalations_deficiencyId_key" ON "stop_work_escalations"("deficiencyId");
CREATE INDEX "stop_work_escalations_appealDeadline_idx" ON "stop_work_escalations"("appealDeadline");
CREATE INDEX "stop_work_escalations_lockedOut_idx" ON "stop_work_escalations"("lockedOut");

ALTER TABLE "stop_work_escalations" ADD CONSTRAINT "stop_work_escalations_deficiencyId_fkey" FOREIGN KEY ("deficiencyId") REFERENCES "deficiencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stop_work_escalations" ADD CONSTRAINT "stop_work_escalations_lockOutOverriddenById_fkey" FOREIGN KEY ("lockOutOverriddenById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
