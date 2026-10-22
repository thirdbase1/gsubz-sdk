# GSUBZ SDK — Agent Guide

Guide for AI agents (and humans) using `gsubz-sdk`. Every method name, its
endpoint, what it costs, and the traps. Read "Rules that save money" first —
several endpoints **debit the wallet**.

## Install

```bash
npm i gsubz-sdk
```

```js
import Gsubz from "gsubz-sdk";
const g = new Gsubz({ apiKey: process.env.GSUBZ_API_KEY });
```

## Rules that save money (read first)

1. **Buying debits the wallet.** `buyProduct`, `generatePins`, `buyEsim`,
   `buyGame`, `bookFlight` (non-preview), `storeOrder` (non-preview),
   `sendSms` all spend money. Always pass a unique `requestID` (uuid) — if
   the HTTP call times out, the order may STILL have gone through. Never
   blind-retry without a new `requestID`.
2. **Timeout ≠ failure.** If a purchase times out, look it up with
   `verifyTransaction({ requestID })` or the family's `*Orders` method
   before deciding anything.
3. **Validate before you pay.** `verifyCustomer` (bills), `validateGamePlayer`
   (free), flight preview (`preview: true`, no charge), store order preview —
   they all exist. Use them.
4. **Check `status`, not just errors.** The API returns HTTP 200 with
   `status: "failed"` — the SDK raises `GsubzError` for both. Catch
   `GsubzError`, read `.code` (e.g. `LOW_BALANCE`/`507`) and `.description`.
5. **Public endpoints** (plans, category, eSIM countries/packages, games
   list/products, store browse) need no key and cost nothing.

## Task → method map

| Task | Method | Cost |
|---|---|---|
| Check wallet | `getBalance()` | free |
| List data/airtime/TV plans | `getPlans({ network })` | free (public) |
| List all services grouped | `listServices()` | free (public) |
| Validate meter/IUC | `verifyCustomer({ billersCode, serviceID })` | free |
| Buy data/airtime/TV/electricity/exam | `buyProduct({ serviceID, amount, phone, requestID })` | DEBITS |
| Recharge pins (bulk printing) | `generatePins({ network, value, number, requestID })` | DEBITS |
| Look up past pin orders | `pinOrders({ order_id, pins: 0 })` | free |
| eSIM countries / packages | `esimCountries()` / `esimPackages()` | free (public) |
| Buy eSIM | `buyEsim({ packageID, quantity, requestID })` | DEBITS |
| eSIM order status | `esimOrders({ requestID })` | free |
| Cancel eSIM | `cancelEsim({ orderID })` | — |
| List games / products | `listGames()` / `listGameProducts({ gameID })` | free (public) |
| Validate player ID | `validateGamePlayer({ productID, player_id })` | free |
| Buy game top-up | `buyGame({ productID, player_id, requestID })` | DEBITS |
| Game order status | `awaitGameOrder({ orderID })` (polls for you) | free |
| Airports | `listAirports({ search })` | free |
| Search flights | `searchFlights({ origin, destination, departureDate })` | free |
| **Book flight** | `bookFlight({ token, searchID, preview: true })` → quote → `preview: false` | DEBITS (2-step) |
| Flight orders | `flightOrders({ requestID, transactionID })` | free |
| Browse store | `storeSearch({ q, scope })` → `storeProduct(id)` / `storeCategories()` / `storeSupplier(id)` | search costs a small fee |
| Image search | `storeImageSearch(formData)` | ₦4 |
| **Place store order** | `storeOrder({ reference, items, preview: true })` → quote → `preview: false` | DEBITS (2-step) |
| Store orders | `storeOrders({ order_id, reference })` / `payShipping({ order_id })` | DEBITS |
| Send bulk SMS | `sendSms({ sender, recipients, message })` | DEBITS |
| Any transaction status | `verifyTransaction({ requestID or transactionID })` | free |
| Verify a webhook | `verifyWebhook(rawBody, headers, secret)` | free |

## The two idempotency keys (do not mix them up)

- `requestID` — YOUR id. Any uuid. Send it on every purchase. The API dedupes
  on it; the SDK auto-generates one if you forget, but then you cannot look
  the order up deterministically — always send your own.
- `transactionID` / `orderID` — GSUBZ's id, returned on the purchase
  response. Use it afterwards for status and family order lookups.

## Purchase → confirm pattern (the safe loop)

```js
const reqID = crypto.randomUUID();
try {
  const res = await g.buyProduct({ serviceID: "mtn-data", billersCode: phone,
                                   amount: 500, phone, requestID: reqID });
  if (res.status === "successful") return res;
} catch (e) {
  if (e.code === "LOW_BALANCE") throw e;
  // network error or timeout — DO NOT re-purchase; verify instead
}
const checked = await g.verifyTransaction({ requestID: reqID });
```

Families with their own order state (games, flights, store) also expose
`awaitGameOrder` / `awaitFlightOrder` / polling helpers that wait until
`orderStatus` leaves `"processing"`.

## Flights (the trickiest flow)

1. `searchFlights(...)` → `offers[]`, each with a `token`, an `amount`, plus
   a `searchID` (quote, expires in minutes).
2. `bookFlight({ token, searchID, preview: true })` → `quoteID` + locked
   `quote.amount`. **No charge yet.**
3. `bookFlight({ quoteID, passengers, contact, maxAmount })` → charges and
   issues `pnr`/tickets. `maxAmount` caps what you accept.
4. If step 3 times out → `flightOrders({ requestID })`. Never re-book blind.

## Store

- `storeSearch` and `storeImageSearch` cost a small per-call fee (₦4 for
  image search) — do not loop them.
- Orders: `preview: true` first (returns `quote` with shipping cost), then
  commit with the SAME `reference`. A duplicate `reference` returns
  `duplicate: true` and no double charge.
- `payShipping({ order_id })` pays shipping for a placed order.

## Webhooks

Events arrive as `transaction.updated`, `games.order.updated`,
`store.order.updated`. Verify before trusting:

```js
import { verifyWebhook } from "gsubz-sdk";
const evt = verifyWebhook(rawBody, headers, SIGNING_SECRET); // throws if bad
if (seen.has(evt.eventId)) return 200; // dedupe — retries reuse eventId
```

Signature = `sha256=` + HMAC-SHA256 of `timestamp + "." + rawBody`. Stale
(>5 min) timestamps are rejected (replay protection). Respond 2xx within 10s.

## Error codes worth branching on

- `LOW_BALANCE` (507) — wallet empty; do not retry.
- `404` — bad key, or serviceID/productID doesn't exist.
- `429` — rate limited; back off.
- `5xx` — upstream issue; verify with `verifyTransaction`, don't re-buy.
- `TIMEOUT` — order state UNKNOWN; always verify, never re-purchase.

## Full method reference

Raw doc dump: `spec/gsubz-docs.md` · machine-readable spec:
`spec/gsubz.openapi.json` · types in `dist/index.d.ts`.
