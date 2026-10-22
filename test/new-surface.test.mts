
/* ------------------------- v0.2.0 new-surface tests ------------------------- */
import { createHmac } from "node:crypto";
import { Gsubz, verifyWebhook } from "../src/index.ts";

function mockClient(responder) {
  return new Gsubz({ apiKey: "test", fetchImpl: async (url, init) => ({
    ok: true, status: 200, text: async () => JSON.stringify(responder(url, init)),
  })});
}

test("games: validate -> buy -> poll orders", async () => {
  let calls = [];
  const c = mockClient((url, init) => {
    calls.push([url, init?.body]);
    if (url.includes("/api/games/validate/")) return { code: 200, status: "successful", description: "PLAYER_FOUND", playerName: "ProGamer99" };
    if (url.includes("/api/games/buy/")) return { code: 200, status: "successful", orderID: 15, orderStatus: "completed", codes: ["XYZ-1"] };
    if (url.includes("/api/games/orders/")) return { code: 200, status: "successful", orders: [{ orderID: 15, orderStatus: "completed", codes: ["XYZ-1"], amount: 1520, amountPaid: 1520, amountRefunded: 0 }] };
    return { code: 404, status: "failed" };
  });
  const v = await c.validateGamePlayer({ productID: "101", player_id: "12345678" });
  assert.equal(v.playerName, "ProGamer99");
  const b = await c.buyGame({ productID: "101", player_id: "12345678", requestID: "game-1" });
  assert.equal(b.orderStatus, "completed");
  assert.equal(calls[1][1].includes("requestID=game-1"), true);
  const o = await c.awaitGameOrder({ orderID: 15, pollMs: 10 });
  assert.deepEqual(o.codes, ["XYZ-1"]);
});

test("flight: search -> preview -> book sends JSON body", async () => {
  let bodies = [];
  const c = mockClient((url, init) => {
    if (init?.body && typeof init.body === "string" && init.headers?.["Content-Type"] === "application/json") bodies.push(JSON.parse(init.body));
    if (url.includes("/api/flight/search/") && init?.method === "GET") return { code: 200, status: "successful", airports: [{ code: "LOS", name: "Murtala Muhammed", city: "Lagos", country: "Nigeria" }] };
    if (url.includes("/api/flight/search/")) return { code: 200, status: "successful", searchID: "FS1", offers: [{ token: "t1", airline: "Ibom", airlineCode: "QI", amount: 95000, refundable: false, journeys: [] }] };
    if (url.includes("/api/flight/book/")) return { code: 200, status: "successful", quoteID: "Q1", quote: { amount: 95000 } };
    return { code: 404, status: "failed" };
  });
  const a = await c.listAirports({ search: "lagos" });
  assert.equal(a.airports[0].code, "LOS");
  const s = await c.searchFlights({ origin: "LOS", destination: "ABV", departureDate: "2026-12-01" });
  assert.equal(s.offers[0].token, "t1");
  const p = await c.bookFlight({ token: "t1", searchID: "FS1", preview: true });
  assert.equal(p.quoteID, "Q1");
  assert.equal(bodies[0].preview, true);
  assert.equal(typeof bodies[0], "object"); // JSON body, not form
});

test("store: order reference dedupe surfaces duplicate flag", async () => {
  const c = mockClient(() => ({ code: 200, status: "successful", duplicate: true, amountPaid: 4850, order: { orderId: 5231, reference: "ORDER-1", items: [] } }));
  const r = await c.storeOrder({ reference: "ORDER-1", items: [{ product_id: "p1", sku_id: 1, quantity: 1 }] });
  assert.equal(r.duplicate, true);
  // requestJson marks duplicateRequestID for successful dupes via requestID — but store uses
  // `duplicate`; both flags present is fine.
});

test("webhook verify: accepts a valid signature, rejects tampering", async () => {
  const secret = "whsec_123";
  const ts = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ eventId: "evt_1", event: "games.order.updated", data: { orderID: 15 } });
  const sig = "sha256=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const parsed = verifyWebhook(body, { event: "games.order.updated", delivery: "evt_1", timestamp: ts, signature: sig }, secret);
  assert.equal(parsed.eventId, "evt_1");
  assert.throws(() => verifyWebhook(body, { event: "games.order.updated", delivery: "evt_1", timestamp: ts, signature: "sha256=deadbeef" }, secret), /BAD_SIGNATURE/);
  assert.throws(() => verifyWebhook(body, { event: "games.order.updated", delivery: "evt_1", timestamp: "1000", signature: sig }, secret), /STALE/);
});

test("verifyTransactionEx refuses a lookup with neither id", async () => {
  const c = new Gsubz({ apiKey: "test", fetchImpl: async () => ({ ok: true, status: 200, text: async () => "{}" }) });
  await assert.rejects(() => c.verifyTransactionEx({}), /REQUESTID_IS_EMPTY|either/);
});

test("pinOrders: history lookup after timeout, pins omitted", async () => {
  let url = "";
  const c = mockClient((u) => { url = u; return { code: 200, status: "success", orders: [] }; });
  await c.pinOrders({ order_id: "abc", pins: 0, limit: 5 });
  assert.ok(url.includes("/api/generate/history/?limit=5&order_id=abc&pins=0"), url);
});
