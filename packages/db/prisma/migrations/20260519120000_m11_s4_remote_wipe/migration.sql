-- M11-S4: Remote wipe capability for lost/stolen inspector devices
ALTER TABLE "users" ADD COLUMN "remoteWipeRequestedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "remoteWipeConfirmedAt" TIMESTAMP(3);
