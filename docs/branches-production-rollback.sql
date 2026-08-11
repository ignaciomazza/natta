-- Rollback de emergencia para la ventana previa a habilitar pedidos Nordelta.
-- Se aborta si ya existen datos operativos Nordelta que no pueden descartarse.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Order" WHERE "branchCode" <> 'DEVOTO'
  ) OR EXISTS (
    SELECT 1 FROM "DateCapacityOverride" WHERE "branchCode" <> 'DEVOTO'
  ) OR EXISTS (
    SELECT 1 FROM "DateFlavorCapacityOverride" WHERE "branchCode" <> 'DEVOTO'
  ) OR EXISTS (
    SELECT 1 FROM "DateFlavorSizeCapacityOverride" WHERE "branchCode" <> 'DEVOTO'
  ) THEN
    RAISE EXCEPTION 'Rollback bloqueado: ya existen datos operativos fuera de Devoto';
  END IF;
END $$;

DELETE FROM "WeekdayFlavorSizeCapacityRule" WHERE "branchCode" = 'NORDELTA';
DELETE FROM "WeekdayFlavorCapacityRule" WHERE "branchCode" = 'NORDELTA';
DELETE FROM "WeekdayCapacityRule" WHERE "branchCode" = 'NORDELTA';

DROP INDEX "DateCapacityOverride_branchCode_date_key";
DROP INDEX "DateCapacityOverride_branchCode_idx";
DROP INDEX "DateFlavorCapacityOverride_branchCode_date_flavorId_key";
DROP INDEX "DateFlavorCapacityOverride_branchCode_idx";
DROP INDEX "DateFlavorSizeCapacityOverride_branchCode_date_flavorId_siz_key";
DROP INDEX "DateFlavorSizeCapacityOverride_branchCode_idx";
DROP INDEX "Order_branchCode_deliveryDate_idx";
DROP INDEX "WeekdayCapacityRule_branchCode_weekday_key";
DROP INDEX "WeekdayCapacityRule_branchCode_idx";
DROP INDEX "WeekdayFlavorCapacityRule_branchCode_weekday_flavorId_key";
DROP INDEX "WeekdayFlavorCapacityRule_branchCode_idx";
DROP INDEX "WeekdayFlavorSizeCapacityRule_branchCode_weekday_flavorId_s_key";
DROP INDEX "WeekdayFlavorSizeCapacityRule_branchCode_idx";

ALTER TABLE "DateCapacityOverride" DROP COLUMN "branchCode";
ALTER TABLE "DateFlavorCapacityOverride" DROP COLUMN "branchCode";
ALTER TABLE "DateFlavorSizeCapacityOverride" DROP COLUMN "branchCode";
ALTER TABLE "Order" DROP COLUMN "branchCode";
ALTER TABLE "WeekdayCapacityRule" DROP COLUMN "branchCode";
ALTER TABLE "WeekdayFlavorCapacityRule" DROP COLUMN "branchCode";
ALTER TABLE "WeekdayFlavorSizeCapacityRule" DROP COLUMN "branchCode";

CREATE UNIQUE INDEX "DateCapacityOverride_date_key"
  ON "DateCapacityOverride"("date");
CREATE UNIQUE INDEX "DateFlavorCapacityOverride_date_flavorId_key"
  ON "DateFlavorCapacityOverride"("date", "flavorId");
CREATE UNIQUE INDEX "DateFlavorSizeCapacityOverride_date_flavorId_sizeId_key"
  ON "DateFlavorSizeCapacityOverride"("date", "flavorId", "sizeId");
CREATE UNIQUE INDEX "WeekdayCapacityRule_weekday_key"
  ON "WeekdayCapacityRule"("weekday");
CREATE UNIQUE INDEX "WeekdayFlavorCapacityRule_weekday_flavorId_key"
  ON "WeekdayFlavorCapacityRule"("weekday", "flavorId");
CREATE UNIQUE INDEX "WeekdayFlavorSizeCapacityRule_weekday_flavorId_sizeId_key"
  ON "WeekdayFlavorSizeCapacityRule"("weekday", "flavorId", "sizeId");

DROP TYPE "BranchCode";

COMMIT;
