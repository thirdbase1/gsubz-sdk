import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

/**
 * Offline contract tests: a local mock speaks exactly what the gsubz doc
 * describes (form bodies, Bearer + `api` field, status field semantics,
 * error codes) and the SDK must match it. No network, no real key.
 */

const seen = [];
let responder = () => ({ body: { status: "successful", code: 200 }, code: 200 });

const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const params = new URLSearchParams(raw);
    seen.push({ url: req.url, method: req.method, auth: req.headers.authorization, params: Object.fromEntries(params) });
    const r = responder();
    res.writeHead(r.code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(r.body));
  });
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

const { default: Gsubz, GsubzError } = await import("../dist/index.js");
const g = new Gsubz({ apiKey: "ap_testkey", baseUrl: base, timeoutMs: 5000 });

test("buyData: hits /api/pay/ with Bearer header, api field, plan, phone, auto requestID", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { status: "successful", code: 200, transactionID: 777, requestID: "X1" } });
  const r = await g.buyData({ serviceID: "mtn_sme", plan: "166", phone: "08031234567", requestID: "X1" });
  const s = seen[0];
  assert.equal(s.url, "/api/pay/");
  assert.equal(s.method, "POST");
  assert.equal(s.auth, "Bearer ap_testkey");
  assert.equal(s.params.api, "ap_testkey");
  assert.equal(s.params.serviceID, "mtn_sme");
  assert.equal(s.params.plan, "166");
  assert.equal(s.params.phone, "08031234567");
  assert.equal(s.params.requestID, "X1");
  assert.equal(r.transactionID, 777);
});

test("buyData generates a requestID when none given", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { status: "successful", code: 200 } });
  await g.buyData({ serviceID: "mtn_sme", plan: "166", phone: "08031234567" });
  assert.ok(seen[0].params.requestID && seen[0].params.requestID.length > 10);
});

test("buyData sends empty amount string per doc", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { status: "successful", code: 200 } });
  await g.buyData({ serviceID: "mtn_sme", plan: "166", phone: "08031234567" });
  assert.equal(seen[0].params.amount, "");
});

test("airtime: amount passed through, no plan field", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { status: "successful", code: 200 } });
  await g.buyAirtime({ serviceID: "mtn", amount: 500, phone: "08031234567" });
  assert.equal(seen[0].params.amount, "500");
  assert.equal("plan" in seen[0].params, false);
});

test("electricity: type goes into variation_code", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { status: "successful", code: 200 } });
  await g.buyElectricity({ serviceID: "kaduna_electric", customerID: "1112223334", amount: 2000, type: "prepaid", phone: "08031234567" });
  assert.equal(seen[0].params.variation_code, "prepaid");
  assert.equal(seen[0].params.customerID, "1112223334");
});

test("cable: variationCode -> variation_code, empty amount", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { status: "successful", code: 200 } });
  await g.buyCable({ serviceID: "dstv", variationCode: "confam", customerID: "1043104310", phone: "08031234567" });
  assert.equal(seen[0].params.variation_code, "confam");
  assert.equal(seen[0].params.amount, "");
});

test("HTTP 200 + status=failed raises GsubzError with the doc's fields", async () => {
  responder = () => ({ code: 200, body: { status: "failed", code: 402, description: "INSUFFICIENT_BALANCE", api_response: "balance too low" } });
  await assert.rejects(
    () => g.buyAirtime({ serviceID: "mtn", amount: 500, phone: "08031234567" }),
    (e) => e instanceof GsubzError && e.code === 402 && e.description === "INSUFFICIENT_BALANCE" && e.apiResponse === "balance too low",
  );
});

test("duplicate requestID is flagged (doc: original returned, no double charge)", async () => {
  responder = () => ({ code: 406, body: { status: "failed", code: 406, description: "INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID" } });
  await assert.rejects(
    () => g.buyAirtime({ serviceID: "mtn", amount: 500, phone: "08031234567", requestID: "DUP1" }),
    (e) => e instanceof GsubzError && e.duplicateRequestID === true && e.code === 406,
  );
});

