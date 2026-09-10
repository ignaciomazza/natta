import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const url = process.env.RECEIPT_EMAIL_TEST_URL;
test("Natta: comprobantes compartidos sin duplicados", { skip: !url }, async (t) => {
  const target = new URL(url!);
  assert.ok(["127.0.0.1", "localhost"].includes(target.hostname) && target.pathname.endsWith("_test"));
  process.env.DATABASE_URL = process.env.DIRECT_URL = url;
  process.env.RESEND_API_KEY = "local-test-key";
  process.env.NATTA_RECEIPT_EMAIL_FROM = "Natta <hola@example.test>";
  const { prisma } = await import("../src/lib/prisma");
  const { dispatchOrderReceipt } = await import("../src/lib/email/receipt-delivery");
  const credentials = { accessToken: "oauth-test", from: "Natta <hola@example.test>", connectionId: new Date().toISOString() };
  const suffix = randomUUID();
  const flavor = await prisma.flavor.create({ data: { slug: suffix, name: "Chocolate <script>", description: "Prueba" } });
  const size = await prisma.size.create({ data: { slug: suffix, name: "Mediana", description: "Prueba", servings: "4" } });
  const customer = await prisma.customer.create({ data: { name: "Cliente de prueba", email: "customer@example.test", phone: suffix } });
  const ids: string[] = [];
  const order = async (paid = 12000, status: "CONFIRMED" | "CANCELLED" = "CONFIRMED") => {
    const row = await prisma.order.create({ data: { customerId: customer.id, branchCode: "DEVOTO", fulfillmentMode: "DELIVERY", deliveryAddress: "Calle de prueba", deliveryDate: new Date("2026-09-12T00:00:00Z"), publicReceiptCode: randomUUID().slice(0, 10), status, subtotalArs: 24000, amountDueNowArs: 12000, amountPaidArs: paid, amountBalanceArs: 24000 - paid,
      items: { create: { flavorId: flavor.id, sizeId: size.id, quantity: 1, unitPriceArs: 24000, subtotalArs: 24000 } },
      ...(paid ? { payments: { create: { customerId: customer.id, amountArs: paid, status: "APPROVED", kind: "DEPOSIT", method: "TRANSFER", paidAt: new Date() } } } : {}),
    } }); ids.push(row.id); return row;
  };
  const request = (row: Awaited<ReturnType<typeof order>>) => ({ force: true, requestId: randomUUID(), actorUserId: "cobots-operator", expectedRecipient: customer.email!, expectedUpdatedAt: row.updatedAt.toISOString(), credentials });
  t.after(async () => {
    await prisma.orderReceiptDelivery.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: ids } } }); await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } }); await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.customer.delete({ where: { id: customer.id } }); await prisma.flavor.delete({ where: { id: flavor.id } }); await prisma.size.delete({ where: { id: size.id } }); await prisma.$disconnect();
  });
  let calls = 0;
  const sent = new Map<string, { id: string; body: string }>();
  const fake: typeof fetch = async (input, init) => {
    assert.equal(String(input), "https://api.resend.com/emails"); calls++;
    const key = new Headers(init?.headers).get("Idempotency-Key")!;
    const prior = sent.get(key); if (prior) { assert.equal(init?.body, prior.body); return Response.json({ id: prior.id }); }
    const row = { id: randomUUID(), body: String(init?.body) }; sent.set(key, row); return Response.json({ id: row.id });
  };
  await t.test("misma solicitud y dobles clics producen un solo correo con seña y saldo", async () => {
    const row = await order(); const options = request(row); const before = calls;
    const results = await Promise.all([dispatchOrderReceipt(row.id, options, fake), dispatchOrderReceipt(row.id, options, fake)]);
    assert.ok(results.some((r) => r.sent));
    assert.equal(calls - before, 1);
    assert.equal((await dispatchOrderReceipt(row.id, options, fake)).sent, true);
    assert.equal(calls - before, 1);
    const body = JSON.parse(sent.get(`natta-receipt/${options.requestId}`)!.body);
    assert.equal(body.from, credentials.from); assert.equal(body.to, customer.email);
    assert.match(body.html, /Saldo pendiente/); assert.match(body.html, /12.000/);
    assert.match(body.html, /&lt;script&gt;/); assert.doesNotMatch(body.html, /<script>/);
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: row.id } })).receiptEmailResendId, results.find((r) => r.sent)!.resendId);
    const stored = await prisma.orderReceiptDelivery.findUniqueOrThrow({ where: { id: options.requestId } });
    assert.ok(!JSON.stringify(stored).includes("oauth-test"));
  });
  await t.test("respuesta perdida se recupera con cuerpo e identidad estables", async () => {
    const row = await order(); const options = request(row);
    const lost: typeof fetch = async (...args) => { await fake(...args); throw new Error("connection lost"); };
    assert.equal((await dispatchOrderReceipt(row.id, options, lost)).skippedReason, "SEND_FAILED");
    await prisma.order.update({ where: { id: row.id }, data: { notes: "Updated after uncertain send" } });
    const sizeBefore = sent.size;
    assert.equal((await dispatchOrderReceipt(row.id, options, fake)).sent, true);
    assert.equal(sent.size, sizeBefore);
  });
  await t.test("envío manual pendiente bloquea al automático y nuevas solicitudes", async () => {
    const row = await order(); const options = request(row);
    await dispatchOrderReceipt(row.id, options, async () => { throw new Error("timeout"); });
    const before = calls;
    assert.equal((await dispatchOrderReceipt(row.id, {}, fake)).skippedReason, "RECENT_ATTEMPT");
    assert.equal((await dispatchOrderReceipt(row.id, { ...options, requestId: randomUUID() }, fake)).skippedReason, "RECENT_ATTEMPT");
    assert.equal(calls, before);
    assert.equal((await dispatchOrderReceipt(row.id, options, fake)).sent, true);
    assert.equal((await dispatchOrderReceipt(row.id, {}, fake)).skippedReason, "ALREADY_SENT");
  });
  await t.test("un rechazo posterior no borra un resultado anterior incierto", async () => {
    const row = await order(); const options = request(row);
    await dispatchOrderReceipt(row.id, options, async () => { throw new Error("lost"); });
    await dispatchOrderReceipt(row.id, options, async () => new Response("denied", { status: 403 }));
    assert.equal((await prisma.orderReceiptDelivery.findUniqueOrThrow({ where: { id: options.requestId } })).status, "UNCERTAIN");
    assert.equal((await dispatchOrderReceipt(row.id, { ...options, requestId: randomUUID() }, fake)).skippedReason, "RECENT_ATTEMPT");
  });
  await t.test("respeta intentos anteriores al despliegue y conserva la clave automática", async () => {
    const recent = await order(); const old = await order(); const recoverable = await order();
    await prisma.order.update({ where: { id: recent.id }, data: { receiptEmailLastAttemptAt: new Date() } });
    await prisma.order.update({ where: { id: old.id }, data: { receiptEmailLastAttemptAt: new Date(Date.now() - 25 * 3600000) } });
    await prisma.order.update({ where: { id: recoverable.id }, data: { receiptEmailLastAttemptAt: new Date(Date.now() - 3600000) } });
    assert.equal((await dispatchOrderReceipt(recent.id, {}, fake)).skippedReason, "RECENT_ATTEMPT");
    assert.equal((await dispatchOrderReceipt(old.id, {}, fake)).skippedReason, "REVIEW_REQUIRED");
    assert.equal((await dispatchOrderReceipt(recoverable.id, {}, fake)).sent, true);
    assert.ok(sent.has(`order-receipt-${recoverable.id}-12000`));
  });
  await t.test("fuera de la ventana de Resend requiere revisión y no vuelve a enviar", async () => {
    const row = await order(); const options = request(row);
    await dispatchOrderReceipt(row.id, options, async () => { throw new Error("timeout"); });
    await prisma.orderReceiptDelivery.update({ where: { id: options.requestId }, data: { firstAttemptAt: new Date(Date.now() - 24 * 3600000) } });
    const before = calls;
    assert.equal((await dispatchOrderReceipt(row.id, options, fake)).skippedReason, "REVIEW_REQUIRED");
    assert.equal((await dispatchOrderReceipt(row.id, { ...options, requestId: randomUUID() }, fake)).skippedReason, "REVIEW_REQUIRED");
    assert.equal(calls, before);
  });
  await t.test("no envía pedidos cancelados, sin pago, con seña incompleta o datos cambiados", async () => {
    const cancelled = await order(12000, "CANCELLED"); const unpaid = await order(0); const partial = await order(1000); const changed = await order();
    const before = calls;
    assert.equal((await dispatchOrderReceipt(cancelled.id, request(cancelled), fake)).skippedReason, "ORDER_CANCELLED");
    assert.equal((await dispatchOrderReceipt(unpaid.id, request(unpaid), fake)).skippedReason, "PAYMENT_NOT_APPROVED");
    assert.equal((await dispatchOrderReceipt(partial.id, request(partial), fake)).skippedReason, "AMOUNT_NOT_COVERED");
    assert.equal((await dispatchOrderReceipt(changed.id, { ...request(changed), expectedRecipient: "different@example.test" }, fake)).skippedReason, "ORDER_CHANGED");
    assert.equal(calls, before);
  });
  await t.test("rechazo definitivo se registra y el automático puede recuperarse", async () => {
    const row = await order();
    assert.equal((await dispatchOrderReceipt(row.id, {}, async () => new Response("bad", { status: 403 }))).skippedReason, "SEND_FAILED");
    assert.equal((await prisma.orderReceiptDelivery.findUniqueOrThrow({ where: { id: `automatic:${row.id}` } })).status, "FAILED");
    assert.equal((await dispatchOrderReceipt(row.id, {}, fake)).sent, true);
  });
  await t.test("UUID no puede reutilizarse para otra cuenta, actor o pedido", async () => {
    const row = await order(); const other = await order(); const options = request(row);
    await dispatchOrderReceipt(row.id, options, fake);
    const before = calls;
    assert.equal((await dispatchOrderReceipt(other.id, options, fake)).skippedReason, "ORDER_CHANGED");
    assert.equal((await dispatchOrderReceipt(row.id, { ...options, actorUserId: "other" }, fake)).skippedReason, "ORDER_CHANGED");
    assert.equal((await dispatchOrderReceipt(row.id, { ...options, credentials: { ...credentials, connectionId: "different" } }, fake)).skippedReason, "ORDER_CHANGED");
    assert.equal(calls, before);
  });
});
