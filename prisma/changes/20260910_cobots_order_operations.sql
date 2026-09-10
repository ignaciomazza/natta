-- Apply explicitly before enabling COBOTS_OPERATIONS_TOKEN. Additive change only.
CREATE TABLE IF NOT EXISTS "CobotsOrderOperation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "request" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CobotsOrderOperation_orderId_createdAt_idx" ON "CobotsOrderOperation"("orderId", "createdAt");