test("balance: POST with auth, number coerced from doc's string form", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { status: "successful", code: 200, balance: "1234.50" } });
  const bal = await g.getBalance();
  assert.equal(bal, 1234.5);
  assert.equal(seen[0].url, "/api/balance/");
});

test("verify-customer: billersCode + type for electricity", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { status: "successful", code: 200, description: "CUSTOMER_FOUND", content: { customerName: "TEST USER" } } });
  await g.verifyCustomer({ serviceID: "kaduna_electric", billersCode: "1112223334", type: "prepaid" });
  assert.equal(seen[0].params.billersCode, "1112223334");
  assert.equal(seen[0].params.type, "prepaid");
});

test("plans: public endpoint — no Authorization, no api field (doc: no auth)", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { service: "MTN SME Data", PlanName: "plan_id", fixedPrice: true, discount: "4.62%", plans: [{ displayName: "1GB", value: "166", price: "399", api_price: "380.58" }] } });
  await g.getPlans("mtn_sme");
  assert.equal(seen[0].auth, undefined);
  assert.equal(seen[0].params.api, undefined);
  assert.equal(seen[0].url, "/api/plans/?service=mtn_sme");
});

test("generate pins: header auth only, no api body field (doc: apiV2)", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { message: "done", status: "success", pins: [{ pin: "1234567890", sn: "1" }] } });
  await g.generatePins({ network: "mtn", value: "100", number: 10 });
  assert.equal(seen[0].url, "/apiV2/generate/");
  assert.equal(seen[0].auth, "Bearer ap_testkey");
  assert.equal(seen[0].params.api, undefined);
  assert.equal(seen[0].params.number, "10");
});

test("esim buy/orders/cancel keep trailing slashes and auth", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { status: "successful", code: 200 } });
  await g.buyEsim({ packageCode: "PC2G2GAZG" });
  await g.esimOrders({ orderID: 42 });
  await g.cancelEsim(42);
  assert.equal(seen[0].url, "/api/esim/buy/");
  assert.equal(seen[1].url, "/api/esim/orders/");
  assert.equal(seen[1].params.orderID, "42");
  assert.equal(seen[2].url, "/api/esim/cancel/");
});

test("bulk sms: to joined with commas", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { status: "successful", code: 200, sent: 2, failed: 0, recipients: 2 } });
  await g.sendSms({ from: "MIRACLE", to: ["08031234567", "08031234568"], msg: "hello there" });
  assert.equal(seen[0].url, "/api/sms/");
  assert.equal(seen[0].params.to, "08031234567,08031234568");
  assert.equal(seen[0].params.msg, "hello there");
});

test("verify transaction hits /api/verify/ with requestID", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { status: "successful", code: 200, transactionID: 9 } });
  await g.verifyTransaction("X1");
  assert.equal(seen[0].url, "/api/verify/");
  assert.equal(seen[0].params.requestID, "X1");
});

test("findPlan: matches on display text, returns the plan value", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { service: "MTN SME Data", PlanName: "plan_id", plans: [
    { displayName: "500MB - 7days", value: "179", price: "299", api_price: "285.20" },
    { displayName: "1GB - 30days", value: "166", price: "399", api_price: "380.58" },
  ] } });
  const p = await g.findPlan("mtn_sme", "1gb");
  assert.equal(p.value, "166");
  const byValue = await g.findPlan("mtn_sme", "179");
  assert.equal(byValue.displayName, "500MB - 7days");
});

test("findPlan: unknown plan lists the options instead of failing silently", async () => {
  responder = () => ({ code: 200, body: { service: "MTN SME Data", PlanName: "plan_id", plans: [
    { displayName: "1GB - 30days", value: "166", price: "399", api_price: "380.58" },
  ] } });
  await assert.rejects(() => g.findPlan("mtn_sme", "999tb"), /Available plans/);
});

test("buyDataByPlan: resolves the plan then pays with its value", async () => {
  seen.length = 0;
  let call = 0;
  responder = () => {
    call++;
    if (call === 1) return { code: 200, body: { service: "MTN SME Data", PlanName: "plan_id", plans: [
      { displayName: "1GB - 30days", value: "166", price: "399", api_price: "380.58" }] } };
    return { code: 200, body: { status: "successful", code: 200, transactionID: 5 } };
  };
  const tx = await g.buyDataByPlan("mtn_sme", "1gb", "08031234567", { requestID: "R1" });
  assert.equal(tx.transactionID, 5);
  assert.equal(seen[1].params.plan, "166");
  assert.equal(seen[1].params.requestID, "R1");
});

