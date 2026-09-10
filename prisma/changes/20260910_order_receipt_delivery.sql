CREATE TABLE IF NOT EXISTS "OrderReceiptDelivery" (
 "id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL, "actorUserId" TEXT,
 "origin" TEXT NOT NULL, "connectionId" TEXT, "body" JSONB NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "providerId" TEXT, "lastError" TEXT,
 "lockedUntil" TIMESTAMP(3), "firstAttemptAt" TIMESTAMP(3) NOT NULL,
 "sentAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "OrderReceiptDelivery_orderId_createdAt_idx" ON "OrderReceiptDelivery"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderReceiptDelivery_orderId_status_idx" ON "OrderReceiptDelivery"("orderId", "status");
