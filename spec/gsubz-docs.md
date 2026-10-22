# GSUBZ API Documentation

Sell airtime, data, cable TV, electricity tokens, exam pins and social media services from your own website or app, using your GSUBZ wallet.

- Base URL: `https://api.gsubz.com`
- Get your API key: https://gsubz.com/dashboard/key.php
- Human-readable docs: https://gsubz.com/api_doc/
- OpenAPI 3.0 spec (JSON): https://gsubz.com/api_doc/?format=openapi
- This document (Markdown): https://gsubz.com/api_doc/?format=md
- Currency: Nigerian naira (NGN). Time zone: West Africa Time (UTC+1).

## Getting started

1. Create a GSUBZ account and fund your wallet.
2. Copy your API key from https://gsubz.com/dashboard/key.php.
3. Integrate using this documentation.
4. Check your API prices: every plan from Get Plans shows `price` (the normal price) and `api_price` (what you pay through the API).

## Authentication

Send your API key as a Bearer token on every request except Get Plans, List All Services, the two public eSIM lists and the two public game lists:

```
Authorization: Bearer YOUR_API_KEY
```

Most POST endpoints also take the same key in the `api` body field. The Store endpoints take the Bearer header only. Keep the key on your server and never expose it in a mobile app or in browser JavaScript.

## Making requests

| Topic | Detail |
|---|---|
| Base URL | `https://api.gsubz.com`. Always use HTTPS. |
| Endpoint paths | Paths end with a trailing slash, for example `/api/pay/`. Use the URLs exactly as shown. |
| Request body | Form data: `multipart/form-data` or `application/x-www-form-urlencoded`. Every value is sent as text. The GET endpoints (Get Plans, List All Services, List Airports, the eSIM lists, the two game lists and every Store endpoint except Image Search) take their fields in the query string instead. Place an Order and Book a Flight also accept a JSON body (`application/json`), which is the easiest way to send their lists (`items`, `passengers`). |
| Response body | JSON, UTF-8 encoded. |
| Authentication | Header `Authorization: Bearer YOUR_API_KEY`. See Authentication above. |
| Phone numbers | 11-digit Nigerian format, for example `08031234567`. |
| Money | Nigerian naira (₦). Send plain numbers: no ₦ symbol, commas or spaces (`2400`, not `₦2,400`). |
| Dates and time | ISO 8601 with the West Africa Time offset, for example `2026-01-01T09:30:00+01:00`. |
| Timeouts | A purchase can take a few seconds while the network or biller responds. Use a client timeout of at least 60 seconds. |

## Responses

Every purchase returns the same flat JSON object. Check `status` first: `successful` means delivered and `failed` means it did not go through.

| Field | Type | Description |
|---|---|---|
| `code` | integer | Result code. `200` means the request was processed. See Errors. |
| `status` | string | Outcome of the purchase. `successful` means it was delivered. `failed` means it did not go through. |
| `transactionID` | integer | GSUBZ's unique reference for this transaction. |
| `amount` | number | Value of the purchase in naira (the plan price, or the amount you requested). |
| `phone` | string | The phone number the purchase was made for, where the service uses one. |
| `serviceID` | string | The service you bought. |
| `amountPaid` | number | Amount deducted from your wallet, in naira, at your API price. It can be lower than `amount`. |
| `initialBalance` | number | Wallet balance before the purchase. |
| `finalBalance` | number | Wallet balance after the purchase. |
| `date` | string | When the transaction was created (ISO 8601, West Africa Time). |
| `api_response` | string | The message returned by the network or provider, for example the confirmation text for a recharge or data purchase. |

## Errors

A transaction can return HTTP 200 and still have failed. Always check the `status` field.

