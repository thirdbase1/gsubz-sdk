
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";

/** v0.2.0 new-surface contract tests (games / flights / store / webhooks / verify). */

const { default: Gsubz, verifyWebhook } = await import("../dist/index.js");

let responder;
const seen = [];
const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    seen.push({ url: req.url, method: req.method, raw, ct: req.headers["content-type"] });
    const r = responder({ url: req.url, method: req.method, raw, ct: req.headers["content-type"] });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(r));
  });
});
server.unref();
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;
const g = new Gsubz({ apiKey: "test", baseUrl: base, timeoutMs: 5000 });

test("games: validate -> buy -> poll orders", async () => {
  seen.length = 0;
  responder = ({ url, raw }) => {
    if (url.includes("/api/games/validate/")) return { code: 200, status: "successful", description: "PLAYER_FOUND", playerName: "ProGamer99" };
    if (url.includes("/api/games/buy/")) return { code: 200, status: "successful", orderID: 15, orderStatus: "completed", codes: ["XYZ-1"] };
    if (url.includes("/api/games/orders/")) return { code: 200, status: "successful", orders: [{ orderID: 15, orderStatus: "completed", codes: ["XYZ-1"], amount: 1520, amountPaid: 1520, amountRefunded: 0 }] };
    return { code: 404, status: "failed" };
  };
  const v = await g.validateGamePlayer({ productID: "101", player_id: "12345678" });
  assert.equal(v.playerName, "ProGamer99");
  const b = await g.buyGame({ productID: "101", player_id: "12345678", requestID: "game-1" });
  assert.equal(b.orderStatus, "completed");
  assert.ok(seen[1].raw.includes("requestID=game-1"), seen[1].raw);
  const o = await g.awaitGameOrder({ orderID: 15 }, { pollMs: 10 });
  assert.deepEqual(o.codes, ["XYZ-1"]);
});

test("flight: airports -> search -> preview book sends JSON body", async () => {
  seen.length = 0;
  responder = ({ url }) => {
    if (url.includes("/api/flight/search/"))
    return seen.at(-1).method === "GET"
      ? { code: 200, status: "successful", airports: [{ code: "LOS", name: "Murtala Muhammed", city: "Lagos", country: "Nigeria" }] }
      :
      { code: 200, status: "successful", searchID: "FS1", offers: [{ token: "t1", airline: "Ibom", airlineCode: "QI", amount: 95000, refundable: false, journeys: [] }] };
    if (false) return { code: 200, status: "successful", searchID: "FS1", offers: [{ token: "t1", airline: "Ibom", airlineCode: "QI", amount: 95000, refundable: false, journeys: [] }] };
    if (url.includes("/api/flight/book/")) return { code: 200, status: "successful", quoteID: "Q1", quote: { amount: 95000 } };
    return { code: 404, status: "failed" };
  };
  const a = await g.listAirports({ search: "lagos" });
  assert.equal(a.airports[0].code, "LOS");
  const s = await g.searchFlights({ origin: "LOS", destination: "ABV", departureDate: "2026-12-01" });
  assert.equal(s.offers[0].token, "t1");
  const p = await g.bookFlight({ token: "t1", searchID: "FS1", preview: true });
  assert.equal(p.quoteID, "Q1");
  // book must be a JSON POST, not a form
  const book = seen.find((x) => x.url.includes("/api/flight/book/"));
  assert.equal(book.ct, "application/json");
  assert.equal(JSON.parse(book.raw).preview, true);
});

test("store: order sends reference and surfaces duplicate flag", async () => {
  seen.length = 0;
  responder = () => ({ code: 200, status: "successful", duplicate: true, amountPaid: 4850, order: { orderId: 5231, reference: "ORDER-1", items: [] } });
  const r = await g.storeOrder({ reference: "ORDER-1", items: [{ product_id: "p1", sku_id: 1, quantity: 1 }] });
  assert.equal(r.duplicate, true);
  const order = seen.find((x) => x.url.includes("/api/store/order/"));
  assert.equal(order.ct, "application/json");
  assert.equal(JSON.parse(order.raw).reference, "ORDER-1");
});

test("webhook verify: accepts a valid signature, rejects tampering + replay", () => {
  const secret = "whsec_123";
  const ts = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ eventId: "evt_1", event: "games.order.updated", data: { orderID: 15 } });
  const sig = "sha256=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const parsed = verifyWebhook(body, { event: "games.order.updated", delivery: "evt_1", timestamp: ts, signature: sig }, secret);
  assert.equal(parsed.eventId, "evt_1");
  assert.throws(() => verifyWebhook(body, { event: "e", delivery: "evt_1", timestamp: ts, signature: "sha256=deadbeef" }, secret), /BAD_SIGNATURE/);
  assert.throws(() => verifyWebhook(body, { event: "e", delivery: "evt_1", timestamp: "1000", signature: "sha256=" + createHmac("sha256", secret).update("1000." + body).digest("hex") }, secret), /STALE/);
});

test("verifyTransactionEx refuses a lookup with neither id", async () => {
  await assert.rejects(() => g.verifyTransactionEx({}), /REQUESTID_IS_EMPTY|either/i);
});
