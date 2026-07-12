-- Scheduled broadcasts: send at a future time instead of immediately.
ALTER TABLE "Broadcast" ADD COLUMN "scheduledFor" TIMESTAMP(3);
