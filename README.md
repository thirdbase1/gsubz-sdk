# gsubz-sdk

**Unofficial TypeScript / JavaScript SDK for the [GSUBZ API](https://gsubz.com/api_doc/).**

One dependency-free client for everything GSUBZ sells: airtime, data bundles,
cable TV, electricity tokens, exam pins, social-media orders, recharge pins,
eSIMs, bulk SMS — plus wallet balance, meter/smartcard verification and
transaction lookups.

Everything in here is taken straight from the official API doc (a copy of the
doc and the OpenAPI spec live in [`spec/`](spec/)). Nothing is invented.

```bash
npm install gsubz-sdk
```

## Why this SDK

The raw API is form posts with a handful of sharp edges. This SDK rounds them
off so you can't get them wrong:

- **Auto `requestID`** — every purchase gets a unique idempotency key if you
  don't pass one. Reusing one returns the *original* result and never double
  charges; the SDK surfaces that case explicitly (`e.duplicateRequestID`).
- **`status` checked, not just HTTP** — a purchase can return HTTP 200 and
  still be **failed**. Any non-successful outcome throws a typed
  [`GsubzError`](#errors) with the doc's own `code` + description.
- **Auth done both ways** — Bearer header **and** the `api` body field where
  the doc says both are needed; public endpoints (plans, eSIM catalogue) get
  no key at all.
- **Timeouts handled the safe way** — a client timeout throws with an
  instruction, never auto-retries a purchase. The SDK never re-sends money
  movement blindly; use `verifyTransaction()` instead (same call the doc
  prescribes).
- **Full typings** — every response shape is a TypeScript interface, every
  doc'd error code is a constant.

## Quickstart

```ts
import Gsubz from "gsubz-sdk";

const gsubz = new Gsubz({ apiKey: process.env.GSUBZ_API_KEY }); // starts with ap_

// 1. Check your wallet
const balance = await gsubz.getBalance(); // → 1234.5 (naira)

// 2. See what MTN SME data costs you
const plans = await gsubz.getPlans("mtn_sme");
for (const p of plans.plans) console.log(p.displayName, "₦" + p.api_price);

// 3. Sell 1GB (plan value from the list above)
const tx = await gsubz.buyData({
  serviceID: "mtn_sme",
  plan: "166",
  phone: "08031234567",
});
console.log(tx.status, tx.transactionID, tx.requestID);
```

That's the whole happy path. Everything else is the same shape.

## Buying things

All purchases go through the same client; the method just pre-fills the right
fields the way the doc describes.

### Data

```ts
await gsubz.buyData({ serviceID: "mtn_sme", plan: "166", phone: "08031234567" });
```

### Airtime (min ₦100)

```ts
await gsubz.buyAirtime({ serviceID: "mtn", amount: 500, phone: "08031234567" });
// serviceID: "mtn" | "airtel" | "etisalat" | "glo" (lowercase)
```

### Cable TV (DStv / GOtv / StarTimes)

Verify the smartcard first — it's one call and saves a failed charge:

```ts
const customer = await gsubz.verifyCustomer({ serviceID: "dstv", billersCode: "1043104310" });
// → { description: "CUSTOMER_FOUND", content: { customerName: "JOHN DOE", ... } }

await gsubz.buyCable({
  serviceID: "dstv",
  variationCode: "confam",        // plan value for this service
  customerID: "1043104310",
  phone: "08031234567",
});
```

### Electricity (prepaid token / postpaid bill)

`type` is required and goes in `variation_code` (doc's contract):

```ts
const meter = await gsubz.verifyCustomer({
  serviceID: "kaduna_electric",
  billersCode: "1112223334",
  type: "prepaid",
});

const tx = await gsubz.buyElectricity({
  serviceID: "kaduna_electric",
  customerID: "1112223334",
  amount: 2000,
  type: "prepaid",
  phone: "08031234567",
});
console.log(tx.api_response); // ← the actual meter token, in plain words
```

### Exam pins (WAEC / NECO / NABTEB)

```ts
const tx = await gsubz.buyExamPin({ serviceID: "waec", plan: "waecdirect", phone: "08031234567" });
// tx.api_response holds the pin text
```

### Social media orders

```ts
await gsubz.buySocial({ plan: "instagram-followers", link: "https://instagram.com/you", quantity: 100 });
```

### Recharge card pins (apiV2)

```ts
const res = await gsubz.generatePins({ network: "mtn", value: "100", number: 10 });
for (const p of res.pins) console.log(p.sn, p.pin);
```

### eSIMs

```ts
const { countries } = await gsubz.esimCountries();          // public, 241 of them
const usa = countries.find((c) => c.country === "United States");
const { packages } = await gsubz.esimPackages(usa.locationCodes.split(",")[0].trim());

const buy = await gsubz.buyEsim({ packageCode: packages[0].packageCode });

// Sometimes activation is async — poll for the QR code:
let [order] = (await gsubz.esimOrders({ requestID: buy.requestID })).orders;
while (order.esimStatus === "provisioning") {
  await new Promise((r) => setTimeout(r, 5000));
  [order] = (await gsubz.esimOrders({ orderID: order.orderID })).orders;
}
console.log(order.iccid, order.activationCode, order.qrCodeUrl);

// Unused eSIM? Refund it (only works once):
await gsubz.cancelEsim(order.orderID);
```

### Bulk SMS

```ts
const sms = await gsubz.sendSms({
  from: "MIRACLE",                       // 3–11 letters, no spaces/numbers
  to: ["08031234567", "08031234568"],    // or one comma/newline string, ≤ 5000
  msg: "Your delivery arrives tomorrow", // ≤ 905 chars
});
console.log(sms.sent, sms.failed, sms.recipients);
```

> The network silently rejects SMS about banks, OTPs, or with bare digit runs
> (write "5,000", not "5000") — the doc's content rules. Keep them in mind.

## Money safety

### Idempotency (`requestID`)

Pass your own (order id, invoice id) and a network retry can never double
charge — the API returns the original result with code 406
`INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID`, and the SDK flags it:

```ts
try {
  await gsubz.buyData({ serviceID: "mtn_sme", plan: "166", phone: "08031234567", requestID: "order-915" });
} catch (e) {
  if (e.duplicateRequestID) {
    // Already processed earlier — e.body holds the ORIGINAL result. Not an error.
  }
}
```

Omit it and the SDK generates one for you; it's echoed back on every response.

### Timeouts and the "did it go through?" problem

Purchases can be slow; the doc asks for ≥ 60s timeouts (SDK default: 90s). If
the client times out, **the purchase may still have succeeded** — never retry
blindly:

```ts
try {
  await gsubz.buyAirtime({ serviceID: "mtn", amount: 500, phone: "08031234567", requestID: "order-916" });
} catch (e) {
  if (e.code === 0 && e.description === "CLIENT_TIMEOUT") {
    const truth = await gsubz.verifyTransaction("order-916"); // the doc's own advice
  }
}
```

### Balance tracking

Purchase responses carry `initialBalance` / `finalBalance` / `amountPaid`
(your discounted API price). Compare them to reconcile your ledger.

## Errors

Everything that isn't a success throws `GsubzError`:

```ts
import { GsubzError, RESPONSE_CODES } from "gsubz-sdk";

try {
  await gsubz.buyData({ /* ... */ });
} catch (e) {
  if (e instanceof GsubzError) {
    e.code;              // 402 — the doc's numeric code
    e.description;       // "INSUFFICIENT_BALANCE" — the doc's name
    e.apiResponse;       // plain-words reason from the provider
    e.duplicateRequestID // true for 406 duplicate-request cases
    e.body;              // the full parsed response
  }
}
```

Codes straight from the doc: `204` missing field · `206` invalid content ·
`401` invalid plan · `402` insufficient balance · `404` not found · `405` not
POST · `406` service disabled / duplicate requestID / not cancellable · `429`
too many requests · `502` gateway error. The full table is exported as
`RESPONSE_CODES`.

## Configuration

```ts
const gsubz = new Gsubz({
  apiKey: process.env.GSUBZ_API_KEY, // required
  timeoutMs: 90_000,                 // default; doc asks for ≥ 60s on purchases
  baseUrl: "https://api.gsubz.com",  // override for tests/mocks
  headers: { "X-Trace-Id": "..." },  // added to every request
  fetchImpl: myFetch,                // custom fetch (proxies, test doubles)
});
```

Zero runtime dependencies. Node ≥ 18 (global fetch) and every modern
bundler/runtime — ESM and CommonJS builds ship together.

## API reference

| Method | Endpoint | Notes |
|---|---|---|
| `getBalance()` | `POST /api/balance/` | wallet balance, naira |
| `getPlans(serviceID)` | `GET /api/plans/` | public; data/cable/social catalogues |
| `verifyCustomer({serviceID, billersCode, type?})` | `POST /api/verify-customer/` | meters & smartcards; `type` required for electricity |
| `buyData(...)` · `buyAirtime(...)` · `buyCable(...)` · `buyElectricity(...)` · `buyExamPin(...)` · `buySocial(...)` | `POST /api/pay/` | all purchases; empty `amount` where the plan sets the price |
| `generatePins({network, value, number})` | `POST /apiV2/generate/` | header auth only |
| `esimCountries(q?)` | `GET /api/esim/countries/` | public |
| `esimPackages(locationCode)` | `GET /api/esim/packages/` | public; ≤ 20 comma-separated codes |
| `buyEsim({packageCode})` | `POST /api/esim/buy/` | may be `provisioning` → poll |
| `esimOrders({requestID?, orderID?})` | `POST /api/esim/orders/` | none given → last 50 |
| `cancelEsim(orderID)` | `POST /api/esim/cancel/` | refund, once only |
| `sendSms({from, to, msg})` | `POST /api/sms/` | ≤ 5,000 numbers, ≤ 905 chars |
| `verifyTransaction(requestID)` | `POST /api/verify/` | always use after a timeout |

A verbatim copy of the official doc (`spec/gsubz-docs.md`) and its OpenAPI
spec (`spec/gsubz.openapi.json`) ship in this repo so you can check the SDK
against the source without leaving your editor.

## Development

```bash
npm install
npm run typecheck   # strict tsc
npm test            # 15 offline contract tests against a doc-accurate mock
npm run build       # ESM + CJS into dist/
```

## License

MIT. Unofficial — not affiliated with GSUBZ. You need your own API key from
your GSUBZ dashboard. Keep it server-side only.
