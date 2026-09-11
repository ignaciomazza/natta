import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const databaseUrl = process.env.COMMERCE_TEST_URL;
test(
  "Natta conserva su base y sincroniza por contrato estándar",
  { skip: !databaseUrl },
  async (t) => {
    const url = new URL(databaseUrl!);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
        url.pathname.endsWith("_test"),
    );
    process.env.DATABASE_URL = process.env.DIRECT_URL = databaseUrl!;
    process.env.COBOTS_API_URL = "http://localhost:3157";
    process.env.COBOTS_STOREFRONT_API_KEY = "test-local-only";
    execFileSync(
      "node_modules/.bin/prisma",
      ["db", "push", "--skip-generate"],
      { env: process.env, stdio: "pipe" },
    );
    const { prisma } = await import("@/lib/prisma");
    // Apply complete SQL through psql because PL/pgSQL contains internal semicolons.
    execFileSync(
      "/Applications/Postgres.app/Contents/Versions/18/bin/psql",
      [
        databaseUrl!,
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        "prisma/commerce-bridge.sql",
      ],
      { stdio: "pipe" },
    );
    assert.ok(
      readFileSync("prisma/commerce-bridge.sql", "utf8").includes(
        "commerce_enqueue_order",
      ),
    );
    const bridge = await import("@/lib/integrations/commerce-bridge");
    const { applyCobotsOrderCommand } =
      await import("@/lib/integrations/cobots-operations");
    const suffix = randomUUID();
    const flavor = await prisma.flavor.create({
      data: { slug: suffix, name: "Torta de prueba", description: "" },
    });
    const size = await prisma.size.create({
      data: { slug: suffix, name: "Grande", description: "", servings: "6" },
    });
    const customer = await prisma.customer.create({
      data: {
        name: "Cliente local",
        phone: suffix,
        email: "cliente@example.test",
      },
    });
    await prisma.commerceBridgeConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        enabled: true,
        settings: {
          branches: {
            DEVOTO: { locationId: "location-a", scheduleId: "schedule-a" },
            NORDELTA: { locationId: "location-b", scheduleId: "schedule-b" },
          },
          variants: [
            {
              flavorId: flavor.id,
              sizeId: size.id,
              productId: "product-standard",
              variantId: "variant-standard",
            },
          ],
        },
      },
      update: {
        enabled: true,
        settings: {
          branches: {
            DEVOTO: { locationId: "location-a", scheduleId: "schedule-a" },
            NORDELTA: { locationId: "location-b", scheduleId: "schedule-b" },
          },
          variants: [
            {
              flavorId: flavor.id,
              sizeId: size.id,
              productId: "product-standard",
              variantId: "variant-standard",
            },
          ],
        },
      },
    });
    const order = await prisma.order.create({
      data: {
        customerId: customer.id,
        branchCode: "NORDELTA",
        fulfillmentMode: "PICKUP",
        deliveryDate: new Date("2026-10-10"),
        status: "CONFIRMED",
        subtotalArs: 100,
        amountDueNowArs: 50,
        amountPaidArs: 50,
        amountBalanceArs: 50,
        publicReceiptCode: suffix,
        confirmedAt: new Date(),
        items: {
          create: {
            flavorId: flavor.id,
            sizeId: size.id,
            quantity: 1,
            unitPriceArs: 100,
            subtotalArs: 100,
          },
        },
        payments: {
          create: {
            customerId: customer.id,
            kind: "DEPOSIT",
            status: "APPROVED",
            method: "CASH",
            amountArs: 50,
            paidAt: new Date(),
          },
        },
      },
    });
    const originalFetch = globalThis.fetch;
    t.after(async () => {
      globalThis.fetch = originalFetch;
      await prisma.$disconnect();
    });
    await t.test(
      "los eventos se guardan en la misma transacción y exportan referencias de Cobots",
      async () => {
        const outbox = await prisma.commerceOutbox.findUniqueOrThrow({
          where: { orderId: order.id },
        });
        assert.ok(outbox.version >= 3);
        assert.equal(outbox.pushedVersion, 0);
        const { snapshot } = await bridge.exportCommerceOrder(order.id);
        assert.equal(snapshot.locationId, "location-b");
        assert.equal(snapshot.items[0].productId, "product-standard");
        assert.equal(snapshot.amountPaid, 50);
        assert.equal(snapshot.balance, 50);
        const before = outbox.version;
        await assert.rejects(
          prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: order.id },
              data: { notes: "rollback" },
            });
            throw new Error("rollback");
          }),
        );
        assert.equal(
          (
            await prisma.commerceOutbox.findUniqueOrThrow({
              where: { orderId: order.id },
            })
          ).version,
          before,
        );
      },
    );
    await t.test(
      "una respuesta perdida conserva el evento y el reintento envía el mismo pedido",
      async () => {
        let body = "";
        globalThis.fetch = async (_url, init) => {
          body = String(init?.body);
          throw new Error("respuesta perdida");
        };
        await assert.rejects(bridge.pushCommerceOrder(order.id));
        const pending = await prisma.commerceOutbox.findUniqueOrThrow({
          where: { orderId: order.id },
        });
        assert.ok(pending.version > pending.pushedVersion);
        globalThis.fetch = async (url, init) => {
          assert.equal(
            String(url),
            "http://localhost:3157/api/storefront/commerce/orders",
          );
          assert.equal(String(init?.body), body);
          assert.equal(
            new Headers(init?.headers).get("x-cobots-storefront-api-key"),
            "test-local-only",
          );
          return Response.json({ outcome: "unchanged" });
        };
        await bridge.pushCommerceOrder(order.id);
        const done = await prisma.commerceOutbox.findUniqueOrThrow({
          where: { orderId: order.id },
        });
        assert.equal(done.version, done.pushedVersion);
      },
    );
    await t.test(
      "un cambio concurrente no queda confirmado por la respuesta de una versión anterior",
      async () => {
        await prisma.order.update({
          where: { id: order.id },
          data: { notes: "primera revisión" },
        });
        globalThis.fetch = async () => {
          await prisma.customer.update({
            where: { id: customer.id },
            data: { name: "Cliente corregido" },
          });
          return Response.json({ outcome: "updated" });
        };
        await bridge.pushCommerceOrder(order.id);
        const pending = await prisma.commerceOutbox.findUniqueOrThrow({
          where: { orderId: order.id },
        });
        assert.ok(pending.version > pending.pushedVersion);
        globalThis.fetch = async () => Response.json({ outcome: "updated" });
        await bridge.pushCommerceOrder(order.id);
      },
    );
    await t.test(
      "el envío anterior no puede tomar un correo después del cambio a Cobots",
      async () => {
        const { dispatchOrderReceipt } =
          await import("@/lib/email/receipt-delivery");
        let calls = 0;
        const result = await dispatchOrderReceipt(order.id, {}, async () => {
          calls++;
          return Response.json({ id: "should-not-send" });
        });
        assert.equal(result.sent, false);
        assert.equal(calls, 0);
        assert.equal(result.skippedReason, "REVIEW_REQUIRED");
      },
    );
    await t.test(
      "Cobots puede registrar el saldo una sola vez y entregar con la revisión actual",
      async () => {
        const before = await prisma.order.findUniqueOrThrow({
          where: { id: order.id },
        });
        const command = {
          id: randomUUID(),
          orderId: order.id,
          actorUserId: "operador-local",
          expectedUpdatedAt: before.updatedAt.toISOString(),
          requestedAt: new Date().toISOString(),
          operation: {
            action: "COLLECT_BALANCE" as const,
            amountArs: 50,
            method: "CASH" as const,
            referenceNote: "prueba",
          },
        };
        const first = await applyCobotsOrderCommand(command);
        assert.equal(first.outcome, "APPLIED");
        assert.deepEqual(await applyCobotsOrderCommand(command), first);
        assert.equal(
          await prisma.payment.count({
            where: { orderId: order.id, kind: "BALANCE" },
          }),
          1,
        );
        const { snapshot } = await bridge.exportCommerceOrder(order.id);
        assert.equal(snapshot.balance, 0);
        assert.equal(snapshot.amountPaid, 100);
        const result = await applyCobotsOrderCommand({
          ...command,
          id: randomUUID(),
          expectedUpdatedAt: snapshot.updatedAt.toISOString(),
          operation: { action: "DELIVER" },
        });
        assert.equal(result.outcome, "APPLIED");
        assert.equal(
          (await bridge.exportCommerceOrder(order.id)).snapshot.status,
          "DELIVERED",
        );
      },
    );
    await t.test(
      "un error al preparar el pedido registra el intento para no bloquear la cola",
      async () => {
        const original = await prisma.commerceBridgeConfig.findUniqueOrThrow({
          where: { id: "default" },
        });
        const broken = bridge.bridgeSettingsSchema.parse(original.settings);
        broken.variants[0].variantId = "";
        await prisma.commerceBridgeConfig.update({
          where: { id: "default" },
          data: { settings: broken },
        });
        await prisma.commerceOutbox.update({
          where: { orderId: order.id },
          data: { lastAttemptAt: null },
        });
        try {
          await assert.rejects(bridge.pushCommerceOrder(order.id));
          const queued = await prisma.commerceOutbox.findUniqueOrThrow({
            where: { orderId: order.id },
          });
          assert.ok(queued.lastAttemptAt);
          assert.ok(queued.lastError);
        } finally {
          await prisma.commerceBridgeConfig.update({
            where: { id: "default" },
            data: { settings: original.settings! },
          });
        }
      },
    );
  },
);
