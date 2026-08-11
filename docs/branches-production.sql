-- Generado y revisado contra el esquema productivo de Natta el 2026-08-10.
-- No ejecutar sin volver a comparar el diff y contar con backup verificable.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '2min';

CREATE TYPE "BranchCode" AS ENUM ('DEVOTO', 'NORDELTA');

DROP INDEX "DateCapacityOverride_date_key";
DROP INDEX "DateFlavorCapacityOverride_date_flavorId_key";
DROP INDEX "DateFlavorSizeCapacityOverride_date_flavorId_sizeId_key";
DROP INDEX "WeekdayCapacityRule_weekday_key";
DROP INDEX "WeekdayFlavorCapacityRule_weekday_flavorId_key";
DROP INDEX "WeekdayFlavorSizeCapacityRule_weekday_flavorId_sizeId_key";

ALTER TABLE "DateCapacityOverride"
  ADD COLUMN "branchCode" "BranchCode" NOT NULL DEFAULT 'DEVOTO';
ALTER TABLE "DateFlavorCapacityOverride"
  ADD COLUMN "branchCode" "BranchCode" NOT NULL DEFAULT 'DEVOTO';
ALTER TABLE "DateFlavorSizeCapacityOverride"
  ADD COLUMN "branchCode" "BranchCode" NOT NULL DEFAULT 'DEVOTO';
ALTER TABLE "Order"
  ADD COLUMN "branchCode" "BranchCode" NOT NULL DEFAULT 'DEVOTO';
ALTER TABLE "WeekdayCapacityRule"
  ADD COLUMN "branchCode" "BranchCode" NOT NULL DEFAULT 'DEVOTO';
ALTER TABLE "WeekdayFlavorCapacityRule"
  ADD COLUMN "branchCode" "BranchCode" NOT NULL DEFAULT 'DEVOTO';
ALTER TABLE "WeekdayFlavorSizeCapacityRule"
  ADD COLUMN "branchCode" "BranchCode" NOT NULL DEFAULT 'DEVOTO';

CREATE INDEX "DateCapacityOverride_branchCode_idx"
  ON "DateCapacityOverride"("branchCode");
CREATE UNIQUE INDEX "DateCapacityOverride_branchCode_date_key"
  ON "DateCapacityOverride"("branchCode", "date");
CREATE INDEX "DateFlavorCapacityOverride_branchCode_idx"
  ON "DateFlavorCapacityOverride"("branchCode");
CREATE UNIQUE INDEX "DateFlavorCapacityOverride_branchCode_date_flavorId_key"
  ON "DateFlavorCapacityOverride"("branchCode", "date", "flavorId");
CREATE INDEX "DateFlavorSizeCapacityOverride_branchCode_idx"
  ON "DateFlavorSizeCapacityOverride"("branchCode");
CREATE UNIQUE INDEX "DateFlavorSizeCapacityOverride_branchCode_date_flavorId_siz_key"
  ON "DateFlavorSizeCapacityOverride"("branchCode", "date", "flavorId", "sizeId");
CREATE INDEX "Order_branchCode_deliveryDate_idx"
  ON "Order"("branchCode", "deliveryDate");
CREATE INDEX "WeekdayCapacityRule_branchCode_idx"
  ON "WeekdayCapacityRule"("branchCode");
CREATE UNIQUE INDEX "WeekdayCapacityRule_branchCode_weekday_key"
  ON "WeekdayCapacityRule"("branchCode", "weekday");
CREATE INDEX "WeekdayFlavorCapacityRule_branchCode_idx"
  ON "WeekdayFlavorCapacityRule"("branchCode");
CREATE UNIQUE INDEX "WeekdayFlavorCapacityRule_branchCode_weekday_flavorId_key"
  ON "WeekdayFlavorCapacityRule"("branchCode", "weekday", "flavorId");
CREATE INDEX "WeekdayFlavorSizeCapacityRule_branchCode_idx"
  ON "WeekdayFlavorSizeCapacityRule"("branchCode");
CREATE UNIQUE INDEX "WeekdayFlavorSizeCapacityRule_branchCode_weekday_flavorId_s_key"
  ON "WeekdayFlavorSizeCapacityRule"("branchCode", "weekday", "flavorId", "sizeId");

INSERT INTO "WeekdayCapacityRule" (
  "id",
  "branchCode",
  "weekday",
  "isOpen",
  "maxUnits",
  "isAutoCapacity",
  "minLeadTimeDays",
  "cutoffHour",
  "pickupStartMinutes",
  "pickupEndMinutes",
  "createdAt",
  "updatedAt"
)
SELECT
  'nordelta_weekday_' || "weekday"::text,
  'NORDELTA'::"BranchCode",
  "weekday",
  "isOpen",
  "maxUnits",
  "isAutoCapacity",
  "minLeadTimeDays",
  "cutoffHour",
  "pickupStartMinutes",
  "pickupEndMinutes",
  NOW(),
  NOW()
FROM "WeekdayCapacityRule"
WHERE "branchCode" = 'DEVOTO'
ON CONFLICT ("branchCode", "weekday") DO NOTHING;

-- Los días con capacidad automática derivan su total de los límites por sabor
-- y tamaño. Nordelta comparte los límites por sabor, pero sólo ofrece Latta.
INSERT INTO "WeekdayFlavorCapacityRule" (
  "id",
  "branchCode",
  "weekday",
  "flavorId",
  "maxUnits",
  "createdAt",
  "updatedAt"
)
SELECT
  'nordelta_flavor_' || "weekday"::text || '_' || "flavorId",
  'NORDELTA'::"BranchCode",
  "weekday",
  "flavorId",
  "maxUnits",
  NOW(),
  NOW()
FROM "WeekdayFlavorCapacityRule"
WHERE "branchCode" = 'DEVOTO'
ON CONFLICT ("branchCode", "weekday", "flavorId") DO NOTHING;

INSERT INTO "WeekdayFlavorSizeCapacityRule" (
  "id",
  "branchCode",
  "weekday",
  "flavorId",
  "sizeId",
  "maxUnits",
  "createdAt",
  "updatedAt"
)
SELECT
  'nordelta_latta_' || source."weekday"::text || '_' || source."flavorId",
  'NORDELTA'::"BranchCode",
  source."weekday",
  source."flavorId",
  source."sizeId",
  source."maxUnits",
  NOW(),
  NOW()
FROM "WeekdayFlavorSizeCapacityRule" AS source
INNER JOIN "Size" AS size ON size."id" = source."sizeId"
WHERE source."branchCode" = 'DEVOTO'
  AND size."slug" = 'latta'
ON CONFLICT ("branchCode", "weekday", "flavorId", "sizeId") DO NOTHING;

COMMIT;
