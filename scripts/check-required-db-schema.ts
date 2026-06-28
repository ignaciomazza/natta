import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const requiredTables = [
  "User",
  "Flavor",
  "Size",
  "Price",
  "WeekdayCapacityRule",
  "WeekdayFlavorCapacityRule",
  "DateCapacityOverride",
  "DateFlavorCapacityOverride",
  "Customer",
  "Order",
  "OrderItem",
  "Payment",
  "MercadoPagoWebhookEvent",
  "Supplier",
  "Purchase",
  "Expense",
] as const;

const requiredUniqueIndexes = [
  { table: "User", columns: ["email"] },
  { table: "Flavor", columns: ["slug"] },
  { table: "Size", columns: ["slug"] },
  { table: "Price", columns: ["flavorId", "sizeId"] },
  { table: "WeekdayCapacityRule", columns: ["weekday"] },
  { table: "WeekdayFlavorCapacityRule", columns: ["weekday", "flavorId"] },
  { table: "DateCapacityOverride", columns: ["date"] },
  { table: "DateFlavorCapacityOverride", columns: ["date", "flavorId"] },
  { table: "Customer", columns: ["phone"] },
  { table: "Order", columns: ["publicReceiptCode"] },
  { table: "Order", columns: ["mercadoPagoExternalReference"] },
  { table: "Payment", columns: ["externalReference"] },
  { table: "Payment", columns: ["providerPaymentId"] },
] as const;

type TableRow = {
  table_name: string;
};

type UniqueIndexRow = {
  table_name: string;
  columns: string[];
};

function uniqueIndexKey(table: string, columns: readonly string[]) {
  return `${table}:${columns.join(",")}`;
}

async function main() {
  const [tableRows, uniqueIndexRows] = await Promise.all([
    prisma.$queryRaw<TableRow[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `,
    prisma.$queryRaw<UniqueIndexRow[]>`
    SELECT
      table_class.relname AS table_name,
      array_agg(attribute.attname ORDER BY key.ordinality) AS columns
    FROM pg_index index
    JOIN pg_class table_class
      ON table_class.oid = index.indrelid
    JOIN pg_namespace namespace
      ON namespace.oid = table_class.relnamespace
    JOIN LATERAL unnest(index.indkey) WITH ORDINALITY key(attnum, ordinality)
      ON true
    JOIN pg_attribute attribute
      ON attribute.attrelid = table_class.oid
      AND attribute.attnum = key.attnum
    WHERE namespace.nspname = 'public'
      AND index.indisunique = true
    GROUP BY table_class.relname, index.indexrelid
  `,
  ]);

  const existingTables = new Set(tableRows.map((row) => row.table_name));
  const existingUniqueIndexes = new Set(
    uniqueIndexRows.map((row) => uniqueIndexKey(row.table_name, row.columns)),
  );
  const missingTables = requiredTables.filter(
    (table) => !existingTables.has(table),
  );
  const missingUniqueIndexes = requiredUniqueIndexes.filter(
    (index) =>
      existingTables.has(index.table) &&
      !existingUniqueIndexes.has(uniqueIndexKey(index.table, index.columns)),
  );

  if (missingTables.length > 0 || missingUniqueIndexes.length > 0) {
    if (missingTables.length > 0) {
    console.error("Faltan tablas requeridas en la base:");
    for (const table of missingTables) {
      console.error(`- ${table}`);
    }
    }

    if (missingUniqueIndexes.length > 0) {
      console.error("Faltan indices unicos requeridos en la base:");
      for (const index of missingUniqueIndexes) {
        console.error(`- ${index.table}(${index.columns.join(", ")})`);
      }
    }

    console.error("");
    console.error("Aplicar el esquema antes del deploy:");
    console.error("npm run db:push");
    process.exit(1);
  }

  console.log("Schema check OK: todas las tablas requeridas existen.");
}

main()
  .catch((error) => {
    console.error("No se pudo verificar el esquema de la base.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
