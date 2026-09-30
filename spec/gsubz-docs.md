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

Send your API key as a Bearer token on every request except Get Plans and the two public eSIM lists:

```
Authorization: Bearer YOUR_API_KEY
```

Most POST endpoints also take the same key in the `api` body field. Keep the key on your server and never expose it in a mobile app or in browser JavaScript.

## Making requests

| Topic | Detail |
|---|---|
| Base URL | `https://api.gsubz.com`. Always use HTTPS. |
| Endpoint paths | Paths end with a trailing slash, for example `/api/pay/`. Use the URLs exactly as shown. |
| Request body | Form data: `multipart/form-data` or `application/x-www-form-urlencoded`. Every value is sent as text. The GET endpoints (Get Plans and the eSIM lists) take their fields in the query string instead. |
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
| 206 | `failed` | `INVALID_CONTENT` | One of the fields has an invalid value. | Check the phone number, amount and service ID formats. |
| 401 | `failed` | `INVALID_PLAN` | The `plan` or `variation_code` does not match the `serviceID`. | Call [Get Plans](#plans) again and use a value from that list. |
| 402 | `failed` | `INSUFFICIENT_BALANCE` | Your wallet balance is too low for this purchase. | Fund your wallet, then try again. |
| 404 | `failed` | `CONTENT_NOT_FOUND` | The resource you asked for could not be found. | Check the URL and the reference you sent. |
| 405 | `failed` | `REQUEST_METHOD_NOT_IN_POST` | You used GET where POST is required, or the other way round. | Use the method shown for the endpoint. |
| 406 | `failed` | `SERVICE_DISABLED` | This service is temporarily disabled. | Try again later or use another service. |
| 406 | `successful or failed` | `INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID` | You already used this `requestID`. Nothing was charged again, and the response carries the original result. | Read the original result from the response, or send a new `requestID` for a new order. |
| 406 | `failed` | `NOT_CANCELLABLE` | The eSIM cannot be cancelled, for example because it was already installed or already refunded. | Nothing was changed. Only an unused eSIM can be cancelled. |
| 429 | `failed` | `TOO_MANY_REQUESTS` | You sent too many requests in a short time. | Wait a minute, then try again. |
| 502 | `failed` | `GATEWAY_ERROR` | The upstream provider did not respond. Safe to retry. | If you sent a `requestID`, check [Fetch Transaction Status](#transaction-status) first, then retry. |

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
2. **Send a unique requestID with every purchase.** Use your own order or invoice number. It lets you look the transaction up later with [Fetch Transaction Status](#transaction-status).
3. **Read status, not just the HTTP code.** A response can arrive with HTTP 200 and still describe a failed transaction. Treat a purchase as successful only when `status` is `successful`. A failed purchase returns `failed`.
4. **Never resend a purchase blindly after a timeout.** If a request times out or you get no response, the purchase may still have gone through. Look it up by `requestID` first, so you do not charge your customer twice.
5. **Fetch plans instead of hard-coding them.** Plan values and prices can change. Call [Get Plans](#plans) and use the `value` it returns as your `plan` (or `variation_code`).
6. **Verify meter and smartcard numbers before paying.** Call [Verify Meter / IUC Number](#verify-customer) so your customer can confirm their name before you charge them. It catches typing mistakes before money moves.
7. **Watch your wallet balance.** Check [Fetch Wallet Balance](#wallet-balance) and top up before it runs low, so customers do not hit `INSUFFICIENT_BALANCE`.
8. **Convert numbers before doing arithmetic.** Amounts and balances are numbers in naira. Convert them yourself before doing arithmetic, in case a value ever arrives as text.

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
- `mtn_fibrex`: MTN Fibre X (Wifi)
- `mtn_gifting`: MTN Gifting Data
- `mtn_sme`: MTN SME Data

### Education (Result Pins)

- `jamb`: JAMB PIN (UTME &amp; Direct Entry)
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

### TV Subscriptions

- `dstv`: DSTV
- `gotv`: GOTV
- `startimes`: Startimes

### Uncategorised

- `mtn_datashare`: MTN-SME-Datashare
- `socials`: Socials Media Market

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

`POST https://api.gsubz.com/apiV2/generate/`

Generate recharge card pins for printing. The `network` must be `mtn`, `airtel`, `glo` or `9mobile`: lowercase, spelt exactly as shown. This endpoint authenticates with the `Authorization` header only.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `network` | string | Yes | `airtel` | `mtn`, `airtel`, `glo` or `9mobile`. |
| `value` | string | Yes | `500` | Face value of each pin in naira: `100`, `200`, `400` or `500`. |
| `number` | string | Yes | `1` | How many pins to generate. The minimum is 10 for values below 500. |

Example request (cURL):

```bash
curl --location 'https://api.gsubz.com/apiV2/generate/' \
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

### Transactions

#### Fetch Transaction Status

`POST https://api.gsubz.com/api/verify/`

Check the status and response of a purchase using the `requestID` you sent when you made it. Use this whenever a purchase request times out or returns no response, before you try again.

> A transaction can return HTTP 200 and still have failed. Always check the `status` field, not just the response code.

Authentication: Bearer token required.

| Body field | Type | Required | Example | Description |
|---|---|---|---|---|
| `api` | string | Yes | `YOUR_API_KEY` | Your API key. Send the same key you use in the `Authorization` header. |
| `requestID` | string | Yes | `7wbd7wbdw7d72g6vd` | The `requestID` you passed during the purchase. |

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
  "api_response": "Dear Customer, You have successfully shared 1GB Data to 2349063648020. Your SME data balance is 28955.68GB expires 30/01/2024. Thankyou"
}
```