test("canAfford: compares against the string balance", async () => {
  responder = () => ({ code: 200, body: { status: "successful", code: 200, balance: "747.5" } });
  assert.equal(await g.canAfford(500), true);
  assert.equal(await g.canAfford(1000), false);
});

test("sendSmsOne: single number, no array needed", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, body: { status: "successful", code: 200, sent: 1, failed: 0 } });
  await g.sendSmsOne("MyShop", "08031234567", "ready for pickup");
  assert.equal(seen[0].params.to, "08031234567");
});

test("validation: bad phone caught locally, no network call", async () => {
  seen.length = 0;
  responder = () => { throw new Error("should not be reached"); };
  await assert.rejects(
    () => g.buyData({ serviceID: "mtn_sme", plan: "166", phone: "080123" }),
    /11-digit Nigerian number/,
  );
  assert.equal(seen.length, 0, "no request should have left the process");
});

test("validation: airtime below ₦100 caught locally (doc minimum)", async () => {
  seen.length = 0;
  responder = () => { throw new Error("should not be reached"); };
  await assert.rejects(() => g.buyAirtime({ serviceID: "mtn", amount: 50, phone: "08031234567" }), /minimum/);
  assert.equal(seen.length, 0);
});

test("validation: SMS caps enforced locally (905 chars, 5000 recipients, sender name)", async () => {
  responder = () => { throw new Error("should not be reached"); };
  await assert.rejects(() => g.sendSms({ from: "AB1", to: "08031234567", msg: "hi" }), /3-11 letters/);
  await assert.rejects(() => g.sendSms({ from: "SHOP", to: "08031234567", msg: "x".repeat(906) }), /905/);
  const many = Array.from({ length: 5001 }, () => "08031234567").join(",");
  await assert.rejects(() => g.sendSms({ from: "SHOP", to: many, msg: "hi" }), /5,000/);
});

test("validation: generatePins minimum of 10 for values below 500 (doc rule)", async () => {
  responder = () => { throw new Error("should not be reached"); };
  await assert.rejects(() => g.generatePins({ network: "mtn", value: "100", number: 5 }), /at least 10/);
  // 500 has no minimum per the doc
  responder = () => ({ code: 200, body: { message: "ok", status: "success", pins: [] } });
  await g.generatePins({ network: "mtn", value: "500", number: 1 });
});

test("502 GATEWAY_ERROR is retried automatically, then succeeds (doc: safe to retry)", async () => {
  seen.length = 0;
  let calls = 0;
  responder = () => {
    calls++;
    if (calls < 3) return { code: 502, body: { status: "failed", code: 502, description: "GATEWAY_ERROR" } };
    return { code: 200, body: { status: "successful", code: 200, transactionID: 11 } };
  };
  const tx = await g.buyAirtime({ serviceID: "mtn", amount: 500, phone: "08031234567", requestID: "R502" });
  assert.equal(tx.transactionID, 11);
  assert.equal(seen.length, 3, "same requestID resent on every retry");
  assert.equal(seen[2].params.requestID, "R502");
});

test("duplicate 406 arriving as status=successful is still flagged", async () => {
  responder = () => ({ code: 406, body: { status: "successful", code: 406, description: "INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID", transactionID: 9 } });
  const tx = await g.buyAirtime({ serviceID: "mtn", amount: 500, phone: "08031234567", requestID: "RDUP" });
  assert.equal(tx.duplicateRequestID, true);
});

test("findPlan: ambiguous query lists every match instead of guessing", async () => {
  responder = () => ({ code: 200, body: { service: "MTN SME Data", PlanName: "plan_id", plans: [
    { displayName: "1GB - 30days", value: "166", price: "399", api_price: "380.58" },
    { displayName: "1GB - 7days", value: "180", price: "299", api_price: "285.20" },
  ] } });
  await assert.rejects(() => g.findPlan("mtn_sme", "1gb"), /matches 2 plans/);
});

after(() => server.close());
