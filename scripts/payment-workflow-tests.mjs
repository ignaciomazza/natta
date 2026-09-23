import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const workflow = readFileSync(
  new URL("../.github/workflows/reconcile-payments.yml", import.meta.url),
  "utf8",
);
const source = workflow.match(/<<'NODE'\n([\s\S]*?)\n\s+NODE\s*$/)?.[1];
assert.ok(source, "The workflow must contain the executable worker being tested");

async function run({ slowInbox = false, inboxUnavailable = false, paymentError = false } = {}) {
  let now = Date.parse("2026-09-07T12:00:00Z");
  let tokenCreatedAt = 0;
  let identities = 0;
  let notifications = 0;
  const offsets = [];
  const logs = [];
  const complete = new Error("TEST_WORKER_EXIT");
  let failure;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  try {
    await runInNewContext(`(async () => {${source}\n})()`, {
      URL, AbortSignal, Date: Clock,
      console: { log: value => logs.push(JSON.parse(value)) },
      process: {
        env: {
          ACTIONS_ID_TOKEN_REQUEST_URL: "https://identity.example.test/token",
          ACTIONS_ID_TOKEN_REQUEST_TOKEN: "fake-identity-request",
        },
        exit: code => { assert.equal(code, 0); throw complete; },
      },
      fetch: async (input, init) => {
        const url = new URL(input);
        if (url.hostname === "identity.example.test") {
          assert.equal(url.searchParams.get("audience"), "https://www.nattavascas.com/api/payments/reconcile");
          identities++;
          tokenCreatedAt = now;
          return Response.json({ value: `fake-token-${identities}` });
        }
        assert.equal(url.href, "https://www.nattavascas.com/api/payments/reconcile");
        assert.equal(init.headers.Authorization, `Bearer fake-token-${identities}`);
        assert.ok(now - tokenCreatedAt < 180000, "The worker must renew its short-lived identity");
        const body = JSON.parse(init.body);
        if (body.mode === "commerce") {
          return Response.json({ processed: 0, errors: 0, hasMore: false });
        }
        if (body.mode === "notifications") {
          notifications++;
          if (inboxUnavailable) return new Response(null, { status: 503 });
          if (slowInbox) now += 70000;
          return Response.json({ checked: 3, recovered: 3, errors: [], hasMore: slowInbox });
        }
        offsets.push(body.offset);
        now += 3000;
        // Partial MP pages require more than the former 100-request limit.
        return Response.json({
          checked: 3, recovered: 3, attention: [],
          errors: paymentError && body.offset === 0 ? ["fake-failed-payment"] : [],
          nextOffset: body.offset === 300 ? null : body.offset + 3,
        });
      },
    });
  } catch (error) {
    if (error !== complete) failure = error;
  }
  assert.deepEqual(offsets, Array.from({ length: 101 }, (_, i) => i * 3));
  assert.ok(identities >= 3);
  assert.equal(logs.length, 1);
  return { failure, notifications, report: logs[0] };
}

const normal = await run();
assert.equal(normal.failure, undefined);
assert.equal(normal.report.errors, 0);
console.log("PASS workflow follows partial pages beyond 100 requests and refreshes its identity");

const slow = await run({ slowInbox: true });
assert.equal(slow.notifications, 2);
assert.match(slow.failure?.message ?? "", /Some payment checks failed/);
console.log("PASS a slow inbox cannot consume the entire run before payment reconciliation");

const unavailable = await run({ inboxUnavailable: true });
assert.equal(unavailable.notifications, 1);
assert.match(unavailable.failure?.message ?? "", /Some payment checks failed/);
console.log("PASS an unavailable inbox is reported after payment reconciliation continues");

const failedPayment = await run({ paymentError: true });
assert.equal(failedPayment.report.errors, 1);
assert.match(failedPayment.failure?.message ?? "", /Some payment checks failed/);
console.log("PASS individual failures are reported after all subsequent pages are visited");
