-- M11-S11: Database query optimization — composite indexes for hot query paths

-- PermitInspection: compliance search, assigned lists, date ordering
CREATE INDEX "permit_inspections_scheduledDate_idx" ON "permit_inspections"("scheduledDate");
CREATE INDEX "permit_inspections_status_scheduledDate_idx" ON "permit_inspections"("status", "scheduledDate");
CREATE INDEX "permit_inspections_inspectorId_status_idx" ON "permit_inspections"("inspectorId", "status");

-- InspectionSchedule: workload and available-inspector counts
CREATE INDEX "inspection_schedules_assignedToId_assignedDate_idx" ON "inspection_schedules"("assignedToId", "assignedDate");

-- Deficiency: sync pull and ownership filters
CREATE INDEX "deficiencies_inspectionId_syncedAt_idx" ON "deficiencies"("inspectionId", "syncedAt");
CREATE INDEX "deficiencies_createdById_idx" ON "deficiencies"("createdById");

-- VerificationOfCompliance: pending queue
CREATE INDEX "verification_of_compliance_status_submittedAt_idx" ON "verification_of_compliance"("status", "submittedAt");

-- User: admin registry and assignment candidate queries
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- Report: distribution lookups
CREATE INDEX "reports_inspectionId_type_distributedAt_idx" ON "reports"("inspectionId", "type", "distributedAt");
