import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import type { MercadoPagoPaymentResponse } from "@/lib/payments/mercadopago";

async function main() {
  // This script never reads .env and refuses non-local or non-test databases.
  const database = new URL(
    process.env.TEST_DATABASE_URL ?? "postgresql://invalid",
  );
  assert.ok(
    ["localhost", "127.0.0.1"].includes(database.hostname),
    "TEST_DATABASE_URL must be local",
  );
  assert.equal(
    database.pathname,
    "/natta_payment_test",
    "Use the dedicated natta_payment_test database",
  );
  process.env.DATABASE_URL = database.href;
  process.env.DIRECT_URL = database.href;
  process.env.MERCADOPAGO_ENV = "production";
  process.env.MERCADOPAGO_ACCESS_TOKEN_PRODUCTION = "TEST-FAKE-NO-NETWORK";
  process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY_PRODUCTION = "TEST-FAKE";
  process.env.MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION = "test-webhook-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://natta.example.test";
  process.env.RESEND_API_KEY = "test-fake";
  process.env.NATTA_RECEIPT_EMAIL_FROM = "receipts@example.test";
  process.env.JWT_SECRET = "test-only-jwt-secret-longer-than-32-characters";
  process.env.CRON_SECRET = "test-reconciliation-secret";
  process.env.DOTENV_CONFIG_PATH = "/dev/null";

  execFileSync("node_modules/.bin/prisma", ["db", "push", "--skip-generate"], {
    env: process.env,
    stdio: "pipe",
  });
  const { prisma } = await import("@/lib/prisma");
  const { POST: webhook } = await import("@/app/api/payments/webhook/route");
  const { POST: discard } =
    await import("@/app/api/public/order/[orderId]/discard/route");
  const { POST: checkout } = await import("@/app/api/payments/checkout/route");
  const { POST: processPayment } =
    await import("@/app/api/payments/process/route");
  const { POST: createOrder, GET: listOrders } =
    await import("@/app/api/orders/route");
  const { POST: reconcileRoute } =
    await import("@/app/api/payments/reconcile/route");
  const { applyMercadoPagoPaymentSnapshot: apply } =
    await import("@/lib/payments/sync");
  const { reconcilePaymentPage } = await import("@/lib/payments/reconcile");
  const { canReconcilePayments, isReconciliationWorkflow } =
    await import("@/lib/payments/reconcile-auth");
  const { signToken, AUTH_COOKIE_NAME } = await import("@/lib/auth/jwt");
  const remote = new Map<string, MercadoPagoPaymentResponse>();
  let failSearch = false;
  const failedPaymentIds = new Set<string>();
  let emails = 0;
  let preferences = 0;
  let cardRequests = 0;
  let cardStarted: (() => void) | null = null;
  let releaseCard: Promise<void> = Promise.resolve();
  let passed = 0;
  const originalFetch = globalThis.fetch;
  // All outbound HTTP is simulated; unexpected destinations fail closed.
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin === "https://api.resend.com" && url.pathname === "/emails") {
      emails++;
      return Response.json({ id: `fake-email-${emails}` });
    }
    assert.equal(
      url.origin,
      "https://api.mercadopago.com",
      "Unexpected external request",
    );
    if (url.pathname === "/v1/payments" && init?.method === "POST") {
      cardRequests++;
      cardStarted?.();
      await releaseCard;
      const body = JSON.parse(String(init.body));
      const payment: MercadoPagoPaymentResponse = {
        id: 9000 + cardRequests,
        status: "approved",
        transaction_amount: body.transaction_amount,
        external_reference: body.external_reference,
        currency_id: "ARS",
        date_last_updated: new Date().toISOString(),
        date_approved: new Date().toISOString(),
      };
      remote.set(String(payment.id), payment);
      return Response.json(payment);
    }
    if (url.pathname === "/checkout/preferences") {
      preferences++;
      const body = JSON.parse(String(init?.body));
      return Response.json({
        id: `fake-pref-${preferences}`,
        init_point: `https://example.test/pay/${preferences}`,
        external_reference: body.external_reference,
      });
    }
    if (url.pathname === "/v1/payments/search") {
      if (failSearch)
        return Response.json(
          { error: "Simulated provider outage" },
          { status: 503 },
        );
      const reference = url.searchParams.get("external_reference");
      const all = [...remote.values()].filter(
        (p) => !reference || p.external_reference === reference,
      );
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 50);
      return Response.json({
        results: all.slice(offset, offset + limit),
        paging: { total: all.length, offset, limit },
      });
    }
    if (failedPaymentIds.has(url.pathname.split("/").at(-1)!))
      return Response.json(
        { error: "Simulated payment lookup failure" },
        { status: 503 },
      );
    const payment = remote.get(url.pathname.split("/").at(-1)!);
    return payment
      ? Response.json(payment)
      : Response.json({ error: "Not found" }, { status: 404 });
  };
  const request = (
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    new NextRequest(`https://natta.example.test${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  const params = (orderId: string) => ({
    params: Promise.resolve({ orderId }),
  });
  const ok = (description: string) => {
    passed++;
    console.log(`PASS ${description}`);
  };
  try {
    await prisma.mercadoPagoWebhookEvent.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();
    const customer = await prisma.customer.create({
      data: {
        name: "Cliente de prueba",
        phone: "1100000000",
        email: "customer@example.test",
      },
    });
    async function fixture(
      label: string,
      options: { preference?: boolean; cancelled?: boolean } = {},
    ) {
      const id = `regression-${label}`;
      return prisma.order.create({
        data: {
          id,
          customerId: customer.id,
          fulfillmentMode: "DELIVERY",
          deliveryDate: new Date("2026-09-12T12:00:00Z"),
          publicReceiptCode: label,
          status: options.cancelled ? "CANCELLED" : "PENDING",
          subtotalArs: 53000,
          amountDueNowArs: 53000,
          amountBalanceArs: 53000,
          mercadoPagoExternalReference: `natta_${id}`,
          mercadoPagoPreferenceId: options.preference ? `pref-${id}` : null,
          payments: {
            create: {
              customerId: customer.id,
              kind: "FULL",
              method: "MERCADO_PAGO",
              amountArs: 53000,
              externalReference: `natta_${id}`,
              provider: "mercadopago",
            },
          },
        },
        include: { payments: true },
      });
    }
    function payment(
      order: { mercadoPagoExternalReference: string | null },
      id: number,
    ): MercadoPagoPaymentResponse {
      return {
        id,
        external_reference: order.mercadoPagoExternalReference!,
        status: "approved",
        status_detail: "accredited",
        currency_id: "ARS",
        live_mode: true,
        transaction_amount: 53000,
        date_approved: "2026-09-07T12:00:00Z",
        date_last_updated: "2026-09-07T12:00:00Z",
      };
    }
    function notification(paymentId: number, eventId: number, valid = true) {
      const ts = String(Date.now());
      const requestId = "test-request";
      const hash = crypto
        .createHmac(
          "sha256",
          process.env.MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION!,
        )
        .update(`id:${paymentId};request-id:${requestId};ts:${ts};`)
        .digest("hex");
      return request(
        `/api/payments/webhook?data.id=${paymentId}`,
        {
          id: eventId,
          type: "payment",
          action: "payment.updated",
          live_mode: true,
          data: { id: paymentId },
        },
        {
          "x-request-id": requestId,
          "x-signature": `ts=${ts},v1=${valid ? hash : "0".repeat(64)}`,
        },
      );
    }

    const first = await fixture("paid-saturday", { preference: true });
    remote.set("1001", payment(first, 1001));
    if (process.env.BASELINE_WEBHOOK_PATH) {
      const before = await import(
        pathToFileURL(resolve(process.env.BASELINE_WEBHOOK_PATH)).href
      );
      const response = await before.POST(notification(1001, 7001));
      assert.equal(response.status, 500);
      assert.equal(
        (await prisma.order.findUniqueOrThrow({ where: { id: first.id } }))
          .status,
        "PENDING",
      );
      ok(
        "before/after: the previous webhook fails on a numeric event ID and leaves the same paid order pending",
      );
    }
    assert.equal((await webhook(notification(1001, 7001))).status, 200);
    let saved = await prisma.order.findUniqueOrThrow({
      where: { id: first.id },
    });
    assert.equal(saved.status, "CONFIRMED");
    assert.equal(saved.amountPaidArs, 53000);
    assert.equal(saved.deliveryDate.toISOString().slice(0, 10), "2026-09-12");
    assert.equal(
      (
        await prisma.mercadoPagoWebhookEvent.findUniqueOrThrow({
          where: { eventId: "7001" },
        })
      ).status,
      "PROCESSED",
    );
    assert.equal(emails, 1);
    await Promise.all(
      Array.from({ length: 5 }, () => webhook(notification(1001, 7001))),
    );
    assert.equal(
      await prisma.payment.count({ where: { orderId: first.id } }),
      1,
    );
    assert.equal(emails, 1);
    ok(
      "numeric webhook IDs confirm the original date; concurrent duplicate notices do not duplicate payments or receipts",
    );

    assert.equal((await webhook(notification(1001, 7002, false))).status, 401);
    assert.equal(
      await prisma.mercadoPagoWebhookEvent.count({
        where: { eventId: "7002" },
      }),
      0,
    );
    assert.equal(
      (
        await webhook(
          request("/api/payments/webhook", {
            topic: "payment",
            resource: "1001",
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await webhook(
          request("/api/payments/webhook", { id: {}, type: "payment" }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await webhook(
          request("/api/payments/webhook?data.id=9999", {
            id: 99,
            type: "payment",
            data: { id: 1001 },
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await webhook(
          request("/api/payments/webhook", {
            id: 90,
            type: "payment",
            live_mode: false,
            data: { id: 1001 },
          }),
        )
      ).status,
      200,
    );
    ok(
      "invalid signatures, malformed/mismatched IDs, legacy IPN and test notifications cannot change production payments",
    );

    remote.set("1999", {
      ...payment(first, 1999),
      external_reference: "natta_missing-order",
    });
    assert.equal((await webhook(notification(1999, 7999))).status, 500);
    assert.equal(
      (
        await prisma.mercadoPagoWebhookEvent.findUniqueOrThrow({
          where: { eventId: "7999" },
        })
      ).status,
      "ERROR",
    );
    remote.delete("1999");
    ok(
      "unmatched payments remain retryable instead of being acknowledged as processed",
    );

    assert.equal(
      (
        await discard(
          request("/discard", { receiptCode: first.publicReceiptCode }),
          params(first.id),
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await checkout(
          request("/checkout", {
            orderId: first.id,
            receiptCode: first.publicReceiptCode,
          }),
        )
      ).status,
      409,
    );
    saved = await prisma.order.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(saved.status, "CONFIRMED");
    assert.equal(preferences, 0);
    ok("paid orders cannot be discarded or start another checkout");

    assert.equal(
      (
        await processPayment(
          request("/process", {
            orderId: first.id,
            receiptCode: first.publicReceiptCode,
            formData: {},
          }),
        )
      ).status,
      409,
    );
    const partial = await fixture("partial-amount");
    await apply({ ...payment(partial, 1003), transaction_amount: 1 });
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: partial.id } }))
        .status,
      "PENDING",
    );
    assert.equal(emails, 1);
    await assert.rejects(
      apply({ ...payment(partial, 1004), currency_id: "USD" }),
      /PAYMENT_CURRENCY_MISMATCH/,
    );
    ok(
      "card processing also refuses covered orders; insufficient amounts and foreign currencies cannot confirm them",
    );

    const late = await fixture("missed-notice", { preference: true });
    remote.set("1002", payment(late, 1002));
    const report = await reconcilePaymentPage(0, new Date().toISOString());
    assert.equal(report.errors.length, 0);
    assert.equal(report.recovered, 1);
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: late.id } })).status,
      "CONFIRMED",
    );
    assert.equal(emails, 2);
    await reconcilePaymentPage(0, new Date().toISOString());
    assert.equal(emails, 2);
    ok(
      "background reconciliation recovers missed notifications once without customer or admin visits",
    );

    const unresolved = await fixture("unresolved", { preference: true });
    const unresolvedResponse = await discard(
      request("/discard", { receiptCode: unresolved.publicReceiptCode }),
      params(unresolved.id),
    );
    assert.equal(unresolvedResponse.status, 409);
    assert.equal((await unresolvedResponse.json()).code, "PAYMENT_UNRESOLVED");
    failSearch = true;
    const editable = await fixture("editable");
    assert.equal(
      (
        await discard(
          request("/discard", { receiptCode: editable.publicReceiptCode }),
          params(editable.id),
        )
      ).status,
      503,
    );
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: editable.id } }))
        .status,
      "PENDING",
    );
    failSearch = false;
    assert.equal(
      (
        await discard(
          request("/discard", { receiptCode: editable.publicReceiptCode }),
          params(editable.id),
        )
      ).status,
      200,
    );
    ok(
      "a live payment link or provider outage preserves the order; an unstarted unpaid order can be discarded",
    );

    const concurrent = await fixture("checkout-concurrent");
    const checkouts = await Promise.all(
      Array.from({ length: 3 }, () =>
        checkout(
          request("/checkout", {
            orderId: concurrent.id,
            receiptCode: concurrent.publicReceiptCode,
          }),
        ),
      ),
    );
    assert.ok(checkouts.every((r) => r.status === 200));
    assert.equal(preferences, 1);
    const checkoutBodies = await Promise.all(checkouts.map((r) => r.json()));
    assert.equal(new Set(checkoutBodies.map((r) => r.preferenceId)).size, 1);
    ok("simultaneous checkout retries reuse one preference and one payment");

    const beforePaying = await fixture("edit-before-paying");
    const preferencesBefore = preferences;
    const configuration = await checkout(
      request("/checkout", {
        orderId: beforePaying.id,
        receiptCode: beforePaying.publicReceiptCode,
        prepareWallet: false,
      }),
    );
    assert.equal(configuration.status, 200);
    assert.equal((await configuration.json()).preferenceId, null);
    assert.equal(preferences, preferencesBefore);
    assert.equal(
      (
        await discard(
          request("/discard", { receiptCode: beforePaying.publicReceiptCode }),
          params(beforePaying.id),
        )
      ).status,
      200,
    );
    ok(
      "opening the payment screen alone does not issue a payable link or prevent editing",
    );

    const card = await fixture("card-in-progress");
    let finishCard!: () => void;
    releaseCard = new Promise<void>((resolve) => {
      finishCard = resolve;
    });
    const started = new Promise<void>((resolve) => {
      cardStarted = resolve;
    });
    const cardRequest = () =>
      request("/process", {
        orderId: card.id,
        receiptCode: card.publicReceiptCode,
        formData: {
          payment_method_id: "visa",
          token: "fake-card-token",
          payer: { email: "card@example.test" },
        },
      });
    const processing = processPayment(cardRequest());
    await Promise.race([
      started,
      new Promise<never>((_, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Card request did not start")),
          5000,
        );
        timeout.unref();
      }),
    ]);
    assert.equal(
      (
        await discard(
          request("/discard", { receiptCode: card.publicReceiptCode }),
          params(card.id),
        )
      ).status,
      409,
    );
    assert.equal((await processPayment(cardRequest())).status, 409);
    finishCard();
    assert.equal((await processing).status, 200);
    assert.equal(cardRequests, 1);
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: card.id } })).status,
      "CONFIRMED",
    );
    cardStarted = null;
    ok(
      "a card payment in flight cannot be discarded or charged twice when the client retries",
    );

    const double = await fixture("two-real-payments");
    await Promise.all([
      apply(payment(double, 2001)),
      apply(payment(double, 2002)),
    ]);
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: double.id } }))
        .amountPaidArs,
      106000,
    );
    await apply({
      ...payment(double, 2002),
      status: "refunded",
      date_last_updated: "2026-09-07T13:00:00Z",
    });
    await apply({
      ...payment(double, 2002),
      date_last_updated: "2026-09-07T12:00:00Z",
    });
    assert.equal(
      (
        await prisma.payment.findUniqueOrThrow({
          where: { providerPaymentId: "2002" },
        })
      ).status,
      "REFUNDED",
    );
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: double.id } }))
        .amountPaidArs,
      53000,
    );
    const cancelled = await fixture("cancelled-paid", { cancelled: true });
    await apply(payment(cancelled, 3001));
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: cancelled.id } }))
        .status,
      "CANCELLED",
    );
    ok(
      "distinct real payments are counted separately; refunds target their operation, stale updates cannot reverse them and intentional cancellations remain cancelled",
    );

    const user = await prisma.user.create({
      data: { email: "admin@example.test", passwordHash: "unused" },
    });
    const token = await signToken({ userId: user.id, email: user.email });
    const hiddenFilters =
      "status=confirmed&from=2025-01-01&to=2025-01-02&branch=nordelta";
    for (const q of [cancelled.publicReceiptCode, "3001"]) {
      const response = await listOrders(
        new NextRequest(
          `https://natta.example.test/api/orders?${hiddenFilters}&q=${q}`,
          { headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` } },
        ),
      );
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.items[0].id, cancelled.id);
      assert.equal(body.searchAll, true);
    }
    assert.equal(
      (
        await listOrders(
          new NextRequest("https://natta.example.test/api/orders?q=3001"),
        )
      ).status,
      401,
    );
    ok(
      "authenticated receipt and operation searches find cancelled orders outside the selected date and branch",
    );

    const flavor = await prisma.flavor.upsert({
      where: { slug: "clasica" },
      create: { slug: "clasica", name: "Clásica", description: "Prueba" },
      update: {},
    });
    const size = await prisma.size.upsert({
      where: { slug: "grande" },
      create: {
        slug: "grande",
        name: "Grande",
        description: "Prueba",
        servings: "8",
      },
      update: {},
    });
    await prisma.price.upsert({
      where: { flavorId_sizeId: { flavorId: flavor.id, sizeId: size.id } },
      create: { flavorId: flavor.id, sizeId: size.id, amountArs: 53000 },
      update: {},
    });
    const future = new Date(Date.now() + 14 * 86400000)
      .toISOString()
      .slice(0, 10);
    await prisma.dateCapacityOverride.upsert({
      where: {
        branchCode_date: {
          branchCode: "DEVOTO",
          date: new Date(`${future}T12:00:00Z`),
        },
      },
      create: {
        branchCode: "DEVOTO",
        date: new Date(`${future}T12:00:00Z`),
        maxUnits: 50,
        ignoreLeadTime: true,
      },
      update: { maxUnits: 50, isClosed: false, ignoreLeadTime: true },
    });
    const orderBody = {
      requestId: crypto.randomUUID(),
      branch: "devoto",
      customer: {
        name: "Reintento de prueba",
        email: "retry@example.test",
        phone: "1199999999",
        address: "Dirección ficticia",
      },
      deliveryDate: future,
      fulfillmentMode: "delivery",
      items: [{ flavorId: flavor.id, sizeId: size.id, quantity: 1 }],
    };
    const creations = await Promise.all(
      Array.from({ length: 3 }, () =>
        createOrder(request("/api/orders", orderBody)),
      ),
    );
    const results = await Promise.all(creations.map((r) => r.json()));
    assert.ok(
      creations.every((r) => r.status === 200),
      JSON.stringify(results),
    );
    assert.equal(new Set(results.map((r) => r.orderId)).size, 1);
    assert.equal(
      await prisma.payment.count({ where: { orderId: results[0].orderId } }),
      1,
    );
    ok(
      "concurrent creation retries return the same complete order and receipt",
    );

    assert.equal(await canReconcilePayments(null), false);
    assert.equal(
      await canReconcilePayments("Bearer test-reconciliation-secret"),
      true,
    );
    assert.equal(await canReconcilePayments("Bearer é".repeat(10)), false);
    const claims = {
      repository: "ignaciomazza/natta",
      repository_id: "1230336805",
      ref: "refs/heads/main",
      sub: "repo:ignaciomazza/natta:ref:refs/heads/main",
      workflow_ref:
        "ignaciomazza/natta/.github/workflows/reconcile-payments.yml@refs/heads/main",
      event_name: "schedule",
    };
    assert.equal(isReconciliationWorkflow(claims), true);
    assert.equal(
      isReconciliationWorkflow({ ...claims, event_name: "pull_request" }),
      false,
    );
    assert.equal(
      isReconciliationWorkflow({ ...claims, repository_id: "fork" }),
      false,
    );
    assert.equal(
      isReconciliationWorkflow({ ...claims, workflow_ref: "other" }),
      false,
    );
    assert.equal(
      (await reconcileRoute(request("/api/payments/reconcile", {}))).status,
      401,
    );
    assert.equal(
      (
        await reconcileRoute(
          request(
            "/api/payments/reconcile",
            { offset: -1, end: new Date().toISOString() },
            { Authorization: "Bearer test-reconciliation-secret" },
          ),
        )
      ).status,
      400,
    );
    ok(
      "reconciliation requires the trusted workflow identity or secret and validates pagination",
    );

    remote.clear();
    const brokenLookup = await fixture("failed-lookup");
    remote.set("8001", payment(brokenLookup, 8001));
    failedPaymentIds.add("8001");
    for (let id = 8100; id < 8149; id++)
      remote.set(String(id), {
        id,
        external_reference: "unrelated",
        status: "pending",
      });
    const laterPage = await fixture("later-page");
    remote.set("8002", payment(laterPage, 8002));
    const end = new Date().toISOString();
    const pageOne = await reconcileRoute(
      request(
        "/api/payments/reconcile",
        { offset: 0, end },
        { Authorization: "Bearer test-reconciliation-secret" },
      ),
    );
    assert.equal(pageOne.status, 200);
    const firstPage = await pageOne.json();
    assert.deepEqual(firstPage.errors, ["8001"]);
    assert.equal(firstPage.nextOffset, 50);
    const pageTwo = await reconcileRoute(
      request(
        "/api/payments/reconcile",
        { offset: firstPage.nextOffset, end },
        { Authorization: "Bearer test-reconciliation-secret" },
      ),
    );
    const secondPage = await pageTwo.json();
    assert.equal(secondPage.nextOffset, null);
    assert.equal(secondPage.recovered, 1);
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: laterPage.id } }))
        .status,
      "CONFIRMED",
    );
    ok(
      "a failed payment is reported while subsequent pages still recover other paid orders",
    );
    console.log(
      `${passed} payment regression scenarios passed; no real payments or emails sent.`,
    );
  } finally {
    globalThis.fetch = originalFetch;
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
