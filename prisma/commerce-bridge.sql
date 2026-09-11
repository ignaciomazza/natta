-- One-time, additive migration. Run explicitly after approval; never during builds.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtextextended('natta:commerce-bridge:migration', 0));
CREATE TABLE IF NOT EXISTS "CommerceBridgeConfig" ("id" TEXT PRIMARY KEY, "enabled" BOOLEAN NOT NULL DEFAULT false, "settings" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "CommerceOutbox" ("orderId" TEXT PRIMARY KEY, "version" INTEGER NOT NULL DEFAULT 1, "pushedVersion" INTEGER NOT NULL DEFAULT 0, "lastAttemptAt" TIMESTAMP(3), "lastError" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE OR REPLACE FUNCTION commerce_order_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" := GREATEST(date_trunc('milliseconds', clock_timestamp()), OLD."updatedAt" + interval '1 millisecond');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS commerce_order_revision ON "Order";
CREATE TRIGGER commerce_order_revision BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION commerce_order_revision();
CREATE OR REPLACE FUNCTION commerce_enqueue_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "CommerceOutbox" ("orderId", "version", "updatedAt") VALUES (NEW.id, 1, CURRENT_TIMESTAMP)
  ON CONFLICT ("orderId") DO UPDATE SET "version" = "CommerceOutbox"."version" + 1, "updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS commerce_enqueue_order ON "Order";
CREATE TRIGGER commerce_enqueue_order AFTER INSERT OR UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION commerce_enqueue_order();
CREATE OR REPLACE FUNCTION commerce_touch_parent_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'DELETE' AND NEW."orderId" IS NOT NULL THEN UPDATE "Order" SET "updatedAt" = CURRENT_TIMESTAMP WHERE id = NEW."orderId"; END IF;
  IF TG_OP = 'DELETE' THEN UPDATE "Order" SET "updatedAt" = CURRENT_TIMESTAMP WHERE id = OLD."orderId";
  ELSIF TG_OP = 'UPDATE' AND OLD."orderId" IS DISTINCT FROM NEW."orderId" THEN UPDATE "Order" SET "updatedAt" = CURRENT_TIMESTAMP WHERE id = OLD."orderId"; END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS commerce_touch_payment ON "Payment";
CREATE TRIGGER commerce_touch_payment AFTER INSERT OR UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION commerce_touch_parent_order();
DROP TRIGGER IF EXISTS commerce_touch_item ON "OrderItem";
CREATE TRIGGER commerce_touch_item AFTER INSERT OR UPDATE OR DELETE ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION commerce_touch_parent_order();
CREATE OR REPLACE FUNCTION commerce_touch_customer_orders() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN UPDATE "Order" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "customerId" = NEW.id; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS commerce_touch_customer ON "Customer";
CREATE TRIGGER commerce_touch_customer AFTER UPDATE ON "Customer" FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION commerce_touch_customer_orders();

COMMIT;