| Code | `status` | `description` | Meaning | What to do |
|---|---|---|---|---|
| 200 | `successful` | - | The request was processed. A transaction can still fail with HTTP 200, so always read the `status` field. | Deliver value only when `status` is `successful`. A purchase that did not go through returns `failed`. |
| 204 | `failed` | `REQUIRED_CONTENT_NOT_SENT` | A required field is missing from your request. | Compare your request with the Parameters table for that endpoint. |
| 400 | `failed` | `REQUIRED_CONTENT_REQUESTID_IS_EMPTY` | You sent neither `requestID` nor `transactionID` to [Fetch Transaction Status](#transaction-status). | Send one of them. |
| 206 | `failed` | `INVALID_CONTENT` | One of the fields has an invalid value. | Check the phone number, amount and service ID formats. |
| 401 | `failed` | `INVALID_PLAN` | The `plan` or `variation_code` does not match the `serviceID`. | Call [Get Plans](#plans) again and use a value from that list. |
| 401 | `failed` | `INVALID_API_OR_NOT_FOUND` | The API key is missing or is not valid. | Send it as `Authorization: Bearer YOUR_API_KEY`, and copy it again from your dashboard if it still fails. |
| 402 | `failed` | `INSUFFICIENT_BALANCE` | Your wallet balance is too low for this purchase. | Fund your wallet, then try again. |
| 404 | `failed` | `CONTENT_NOT_FOUND` | The resource you asked for could not be found. | Check the URL and the reference you sent. |
| 405 | `failed` | `REQUEST_METHOD_NOT_IN_POST` | You used GET where POST is required, or the other way round. | Use the method shown for the endpoint. |
| 406 | `failed` | `SERVICE_DISABLED` | This service is temporarily disabled. | Try again later or use another service. |
| 406 | `successful or failed` | `INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID` | You already used this `requestID`. Nothing was charged again, and the response carries the original result. A `requestID` already used by another account is refused the same way, with no transaction details. | Read the original result from the response, or send a new `requestID` for a new order. |
| 406 | `failed` | `NOT_CANCELLABLE` | The eSIM cannot be cancelled, for example because it was already installed or already refunded. | Nothing was changed. Only an unused eSIM can be cancelled. |
| 404 | `failed` | `PLAYER_NOT_FOUND` | The player ID you sent does not exist for that game. | Check the ID with the player. Nothing was charged. |
| 406 | `failed` | `OUT_OF_STOCK` | That game product is out of stock right now. For a Store order: you asked for more than is in stock, and the response has `available`. | Nothing was charged. Pick another amount or lower the quantity, or try again later. |
| 406 | `failed` | `PRICE_CHANGED` | The price changed while your order was being placed. For a Store order: a product costs more than the `price` you sent, and the response lists `currentPriceNgn` for each item. | Nothing was charged. Fetch the products again ([List Game Products](#games-products) or [Get Product Details](#store-product)) and retry. |
| 206 | `failed` | `REGION_MISMATCH` | The player account is in a region that cannot receive this product. | Use the product line for the player's region. Nothing was charged. |
| 406 | `failed` | `ORDER_FAILED` | The order could not be completed, and your wallet was refunded automatically. | The response carries the refunded order. Try another product or try again later. |
| 406 | `failed` | `REQUEST_IN_PROGRESS` | An earlier request with this `requestID` has not finished yet. | Look it up with [Fetch Game Orders](#games-orders) in a minute, or send a new `requestID` for a new order. |
| 206 | `failed` | `BELOW_MINIMUM_ORDER` | A product needs more pieces (across its variants) than you ordered. The response has `moq`. | Raise the quantity to at least `moq`. |
| 406 | `failed` | `SEARCH_EXPIRED` | The flight search you are booking from is older than one hour (or is not yours). | Search again and pick a flight from the new results. Nothing was charged. |
| 406 | `failed` | `QUOTE_EXPIRED` | The locked flight price expired (about 25 minutes) or was already used. | Call [Book a Flight](#flight-book) with `preview=true` for a new price. Nothing was charged. |
| 406 | `failed` | `FARE_UNAVAILABLE` | The airline no longer offers that fare. | Search again and pick another flight. Nothing was charged. |
| 406 | `failed` | `BOOKING_FAILED` | The airline could not issue the booking, and your wallet was refunded automatically. | Nothing was charged. Search again, or try another flight. |
| 406 | `failed` | `CANCEL_NOT_ALLOWED` | The order or item can no longer be cancelled: more than 2 hours have passed, or it is already being processed or cancelled. | Nothing was changed. Contact support if something went wrong with the order. |
| 406 | `failed` | `NOTHING_DUE` | No shipping fee is due on that order or item right now. | Nothing was charged. Check `shipping.status` in [Get Orders](#store-orders). |
| 406 | `failed` | `ACCOUNT_BLOCKED` | This account is blocked. | Contact support. |
| 407 | `failed` | `Chat Admin to get upgraded before using our API, Thank you!` | Your account has not been upgraded for API use yet. | Contact support to be upgraded. The HTTP status for this one is 403. |
| 429 | `failed` | `TOO_MANY_REQUESTS` | You sent too many requests in a short time. The Store endpoints allow 60 calls a minute for each API key, and flight searches 20. | Wait a minute, then try again. |
| 500 | `failed` | `SERVER_ERROR` | Something went wrong on our side. Nothing was charged. | Try again. If it keeps happening, contact support. |
| 502 | `failed` | `GATEWAY_ERROR` | The upstream provider did not respond. Safe to retry. | If you sent a `requestID`, check [Fetch Transaction Status](#transaction-status) first, then retry. Store calls that fail this way are never charged. |

A failed request returns `status: failed`, the `code`, a `description` from the table above, and an `api_response` that explains what went wrong. Example:

```json
{
  "code": 402,
  "status": "failed",
  "description": "INSUFFICIENT_BALANCE",
  "api_response": "Your wallet balance is too low for this purchase"
}
```

## Best practices

1. **Keep your API key on your server.** Never put it in a mobile app, in website JavaScript or in a public repository. Call GSUBZ from your backend only. If a key is ever exposed, reset it from your dashboard.
2. **Send a unique requestID with every purchase.** Use your own order or invoice number. It lets you look the transaction up later with [Fetch Transaction Status](#transaction-status). You can also look it up with the `transactionID` from the response, so save that too.
3. **Read status, not just the HTTP code.** A response can arrive with HTTP 200 and still describe a failed transaction. Treat a purchase as successful only when `status` is `successful`. A failed purchase returns `failed`.
4. **Never resend a purchase blindly after a timeout.** If a request times out or you get no response, the purchase may still have gone through. Look it up by `requestID` first, so you do not charge your customer twice. A purchase that takes longer than 10 seconds, or whose answer never reaches you, also sends its final result to your [webhook](#webhooks) as `transaction.updated`.
5. **Fetch plans instead of hard-coding them.** Plan values and prices can change. Call [Get Plans](#plans) and use the `value` it returns as your `plan` (or `variation_code`).
6. **Verify meter and smartcard numbers before paying.** Call [Verify Meter / IUC Number](#verify-customer) so your customer can confirm their name before you charge them. It catches typing mistakes before money moves.
7. **Watch your wallet balance.** Check [Fetch Wallet Balance](#wallet-balance) and top up before it runs low, so customers do not hit `INSUFFICIENT_BALANCE`.
8. **Treat processing game orders as unfinished.** A game purchase can return `orderStatus` `processing`. You have been charged, and the order ends as `completed` or `refunded`. Wait for the `games.order.updated` [webhook](#webhooks), or check it with [Fetch Game Orders](#games-orders), before you tell your customer it is done.
9. **Cache Store results on your side.** Every paid Store call is charged, even when you repeat the same request. Save search results and product details in your own database or cache, and refresh them only when you need to.
10. **Preview Store orders, and send a reference.** Call [Place an Order](#store-order) with `preview=true` to show your customer the exact total first. Then place it with your own unique `reference`, so a retry after a timeout can never create a second order.
11. **Preview a flight, then book it.** Show your customer the price from [Book a Flight](#flight-book) with `preview=true`, not the one from search, then book with the `quoteID` and a unique `requestID`. A booking can be `processing` for a while: wait for the `flight.order.updated` [webhook](#webhooks) before you tell your customer the ticket is issued.
12. **Check every webhook's signature.** Verify `X-Gsubz-Signature` with your signing secret before you trust a [webhook](#webhooks), answer `2xx` quickly, and ignore an `eventId` you have already handled.
13. **Convert numbers before doing arithmetic.** Amounts and balances are numbers in naira. Convert them yourself before doing arithmetic, in case a value ever arrives as text.

## Webhooks

We POST a JSON event to your webhook URL when something changes on an order you placed through the API, including the final result of a slow data, airtime or bill purchase and any later refund.

- Set your webhook URL and copy your signing secret on your [key page](https://gsubz.com/dashboard/key.php#webhook). The URL must be `https://`. One URL receives every event for your account.
- Webhooks are sent for orders you place through the API. Each one carries the whole order as it is now, so you never need a second call to know where things stand.
- Answer with any `2xx` status within 10 seconds. Save the event and do the slow work afterwards.
- If your server does not answer `2xx`, we try again after about 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours and 24 hours (7 attempts in all). You can see every delivery, and resend failed ones, on your key page.
- The same event can arrive more than once, and events can arrive out of order. Use `eventId` to ignore repeats, and trust the newest `order` or `transaction` you have received (or call [Get Orders](#store-orders) or [Fetch Transaction Status](#transaction-status)).

| Header | Meaning |
|---|---|
| `Content-Type` | Always `application/json`. |
| `X-Gsubz-Event` | The event name, for example `store.order.updated`. |
| `X-Gsubz-Delivery` | The unique ID of this event (the same as `eventId` in the body). Retries of the same event keep the same ID, so use it to ignore duplicates. |
| `X-Gsubz-Timestamp` | Unix time (seconds) when this attempt was sent. |
| `X-Gsubz-Signature` | `sha256=` followed by the HMAC-SHA256 of `timestamp + "." + raw body`, made with your signing secret. |

| Event | `data.change.type` | When |
|---|---|---|
| `transaction.updated` | `COMPLETED` | The final result of a data, airtime, cable TV, electricity, exam pin or social media purchase (`/api/pay/`), sent when the call took longer than 10 seconds or the connection closed before our answer reached you. So a short timeout on your side never leaves you guessing. `reason` is `SLOW_RESPONSE` or `CLIENT_DISCONNECTED`, and `processingSeconds` is how long it took. Sent at most once per transaction. |
| `transaction.updated` | `REFUNDED` | A purchase that had already answered was refunded to your wallet later, for example by our support team, or because the provider cancelled a social media order: `from`, `to` (`failed`), `refundNgn` and `reason` (`ADMIN` or `PROVIDER_CANCELLED`). The transaction's `status` is now `failed` and `amountRefunded` shows the refund. Sent at most once per transaction. |
| `store.order.updated` | `ORDER_PLACED` | An order you placed through the API was created and paid. |
| `store.order.updated` | `STATUS` | An item moved to a new status (`from`, `to`). A cancellation also carries `refund` (`totalNgn`, `itemNgn`, `serviceFeeNgn`, `shippingNgn`, `deliveryNgn`) and `reason`. |
| `store.order.updated` | `SHIPPING_FEE` | An item was weighed and its shipping fee was set or changed (`previousUnitNgn`, `unitNgn`). The item's `shipping` in `order` has the new `weightKg`, `volumeCbm` and `dueNgn`. Pay with [Pay Shipping](#store-order-pay-shipping) when `dueNgn` is more than 0. |
| `store.order.updated` | `SHIPPING_METHOD` | An item had to switch between air and sea (`from`, `to`), with its new fee and any refund (`refundNgn`). |
| `store.order.updated` | `SHIPPING_PAID` | Shipping you paid was received (`items`, `amountNgn`). |
| `store.order.updated` | `TRACKING` | The delivery tracking number for the pickup station was added (`trackingNumber`). |
| `flight.order.updated` | `CONFIRMED` | A flight you booked was confirmed. `order` carries the `pnr` and `tickets` when they are already issued. |
| `flight.order.updated` | `TICKETED` | The PNR and e-ticket numbers arrived after the booking was confirmed. |
| `flight.order.updated` | `REFUNDED` | A flight booking failed or was cancelled by the airline, and your wallet was refunded: `reason` (`FAILED` or `CANCELLED`) and `refundNgn`. |
| `games.order.updated` | `STATUS` | A game order that was still `processing` when [Buy Game Top-up](#games-buy) answered has finished (`from`, `to`). `to` is `completed` (any gift-card `codes` are in `order`) or `refunded` (your wallet was refunded). Not sent when the purchase response already gave the final result. |
| `webhook.test` | - | Sent when you press "Send test event" on your key page. |

Example body (data, airtime and bills: a refund):

```json
{
  "event": "transaction.updated",
  "eventId": "evt_7d41c2b9e0a35f6d8c12ab90",
  "createdAt": "2026-10-19T10:20:05+01:00",
  "data": {
    "change": { "type": "REFUNDED", "from": "successful", "to": "failed", "refundNgn": 2284.56, "reason": "ADMIN" },
    "transaction": {
      "transactionID": 3878886201,
      "requestID": "8dhbc8w7huwh8hw9hew9",
      "serviceID": "mtn_sme",
      "status": "failed",
      "description": "TRANSACTION_REVERSED",
      "amount": 2400,
      "amountPaid": 0,
      "amountRefunded": 2284.56,
      "phone": "08031234567",
      "initialBalance": 5000,
      "finalBalance": 2715.44,
      "date": "2026-10-19T09:47:15+01:00",
      "api_response": "Dear Customer, You have successfully shared 10GB Data to 2348031234567. Thankyou"
    }
  }
}
```

Example body (store order):

```json
{
  "event": "store.order.updated",
  "eventId": "evt_8f2c1d0a9b7e6f5a4c3b2a19",
  "createdAt": "2026-10-16T13:02:44+01:00",
  "data": {
    "change": { "type": "SHIPPING_FEE", "itemId": 88121, "previousUnitNgn": 0, "unitNgn": 13068 },
    "order": {
      "orderId": 5231,
      "reference": "ORDER-10045",
      "amounts": { "itemsNgn": 14100, "serviceFeeNgn": 1900, "shippingPaidNgn": 16676, "shippingDueNgn": 13068, "deliveryNgn": 2400 },
      "items": [
        {
          "itemId": 88121,
          "status": "PAID",
          "shipping": { "method": "air", "weightKg": 0.9, "volumeCbm": 0.001, "status": "due", "unitNgn": 13068, "totalNgn": 13068, "paidNgn": 0, "dueNgn": 13068 }
        }
      ]
    }
  }
}
```

Example body (flight booking):

```json
{
  "event": "flight.order.updated",
  "eventId": "evt_3c9a77d1b0e24f6a8d15c2e7",
  "createdAt": "2026-10-17T11:04:10+01:00",
  "data": {
    "change": { "type": "CONFIRMED" },
    "order": {
      "transactionID": "TRV261017110002AB12CD34",
      "requestID": "flight-1001",
      "orderStatus": "completed",
      "origin": "LOS",
      "destination": "ABV",
      "departureDate": "2026-12-01",
      "amountPaid": 95000,
      "pnr": "ABC123",
      "tickets": [
        { "name": "Ada Obi", "type": "ADT", "ticketNumber": "1234567890123" }
      ]
    }
  }
}
```

Example body (game order):

```json
{
  "event": "games.order.updated",
  "eventId": "evt_5b1e93c0d7a24f88b6e01c4d",
  "createdAt": "2026-10-17T13:54:33+01:00",
  "data": {
    "change": { "type": "STATUS", "from": "processing", "to": "completed" },
    "order": {
      "orderID": 15,
      "transactionID": "GM261007113015A1B2C3D4",
      "requestID": "game-1001",
      "game": "Free Fire · Direct Topup Mena",
      "product": "100 Diamonds",
      "amount": 1520,
      "amountPaid": 1520,
      "amountRefunded": 0,
      "orderStatus": "completed",
      "playerName": "ProGamer99",
      "codes": [],
      "date": "2026-10-07T11:30:15+01:00"
    }
  }
}
```

Verify the signature (PHP):

```php
<?php
$secret = 'whsec_...';                       // from your key page
$body   = file_get_contents('php://input');  // the RAW body, before json_decode
$ts     = $_SERVER['HTTP_X_GSUBZ_TIMESTAMP'] ?? '';
$sig    = $_SERVER['HTTP_X_GSUBZ_SIGNATURE'] ?? '';

$expected = 'sha256=' . hash_hmac('sha256', $ts . '.' . $body, $secret);
if (!hash_equals($expected, $sig) || abs(time() - (int)$ts) > 300) {
    http_response_code(401);
    exit;
}

$event = json_decode($body, true);
// Save it, skip it if you already have $event['eventId'], then do the work later.
http_response_code(200);
echo 'ok';
```

Verify the signature (Node.js):

```js
// Express: use the raw body for the signature
app.post('/gsubz/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const ts = req.get('X-Gsubz-Timestamp');
  const expected = 'sha256=' + crypto.createHmac('sha256', process.env.GSUBZ_WEBHOOK_SECRET)
    .update(ts + '.' + req.body).digest('hex');
  const got = req.get('X-Gsubz-Signature') || '';
  if (got.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return res.sendStatus(401);
  }
  const event = JSON.parse(req.body);
  // Save it, skip it if you already have event.eventId, then do the work later.
  res.send('ok');
});
```

## Service IDs (live)

Use the `serviceID` value in requests. This list is generated live, so it is always current.

### Airtime

- `etisalat`: 9mobile Airtime
- `airtel`: Airtel Airtime
- `glo`: Glo Airtime
- `mtn`: MTN Airtime

### Data Subscription

- `etisalat_data`: 9mobile or T2 Data
- `airtel_gifting`: Airtel Gifting Data
- `airtel_sme`: Airtel SME Data
- `glo_data`: Glo Corporate Gifting Data
- `glo_sme`: Glo SME Data
- `mtn_gifting`: MTN Gifting Data
- `mtn_sme`: MTN SME Data

### Education (Result Pins)

- `nabteb`: NABTEB Result Pin
- `neco`: NECO Result Pin
- `waec`: WAEC Result Pin

### Electricity Billl

- `aba-electric`: Aba (ABEDC/APL)
- `abuja-electric`: Abuja (AEDC)
- `benin-electric`: Benin (BEDC)
- `eko-electric`: Eko (EKEDC)
- `enugu-electric`: Enugu (EEDC)
- `ibadan-electric`: Ibadan (IBEDC)
- `ikeja-electric`: Ikeja (IKEDC)
- `jos-electric`: Jos (JEDC)
- `kaduna-electric`: Kaduna KAEDCO)
- `kano-electric`: Kano (KEDCO) 
- `portharcourt-electric`: Port Harcourt (PHED)
- `yola-electric`: Yola (YEDC)

### Pro Services/Apps

- `canva`: Canva Pro

### Socials Media Market

- `socials`: Socials Media Market

### TV Subscriptions

- `dstv`: DSTV
- `gotv`: GOTV
- `startimes`: Startimes

### Uncategorised

- `mtn_datashare`: MTN-SME-Datashare

## API reference

The six purchase endpoints below all use `POST /api/pay/`. The `serviceID` you send decides what is bought.

### Wallet

#### Fetch Wallet Balance

`POST https://api.gsubz.com/api/balance/`

Returns your current wallet balance in naira (₦). Check it before a purchase so you can top up before a transaction fails with `INSUFFICIENT_BALANCE`.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/balance/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'api="YOUR_API_KEY"'
```

Example response:

```json
{
  "balance": "747.5"
}
```

`balance` is returned as a string. Convert it to a number before doing arithmetic.

### Services

#### List All Services

`GET https://api.gsubz.com/api/category/`

Returns every active `serviceID` GSUBZ offers, grouped under its category — data, cable TV, electricity, social media and so on. Call this once to build a full picture of what's available, then use [Get Plans](#plans) for a specific service's pricing. No parameters: it always returns everything in one response, so filter or sort on your side.

Authentication: none required.

No parameters. It always returns everything in one response.

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/category/'
```

Example response:

```json
[
  {
    "name": "electricity",
    "displayName": "Electricity",
    "image": "//gsubz.com/uploads/2021/9/1/electric-icon.png",
    "services": [
      {
        "serviceID": "eko-electric",
        "displayName": "Eko (EKEDC)"
      },
      {
        "serviceID": "kaduna-electric",
        "displayName": "Kaduna Electric"
      }
    ]
  },
  {
    "name": "cable",
    "displayName": "Cable TV",
    "image": "//gsubz.com/uploads/2021/9/1/cable-icon.png",
    "services": [
      {
        "serviceID": "gotv",
        "displayName": "GOtv"
      }
    ]
  }
]
```

A category with no active services still appears, with an empty `services` array. `image` is `null` when the category has no icon set. This list is cached for up to 60 seconds, so a change can take up to a minute to show here.

### Plans

#### Get Plans

`GET https://api.gsubz.com/api/plans/`

One shared endpoint for every category's plan list: data, cable TV, social media and more. Pass the `service` you want and get back that service's plans. Call it before a purchase to get the correct plan value. Every plan shows its normal `price` and its `api_price`, the price you pay through the API.

> The plan identifier is returned in a field called `PlanName`, and its value tells you which body field to submit when buying. Data and social media services use `plan`. Cable TV services use `variation_code`.

Authentication: none required.

| Query parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| `service` | string | Yes | `mtn_sme` | The service ID, for example `mtn_sme`. Also accepts cable (`gotv`, `dstv`, `startimes`) and social media (`socials`) service IDs. See [Service IDs](#service-ids). |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/plans/?service=mtn_sme'
```

Example response:

```json
{
  "service": "MTN-SME-Data(*461*4#)",
  "PlanName": "plan",
  "fixedPrice": true,
  "discount": "4.81%",
  "plans": [
    {
      "displayName": "10GB - 30days",
      "value": "260",
      "price": "2400",
      "api_price": "2284.56"
    }
  ]
}
```

Use `value` as your `plan` (or `variation_code`) when you buy. `price` is the normal price and `api_price` is the price you pay through the API, both in naira. `discount` is your API discount on this service.

### Verify Customer

#### Verify Meter / IUC Number

`POST https://api.gsubz.com/api/verify-customer/`

Checks a meter number or a cable smartcard/IUC number before payment and returns the customer's name (and, for electricity meters, their address and account type). Always verify before you charge: it catches typing mistakes before money moves.

> For electricity services, `type` is required: `prepaid` or `postpaid`. For cable services (`dstv`, `gotv`, `startimes`), leave `type` out.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `serviceID` | string | Yes | `kaduna_electric` | Any electricity or cable service ID: see the list below, or `dstv`, `gotv`, `startimes` for cable. Underscores and hyphens both work, so `kaduna_electric` and `kaduna-electric` are the same. |
| `billersCode` | string | Yes | `00000000000` | The meter number (electricity) or smartcard/IUC number (cable). |
| `type` | string | Electricity only | `prepaid` | `prepaid` or `postpaid`. Required for electricity, omit for cable. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/verify-customer/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'api="YOUR_API_KEY"' \
--form 'serviceID="kaduna_electric"' \
--form 'billersCode="00000000000"' \
--form 'type="prepaid"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "description": "CUSTOMER_FOUND",
  "content": {
    "customerName": "JOHN ADEBAYO",
    "address": "12 SAMPLE STREET, IKEJA",
    "meterNumber": "45000000000",
    "meterType": "PREPAID",
    "accountType": null,
    "canVend": "yes"
  }
}
```

Some fields, such as `accountType`, can be `null` when the provider does not send them. Cable verification returns `customerName`, `status`, `dueDate`, `customerNumber` and `customerType` instead of the address and meter fields. Both shapes are under `content`, so you can always read `customerName` the same way.

Example error response (HTTP 404):

```json
{
  "code": 404,
  "status": "failed",
  "description": "CONTENT_NOT_FOUND",
  "api_response": "Could not verify this meter number"
}
```

### Data & Airtime

#### Buy Data

`POST https://api.gsubz.com/api/pay/`

Send a data bundle to any Nigerian phone number. Call [Get Plans](#plans) with the network's `serviceID` first to get the exact `plan` value, then submit it here. The data service IDs are listed under [Service IDs](#service-ids).

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `serviceID` | string | Yes | `mtn_sme` | The data service ID, for example `mtn_sme`. |
| `plan` | string | Yes | `260` | The plan value from [Get Plans](#plans) for this service. |
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `amount` | string | Yes | `""` (empty string) | Send as an empty string. The price is set by the plan. |
| `phone` | string | Yes | `08031234567` | The phone number to receive the data. |
| `requestID` | string | No | `8dhbc8w7huwh8hw9hew9` | Your own unique reference for this order (for example your order ID). Use it later with [Fetch Transaction Status](#transaction-status). |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/pay/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'serviceID="mtn_sme"' \
--form 'plan="260"' \
--form 'api="YOUR_API_KEY"' \
--form 'amount=""' \
--form 'phone="08031234567"' \
--form 'requestID="8dhbc8w7huwh8hw9hew9"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "transactionID": 3878886201,
  "amount": 2400,
  "phone": "08031234567",
  "serviceID": "mtn_sme",
  "amountPaid": 2284.56,
  "initialBalance": 5000,
  "finalBalance": 2715.44,
  "date": "2026-09-28T09:47:15+01:00",
  "api_response": "Dear Customer, You have successfully shared 10GB Data to 2348031234567. Thankyou"
}
```

Values are examples. Read `status` (`successful` or `failed`) to know the outcome, and see [Responses](#responses) for every field.

#### Buy Airtime

`POST https://api.gsubz.com/api/pay/`

Send airtime to any Nigerian number. The `serviceID` must be one of `mtn`, `airtel`, `etisalat` (9mobile) or `glo`: lowercase, spelt exactly as shown.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `serviceID` | string | Yes | `mtn` | `mtn`, `airtel`, `etisalat` (9mobile) or `glo`. |
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `amount` | string | Yes | `100` | Amount of airtime in naira. The minimum is ₦100. |
| `phone` | string | Yes | `08031234567` | The phone number to receive the airtime. |
| `requestID` | string | No | `8dhbc8w7huwh8hw9hew9` | Your own unique reference for this order (for example your order ID). Use it later with [Fetch Transaction Status](#transaction-status). |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/pay/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'serviceID="mtn"' \
--form 'api="YOUR_API_KEY"' \
--form 'amount="100"' \
--form 'phone="08031234567"' \
--form 'requestID="8dhbc8w7huwh8hw9hew9"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "transactionID": 3768661863,
  "amount": 800,
  "phone": "08031234567",
  "serviceID": "mtn",
  "amountPaid": 768,
  "initialBalance": 5000,
  "finalBalance": 4232,
  "date": "2026-09-28T09:47:15+01:00",
  "api_response": "You have topped up N800.00 to 2348031234567. ref: 2026092809402519057879292"
}
```

Values are examples. Read `status` (`successful` or `failed`) to know the outcome, and see [Responses](#responses) for every field.

### Cable TV

#### Buy TV / Decoder / Cable Sub

`POST https://api.gsubz.com/api/pay/`

Renew a DStv, GOtv or StarTimes subscription. The `serviceID` must be `gotv`, `dstv` or `startimes`. Verify the smartcard/IUC number with [Verify Meter / IUC Number](#verify-customer) first.

> For cable, [Get Plans](#plans) returns the package identifier as `variation_code`. Send that value in the `variation_code` field.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `serviceID` | string | Yes | `gotv` | `dstv`, `gotv` or `startimes`. |
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `variation_code` | string | Yes | `gotv-smallie` | The package from [Get Plans](#plans) (`service=gotv`, `dstv` or `startimes`). |
| `phone` | string | Yes | `08031234567` | Customer phone number. Can be any valid number. |
| `amount` | string | Yes | `""` (empty string) | Send as an empty string. The price is set by the plan. |
| `customerID` | string | Yes | `0000000000` | The IUC or smartcard number of the decoder. |
| `requestID` | string | No | `8dhbc8w7huwh8hw9hew9` | Your own unique reference for this order (for example your order ID). Use it later with [Fetch Transaction Status](#transaction-status). |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/pay/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'serviceID="gotv"' \
--form 'api="YOUR_API_KEY"' \
--form 'variation_code="gotv-smallie"' \
--form 'phone="08031234567"' \
--form 'amount=""' \
--form 'customerID="0000000000"' \
--form 'requestID="8dhbc8w7huwh8hw9hew9"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "transactionID": 3685573902,
  "amount": 900,
  "phone": "08031234567",
  "serviceID": "gotv",
  "amountPaid": 882,
  "initialBalance": 5000,
  "finalBalance": 4118,
  "date": "2026-09-28T09:47:15+01:00",
  "api_response": "Your GOtv subscription was successful."
}
```

Values are examples. Read `status` (`successful` or `failed`) to know the outcome, and see [Responses](#responses) for every field.

### Electricity

#### Buy Electric Token

`POST https://api.gsubz.com/api/pay/`

Generate an electricity token (prepaid) or pay a postpaid bill for any supported distribution company. Verify the meter number first with [Verify Meter / IUC Number](#verify-customer) so your customer sees their own name before you charge them.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `serviceID` | string | Yes | `kaduna_electric` | The distribution company service ID. See the list below. |
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `phone` | string | Yes | `08031234567` | Customer phone number. Can be any valid number. |
| `customerID` | string | Yes | `00000000000` | The meter number. |
| `amount` | string | Yes | `1100` | Amount of electricity to buy, in naira. |
| `variation_code` | string | Yes | `prepaid` | `prepaid` or `postpaid`. |
| `requestID` | string | No | `8dhbc8w7huwh8hw9hew9` | Your own unique reference for this order (for example your order ID). Use it later with [Fetch Transaction Status](#transaction-status). |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/pay/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'serviceID="kaduna_electric"' \
--form 'api="YOUR_API_KEY"' \
--form 'phone="08031234567"' \
--form 'customerID="00000000000"' \
--form 'amount="1100"' \
--form 'variation_code="prepaid"' \
--form 'requestID="8dhbc8w7huwh8hw9hew9"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "transactionID": 3574357094,
  "amount": 1100,
  "phone": "08031234567",
  "serviceID": "kaduna_electric",
  "amountPaid": 1100,
  "initialBalance": 5000,
  "finalBalance": 3900,
  "date": "2026-09-28T09:47:15+01:00",
  "api_response": "Token: 47488383838383838383833"
}
```

Values are examples. Read `status` (`successful` or `failed`) to know the outcome, and see [Responses](#responses) for every field.

### Exam Pins

#### Buy Exam Pin

`POST https://api.gsubz.com/api/pay/`

Buy an exam pin. The `serviceID` must be `waec`, `neco` or `nabteb`: lowercase, spelt exactly as shown. Each exam service has one plan.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `serviceID` | string | Yes | `waec` | `waec`, `neco` or `nabteb`. |
| `plan` | string | Yes | `waecdirect` | The plan for the exam service. There is one plan per service; for WAEC it is `waecdirect`. |
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `amount` | string | Yes | `""` (empty string) | Send as an empty string. The price is set by the plan. |
| `phone` | string | Yes | `08031234567` | Customer phone number. |
| `requestID` | string | No | `87dfhw8dbw8e7hw9d9dh` | Your own unique reference for this order. Use it later with [Fetch Transaction Status](#transaction-status). |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/pay/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'serviceID="waec"' \
--form 'plan="waecdirect"' \
--form 'api="YOUR_API_KEY"' \
--form 'amount=""' \
--form 'phone="08031234567"' \
--form 'requestID="87dfhw8dbw8e7hw9d9dh"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "transactionID": 3075647209,
  "amount": 3500,
  "phone": "08031234567",
  "serviceID": "waec",
  "amountPaid": 3500,
  "initialBalance": 5000,
  "finalBalance": 1500,
  "date": "2026-09-28T09:47:15+01:00",
  "api_response": "968686868685<=>WRN2056666666"
}
```

Values are examples. Read `status` (`successful` or `failed`) to know the outcome, and see [Responses](#responses) for every field.

### Social Media Market

#### Buy Social Media Service

`POST https://api.gsubz.com/api/pay/`

Place a social media order. The `serviceID` is always `socials`. Call [Get Plans](#plans) with `service=socials` first to get the `plan` value for the service you want (for example Instagram followers or TikTok likes).

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `serviceID` | string | Yes | `socials` | Always `socials`. |
| `plan` | string | Yes | `179` | The plan value from [Get Plans](#plans) (`service=socials`). |
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `amount` | string | Yes | `""` (empty string) | Send as an empty string. The price is set by the plan. |
| `link` | string | Yes | `https://instagram.com/gsubzonline` | The profile or post URL the order should be delivered to. |
| `quantity` | integer | Yes | `1000` | How many to deliver. Must be a positive whole number. |
| `requestID` | string | No | `8dhbc8w7huwh8hw9hew9` | Your own unique reference for this order (for example your order ID). Use it later with [Fetch Transaction Status](#transaction-status). |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/pay/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'serviceID="socials"' \
--form 'plan="179"' \
--form 'api="YOUR_API_KEY"' \
--form 'amount=""' \
--form 'link="https://instagram.com/gsubzonline"' \
--form 'quantity="1000"' \
--form 'requestID="8dhbc8w7huwh8hw9hew9"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "transactionID": 3075647200,
  "amount": 179,
  "serviceID": "socials",
  "amountPaid": 179,
  "initialBalance": 5000,
  "finalBalance": 4821,
  "date": "2026-09-28T09:47:15+01:00",
  "api_response": "Order received. Order ID: 39554883"
}
```

Values are examples. Read `status` (`successful` or `failed`) to know the outcome, and see [Responses](#responses) for every field.

### Recharge Pins

#### Recharge Pins / Epins Printing

`POST https://api.gsubz.com/api/generate/`

Generate recharge card pins for printing. The `network` must be `mtn`, `airtel`, `glo` or `9mobile`: lowercase, spelt exactly as shown. This endpoint authenticates with the `Authorization` header only.

> If you get `UNABLE_TO_PROCESS_REQUEST`, or no response at all, do not resend the order straight away. Check [Fetch Recharge Pin Orders](#generate-history) first: if the order is listed, it went through and your pins are there. Only send a new order when it is not listed.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `network` | string | Yes | `airtel` | `mtn`, `airtel`, `glo` or `9mobile`. |
| `value` | string | Yes | `500` | Face value of each pin in naira: `100`, `200`, `400` or `500`. |
| `number` | string | Yes | `1` | How many pins to generate. The minimum is 10 for values below 500. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/generate/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'network="airtel"' \
--form 'value="500"' \
--form 'number="1"'
```

Example response:

```json
{
  "message": "We Received your order, 1 of 1 delivered\n Thank you for your patronage",
  "status": "success",
  "id": "c143e774874a59623aa928292d128f97",
  "network": "Airtel",
  "value": "500",
  "number": "1",
  "delivered": "1",
  "pending": 0,
  "pins": [
    {
      "pin": "5794977707301520",
      "sn": "26026825914918714922"
    }
  ]
}
```

`delivered` and `pending` show how many pins have been issued so far. Each item in `pins` has the `pin` and its serial number `sn`.

#### Fetch Recharge Pin Orders

`GET https://api.gsubz.com/api/generate/history/`

Returns your recent [Recharge Pins](#generate-pins) orders, newest first, so you can compare them with your own records. If an order timed out or its response never reached you, the pins are here: read them from this endpoint instead of resending the order. Send an `order_id` to get just one order. This endpoint is free and authenticates with the `Authorization` header only. It also accepts POST.

> Every order comes with its `pins` (the `pin` and its serial number `sn`), so you can save any you did not receive. A long list can be large: use `limit` for fewer orders, or `order_id` for one. Send `pins=0` if you only want the order details.

> `order_id` is the `id` returned when you placed the order.

Authentication: Bearer token required.

| Query parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| `limit` | integer | No | `200` | How many orders to return, from 1 to 200. The default is 200. |
| `order_id` | string | No | `c143e774874a59623aa928292d128f97` | Return only this order, with its pins. Use the `id` from the order response. |
| `pins` | string | No | `0` | Pins are included by default. Send `0` to leave them out. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/generate/history/' \
--header 'Authorization: Bearer YOUR_API_KEY'
```

Example response:

```json
{
  "code": "200",
  "status": "TRANSACTION_SUCCESSFUL",
  "count": 1,
  "orders": [
    {
      "order_id": "c143e774874a59623aa928292d128f97",
      "description": "Airtel-500-1 28/09/2026",
      "network": "airtel",
      "value": "500",
      "requested": 1,
      "delivered": 1,
      "amount_paid": "485",
      "status": "success",
      "timestamp": 1790585235,
      "date": "2026-09-28 09:47:15",
      "pins": [
        {
          "pin": "5794977707301520",
          "sn": "26026825914918714922"
        }
      ]
    }
  ]
}
```

`status` is `success` when every pin you asked for was delivered, `partial` when only some were, and `failed` when none were. `requested` and `delivered` are pin counts. `pins` lists every pin issued for the order, and is empty for an order that failed.

Example error response (HTTP 404):

```json
{
  "code": "404",
  "description": "ORDER_NOT_FOUND",
  "status": "TRANSACTION_FAILED"
}
```

### eSIM

#### List eSIM Countries

`GET https://api.gsubz.com/api/esim/countries/`

An eSIM gives your customer mobile data in another country without a physical SIM card. Start here: list the countries, pick one, then call [List eSIM Packages](#esim-packages) with its `locationCodes`. This list is public and needs no API key.

Authentication: none required.

| Query parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| `q` | string | No | `fra` | Search text to filter countries by name, for example `fra` for France. Leave it out to list every country. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/esim/countries/?q=fra'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "countries": [
    {
      "country": "France",
      "locationCodes": "FR",
      "plans": 12
    },
    {
      "country": "Spain",
      "locationCodes": "ES",
      "plans": 9
    }
  ]
}
```

`locationCodes` can hold more than one code, separated by commas. Send the whole value as `locationCode` to List eSIM Packages. `plans` is how many packages exist for that country.

#### List eSIM Packages

`GET https://api.gsubz.com/api/esim/packages/`

Returns the data packages for one country, cheapest first. Use the `packageCode` of the one your customer wants when you call [Buy eSIM](#esim-buy). This list is public and needs no API key.

> `price` is in naira and can change slightly between this list and your purchase, because the live price is checked when you buy. Read `amountPaid` in the purchase response for what was actually charged.

Authentication: none required.

| Query parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| `locationCode` | string | Yes | `FR` | The `locationCodes` value from [List eSIM Countries](#esim-countries). You can send up to twenty codes, separated by commas. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/esim/packages/?locationCode=FR'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "packages": [
    {
      "packageCode": "FR_1_7",
      "name": "France 1GB 7Days",
      "country": "France",
      "dataGB": 1,
      "duration": 7,
      "durationUnit": "DAY",
      "price": 2607,
      "refundable": true,
      "topUp": true
    }
  ]
}
```

`dataGB` is the data allowance and `duration` is how long the package lasts, in `durationUnit`. A package with `refundable` set to `false` cannot be cancelled for a refund. `topUp` shows whether more data can be added later.

#### Buy eSIM

`POST https://api.gsubz.com/api/esim/buy/`

Buys one eSIM. Your wallet is charged and the eSIM details come back in the response: scan the `qrCodeUrl` image or type the `activationCode` into the phone to install it.

> Always send a `requestID`. If you send the same one again, the API returns the original order (code `406`, `INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID`) and never charges twice.

> If `esimStatus` is `provisioning`, the eSIM is still being prepared. Call [Fetch eSIM Orders](#esim-orders) in a minute to get the QR code and activation code. You have already been charged.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `packageCode` | string | Yes | `FR_1_7` | The `packageCode` from [List eSIM Packages](#esim-packages). |
| `requestID` | string | No | `esim-1001` | Your own unique reference for this order, up to 100 characters. Use it later with [Fetch eSIM Orders](#esim-orders). |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/esim/buy/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'api="YOUR_API_KEY"' \
--form 'packageCode="FR_1_7"' \
--form 'requestID="esim-1001"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "transactionID": "ESIMA0BA0EC673A45212",
  "orderID": 1,
  "amount": 3476,
  "serviceID": "esim",
  "amountPaid": 3476,
  "initialBalance": 100000,
  "finalBalance": 96524,
  "date": "2026-09-28T12:36:59+01:00",
  "api_response": "Your eSIM is ready. Scan the QR code or enter the activation code to install it.",
  "requestID": "esim-1001",
  "packageCode": "FR_1_7",
  "packageName": "France 1GB 7Days",
  "country": "France",
  "esimStatus": "active",
  "iccid": "8944500102030405060",
  "activationCode": "LPA:1$rsp.example.com$ABCD-1234-EFGH",
  "qrCodeUrl": "https://example.com/qr/ORD-123"
}
```

`esimStatus` is `active` when the eSIM is ready to install, or `provisioning` while it is still being prepared (then `iccid`, `activationCode` and `qrCodeUrl` are `null`). Keep `orderID`: you need it to cancel or look the order up.

Example error response (HTTP 402):

```json
{
  "code": 402,
  "status": "failed",
  "description": "INSUFFICIENT_BALANCE",
  "api_response": "Insufficient balance. This eSIM costs ₦3,476.00 but your wallet has ₦100.00."
}
```

#### Fetch eSIM Orders

`POST https://api.gsubz.com/api/esim/orders/`

Returns your eSIM orders. Send a `requestID` or an `orderID` to get one order, or send neither to list your last 50. An order that was still being prepared is checked again each time you call, so this is also how you collect the QR code after a `provisioning` purchase.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `requestID` | string | No | `esim-1001` | The `requestID` you sent when you bought the eSIM. |
| `orderID` | integer | No | `1` | The `orderID` from the purchase response. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/esim/orders/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'api="YOUR_API_KEY"' \
--form 'requestID="esim-1001"' \
--form 'orderID="1"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "orders": [
    {
      "orderID": 1,
      "transactionID": "ESIMA0BA0EC673A45212",
      "packageCode": "FR_1_7",
      "packageName": "France 1GB 7Days",
      "country": "France",
      "amountPaid": 3476,
      "amountRefunded": 0,
      "esimStatus": "active",
      "iccid": "8944500102030405060",
      "activationCode": "LPA:1$rsp.example.com$ABCD-1234-EFGH",
      "qrCodeUrl": "https://example.com/qr/ORD-123",
      "date": "2026-09-28T12:36:59+01:00"
    }
  ]
}
```

`esimStatus` is one of `active`, `provisioning`, `refunded` or `failed`. `amountRefunded` shows what was returned to your wallet, if anything.

Example error response (HTTP 404):

```json
{
  "code": 404,
  "status": "failed",
  "description": "CONTENT_NOT_FOUND",
  "api_response": "No eSIM order found for that reference."
}
```

#### Cancel eSIM

`POST https://api.gsubz.com/api/esim/cancel/`

Cancels an eSIM that has not been installed and returns what you paid to your wallet. It can only work once for each order.

> Only an unused eSIM can be cancelled. If it has already been installed, used or refunded, the request is refused with `NOT_CANCELLABLE` and nothing is refunded.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `orderID` | integer | Yes | `1` | The `orderID` from the purchase response or from [Fetch eSIM Orders](#esim-orders). |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/esim/cancel/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'api="YOUR_API_KEY"' \
--form 'orderID="1"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "orderID": 1,
  "amountRefunded": 3476,
  "initialBalance": 96524,
  "finalBalance": 100000,
  "date": "2026-09-28T12:37:22+01:00",
  "api_response": "Refunded ₦3,476.00."
}
```

Example error response (HTTP 406):

```json
{
  "code": 406,
  "status": "failed",
  "description": "NOT_CANCELLABLE",
  "api_response": "This eSIM cannot be cancelled. It may already be in use."
}
```

### Games

#### List Games

`GET https://api.gsubz.com/api/games/list/`

Top up a player's game account or sell a gift card. Start here: list the games and brands on sale, most popular first, then call [List Game Products](#games-products) with the `gameID` you want. This list is public and needs no API key.

Authentication: none required.

| Query parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| `q` | string | No | `free` | Search text to filter by name, for example `free` for Free Fire. Leave it out to list everything. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/games/list/?q=free'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "games": [
    {
      "gameID": 12,
      "name": "Free Fire",
      "image": "https://gsubz.com/uploads/gaming/free-fire.png",
      "note": null,
      "lines": 2,
      "products": 24,
      "fromPrice": 1440
    },
    {
      "gameID": 20,
      "name": "Roblox",
      "image": "https://gsubz.com/uploads/gaming/roblox.png",
      "note": "Codes arrive within seconds.",
      "lines": 1,
      "products": 8,
      "fromPrice": 8000
    }
  ]
}
```

`lines` is how many product lines the game has (for example one per region) and `products` is how many amounts or packs you can buy. `fromPrice` is the lowest price in naira. `note` is an important message about the game, or `null`. `image` is `null` when the game has no logo. The example is shortened.

#### List Game Products

`GET https://api.gsubz.com/api/games/products/`

Returns the product lines of one game, each with the fields the player must give and the amounts or packs you can buy, priced in naira. Use a `productID` from here with [Validate Player ID](#games-validate) and [Buy Game Top-up](#games-buy). This list is public and needs no API key.

> A game can have several product lines, usually one for each region. A player's account only works with the line for its own region, so check `region` and use [Validate Player ID](#games-validate) before charging. Each line has its own `requirements`: send every field it lists, using its `field` name, when you validate or buy.

Authentication: none required.

| Query parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| `gameID` | integer | Yes | `12` | The `gameID` from [List Games](#games-list). |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/games/products/?gameID=12'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "game": {
    "gameID": 12,
    "name": "Free Fire",
    "image": "https://gsubz.com/uploads/gaming/free-fire.png",
    "note": null
  },
  "lines": [
    {
      "lineID": 467,
      "name": "Direct Topup Mena",
      "region": "Mena",
      "requirements": [
        {
          "field": "player_id",
          "label": "Player ID",
          "type": "text",
          "required": true,
          "options": null
        }
      ],
      "products": [
        {
          "productID": "101",
          "name": "100 Diamonds",
          "price": 1520,
          "kind": "amount",
          "inStock": true
        },
        {
          "productID": "102",
          "name": "Weekly Membership",
          "price": 5200,
          "kind": "pack",
          "inStock": null
        }
      ]
    }
  ]
}
```

`price` is in naira and is exactly what a purchase charges (it is checked live when you buy). `kind` is `amount` for a top-up of an amount, or `pack` for a bundle, pass or gift card. `inStock` is `true`, `false` (cannot be bought right now) or `null` (not known, the purchase is still attempted). `options` lists the allowed values when a field is a choice, such as a server. Gift cards have an empty `requirements` list. The example is shortened.

Example error response (HTTP 404):

```json
{
  "code": 404,
  "status": "failed",
  "description": "CONTENT_NOT_FOUND",
  "api_response": "That game is not available."
}
```

#### Validate Player ID

`POST https://api.gsubz.com/api/games/validate/`

Checks the player's details for a product and returns the player's name (and region, when the game states one), so your customer can confirm it is the right account before you buy. It is free. Always validate before you buy: it catches a wrong ID or the wrong region before any money moves.

> Send every field the product line lists under `requirements`, using its `field` name. Most games need only `player_id`. Games that need more, such as a zone or server, take those as extra fields named exactly as listed in `requirements`, for example `zone_id`. Gift cards need no player details and answer `NO_ID_NEEDED`.

> You can make 20 checks every 10 minutes for each API key.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `productID` | string | Yes | `101` | The `productID` from [List Game Products](#games-products). |
| `player_id` | string | No | `12345678` | The player's ID. Needed by most games. It is one of the fields a line lists under `requirements`. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/games/validate/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'productID="101"' \
--form 'player_id="12345678"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "description": "PLAYER_FOUND",
  "playerName": "ProGamer99",
  "region": "AF",
  "api_response": "Player found."
}
```

`playerName` and `region` are `null` when the game does not give them. `description` is `PLAYER_FOUND` or, for products that need no player details, `NO_ID_NEEDED`.

Example error response (HTTP 404):

```json
{
  "code": 404,
  "status": "failed",
  "description": "PLAYER_NOT_FOUND",
  "api_response": "We could not find that player ID. Please check it and try again."
}
```

#### Buy Game Top-up

`POST https://api.gsubz.com/api/games/buy/`

Buys one game top-up or gift card. Your wallet is charged first. A top-up goes straight to the player's account, and a gift card returns its code or codes in `codes`. Validate the player with [Validate Player ID](#games-validate) first.

> Always send a `requestID`. If you send the same one again, the API returns the original order (code `406`, `INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID`) and never buys twice. A `requestID` is free to use again only after a request that was refused before any money moved (for example a wrong player ID or too little balance).

> **An order can still be processing.** When `orderStatus` is `processing`, you have been charged and the order is not finished. It ends as `completed` or `refunded`. We send you a [webhook](#webhooks) (`games.order.updated`) when it finishes, and you can always check it with [Fetch Game Orders](#games-orders). A refund goes back to your wallet automatically, and an order is never refunded while its outcome is unclear.

> Send every field the product line lists under `requirements`, using its `field` name. Most games need only `player_id`. Games that need more, such as a zone or server, take those as extra fields named exactly as listed in `requirements`, for example `zone_id`.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `productID` | string | Yes | `101` | The `productID` from [List Game Products](#games-products). |
| `player_id` | string | No | `12345678` | The player's ID. Needed by most games. It is one of the fields a line lists under `requirements`. |
| `requestID` | string | No | `game-1001` | Your own unique reference for this order, up to 100 characters. Use it later with [Fetch Game Orders](#games-orders). |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/games/buy/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'productID="101"' \
--form 'player_id="12345678"' \
--form 'requestID="game-1001"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "transactionID": "GM261007113015A1B2C3D4",
  "orderID": 15,
  "amount": 1520,
  "serviceID": "games",
  "amountPaid": 1520,
  "initialBalance": 100000,
  "finalBalance": 98480,
  "date": "2026-10-07T11:30:15+01:00",
  "api_response": "Your order is complete.",
  "requestID": "game-1001",
  "game": "Free Fire · Direct Topup Mena",
  "product": "100 Diamonds",
  "orderStatus": "completed",
  "playerName": "ProGamer99",
  "codes": []
}
```

`orderStatus` is `completed`, or `processing` while the order is still being delivered. Keep `orderID`: you need it to look the order up. For a gift card, `codes` holds one item for each code, with `code`, `serial` and `expiry`, and it can be empty until the order is `completed`. Treat codes like cash and never log them.

Example error response (HTTP 404):

```json
{
  "code": 404,
  "status": "failed",
  "description": "PLAYER_NOT_FOUND",
  "api_response": "We could not find that player ID. Please check it and try again. You have not been charged."
}
```

#### Fetch Game Orders

`POST https://api.gsubz.com/api/games/orders/`

Returns your game orders, including orders bought on the website. Send a `requestID`, an `orderID` or a `transactionID` to get one order, or send none of them to list your last 50. An order that is still processing is checked again when you look it up (at most every 25 seconds), so this is also how you collect the result, and any gift-card codes, after a `processing` purchase if you missed the [webhook](#webhooks).

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `requestID` | string | No | `game-1001` | The `requestID` you sent when you bought. |
| `orderID` | integer | No | `15` | The `orderID` from the purchase response. |
| `transactionID` | string | No | `GM261007113015A1B2C3D4` | The `transactionID` from the purchase response. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/games/orders/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'requestID="game-1001"' \
--form 'orderID="15"' \
--form 'transactionID="GM261007113015A1B2C3D4"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "orders": [
    {
      "orderID": 15,
      "transactionID": "GM261007113015A1B2C3D4",
      "requestID": "game-1001",
      "game": "Free Fire · Direct Topup Mena",
      "product": "100 Diamonds",
      "amount": 1520,
      "amountPaid": 1520,
      "amountRefunded": 0,
      "orderStatus": "completed",
      "playerName": "ProGamer99",
      "codes": [],
      "date": "2026-10-07T11:30:15+01:00"
    }
  ]
}
```

`orderStatus` is one of `processing`, `completed` or `refunded`. `amountRefunded` shows what was returned to your wallet, and `amountPaid` is what you paid after any refund. `requestID` is `null` for orders that were not placed through the API.

Example error response (HTTP 404):

```json
{
  "code": 404,
  "status": "failed",
  "description": "CONTENT_NOT_FOUND",
  "api_response": "No game order found for that reference."
}
```

### Bulk SMS

#### Send Bulk SMS

`POST https://api.gsubz.com/api/sms/`

Sends one text message to up to 5,000 Nigerian numbers in a single request. Your wallet is charged first, the message is sent, and anything that could not be sent is refunded automatically.

> The field names `from`, `to` and `msg` are the standard names most SMS gateways use, so code written for another SMS service needs very little change. The message type (normal or unicode) is detected for you, so you never send `type`.

> Your message is checked before anything is charged, because the networks block certain content. These are refused: names of banks and payment companies, international brands such as WhatsApp or Facebook, OTP or verification-code wording, messages that look like bank credit or debit alerts, and any run of four or more digits in a row (write amounts with commas, for example `5,000`; years like 2026 are fine). Numbers on the DND list are not delivered by the networks and are not refunded.

> You pay per page, per recipient. One page is 160 characters (153 each once the message is longer), or 70 (67) if it has emoji or other special characters. The naira sign is sent as `N` so it does not turn the message into a special-character one. The price is currently ₦5 per page per recipient, and `amount` in the response shows exactly what was charged.

> Numbers are cleaned and de-duplicated. Invalid or repeated numbers are skipped and counted in `skipped`. If some numbers cannot be sent, the request still returns `successful` with `failed` above zero, and those numbers are refunded. If nothing can be sent you get `GATEWAY_ERROR` and you are not charged.

> Common failures, all with `"status": "failed"`: `INVALID_SENDER`, `MESSAGE_CONTENT_BLOCKED` (with an `issues` list), `NO_VALID_RECIPIENTS`, `TOO_MANY_RECIPIENTS` and `MESSAGE_TOO_LONG` (code `206`), and `DUPLICATE_MESSAGE` (code `406`, the same message to the same list within two minutes and no `requestID` sent). Send a `requestID` to send the same message again on purpose.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `from` | string | Yes | `MyShop` | The sender name shown on the phone: 3 to 11 letters, with no spaces, numbers or symbols. Names of banks, payment companies, telecoms and government bodies cannot be used. |
| `to` | string | Yes | `08031234567,08021234568` | The phone numbers, separated by commas or new lines, up to 5,000. `080…`, `234…` and `+234…` are all accepted. |
| `msg` | string | Yes | `Hello, your order is ready for pickup.` | The message text, up to 905 characters. |
| `requestID` | string | No | `sms-1001` | Your own unique reference for this send, up to 100 characters. Send the same one again and you get the original result back, never a second send or charge. `message_uuid` is accepted as the same thing. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/sms/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'api="YOUR_API_KEY"' \
--form 'from="MyShop"' \
--form 'to="08031234567,08021234568"' \
--form 'msg="Hello, your order is ready for pickup."' \
--form 'requestID="sms-1001"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "transactionID": 3530235131,
  "amount": 10,
  "serviceID": "bulk_sms",
  "amountPaid": 10,
  "initialBalance": 1000,
  "finalBalance": 990,
  "date": "2026-09-28T12:30:52+01:00",
  "api_response": "Your message was sent to 2 numbers.",
  "reference": "BSMSA260928123052FC8106",
  "requestID": "sms-1001",
  "sender": "MyShop",
  "recipients": 2,
  "sent": 2,
  "failed": 0,
  "skipped": 0,
  "pages": 1
}
```

`recipients` is how many valid, different numbers were found. `sent` and `failed` add up to that, and `skipped` counts invalid or repeated numbers that were left out. `pages` is the number of pages per recipient. `amount` is the full cost and `amountPaid` is what you were charged after any refund for numbers that were not sent.

Example error response (HTTP 206):

```json
{
  "code": 206,
  "status": "failed",
  "description": "MESSAGE_CONTENT_BLOCKED",
  "api_response": "This message would be blocked by the networks, so it was not sent. The networks block messages that mention international brands such as WhatsApp or Facebook.",
  "issues": [
    "The networks block messages that mention international brands such as WhatsApp or Facebook."
  ]
}
```

### Flights

#### List Airports

`GET https://api.gsubz.com/api/flight/search/`

Returns airports with their 3-letter `code`, name, city and country. Send `q` to search by city, airport name, code or country (the best 15 matches). Send nothing to get the popular airports, or `all=true` to download the whole list and keep it in your own cache. Use the `code` as `origin` and `destination` in [Search Flights](#flight-search).

Authentication: Bearer token required.

| Query parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| `q` | string | No | `lagos` | Search text, for example `lagos`, `abuja`, `LHR` or `London`. Leave it out for the popular airports. |
| `all` | string | No | `true` | `true` returns every airport instead of the best matches. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/flight/search/?q=lagos' \
--header 'Authorization: Bearer YOUR_API_KEY'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "count": 1,
  "airports": [
    { "code": "LOS", "name": "Murtala Muhammed International Airport", "city": "Lagos", "country": "Nigeria" }
  ]
}
```

Airports are listed with the best match first.

Example error response (HTTP 401):

```json
{
  "code": 401,
  "status": "failed",
  "description": "INVALID_API_OR_NOT_FOUND",
  "api_response": "This API key is not valid."
}
```

#### Search Flights

`POST https://api.gsubz.com/api/flight/search/`

Searches flights for a date (and a return date for a return trip) and returns the available options, cheapest first, with every price in naira. Searching is free. Each option carries a `token`. Send that token, together with the `searchID` of this response, to [Book a Flight](#flight-book).

> Prices already include our margin, so `amount` is what the booking will cost, to the naira. The price is confirmed again when you call [Book a Flight](#flight-book) with `preview=true`, so show your customer that price, not the search one.

> Send `return_date` to search a return trip; leave it out for one-way. Times in the results are the local time at each airport, with no timezone. A search stays valid for one hour. You can run up to 20 searches a minute for each API key.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `origin` | string | Yes | `LOS` | The airport code you fly from, from [List Airports](#flight-airports). |
| `destination` | string | Yes | `ABV` | The airport code you fly to. |
| `departure_date` | string | Yes | `2026-12-01` | Departure date as `YYYY-MM-DD`. Today or later. |
| `return_date` | string | No | `2026-12-08` | Return date as `YYYY-MM-DD`, on or after the departure date. Leave it out for a one-way trip. |
| `adults` | integer | No | `1` | Adults (12 and over). 1 to 9. The default is 1. |
| `children` | integer | No | `0` | Children (2 to 11). 0 to 9. |
| `infants` | integer | No | `0` | Infants (under 2). Each needs an adult. 0 to 9. |
| `cabin` | string | No | `economy` | `economy` (default), `premium_economy`, `business` or `first`. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/flight/search/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'api="YOUR_API_KEY"' \
--form 'origin="LOS"' \
--form 'destination="ABV"' \
--form 'departure_date="2026-12-01"' \
--form 'adults="1"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "searchID": "FS3A9C41D07B22E8F5A61",
  "expiresAt": "2026-10-17T11:59:51+01:00",
  "currency": "NGN",
  "count": 1,
  "api_response": "Found 1 flight option.",
  "offers": [
    {
      "token": "eyJhbGciOi…",
      "airline": "Ibom Air",
      "airlineCode": "QI",
      "logo": "https://…/QI.png",
      "amount": 95000,
      "refundable": false,
      "journeys": [
        {
          "from": "LOS",
          "to": "ABV",
          "departsAt": "2026-12-01T08:00:00",
          "arrivesAt": "2026-12-01T09:10:00",
          "duration": "1h10",
          "stops": 0,
          "flightNumber": "QI 301",
          "baggage": "23KG baggage"
        }
      ]
    }
  ]
}
```

`offers` is sorted by `amount`, cheapest first, and holds up to 80 options (a return trip has two `journeys`). `token` is long, so store it as it is. Keep `searchID`: [Book a Flight](#flight-book) needs it.

Example error response (HTTP 206):

```json
{
  "code": 206,
  "status": "failed",
  "description": "INVALID_CONTENT",
  "api_response": "origin and destination must be different."
}
```

#### Book a Flight

`POST https://api.gsubz.com/api/flight/book/`

Books one flight for your customer and pays for it from your wallet. The price is locked first: send `preview=true` to get the final price (and a `quoteID`) without paying, then book with that `quoteID`, or book straight away with the `token` and `searchID` from [Search Flights](#flight-search). Send the body as JSON (recommended) or as form fields.

> **Two steps.** 1) `preview=true` with `token` and `searchID` returns the final price and a `quoteID` that stays valid for about 25 minutes (`expiresIn`). Nothing is charged. 2) Send the passengers and contact with that `quoteID` to book at exactly that price. A quote can be used once. Add `maxAmount` to refuse a booking that would cost more: you get `PRICE_CHANGED` and nothing is charged.

> **A booking can still be processing.** When `orderStatus` is `processing`, you have been charged and the airline is still issuing the ticket. It ends as `completed` (with the `pnr` and `tickets`) or `refunded`. We send you a [webhook](#webhooks) (`flight.order.updated`) when it changes, and you can always check it with [Fetch Flight Orders](#flight-orders). A refund goes back to your wallet automatically, and a booking is never refunded while its outcome is unclear.

> Always send a `requestID`. Send the same one again and you get the original booking back (code `406`, `INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID`) and never a second booking, so retrying after a timeout is safe. International trips need `passport_number` and `passport_expiry` for every passenger, and the passport must be valid after the last travel date. The ticket e-mail to your customer is yours to send: we do not e-mail them.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `searchID` | string | With token | `FS3A9C41D07B22E8F5A61` | The `searchID` from [Search Flights](#flight-search). Needed together with `token`. |
| `token` | string | Without quoteID | `eyJhbGciOi…` | The `token` of the option your customer picked in [Search Flights](#flight-search). |
| `quoteID` | string | Without token | `Q1b2c3d4` | The `quoteID` from an earlier `preview=true` call. Books at that locked price. |
| `passengers` | array | To book | `[{"type":"adult","title":"Mr","first_name":"Ada","last_name":"Obi","gender":"male"}]` | One item for each traveller, matching the adults, children and infants you searched. Each has `type` (`adult`, `child` or `infant`), `title` (`Mr`, `Mrs`, `Ms`, `Miss` or `Master`), `first_name`, `last_name`, `gender` (`male` or `female`), and optionally `middle_name` and `country_code` (2 letters, default `NG`). International trips also need `passport_number` and `passport_expiry` (`YYYY-MM-DD`). Names use letters only. |
| `contact` | object | To book | `{"email":"customer@example.com","phone":"08031234567"}` | Who the airline contacts: `email` and `phone` (`080…`, `234…` or `+234…`). |
| `requestID` | string | No | `flight-1001` | Your own unique reference for this booking, up to 100 characters. Use it later with [Fetch Flight Orders](#flight-orders). |
| `maxAmount` | number | No | `100000` | The most you will pay, in naira. If the price is higher you get `PRICE_CHANGED` and nothing is charged. |
| `preview` | boolean | No | `true` | `true` locks and returns the final price (as `quoteID` and `amount`) without booking or charging anything. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/flight/book/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--header 'Content-Type: application/json' \
--data '{
    "searchID": "FS3A9C41D07B22E8F5A61",
    "token": "eyJhbGciOi…",
    "passengers": [
        {
            "type": "adult",
            "title": "Mr",
            "first_name": "Ada",
            "last_name": "Obi",
            "gender": "male"
        }
    ],
    "contact": {
        "email": "customer@example.com",
        "phone": "08031234567"
    },
    "requestID": "flight-1001",
    "preview": true
}'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "transactionID": "TRV261017110002AB12CD34",
  "amount": 95000,
  "serviceID": "flight",
  "amountPaid": 95000,
  "initialBalance": 500000,
  "finalBalance": 405000,
  "date": "2026-10-17T11:00:02+01:00",
  "api_response": "Your booking is being processed and you have been charged. The result is sent to your webhook as flight.order.updated, or check it with Fetch Flight Orders.",
  "requestID": "flight-1001",
  "orderStatus": "processing",
  "tripType": "oneway",
  "origin": "LOS",
  "destination": "ABV",
  "departureDate": "2026-12-01",
  "returnDate": null,
  "airline": "Ibom Air",
  "journeys": [
    { "from": "LOS", "to": "ABV", "departsAt": "2026-12-01T08:00:00", "arrivesAt": "2026-12-01T09:10:00", "duration": "1h10", "stops": 0, "flightNumber": "QI 301", "baggage": "23KG baggage" }
  ],
  "passengers": [
    { "type": "Adult", "title": "Mr", "firstName": "Ada", "middleName": null, "lastName": "Obi", "gender": "Male", "countryCode": "NG" }
  ],
  "contact": { "email": "customer@example.com", "phone": "+2348031234567" },
  "amountRefunded": 0,
  "pnr": null,
  "tickets": []
}
```

`orderStatus` is `completed` (ticket issued: `pnr` and `tickets` are filled in), `processing` (charged, ticket not issued yet) or `refunded`. Keep `transactionID`: you need it to look the booking up. With `preview=true` the response has `"preview": true`, the final `amount`, a `quoteID`, `expiresIn` (seconds), the `journeys`, `fareRules` and `penaltyRules`, and `amountPaid` is 0. `amountPaid` is what you pay after any refund.

Example error response (HTTP 406):

```json
{
  "code": 406,
  "status": "failed",
  "description": "PRICE_CHANGED",
  "api_response": "The price is now ₦98,500.00, above your maxAmount. Nothing was charged. Send the same request with the quoteID in this response to book at the new price.",
  "quoteID": "Q1b2c3d4",
  "currentAmount": 98500,
  "expiresIn": 1700
}
```

#### Fetch Flight Orders

`POST https://api.gsubz.com/api/flight/orders/`

Returns your flight bookings made through the API. Send a `requestID` or a `transactionID` to get one booking, or send neither to list your last 50. A booking that is still processing is checked again when you look it up (at most every 25 seconds), so this is also how you collect the PNR and e-ticket numbers if you missed the [webhook](#webhooks). It also answers GET.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `requestID` | string | No | `flight-1001` | The `requestID` you sent when you booked. |
| `transactionID` | string | No | `TRV261017110002AB12CD34` | The `transactionID` from the booking response. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/flight/orders/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'api="YOUR_API_KEY"' \
--form 'requestID="flight-1001"' \
--form 'transactionID="TRV261017110002AB12CD34"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "orders": [
    {
      "transactionID": "TRV261017110002AB12CD34",
      "requestID": "flight-1001",
      "serviceID": "flight",
      "orderStatus": "completed",
      "tripType": "oneway",
      "origin": "LOS",
      "destination": "ABV",
      "departureDate": "2026-12-01",
      "returnDate": null,
      "airline": "Ibom Air",
      "journeys": [
        { "from": "LOS", "to": "ABV", "departsAt": "2026-12-01T08:00:00", "arrivesAt": "2026-12-01T09:10:00", "duration": "1h10", "stops": 0, "flightNumber": "QI 301", "baggage": "23KG baggage" }
      ],
      "passengers": [
        { "type": "Adult", "title": "Mr", "firstName": "Ada", "middleName": null, "lastName": "Obi", "gender": "Male", "countryCode": "NG" }
      ],
      "contact": { "email": "customer@example.com", "phone": "+2348031234567" },
      "amount": 95000,
      "amountRefunded": 0,
      "amountPaid": 95000,
      "pnr": "ABC123",
      "tickets": [
        { "name": "Ada Obi", "type": "ADT", "ticketNumber": "1234567890123" }
      ],
      "date": "2026-10-17T11:00:02+01:00"
    }
  ]
}
```

`orderStatus` is one of `processing`, `completed` or `refunded`. `amountRefunded` shows what was returned to your wallet, and `amountPaid` is what you paid after any refund. `pnr` and `tickets` are filled in once the ticket is issued. Without a reference the response also has `count`.

Example error response (HTTP 404):

```json
{
  "code": 404,
  "status": "failed",
  "description": "CONTENT_NOT_FOUND",
  "api_response": "No flight booking found for that reference."
}
```

### Store

#### Search Products

`GET https://api.gsubz.com/api/store/search/`

Returns a page of products, 20 at a time, with every price in naira, exactly as shown on the Gsubz store. The `scope` decides where you search: `trending` (the default) and `official` are free, `market` searches the whole catalogue by keyword and costs ₦2. Send no parameters at all to get the first page of trending products.

> **What is free and what is not.** Free: trending products, the Official Store (with or without a brand), List Categories and Brands, and Official Store product details (IDs that start with `g`). ₦2 per call: `scope=market` search, details of any other product, and supplier products. ₦4: image search. You are charged only when a call returns results. If it returns nothing or fails, your wallet is refunded automatically, and the response shows what you paid in `amountPaid`.

> The Store endpoints use the `Authorization` Bearer header only, and the same upgraded API account as the rest of the API. Each response carries `callID`, our reference for that call (quote it to support), plus `amountPaid` and your wallet balances.

> If you send `q` you must also send `scope`, so that you never pay for a market search by accident. A market search returns up to 5 pages (100 products) for each keyword and filters only work with `scope=market`. Every call is charged, including a repeat of the same request, so keep the results in your own cache.

Authentication: Bearer token required.

| Query parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| `scope` | string | No | `market` | `trending` (free, the default), `official` (free, the Gsubz Official Store) or `market` (₦2, searches the whole catalogue). If you send only `brand`, the scope is `official`. |
| `q` | string | Needed for market | `wireless earbuds` | The keyword to search for, up to 100 characters. Required with `scope=market`. With `scope=official` it filters the Official Store. Not used with `trending`. To search by category, use the category name as the keyword. |
| `brand` | integer | No | `1` | A brand `id` from [List Categories and Brands](#store-categories). Returns every product of that brand. Only with `scope=official`. |
| `page` | integer | No | `1` | The page number, starting at 1. Up to 5 for `market` and 80 for `trending`. |
| `sort` | string | No | `sales` | `default`, `sales`, `price_up` or `price_down`. Only with `scope=market`. |
| `start_price` | number | No | `5000` | Lowest price in naira. Only with `scope=market`. |
| `end_price` | number | No | `20000` | Highest price in naira. Only with `scope=market`. |
| `moq` | integer | No | `2` | Only products you can order in this quantity or less. Only with `scope=market`. |
| `new_arrival` | string | No | `true` | `true` to list new products only. Only with `scope=market`. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/store/search/?scope=market&q=wireless+earbuds&page=1' \
--header 'Authorization: Bearer YOUR_API_KEY'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "callID": 18452,
  "scope": "market",
  "amountPaid": 2,
  "initialBalance": 5000,
  "finalBalance": 4998,
  "date": "2026-10-07T11:20:15+01:00",
  "api_response": "Search results.",
  "page": 1,
  "pageSize": 20,
  "count": 2,
  "hasMore": false,
  "items": [
    {
      "id": "682718261723",
      "title": "Wireless Bluetooth Earbuds Noise Cancelling",
      "fullTitle": "Wireless Bluetooth Earbuds Noise Cancelling Headset, Long Battery Life",
      "image": "https://gsubz.com/store/image_proxy.php?url=https%3A%2F%2Fimg.example.com%2Fa1.jpg",
      "priceNgn": 4850,
      "sold": 1240,
      "freeShipping": false
    },
    {
      "id": "701442970035",
      "title": "TWS Earbuds Touch Control Charging Case",
      "fullTitle": "TWS Earbuds Touch Control Charging Case",
      "image": "https://gsubz.com/store/image_proxy.php?url=https%3A%2F%2Fimg.example.com%2Fb2.jpg",
      "priceNgn": 3600,
      "sold": 310,
      "freeShipping": false
    }
  ]
}
```

`id` is the product ID: use it with [Get Product Details](#store-product). IDs that start with `g` are Official Store products (`freeShipping` is `true` for those, and they are free to fetch). `title` is the short title shown on the store and `fullTitle` is the full one. `priceNgn` is in naira, or `null` when no price is available. `sold` is how many were sold recently (always `0` for the Official Store). `hasMore` tells you whether another page exists. The example is shortened to two products.

Example error response (HTTP 404):

```json
{
  "code": 404,
  "status": "failed",
  "description": "CONTENT_NOT_FOUND",
  "api_response": "No products found. You were not charged.",
  "callID": 18453
}
```

#### Search Products by Image

`POST https://api.gsubz.com/api/store/image-search/`

Send a link to a photo and get back up to 20 similar products, in the same format as [Search Products](#store-search). It costs ₦4 and you are charged only when it returns results.

> `image_url` must be a public `https` link that anyone on the internet can open without logging in. Use a JPG, PNG or WebP photo of at least 100 × 100 pixels and up to 8 MB. We download the photo, so links to private networks are refused. Use a clear photo of one product for the best matches.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `image_url` | string | Yes | `https://example.com/photos/earbuds.jpg` | A public https link to the photo. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/store/image-search/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'image_url="https://example.com/photos/earbuds.jpg"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "callID": 18455,
  "scope": "market",
  "amountPaid": 4,
  "initialBalance": 4998,
  "finalBalance": 4994,
  "date": "2026-10-07T11:22:40+01:00",
  "api_response": "Image search results.",
  "page": 1,
  "pageSize": 20,
  "count": 1,
  "hasMore": false,
  "items": [
    {
      "id": "682718261723",
      "title": "Wireless Bluetooth Earbuds Noise Cancelling",
      "fullTitle": "Wireless Bluetooth Earbuds Noise Cancelling Headset, Long Battery Life",
      "image": "https://gsubz.com/store/image_proxy.php?url=https%3A%2F%2Fimg.example.com%2Fa1.jpg",
      "priceNgn": 4850,
      "sold": 1240,
      "freeShipping": false
    }
  ]
}
```

Image search returns one page of up to 20 products, so `hasMore` is always `false`. The example is shortened to one product.

Example error response (HTTP 206):

```json
{
  "code": 206,
  "status": "failed",
  "description": "INVALID_CONTENT",
  "api_response": "That link is not an image.",
  "callID": 18456
}
```

#### Get Product Details

`GET https://api.gsubz.com/api/store/product/`

Returns the full details of one product, with every price in naira. Use an `id` from [Search Products](#store-search). Official Store products (IDs that start with `g`) are free. Any other product costs ₦2, and you are charged only when the product is found.

Authentication: Bearer token required.

| Query parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| `id` | string | Yes | `682718261723` | The product `id` from a search result, for example `682718261723`, or `g000000001` for an Official Store product. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/store/product/?id=682718261723' \
--header 'Authorization: Bearer YOUR_API_KEY'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "callID": 18460,
  "scope": "market",
  "amountPaid": 2,
  "initialBalance": 4994,
  "finalBalance": 4992,
  "date": "2026-10-07T11:25:03+01:00",
  "api_response": "Product details.",
  "product": {
    "id": "682718261723",
    "title": "Wireless Bluetooth Earbuds Noise Cancelling Headset",
    "media": [
      { "type": "video", "url": "https://video.example.com/earbuds.mp4" },
      { "type": "image", "url": "https://gsubz.com/store/image_proxy.php?url=https%3A%2F%2Fimg.example.com%2Fa1.jpg" }
    ],
    "priceTiers": [
      { "minQty": 2, "priceNgn": 4850 },
      { "minQty": 100, "priceNgn": 4300 }
    ],
    "minPriceNgn": 4300,
    "maxPriceNgn": 5100,
    "moq": 2,
    "skus": [
      {
        "skuId": "5001",
        "label": "Black / Standard",
        "stock": 120,
        "priceNgn": 4850,
        "image": "https://gsubz.com/store/image_proxy.php?url=https%3A%2F%2Fimg.example.com%2Fk1.jpg",
        "weightKg": 0.12,
        "lengthCm": 12,
        "widthCm": 8,
        "heightCm": 4
      }
    ],
    "specs": {
      "Battery": "300mAh",
      "Bluetooth": "5.3"
    },
    "description": "",
    "location": "Guangdong Shenzhen",
    "totalSold": 4321,
    "freeShipping": false,
    "supplier": {
      "id": "sp_Q3ZnR2Fh0uJp9mKcT1xYvWbEoLd8sA"
    },
    "shipping": {
      "airRatePerKgNgn": 21000,
      "seaRatePerCbmNgn": 450000,
      "weightsKg": [0.12],
      "volumesCbm": [0.000384]
    }
  }
}
```

`priceTiers` show the price for each minimum quantity. `minPriceNgn` and `maxPriceNgn` are the lowest and highest variant prices. `skus` are the variants (colour, size and so on): send the `skuId` as `sku_id` when you [Place an Order](#store-order). A variant's weight and size are `null` when unknown. `media` can hold `image`, `video` and `youtube` items (a `youtube` item has `videoId`, `start` and `end` in seconds). `supplier.id` is the ID to use with [Get Supplier Products](#store-supplier); it is `null` for Official Store products. `shipping` gives the data to work out freight: the air rate per kg, the sea rate per cubic metre, and the weights and volumes of the variants. It is `null` when `freeShipping` is `true`. `description` is empty for most products. The example is shortened.

Example error response (HTTP 404):

```json
{
  "code": 404,
  "status": "failed",
  "description": "CONTENT_NOT_FOUND",
  "api_response": "Product not found. You were not charged.",
  "callID": 18461
}
```

#### Get Supplier Products

`GET https://api.gsubz.com/api/store/supplier/`

Returns a page of products from one supplier, in the same format as [Search Products](#store-search). Get the supplier ID from `supplier.id` in [Get Product Details](#store-product). It costs ₦2, charged only when the page has products.

Authentication: Bearer token required.

| Query parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| `id` | string | Yes | `sp_Q3ZnR2Fh0uJp9mKcT1xYvWbEoLd8sA` | The supplier ID from `supplier.id` in [Get Product Details](#store-product). Always start with `sp_`. |
| `page` | integer | No | `1` | The page number, starting at 1. |
| `sort` | string | No | `sales` | `default`, `sales`, `price_up`, `price_down`, `time_up` or `time_down`. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/store/supplier/?id=sp_Q3ZnR2Fh0uJp9mKcT1xYvWbEoLd8sA&page=1' \
--header 'Authorization: Bearer YOUR_API_KEY'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "callID": 18470,
  "scope": "market",
  "amountPaid": 2,
  "initialBalance": 4992,
  "finalBalance": 4990,
  "date": "2026-10-07T11:27:30+01:00",
  "api_response": "Supplier products.",
  "page": 1,
  "pageSize": 20,
  "count": 1,
  "hasMore": true,
  "items": [
    {
      "id": "770000000015",
      "title": "Cotton Casual Shirt",
      "fullTitle": "Cotton Casual Shirt Short Sleeve",
      "image": "https://gsubz.com/store/image_proxy.php?url=https%3A%2F%2Fimg.example.com%2Fsh1.jpg",
      "priceNgn": 3100,
      "sold": 65,
      "freeShipping": false
    }
  ]
}
```

The example is shortened to one product.

Example error response (HTTP 206):

```json
{
  "code": 206,
  "status": "failed",
  "description": "INVALID_CONTENT",
  "api_response": "id must be a supplier id from a product (supplier.id).",
  "callID": 18471
}
```

#### List Categories and Brands

`GET https://api.gsubz.com/api/store/categories/`

Returns the categories shown on the Gsubz store and the Official Store brands. It is free. No parameters: it always returns everything in one response.

> A category is only a group of related search words. To get a category's products, send its `name` as `q` to [Search Products](#store-search) with `scope=market`. You are free to build your own categories from keywords instead. To get a brand's products, send its `id` as `brand` with `scope=official`.

Authentication: Bearer token required.

No parameters. It always returns everything in one response.

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/store/categories/' \
--header 'Authorization: Bearer YOUR_API_KEY'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "callID": 18480,
  "amountPaid": 0,
  "initialBalance": 4990,
  "finalBalance": 4990,
  "date": "2026-10-07T11:30:02+01:00",
  "api_response": "Categories and brands.",
  "categories": [
    {
      "name": "Women's Clothing",
      "image": "https://gsubz.com/store/image_proxy.php?url=https%3A%2F%2Fimg.example.com%2Fc1.jpg",
      "children": [
        {
          "name": "Women's T-Shirts",
          "image": "https://gsubz.com/store/image_proxy.php?url=https%3A%2F%2Fimg.example.com%2Fc2.jpg",
          "children": []
        },
        {
          "name": "Women's Casual Pants",
          "image": "https://gsubz.com/store/image_proxy.php?url=https%3A%2F%2Fimg.example.com%2Fc3.jpg",
          "children": [
            {
              "name": "Casual Pants",
              "image": "https://gsubz.com/store/image_proxy.php?url=https%3A%2F%2Fimg.example.com%2Fc4.jpg",
              "children": []
            }
          ]
        }
      ]
    }
  ],
  "brands": [
    {
      "id": 1,
      "name": "Apple",
      "image": "https://gsubz.com/store/image_proxy.php?url=https%3A%2F%2Fimg.example.com%2Fapple.jpg",
      "products": 24
    }
  ]
}
```

`categories` is a tree up to three levels deep: a category with no sub-categories has an empty `children` array. `brands` lists only brands that have products, and `products` is how many. The example is shortened.

### Store orders

#### List Pickup Stations

`GET https://api.gsubz.com/api/store/order/`

Every Store order is delivered to a pickup station, where your customer collects it. This returns the stations by state, with the delivery fee for each parcel size. Send the `state` and the station `name` exactly as returned when you [Place an Order](#store-order). It is free.

Authentication: Bearer token required.

| Query parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| `action` | string | Yes | `stations` | Always `stations`. |
| `state` | string | No | `Lagos` | Only this state. Leave it out to get every state. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/store/order/?action=stations&state=Lagos' \
--header 'Authorization: Bearer YOUR_API_KEY'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "callID": 18490,
  "scope": "stations",
  "amountPaid": 0,
  "initialBalance": 50000,
  "finalBalance": 50000,
  "date": "2026-10-13T10:02:11+01:00",
  "api_response": "Pickup stations.",
  "parcelSizes": {
    "small":  { "maxKg": 4,  "maxCbm": 0.0384 },
    "medium": { "maxKg": 12, "maxCbm": 0.1536 },
    "large":  { "maxKg": null, "maxCbm": null }
  },
  "states": [
    {
      "state": "Lagos",
      "stations": [
        {
          "name": "Ikota",
          "address": "Ikota Shopping Complex, Lekki",
          "landmark": "Near VGC",
          "phone": "08000000001",
          "hours": { "weekdays": "8am - 6pm", "weekends": "9am - 3pm" },
          "map": "https://maps.example.com/ikota",
          "deliveryFee": { "smallNgn": 2400, "mediumNgn": 4200, "largeNgn": 6800, "days": "2-4 days" }
        }
      ]
    }
  ]
}
```

`deliveryFee` is what the order pays to reach that station, by parcel size. The size is decided by the parcel's total weight _and_ total volume (the bigger one wins), using the limits in `parcelSizes`: for example 3 kg but 0.05 m³ is a medium parcel. `days` is the usual delivery time once the parcel leaves our Lagos warehouse. The example is shortened to one station.

#### Place an Order

`POST https://api.gsubz.com/api/store/order/`

Places an order for one or more products and pays for it from your wallet. Prices, the service fee, shipping and the delivery fee are worked out exactly as on the Gsubz store. Send `preview=true` first to get the full price without paying. API orders are always packed without Gsubz branding, so you can ship to your own customers. Send the body as JSON (recommended) or as form fields.

> **What you pay now:** the products, a service fee (5% of each product's total, at least ₦1,900 and at most ₦70,000 a product; none on Official Store products), the shipping to Nigeria when the product's weight is known, and the delivery fee to the pickup station. When a product has no weight yet, its shipping shows as `pending`: we weigh it, send you a [webhook](#webhooks) with the fee, and you pay it with [Pay Shipping](#store-order-pay-shipping). Items are processed only once their shipping is paid.

> `reference` is your own unique ID for the order. Sending the same reference again never creates or charges a second order: you get the first order back with `"duplicate": true`. That makes it safe to retry after a timeout.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `reference` | string | Yes | `ORDER-10045` | Your own unique ID for this order: letters, numbers, `.` `-` `_`, up to 64 characters. |
| `items` | array | Yes | `[{"product_id":"682718261723","sku_id":"5001","quantity":2,"price":4850}]` | The products. Each item has `product_id` (from [Search Products](#store-search)), `sku_id` (a `skuId` from [Get Product Details](#store-product); Official Store products use their own `skuId` too), `quantity`, and optionally `price`: the naira unit price you expect. If the price has gone up, nothing is charged and you get `PRICE_CHANGED` with the new price. Up to 50 items. A product with a minimum order (`moq`) needs at least that many pieces across its variants. |
| `shipping_method` | string | International products | `air` | `air` or `sea`, for the whole order. Not needed when every item is an Official Store product (their shipping is already in the price). |
| `state` | string | Yes | `Lagos` | The pickup station's state, from [List Pickup Stations](#store-stations). |
| `station` | string | Yes | `Ikota` | The pickup station's `name`, from [List Pickup Stations](#store-stations). |
| `first_name` | string | Yes | `Ada` | First name of the person who collects the order. |
| `last_name` | string | Yes | `Obi` | Last name of the person who collects the order. |
| `phone` | string | Yes | `08031234567` | Their phone number. The pickup station contacts this number. |
| `preview` | boolean | No | `true` | `true` returns the full price (as `quote`) without placing or paying for anything. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/store/order/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--header 'Content-Type: application/json' \
--data '{
    "reference": "ORDER-10045",
    "items": [
        {
            "product_id": "682718261723",
            "sku_id": "5001",
            "quantity": 2,
            "price": 4850
        }
    ],
    "shipping_method": "air",
    "state": "Lagos",
    "station": "Ikota",
    "first_name": "Ada",
    "last_name": "Obi",
    "phone": "08031234567",
    "preview": true
}'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "callID": 18500,
  "scope": "place",
  "amountPaid": 30676,
  "initialBalance": 50000,
  "finalBalance": 19324,
  "date": "2026-10-13T10:05:40+01:00",
  "api_response": "Order placed.",
  "order": {
    "orderId": 5231,
    "reference": "ORDER-10045",
    "dropship": true,
    "createdAt": "2026-10-13T10:05:40+01:00",
    "cancellableUntil": "2026-10-13T12:05:40+01:00",
    "shippingMethod": "air",
    "recipient": { "firstName": "Ada", "lastName": "Obi", "phone": "08031234567" },
    "pickupStation": { "name": "Ikota", "address": "Ikota Shopping Complex, Lekki", "state": "Lagos" },
    "amounts": {
      "itemsNgn": 9700,
      "serviceFeeNgn": 1900,
      "shippingPaidNgn": 16676,
      "shippingDueNgn": 0,
      "deliveryNgn": 2400
    },
    "items": [
      {
        "itemId": 88120,
        "productId": "682718261723",
        "skuId": "5001",
        "title": "Wireless Bluetooth Earbuds Noise Cancelling Headset",
        "variation": "Black / Standard",
        "image": "https://gsubz.com/store/image_proxy.php?url=https%3A%2F%2Fimg.example.com%2Fk1.jpg",
        "quantity": 2,
        "unitPriceNgn": 4850,
        "lineTotalNgn": 9700,
        "serviceFeeNgn": 1900,
        "status": "PAID",
        "shipping": {
          "method": "air",
          "weightKg": null,
          "volumeCbm": null,
          "status": "paid",
          "unitNgn": 8338,
          "totalNgn": 16676,
          "paidNgn": 16676,
          "dueNgn": 0
        },
        "trackingNumber": null,
        "cancellable": true,
        "cancelledAt": null
      }
    ]
  }
}
```

`amountPaid` is what this order took from your wallet. Each item has its own `status`: `PAID` (order placed), `PROCESSING`, `SHIPPED`, `IN_NIGERIA`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RETURNED` or `CANCELLED`. `shipping.status` is `paid`, `due` (pay it with [Pay Shipping](#store-order-pay-shipping)), `pending` (not weighed yet) or `included` (Official Store). `weightKg` and `volumeCbm` are filled in once the item is weighed. With `preview=true` the response has `"preview": true` and a `quote` object (shipping method, pickup station, `parcelSize` with the estimated weight and volume, `amounts` with `totalNgn`, and the priced items) instead of `order`, and `amountPaid` is 0.

Example error response (HTTP 406):

```json
{
  "code": 406,
  "status": "failed",
  "description": "PRICE_CHANGED",
  "api_response": "The price of 1 item(s) went up. Nothing was charged. Check the new prices and send the order again.",
  "callID": 18501,
  "items": [
    { "product_id": "682718261723", "sku_id": "5001", "expectedPriceNgn": 4850, "currentPriceNgn": 4990 }
  ]
}
```

#### Get Orders

`GET https://api.gsubz.com/api/store/order/`

Returns one order when you send `order_id` or `reference`, in the same format as [Place an Order](#store-order). Without them it returns your API orders, newest first, 20 at a time. It is free. Use it to check an order after a timeout, or if you missed a [webhook](#webhooks).

Authentication: Bearer token required.

| Query parameter | Type | Required | Example | Description |
|---|---|---|---|---|
| `order_id` | integer | No | `5231` | The `orderId` from Place an Order. |
| `reference` | string | No | `ORDER-10045` | Or your own `reference`. |
| `page` | integer | No | `1` | Page number when listing, starting at 1. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/store/order/?order_id=5231&reference=ORDER-10045' \
--header 'Authorization: Bearer YOUR_API_KEY'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "callID": 18510,
  "scope": "orders",
  "amountPaid": 0,
  "initialBalance": 19324,
  "finalBalance": 19324,
  "date": "2026-10-14T09:00:00+01:00",
  "api_response": "Order details.",
  "order": {
    "orderId": 5231,
    "reference": "ORDER-10045",
    "items": []
  }
}
```

`order` has exactly the fields shown in [Place an Order](#store-order) (shortened here). Without `order_id` or `reference` the response has `page`, `pageSize`, `count`, `hasMore` and an `orders` list instead.

Example error response (HTTP 404):

```json
{
  "code": 404,
  "status": "failed",
  "description": "CONTENT_NOT_FOUND",
  "api_response": "Order not found.",
  "callID": 18511
}
```

#### Cancel an Order

`POST https://api.gsubz.com/api/store/order/`

Cancels an order and refunds your wallet at once. You can cancel within 2 hours of placing the order, and only items that are still `PAID` (not yet being processed). Leave out `item_id` to cancel the whole order: this works only when no item is being processed yet. Otherwise cancel items one by one. Each cancelled item refunds its price, its service fee and any shipping paid. The delivery fee is refunded when the last item of the order is cancelled.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `action` | string | Yes | `cancel` | Always `cancel`. |
| `order_id` | integer | Or reference | `5231` | The order to cancel. You can send `reference` instead. |
| `reference` | string | No | `ORDER-10045` | Your own reference, instead of `order_id`. |
| `item_id` | integer | No | `88120` | Cancel only this item (`itemId`). Leave it out to cancel the whole order. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/store/order/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'action="cancel"' \
--form 'order_id="5231"' \
--form 'item_id="88120"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "callID": 18520,
  "scope": "cancel",
  "amountPaid": 0,
  "initialBalance": 19324,
  "finalBalance": 50000,
  "date": "2026-10-13T10:40:12+01:00",
  "api_response": "1 item(s) cancelled. ₦30,676.00 was refunded to your wallet.",
  "refundedNgn": 30676,
  "cancelled": [
    { "itemId": 88120, "refundNgn": 30676, "itemNgn": 9700, "serviceFeeNgn": 1900, "shippingNgn": 16676, "deliveryNgn": 2400 }
  ],
  "order": { "orderId": 5231, "reference": "ORDER-10045", "items": [] }
}
```

`order` is the updated order, in the same format as [Place an Order](#store-order) (shortened here).

Example error response (HTTP 406):

```json
{
  "code": 406,
  "status": "failed",
  "description": "CANCEL_NOT_ALLOWED",
  "api_response": "Orders can only be cancelled within 2 hours of ordering.",
  "callID": 18521
}
```

#### Pay Shipping

`POST https://api.gsubz.com/api/store/order/`

When we weigh an item whose shipping was `pending`, or the weight turns out higher than listed, its `shipping.status` becomes `due` and you get a [webhook](#webhooks) with the new weight, size and fee. This pays everything due on the order from your wallet (or only one item with `item_id`). Items move to processing once their shipping is paid. Nothing waits on a deadline: an item stays on hold until it is paid.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `action` | string | Yes | `pay_shipping` | Always `pay_shipping`. |
| `order_id` | integer | Or reference | `5231` | The order. You can send `reference` instead. |
| `reference` | string | No | `ORDER-10045` | Your own reference, instead of `order_id`. |
| `item_id` | integer | No | `88121` | Pay only this item. Leave it out to pay everything due on the order. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/store/order/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'action="pay_shipping"' \
--form 'order_id="5231"'
```

Example response:

```json
{
  "code": 200,
  "status": "successful",
  "callID": 18530,
  "scope": "pay_shipping",
  "amountPaid": 4356,
  "initialBalance": 19324,
  "finalBalance": 14968,
  "date": "2026-10-16T14:20:00+01:00",
  "api_response": "Shipping paid for 1 item(s).",
  "paid": [ { "id": 88121, "amount": 4356 } ],
  "order": { "orderId": 5231, "reference": "ORDER-10045", "items": [] }
}
```

`amountPaid` is the shipping taken from your wallet. `order` is the updated order (shortened here).

Example error response (HTTP 406):

```json
{
  "code": 406,
  "status": "failed",
  "description": "NOTHING_DUE",
  "api_response": "No shipping fee is due on this order right now.",
  "callID": 18531
}
```

### Transactions

#### Fetch Transaction Status

`POST https://api.gsubz.com/api/verify/`

Check the status and response of a purchase using the `requestID` you sent when you made it, or the `transactionID` GSUBZ returned. Use this whenever a purchase request times out or returns no response, before you try again. Electricity purchases also return their `token`, and social media orders return their live progress.

> A transaction can return HTTP 200 and still have failed. Always check the `status` field, not just the response code.

> Send **either** `requestID` **or** `transactionID`: whichever you have. Only your own transactions are searched. If you send neither, the request is refused with code `400`.

> **Electricity.** The response carries `token`, the meter token. If the token was not available when you bought, it is fetched for you now, so a purchase whose token you never received can be recovered by calling this endpoint. If the token is still not ready, `token` is left out: try again in a minute. A failed or refunded purchase never has a token.

> **Social media.** The response carries `order`: the live progress of the order, with `status`, `start_count` (the count when the order started) and `remains` (how many are still to be delivered). It is left out if the progress cannot be read right now.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `requestID` | string | Or transactionID | `7wbd7wbdw7d72g6vd` | The `requestID` you passed during the purchase. Send this or `transactionID`. |
| `transactionID` | string | No | `3574357094` | The `transactionID` from the purchase response. Send this or `requestID`. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/api/verify/' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--form 'api="YOUR_API_KEY"' \
--form 'requestID="7wbd7wbdw7d72g6vd"'
```

Example response:

```json
{
  "code": "200",
  "status": "success",
  "description": "TRANSACTION_SUCCESSFUL",
  "transaction_id": "3574357094",
  "amount": "1100",
  "api_response": "Dear Customer, You have successfully shared 1GB Data to 2349063648020. Your SME data balance is 28955.68GB expires 30/01/2024. Thankyou"
}
```

`transaction_id` is GSUBZ's reference and `amount` is what the purchase cost you, in naira. Electricity adds `"token": "47488383838383838383833"`. Social media adds `"order": { "status": "In progress", "start_count": "0", "remains": "850" }`. Other services return neither.

Example error response (HTTP 404):

```json
{
  "code": "404",
  "description": "CONTENT_NOT_FOUND_API_OR_NOT_FOUND",
  "status": "TRANSACTION_FAILED"
}
```

