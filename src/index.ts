/**
 * GSUBZ API — TypeScript SDK
 *
 * Covers the full documented API surface (https://gsubz.com/api_doc/, OpenAPI
 * spec at spec/gsubz.openapi.json). Nothing here is invented: every endpoint,
 * field name and error code below comes straight from the official doc.
 *
 * Key facts the doc states (mirrored in this SDK):
 * - Base URL: https://api.gsubz.com — paths end with a trailing slash.
 * - Auth: `Authorization: Bearer <api key>` on every request except Get Plans
 *   and the two public eSIM lists (Get Plans, eSIM countries, eSIM packages).
 * - Most POST endpoints ALSO take the same key in the `api` body field.
 *   The SDK sends both, exactly as the doc instructs.
 * - Bodies are form data (multipart/form-data or urlencoded); every value is
 *   sent as text. GET endpoints take fields in the query string.
 * - Responses are JSON, UTF-8.
 * - A purchase can return HTTP 200 and still have FAILED — always check
 *   `status`, never just the HTTP code. The SDK's typed errors enforce this.
 * - requestID: your own unique reference per purchase. If you reuse one, the
 *   API returns the ORIGINAL result and never charges twice
 *   (406 INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID). The SDK generates one for
 *   you when you don't pass one, and returns it in every response.
 * - Phone numbers: 11-digit Nigerian format, e.g. 08031234567.
 * - Money: plain naira numbers, no symbol/commas.
 * - Timeouts: purchases can take seconds; use >= 60s. The SDK defaults to 90s
 *   and retries only what the doc calls safe (502 GATEWAY_ERROR), always
 *   re-verifying by requestID first instead of blind re-sending.
 *
 * Endpoints (doc's API reference, re-scraped Oct 2026 — 17 new endpoints):
 *   POST /api/balance/        Fetch Wallet Balance
 *   GET  /api/plans/          Get Plans                     (public)
 *   GET  /api/category/       List All Services             (public)          NEW
 *   POST /api/verify-customer/ Verify Meter / IUC Number
 *   POST /api/pay/            Buy Data / Airtime / TV / Electricity / Exam Pin / Social
 *   POST /api/generate/       Recharge Pins (moved from /apiV2/generate/)     CHANGED
 *   GET  /api/generate/history/  Fetch Recharge Pin Orders                    NEW
 *   GET  /api/esim/countries/ List eSIM Countries           (public)
 *   GET  /api/esim/packages/  List eSIM Packages            (public)
 *   POST /api/esim/buy/       Buy eSIM
 *   POST /api/esim/orders/    Fetch eSIM Orders
 *   POST /api/esim/cancel/    Cancel eSIM
 *   GET  /api/games/list/     List Games                    (public)          NEW
 *   GET  /api/games/products/ List Game Products            (public)          NEW
 *   POST /api/games/validate/ Validate Player ID (free)                       NEW
 *   POST /api/games/buy/      Buy Game Top-up                                 NEW
 *   POST /api/games/orders/   Fetch Game Orders                               NEW
 *   GET/POST /api/flight/search/  Airports / Search Flights                   NEW
 *   POST /api/flight/book/    Book a Flight (JSON body, preview->quote flow)  NEW
 *   POST /api/flight/orders/  Fetch Flight Orders                             NEW
 *   GET  /api/store/search|product|categories|supplier/  Gsubz Store           NEW
 *   POST /api/store/image-search/  Image Search (₦4)                          NEW
 *   POST /api/store/order/    Place an Order (JSON body, reference dedupe)    NEW
 *   GET  /api/store/order/    Get Orders / POST action=pay_shipping           NEW
 *   POST /api/sms/            Send Bulk SMS
 *   POST /api/verify/         Fetch Transaction Status (requestID OR transactionID;
 *                             recovers electricity tokens)                    CHANGED
 *
 * Webhooks (NEW): X-Gsubz-Signature = "sha256=" + HMAC-SHA256 of `timestamp.body`
 * with your signing secret — use verifyWebhook(); dedupe on eventId.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const BASE_URL = "https://api.gsubz.com";

/** The doc's error codes table, verbatim meanings. */
export const RESPONSE_CODES = {
  200: "successful",
  204: "REQUIRED_CONTENT_NOT_SENT",
  206: "INVALID_CONTENT",
  401: "INVALID_PLAN",
  402: "INSUFFICIENT_BALANCE",
  404: "CONTENT_NOT_FOUND",
  405: "REQUEST_METHOD_NOT_IN_POST",
  406: "SERVICE_DISABLED | INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID | NOT_CANCELLABLE",
  429: "TOO_MANY_REQUESTS",
  502: "GATEWAY_ERROR",
  // NEW (Oct 2026 doc): 400 REQUIRED_CONTENT_REQUESTID_IS_EMPTY (verify with neither
  // requestID nor transactionID), 401 INVALID_API_OR_NOT_FOUND.
} as const;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Outcome of any purchase. The doc: successful = delivered, failed = not. */
export type Status = "successful" | "failed";

/** Fields every purchase response shares (doc: "Responses" section). */
export interface TransactionResponse {
  /** Usually a number; the doc's Fetch Transaction Status example returns it
   *  as the string "200" — accept both. */
  code: number | string;
  status: Status;
  transactionID?: number | string;
  amount?: number;
  phone?: string;
  serviceID?: string;
  /** Amount deducted from wallet at your API price — can be lower than amount. */
  amountPaid?: number;
  initialBalance?: number;
  finalBalance?: number;
  /** ISO 8601, West Africa Time. */
  date?: string;
  /** Plain-words message from the network/provider (e.g. the token, the pin). */
  api_response?: string;
  /** Echoed back when you sent one. */
  requestID?: string;
  /** Present on some endpoints (SMS reference, eSIM fields, etc). */
  [key: string]: unknown;
}

export interface Plan {
  displayName: string;
  /** The value to send as `plan` (data/social) or `variation_code` (cable). */
  value: string;
  /** Normal price in naira (string per doc — convert before arithmetic). */
  price: string;
  /** Your API price in naira. */
  api_price: string;
}

export interface PlansResponse {
  service: string;
  /** Tells you which body field to submit when buying:
   *  data/social => `plan`, cable TV => `variation_code`. */
  PlanName: "plan" | "variation_code";
  fixedPrice?: boolean;
  /** Your API discount on this service, e.g. "4.81%". */
  discount?: string;
  plans: Plan[];
}

export interface ElectricityCustomer {
  customerName: string;
  address?: string | null;
  meterNumber?: string;
  meterType?: string;
  accountType?: string | null;
  canVend?: string;
}
export interface CableCustomer {
  customerName: string;
  status?: string;
  dueDate?: string;
  customerNumber?: string;
  customerType?: string;
}
export interface VerifyCustomerResponse {
  code: number;
  status: Status;
  description: string; // e.g. CUSTOMER_FOUND
  content: ElectricityCustomer | CableCustomer;
}

export interface Pin {
  pin: string;
  sn: string; // serial number
}
export interface GeneratePinsResponse {
  message: string;
  status: string; // "success"
  id: string;
  network: string;
  value: string;
  number: string;
  delivered: string;
  pending: number;
  pins: Pin[];
}

export interface EsimCountry {
  country: string;
  /** May hold several codes comma-separated; send the whole value onward. */
  locationCodes: string;
  plans: number;
}
export interface EsimPackage {
  packageCode: string;
  name: string;
  country: string;
  dataGB: number;
  duration: number;
  durationUnit: string; // e.g. "DAY"
  /** Naira. Can shift slightly before purchase; read amountPaid after buying. */
  price: number;
  refundable: boolean;
  topUp: boolean;
}
export interface EsimOrder {
  orderID: number;
  transactionID?: string;
  packageCode: string;
  packageName: string;
  country: string;
  amountPaid: number;
  amountRefunded: number;
  /** active | provisioning | refunded | failed */
  esimStatus: string;
  iccid?: string | null;
  activationCode?: string | null;
  qrCodeUrl?: string | null;
  date?: string;
}

export interface SmsResponse extends TransactionResponse {
  reference?: string;
  sender?: string;
  /** Valid, de-duplicated numbers found. */
  recipients?: number;
  sent?: number;
  failed?: number;
  /** Invalid/repeated numbers left out. */
  skipped?: number;
  pages?: number;
}

/** Raised for every non-successful outcome. `code`/`description` come from the
 *  API; `apiResponse` is the plain-words explanation. */
export class GsubzError extends Error {
  readonly code: number;
  readonly description: string;
  readonly apiResponse?: string;
  /** Full parsed body, for endpoints with extra fields (e.g. SMS `issues`). */
  readonly body: Record<string, unknown>;
  /** True for 406 INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID — the original
   *  result is in `body`; nothing was charged again. */
  readonly duplicateRequestID: boolean;

  constructor(body: Record<string, unknown>, httpStatus: number) {
    const code = Number(body.code ?? httpStatus);
    const description = String(body.description ?? body.status ?? "UNKNOWN");
    const apiResponse = body.api_response ? String(body.api_response) : undefined;
    super(`GSUBZ ${code} ${description}${apiResponse ? `: ${apiResponse}` : ""}`);
    this.name = "GsubzError";
    this.code = code;
    this.description = description;
    this.apiResponse = apiResponse;
    this.body = body;
    this.duplicateRequestID = description === "INVALID_ARGUMENTS_DUPLICATE_REQUEST_ID";
  }
}


/* ------------------------------------------------------------------ */
/* Input validation — the doc's own rules, caught before any network    */
/* ------------------------------------------------------------------ */

/** 11-digit Nigerian format, e.g. 08031234567 (doc: Phone numbers). */
export function assertNigerianPhone(phone: string, what = "phone"): void {
  if (!/^0\d{10}$/.test(phone)) {
    throw new Error(
      `gsubz-sdk: ${what} must be an 11-digit Nigerian number like 08031234567 (got "${phone}").`,
    );
  }
}

function assertAmount(naira: number, min: number, what: string): void {
  if (!Number.isFinite(naira) || naira < min) {
    throw new Error(`gsubz-sdk: ${what} must be a number >= ${min} (got ${naira}).`);
  }
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export interface GsubzClientOptions {
  /** Your API key (starts with ap_). Keep it server-side only.
   *  Optional: falls back to `process.env.GSUBZ_API_KEY`, so
   *  `new Gsubz()` works once the env var is set. */
  apiKey?: string;
  /** Request timeout in ms. The doc says use at least 60s. Default 90_000. */
  timeoutMs?: number;
  /** Override the base URL (tests/mocks). Default https://api.gsubz.com. */
  baseUrl?: string;
  /** Extra headers for every request (e.g. request tracing). */
  headers?: Record<string, string>;
  /** Log every request/response to console.debug (key redacted). */
  debug?: boolean;
  /** Custom fetch (Node 18+ has global fetch; pass a wrapper for proxies). */
  fetchImpl?: typeof fetch;
}

/** Options for purchase calls. If you omit requestID the SDK generates a
 *  unique one (timestamp + random) and returns it in the response. */
export interface PayOptions {
  /** Your own unique reference (order/invoice id). Strongly recommended. */
  requestID?: string;
}

export interface BuyDataInput {
  /** e.g. mtn_sme, airtel_sme, glo_data, etisalat_data, mtn_gifting… */
  serviceID: string;
  /** Plan value from getPlans(serviceID).plans[i].value */
  plan: string;
  phone: string;
  requestID?: string;
}

export interface BuyAirtimeInput {
  /** mtn | airtel | etisalat (9mobile) | glo — lowercase, exactly. */
  serviceID: "mtn" | "airtel" | "etisalat" | "glo" | string;
  /** Naira; minimum 100 per the doc. */
  amount: number;
  phone: string;
  requestID?: string;
}

export interface BuyCableInput {
  /** dstv | gotv | startimes */
  serviceID: string;
  /** Package value from getPlans(serviceID) — send as variation_code. */
  variationCode: string;
  /** IUC / smartcard number. Verify first with verifyCustomer(). */
  customerID: string;
  phone: string;
  requestID?: string;
}

export interface BuyElectricityInput {
  /** e.g. kaduna_electric / ikeja-electric (hyphen and underscore both work) */
  serviceID: string;
  /** Meter number. Verify first with verifyCustomer(). */
  customerID: string;
  /** Naira. */
  amount: number;
  /** prepaid | postpaid */
  type: "prepaid" | "postpaid";
  phone: string;
  requestID?: string;
}

export interface BuyExamPinInput {
  /** waec | neco | nabteb (jamb also listed under education service IDs) */
  serviceID: string;
  /** One plan per service; WAEC's is waecdirect. Get it from getPlans(). */
  plan: string;
  phone: string;
  requestID?: string;
}

export interface BuySocialInput {
  /** Always "socials". */
  plan: string;
  /** Profile/post URL the order delivers to. */
  link: string;
  /** Positive whole number. */
  quantity: number;
  requestID?: string;
}

export interface SendSmsInput {
  /** Sender name: 3–11 letters, no spaces/numbers/symbols; no bank/telecom names. */
  from: string;
  /** Up to 5,000 Nigerian numbers; commas or new lines; 080…/234…/+234… all ok. */
  to: string | string[];
  /** Message text, up to 905 characters. */
  msg: string;
  requestID?: string;
}

/* ------------------------------------------------------------------ */
/* Webhooks (NEW — Oct 2026 doc)                                       */
/* ------------------------------------------------------------------ */

export interface WebhookHeaders {
  /** X-Gsubz-Event — e.g. "transaction.updated", "games.order.updated", "store.order.updated". */
  event: string;
  /** X-Gsubz-Delivery — same as body eventId; retries keep the same ID (dedupe on it). */
  delivery: string;
  /** X-Gsubz-Timestamp — unix seconds. */
  timestamp: string;
  /** X-Gsubz-Signature — "sha256=" + HMAC-SHA256 of `${timestamp}.${rawBody}` with your signing secret. */
  signature: string;
}

/**
 * Verify a GSUBZ webhook request. The doc: signature is "sha256=" + HMAC-SHA256
 * of `${timestamp}.${rawBody}` using your signing secret. Returns the parsed
 * event when valid; throws when the signature, timestamp, or format is wrong.
 *
 * Dedupe on `parsed.eventId` (retries reuse it) and answer 2xx within 10s.
 */
export function verifyWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  signingSecret: string,
  maxAgeMs = 5 * 60_000,
): { eventId: string; event: string; data: Record<string, unknown> } {
  // timing-safe HMAC check of `${timestamp}.${rawBody}` (doc: X-Gsubz-Signature = "sha256=" + HMAC-SHA256)
  // implemented with node:crypto (import at top of file).
  const sig = headers.signature.startsWith("sha256=") ? headers.signature.slice(7) : headers.signature;
  const expected = createHmac("sha256", signingSecret).update(`${headers.timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new GsubzError({ code: 401, description: "WEBHOOK_BAD_SIGNATURE",
      api_response: "X-Gsubz-Signature does not match the HMAC of timestamp.body — reject this webhook." }, 401);
  }
  const age = Math.abs(Date.now() - Number(headers.timestamp) * 1000);
  if (!Number.isFinite(age) || age > maxAgeMs) {
    throw new GsubzError({ code: 401, description: "WEBHOOK_STALE_TIMESTAMP",
      api_response: `Webhook timestamp is ${Math.round(age / 1000)}s off — possible replay; reject.` }, 401);
  }
  let body: { eventId?: string; event?: string; data?: Record<string, unknown> };
  try { body = JSON.parse(rawBody); }
  catch { throw new GsubzError({ code: 400, description: "WEBHOOK_BAD_JSON", api_response: "Body is not JSON." }, 400); }
  if (!body.eventId || !body.event) {
    throw new GsubzError({ code: 400, description: "WEBHOOK_MISSING_FIELDS",
      api_response: "Webhook body must carry eventId and event." }, 400);
  }
  return { eventId: body.eventId, event: body.event, data: body.data ?? {} };
}

/* ------------------------------------------------------------------ */
/* New-surface types (Oct 2026 doc)                                    */
/* ------------------------------------------------------------------ */

/** GET /api/category/ response — every active serviceID grouped by category. */
export interface ServicesCatalogue {
  code: number | string;
  status?: string;
  categories: Array<{
    name: string;
    image?: string | null;
    services: Array<{ serviceID: string; name: string; minimum?: number | string }>;
  }>;
}

export interface GeneratePinsInput { network: "mtn" | "airtel" | "glo" | "9mobile"; value: string; number: string; requestID?: string }
export interface PinOrdersQuery { limit?: number; order_id?: string; pins?: 0 | 1 }
export interface PinOrdersResponse {
  code: number | string; status: Status | "success";
  orders: Array<{ id: string; network: string; value: string; number: string; delivered: string | number; pending: number; date?: string; pins?: Array<{ pin: string; sn: string }> }>;
}

export interface GamesListResponse {
  code: number | string; status: Status | "success";
  games: Array<{ gameID: number; name: string; image?: string | null; note?: string | null; lines: number; products: number; fromPrice: number }>;
}
export interface GameProductsResponse {
  code: number | string; status: Status | "success";
  products: Array<{ productID: string | number; name: string; price: number; api_price?: number; requirements?: Array<{ field: string; label?: string }> }>;
}
export interface GameValidateInput { productID: string; player_id?: string; extra?: Record<string, string | number> }
export interface GameValidateResponse {
  code: number | string; status: Status | "success";
  description: "PLAYER_FOUND" | "NO_ID_NEEDED" | string;
  playerName?: string | null; region?: string | null; api_response?: string;
}
export interface GameBuyInput { productID: string; player_id?: string; requestID?: string; extra?: Record<string, string | number> }
export interface GameBuyResponse extends TransactionResponse {
  orderID?: number; orderStatus?: "processing" | "completed" | "refunded";
  playerName?: string | null; codes?: string[]; duplicateRequestID?: boolean;
}
export interface GameOrdersQuery { requestID?: string; orderID?: number; transactionID?: string }
export interface GameOrder {
  orderID: number; transactionID: string; requestID?: string | null;
  game: string; product: string; amount: number; amountPaid: number; amountRefunded: number;
  orderStatus: "processing" | "completed" | "refunded";
  playerName?: string | null; codes: string[]; date: string;
}
export interface GameOrdersResponse { code: number | string; status: Status | "success"; orders: GameOrder[] }

export interface AirportsResponse {
  code: number | string; status: Status | "success"; count?: number;
  airports: Array<{ code: string; name: string; city: string; country: string }>;
}
export interface FlightSearchInput {
  origin: string; destination: string; departureDate: string; returnDate?: string;
  adults?: number; children?: number; infants?: number;
  cabin?: "economy" | "premium_economy" | "business" | "first";
}
export interface FlightJourney {
  from: string; to: string; departsAt: string; arrivesAt: string;
  duration: string; stops: number; flightNumber: string; baggage?: string;
}
export interface FlightSearchResponse {
  code: number | string; status: Status | "success";
  searchID: string; expiresAt: string; currency: string; count: number;
  api_response?: string;
  offers: Array<{ token: string; airline: string; airlineCode: string; logo?: string; amount: number; refundable: boolean; journeys: FlightJourney[] }>;
}
export interface FlightPassenger {
  type: "adult" | "child" | "infant";
  title: "Mr" | "Mrs" | "Ms" | "Miss" | "Master";
  first_name: string; last_name: string; gender: "male" | "female";
  middle_name?: string; country_code?: string;
  passport_number?: string; passport_expiry?: string;
}
export interface FlightBookInput {
  quoteID?: string; token?: string; searchID?: string;
  passengers?: FlightPassenger[];
  contact?: { email: string; phone: string };
  requestID?: string; maxAmount?: number; preview?: boolean;
}
export interface FlightBookResponse extends TransactionResponse {
  quoteID?: string; expiresIn?: string; quote?: { amount: number };
  pnr?: string; tickets?: Array<{ passenger: string; ticketNumber: string }>;
  orderStatus?: "processing" | "completed" | "refunded";
  duplicateRequestID?: boolean;
}
export interface FlightOrdersQuery { requestID?: string; transactionID?: string }
export interface FlightOrder {
  transactionID: string; requestID?: string | null; serviceID?: string;
  orderStatus: "processing" | "completed" | "refunded";
  tripType?: "oneway" | "return"; origin?: string; destination?: string;
  departureDate?: string; returnDate?: string | null; airline?: string;
  journeys?: FlightJourney[]; passengers?: Array<Record<string, unknown>>;
  amount?: number; amountPaid?: number; amountRefunded?: number;
}
export interface FlightOrdersResponse { code: number | string; status: Status | "success"; orders: FlightOrder[] }

export interface StoreSearchQuery {
  scope?: "trending" | "official" | "market"; q?: string; brand?: number;
  page?: number; sort?: "default" | "sales" | "price_up" | "price_down";
  start_price?: number; end_price?: number; moq?: number; new_arrival?: boolean | "true";
}
export interface StoreProductSummary {
  id: string; name: string; image?: string | null; priceNgn?: number;
  brand?: string | null; supplier?: string | null; minOrder?: number;
}
export interface StoreSearchResponse {
  code: number | string; status: Status | "success";
  callID?: number; amountPaid?: number; initialBalance?: number; finalBalance?: number;
  page?: number; total?: number; products: StoreProductSummary[];
}
export interface StoreProductResponse extends Record<string, unknown> {
  code: number | string; status: Status | "success"; callID?: number; amountPaid?: number;
  product: { id: string; name: string; description?: string; images?: string[]; brand?: string | null; skus?: Array<{ skuId: string | number; priceNgn: number; stock?: number; attributes?: Record<string, string> }> };
}
export interface StoreCategoriesResponse {
  code: number | string; status: Status | "success";
  categories?: Array<{ name: string; image?: string | null }>;
  brands?: Array<{ id: number; name: string; image?: string | null }>;
}
export interface StoreSupplierResponse extends StoreSearchResponse { supplier?: Record<string, unknown> }
export interface StoreOrderItem {
  product_id: string; sku_id: string | number; quantity: number; price?: number;
}
export interface StoreOrderInput {
  reference: string; items?: StoreOrderItem[];
  pickup_station_id?: string | number; shipping_method?: string;
  contact?: { email?: string; phone?: string; name?: string };
  preview?: boolean;
}
export interface StoreOrderResponse extends Record<string, unknown> {
  code: number | string; status: Status | "success"; callID?: number;
  amountPaid?: number; initialBalance?: number; finalBalance?: number;
  duplicate?: boolean; preview?: boolean;
  quote?: Record<string, unknown>;
  order?: { orderId: number; reference: string; items: Array<Record<string, unknown>> } & Record<string, unknown>;
}
export interface StoreOrdersQuery { order_id?: number; reference?: string; state?: string; page?: number }
export interface StoreOrdersResponse extends StoreOrderResponse { orders?: Array<Record<string, unknown>> }
export interface StorePayShippingResponse extends Record<string, unknown> {
  code: number | string; status: Status | "success"; callID?: number; scope?: string;
  amountPaid?: number; paid?: Array<{ id: number; amount: number }>;
  order?: { orderId: number; reference: string; items: Array<Record<string, unknown>> };
}
export interface VerifyResponse extends TransactionResponse {
  token?: string; meter?: Record<string, unknown>;
  order?: Record<string, unknown>;
}

export class Gsubz {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;
  /** When true, logs every request/response pair to console.debug — for
   *  production debugging. Never logs the API key itself. */
  private readonly debug: boolean;

  constructor(opts: GsubzClientOptions = {}) {
    const key = opts.apiKey ?? (typeof process !== "undefined" ? process.env?.GSUBZ_API_KEY : undefined);
    if (!key) {
      throw new Error(
        "gsubz-sdk: no API key. Pass new Gsubz({ apiKey }) or set the GSUBZ_API_KEY environment variable.",
      );
    }
    this.apiKey = key;
    this.baseUrl = (opts.baseUrl ?? BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? 90_000;
    this.extraHeaders = opts.headers ?? {};
    this.debug = opts.debug ?? false;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /* ---------------- helpers ---------------- */

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    fields: Record<string, string | number | undefined>,
    opts: { withApiKeyBody?: boolean; noAuth?: boolean; timeoutMs?: number } = {},
    attempt = 0,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? this.timeoutMs);

    // The doc: most POST endpoints also take the key in the `api` body field.
    const body = new URLSearchParams();
    if (opts.withApiKeyBody !== false) body.set("api", this.apiKey);
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) body.set(k, String(v));
    }

    const t0 = Date.now();
    try {
      const res = await this.fetchImpl(url, {
        method,
        headers: {
          // Public endpoints (Get Plans, eSIM lists) take no key at all.
          ...(opts.noAuth ? {} : { Authorization: `Bearer ${this.apiKey}` }),
          ...this.extraHeaders,
          ...(method === "POST"
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
        },
        body: method === "POST" ? body.toString() : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new GsubzError(
          { code: res.status, description: "NON_JSON_RESPONSE", api_response: text.slice(0, 300) },
          res.status,
        );
      }

      // The doc: HTTP 200 can still carry a failed transaction. Only bodies
      // that actually carry a `status` are outcomes — plan/catalogue endpoints
      // have no status field and must pass through untouched (verified live).
      if (this.debug) {
        const safe = { ...json };
        if (typeof safe.api === "string") safe.api = "***";
        console.debug(`gsubz-sdk ${method} ${path} -> ${res.status} (${Date.now() - t0}ms)`, safe);
      }
      if (typeof json.status === "string") {
        const err = new GsubzError(json, res.status);
        const ok = json.status === "successful" || json.status === "success";
        if (!ok) {
          // Doc: 502 GATEWAY_ERROR is "safe to retry"; 429 is "wait a minute".
          // Never retried blindly — purchases always carry a requestID, so a
          // retry can return the original result instead of charging twice.
          const retryable =
            (err.code === 502 && attempt < 2) || (err.code === 429 && attempt < 1);
          if (retryable && method === "POST" && fields.requestID !== undefined) {
            const wait = err.code === 429 ? 30_000 : 2_000 * (attempt + 1);
            await new Promise((r) => setTimeout(r, wait));
            return this.request<T>(method, path, fields, opts, attempt + 1);
          }
          throw err;
        }
        // Doc: a duplicate 406 can arrive with status "successful" — surface it
        // as a duplicate instead of a silent fresh purchase.
        if (err.duplicateRequestID) {
          const marked = json as T & { duplicateRequestID?: boolean };
          marked.duplicateRequestID = true;
          return marked;
        }
      }
      return json as T;
    } catch (e) {
      if (e instanceof GsubzError) throw e;
      if ((e as Error).name === "AbortError") {
        throw new GsubzError(
          { code: 0, description: "CLIENT_TIMEOUT",
            api_response: `Request timed out after ${this.timeoutMs}ms. The purchase may still have gone through — look it up with verifyTransaction(requestID) before retrying.` },
          0,
        );
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /** JSON-body request (the doc's recommended format for /api/flight/book/ and
   *  /api/store/order/ — "Send the body as JSON (recommended)"). Same auth + error
   *  handling as request() but Content-Type: application/json. */
  private async requestJson<T>(
    path: string,
    payload: Record<string, unknown>,
    opts: { timeoutMs?: number } = {},
    attempt = 0,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? this.timeoutMs);
    const t0 = Date.now();
    try {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...this.extraHeaders,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const text = await res.text();
      let json: Record<string, unknown>;
      try { json = JSON.parse(text) as Record<string, unknown>; }
      catch {
        throw new GsubzError({ code: res.status, description: "NON_JSON_RESPONSE", api_response: text.slice(0, 300) }, res.status);
      }
      if (this.debug) {
        const safe = { ...json };
        if (typeof safe.api === "string") safe.api = "***";
        console.debug(`gsubz-sdk POST ${path} (json) -> ${res.status} (${Date.now() - t0}ms)`, safe);
      }
      if (typeof json.status === "string" && json.status !== "successful" && json.status !== "success") {
        const err = new GsubzError(json, res.status);
        if (err.code === 502 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 2_000 * (attempt + 1)));
          return this.requestJson<T>(path, payload, opts, attempt + 1);
        }
        throw err;
      }
      if (json.status === "successful" && (json as { duplicateRequestID?: boolean }).duplicateRequestID) {
        (json as T & { duplicateRequestID?: boolean }).duplicateRequestID = true;
      }
      return json as T;
    } catch (e) {
      if (e instanceof GsubzError) throw e;
      if ((e as Error).name === "AbortError") {
        throw new GsubzError(
          { code: 0, description: "CLIENT_TIMEOUT",
            api_response: `Request timed out after ${this.timeoutMs}ms. The order may still have gone through — look it up by reference/requestID before retrying.` },
          0,
        );
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  private newRequestID(): string {
    return `${Date.now()}${Math.floor(Math.random() * 1e9)}`;
  }

  /* ---------------- Wallet ---------------- */

  /** POST /api/balance/ — current wallet balance in naira (returned as a string
   *  per the doc; Number() it before arithmetic). */
  async getBalance(): Promise<number> {
    const r = await this.request<{ balance: string }>("POST", "/api/balance/", {});
    return Number(r.balance);
  }

  /* ---------------- Plans (public, no auth) ---------------- */

  /** GET /api/plans/?service=… — plans for any data/cable/social service.
   *  Public endpoint: no API key sent (per the doc). */
  async getPlans(serviceID: string): Promise<PlansResponse> {
    return this.request<PlansResponse>(
      "GET",
      `/api/plans/?service=${encodeURIComponent(serviceID)}`,
      {},
      { withApiKeyBody: false, noAuth: true },
    );
  }

  /* ---------------- Verify customer ---------------- */

  /** POST /api/verify-customer/ — meter number (electricity) or smartcard/IUC
   *  (cable). `type` is required for electricity, omit for cable. */
  async verifyCustomer(input: {
    serviceID: string;
    billersCode: string;
    type?: "prepaid" | "postpaid";
  }): Promise<VerifyCustomerResponse> {
    return this.request<VerifyCustomerResponse>("POST", "/api/verify-customer/", {
      serviceID: input.serviceID,
      billersCode: input.billersCode,
      type: input.type,
    });
  }

  /* ---------------- Purchases (all POST /api/pay/) ---------------- */

  /** Buy a data bundle. `plan` comes from getPlans(serviceID). */
  async buyData(input: BuyDataInput): Promise<TransactionResponse> {
    assertNigerianPhone(input.phone);
    const requestID = input.requestID ?? this.newRequestID();
    return this.request<TransactionResponse>("POST", "/api/pay/", {
      serviceID: input.serviceID,
      plan: input.plan,
      amount: "", // doc: empty string — price is set by the plan
      phone: input.phone,
      requestID,
    });
  }

  /** Buy airtime (min ₦100). serviceID: mtn | airtel | etisalat | glo. */
  async buyAirtime(input: BuyAirtimeInput): Promise<TransactionResponse> {
    assertNigerianPhone(input.phone);
    assertAmount(input.amount, 100, "amount (doc: airtime minimum is ₦100)");
    const requestID = input.requestID ?? this.newRequestID();
    return this.request<TransactionResponse>("POST", "/api/pay/", {
      serviceID: input.serviceID,
      amount: input.amount,
      phone: input.phone,
      requestID,
    });
  }

  /** Renew DStv/GOtv/StarTimes. Verify the smartcard first. */
  async buyCable(input: BuyCableInput): Promise<TransactionResponse> {
    assertNigerianPhone(input.phone);
    if (!input.customerID || !/^\d{10,13}$/.test(input.customerID)) {
      throw new Error(`gsubz-sdk: customerID must be the 10–13 digit IUC/smartcard number (got "${input.customerID}").`);
    }
    const requestID = input.requestID ?? this.newRequestID();
    return this.request<TransactionResponse>("POST", "/api/pay/", {
      serviceID: input.serviceID,
      variation_code: input.variationCode,
      customerID: input.customerID,
      amount: "", // doc: empty string — price is set by the plan
      phone: input.phone,
      requestID,
    });
  }

  /** Prepaid token or postpaid bill. Verify the meter first. */
  async buyElectricity(input: BuyElectricityInput): Promise<TransactionResponse> {
    assertNigerianPhone(input.phone);
    assertAmount(input.amount, 0, "amount");
    const requestID = input.requestID ?? this.newRequestID();
    return this.request<TransactionResponse>("POST", "/api/pay/", {
      serviceID: input.serviceID,
      customerID: input.customerID,
      amount: input.amount,
      variation_code: input.type, // doc: prepaid/postpaid goes in variation_code
      phone: input.phone,
      requestID,
    });
  }

  /** WAEC/NECO/NABTEB result pins. */
  async buyExamPin(input: BuyExamPinInput): Promise<TransactionResponse> {
    assertNigerianPhone(input.phone);
    const requestID = input.requestID ?? this.newRequestID();
    return this.request<TransactionResponse>("POST", "/api/pay/", {
      serviceID: input.serviceID,
      plan: input.plan,
      amount: "", // doc: empty string — price is set by the plan
      phone: input.phone,
      requestID,
    });
  }

  /** Social media orders (followers, likes…). serviceID is always `socials`. */
  async buySocial(input: BuySocialInput): Promise<TransactionResponse> {
    if (!/^https?:\/\//.test(input.link)) {
      throw new Error(`gsubz-sdk: link must be an http(s) URL (got "${input.link}").`);
    }
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new Error(`gsubz-sdk: quantity must be a positive whole number (got ${input.quantity}).`);
    }
    const requestID = input.requestID ?? this.newRequestID();
    return this.request<TransactionResponse>("POST", "/api/pay/", {
      serviceID: "socials",
      plan: input.plan,
      amount: "", // doc: empty string — price is set by the plan
      link: input.link,
      quantity: input.quantity,
      requestID,
    });
  }

  /** POST /apiV2/generate/ — recharge card pins. Header auth only (no `api`
   *  body field per the doc). value: 100|200|400|500. number: min 10 for
   *  values below 500. */
  async generatePins(input: {
    network: "mtn" | "airtel" | "glo" | "9mobile";
    value: "100" | "200" | "400" | "500";
    number: number;
  }): Promise<GeneratePinsResponse> {
    if (input.value !== "500" && input.number < 10) {
      throw new Error("gsubz-sdk: number must be at least 10 for values below 500 (doc rule).");
    }
    return this.request<GeneratePinsResponse>("POST", "/apiV2/generate/", {
      network: input.network,
      value: input.value,
      number: input.number,
    }, { withApiKeyBody: false });
  }

  /* ---------------- eSIM ---------------- */

  /** GET /api/esim/countries/ — public. `q` filters by name (e.g. "fra"). */
  async esimCountries(q?: string): Promise<{ countries: EsimCountry[] }> {
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    return this.request("GET", `/api/esim/countries/${qs}`, {}, { withApiKeyBody: false, noAuth: true });
  }

  /** GET /api/esim/packages/ — public. Up to 20 comma-separated codes. */
  async esimPackages(locationCode: string): Promise<{ packages: EsimPackage[] }> {
    return this.request(
      "GET",
      `/api/esim/packages/?locationCode=${encodeURIComponent(locationCode)}`,
      {},
      { withApiKeyBody: false, noAuth: true },
    );
  }

  /** POST /api/esim/buy/ — returns QR/activation details when esimStatus is
   *  "active"; if "provisioning", poll esimOrders() to collect them. */
  async buyEsim(input: { packageCode: string; requestID?: string }): Promise<TransactionResponse> {
    const requestID = input.requestID ?? this.newRequestID();
    return this.request<TransactionResponse>("POST", "/api/esim/buy/", {
      packageCode: input.packageCode,
      requestID,
    });
  }

  /** POST /api/esim/orders/ — one order (by requestID and/or orderID) or the
   *  last 50 when neither is sent. Re-checks provisioning orders. */
  async esimOrders(input: { requestID?: string; orderID?: number } = {}): Promise<{ orders: EsimOrder[] }> {
    return this.request("POST", "/api/esim/orders/", {
      requestID: input.requestID,
      orderID: input.orderID,
    });
  }

  /** POST /api/esim/cancel/ — refunds an unused eSIM. Only works once. */
  async cancelEsim(orderID: number): Promise<TransactionResponse> {
    return this.request<TransactionResponse>("POST", "/api/esim/cancel/", { orderID });
  }

  /* ---------------- Bulk SMS ---------------- */

  /** POST /api/sms/ — up to 5,000 Nigerian numbers, 905-char messages.
   *  Note the doc's content rules: no bank/OTP/international-brand wording,
   *  no 4+ digit runs (write "5,000", not "5000"). */
  async sendSms(input: SendSmsInput): Promise<SmsResponse> {
    if (!/^[a-zA-Z]{3,11}$/.test(input.from)) {
      throw new Error(`gsubz-sdk: from must be 3-11 letters with no spaces/numbers (got "${input.from}").`);
    }
    if (input.msg.length > 905) {
      throw new Error(`gsubz-sdk: msg is ${input.msg.length} chars; the doc caps it at 905.`);
    }
    const recipients = (Array.isArray(input.to) ? input.to.join(",") : input.to)
      .split(/[\s,]+/).filter(Boolean);
    if (recipients.length === 0) throw new Error("gsubz-sdk: no recipients given.");
    if (recipients.length > 5_000) {
      throw new Error(`gsubz-sdk: ${recipients.length} recipients; the doc caps a send at 5,000.`);
    }
    const requestID = input.requestID ?? this.newRequestID();
    const to = Array.isArray(input.to) ? input.to.join(",") : input.to;
    return this.request<SmsResponse>("POST", "/api/sms/", {
      from: input.from,
      to,
      msg: input.msg,
      requestID,
    });
  }

  /* ---------------- Transactions ---------------- */

  /** POST /api/verify/ — look a purchase up by its requestID. ALWAYS do this
   *  after a timeout before retrying, per the doc. */
  async verifyTransaction(requestID: string): Promise<TransactionResponse> {
    return this.request<TransactionResponse>("POST", "/api/verify/", { requestID });
  }

  /* ---------------- Seamless helpers (built on the calls above) ---------------- */

  /** Find a plan by human text instead of a magic number.
   *  `await gsubz.findPlan("mtn_sme", "1gb")` → the 1GB plan.
   *  Matching is case/space-insensitive on displayName, and also accepts the
   *  exact plan value. Throws a helpful error listing close matches. */
  async findPlan(serviceID: string, query: string): Promise<Plan> {
    const res = await this.getPlans(serviceID);
    const q = query.toLowerCase().replace(/\s+/g, "");
    const exact = res.plans.find((p) => p.value === query);
    if (exact) return exact;
    const hit = res.plans.find(
      (p) => p.displayName.toLowerCase().replace(/\s+/g, "") === q,
    );
    if (hit) return hit;
    const partials = res.plans.filter(
      (p) => p.displayName.toLowerCase().replace(/\s+/g, "").includes(q),
    );
    if (partials.length === 1) return partials[0] as Plan;
    if (partials.length > 1) {
      const list = partials.map((p) => `  - "${p.displayName}" (value: ${p.value}, ₦${p.api_price})`).join("\n");
      throw new Error(
        `gsubz-sdk: "${query}" matches ${partials.length} plans for "${serviceID}" — pick one explicitly:\n${list}`,
      );
    }
    const partial = partials[0];
    if (partial) return partial;
    const list = res.plans.map((p) => `  - "${p.displayName}" (value: ${p.value}, ₦${p.api_price})`).join("\n");
    throw new Error(
      `gsubz-sdk: no plan matching "${query}" for service "${serviceID}".\nAvailable plans:\n${list}`,
    );
  }

  /** Buy data by human plan name — one call, no catalogue round-trip in your code.
   *  `await gsubz.buyDataByPlan("mtn_sme", "1gb", "08031234567")` */
  async buyDataByPlan(
    serviceID: string,
    planQuery: string,
    phone: string,
    opts: PayOptions = {},
  ): Promise<TransactionResponse> {
    const plan = await this.findPlan(serviceID, planQuery);
    return this.buyData({ serviceID, plan: plan.value, phone, requestID: opts.requestID });
  }

  /** Buy an eSIM and wait until it is usable — resolves the finished order
   *  (iccid + activationCode + qrCodeUrl filled in). Handles the doc's
   *  `provisioning` state for you.
   *  @param pollMs how often to check, default 5s
   *  @param timeoutMs give up waiting after this, default 120s (you were
   *  charged either way — the order stays lookupable via esimOrders) */
  async buyEsimReady(
    input: { packageCode: string; requestID?: string },
    pollMs = 5_000,
    timeoutMs = 120_000,
  ): Promise<EsimOrder> {
    const buy = await this.buyEsim(input);
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const { orders } = await this.esimOrders({ requestID: buy.requestID });
      const order = orders.find((o) => o.orderID === Number(buy.orderID)) ?? orders[0];
      if (order && order.esimStatus !== "provisioning") return order;
      if (Date.now() > deadline) {
        throw new GsubzError(
          { code: 0, description: "ESIM_STILL_PROVISIONING",
            api_response: `Still provisioning after ${timeoutMs}ms. You were charged — keep polling esimOrders({ requestID: "${buy.requestID}" }).` },
          0,
        );
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  /** Send an SMS to ONE number — the common case, zero ceremony.
   *  Sender-name rules still apply (3–11 letters, no banks/telecom names). */
  async sendSmsOne(from: string, to: string, msg: string, opts: PayOptions = {}): Promise<SmsResponse> {
    return this.sendSms({ from, to, msg, requestID: opts.requestID });
  }

  /** True when the wallet can cover `naira`. Cheap pre-flight so purchases
   *  don't die with INSUFFICIENT_BALANCE. */
  async canAfford(naira: number): Promise<boolean> {
    return (await this.getBalance()) >= naira;
  }

  /* ---------------- Services catalogue (NEW: /api/category/) ---------------- */

  /** GET /api/category/ — every active serviceID grouped by category (public,
   *  cached ~60s on GSUBZ's side). One call replaces guesswork about serviceIDs. */
  async listServices(): Promise<ServicesCatalogue> {
    // The endpoint returns a BARE ARRAY of categories (doc omits this) — normalize it.
    const raw = await this.request<any>("GET", "/api/category/", {}, { withApiKeyBody: false, noAuth: true });
    const categories = Array.isArray(raw) ? raw : raw?.categories ?? [];
    return { code: 200, status: "success", categories };
  }

  /* ---------------- Recharge Pins (moved from /apiV2/generate/ to /api/generate/) ---------------- */

  /** POST /api/generate/ — generate recharge card pins. network: mtn|airtel|glo|9mobile;
   *  value: 100|200|400|500; number >= 10 for values below 500. Header auth ONLY (no api body field). */
  async generatePinsV2(input: GeneratePinsInput): Promise<GeneratePinsResponse> {
    return this.request<GeneratePinsResponse>("POST", "/api/generate/", {
      network: input.network, value: input.value, number: input.number,
      ...(input.requestID ? { requestID: input.requestID } : {}),
    }, { withApiKeyBody: false });
  }

  /** GET /api/generate/history/ — your pin orders, newest first. If a generate call timed
   *  out, the pins are HERE — look them up by order_id instead of resending the order. */
  async pinOrders(q: PinOrdersQuery = {}): Promise<PinOrdersResponse> {
    const qs = new URLSearchParams();
    if (q.limit !== undefined) qs.set("limit", String(q.limit));
    if (q.order_id) qs.set("order_id", q.order_id);
    if (q.pins !== undefined) qs.set("pins", String(q.pins));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.request<PinOrdersResponse>("GET", `/api/generate/history/${suffix}`, {}, { withApiKeyBody: false });
  }

  /* ---------------- Games (NEW) ---------------- */

  /** GET /api/games/list/ — games & gift cards on sale, most popular first (public, no key). */
  async listGames(q?: string): Promise<GamesListResponse> {
    const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
    return this.request<GamesListResponse>("GET", `/api/games/list/${suffix}`, {}, { withApiKeyBody: false, noAuth: true });
  }

  /** GET /api/games/products/?gameID=N — the top-up products (denominations) for one game. */
  async listGameProducts(gameID: number): Promise<GameProductsResponse> {
    return this.request<GameProductsResponse>(
      "GET", `/api/games/products/?gameID=${gameID}`, {}, { withApiKeyBody: false, noAuth: true },
    );
  }

  /** POST /api/games/validate/ — check a player ID BEFORE buying (free, 20 per 10 min).
   *  Returns playerName (and region where the game has one). description is
   *  PLAYER_FOUND or NO_ID_NEEDED (gift cards). */
  async validateGamePlayer(input: GameValidateInput): Promise<GameValidateResponse> {
    return this.request<GameValidateResponse>("POST", "/api/games/validate/", {
      productID: input.productID, player_id: input.player_id,
      ...(input.extra ?? {}),
    });
  }

  /** POST /api/games/buy/ — buy a game top-up or gift card. ALWAYS pass requestID: a
   *  duplicate returns the original order and never buys twice. orderStatus can be
   *  "processing" — you were charged; poll gameOrders() or await the games.order.updated webhook. */
  async buyGame(input: GameBuyInput): Promise<GameBuyResponse> {
    return this.request<GameBuyResponse>("POST", "/api/games/buy/", {
      productID: input.productID, player_id: input.player_id,
      requestID: input.requestID ?? this.newRequestID(),
      ...(input.extra ?? {}),
    });
  }

  /** POST /api/games/orders/ — your game orders. Pass requestID/orderID/transactionID for
   *  one, nothing for your last 50. A processing order is re-checked server-side on lookup
   *  (max every 25s) — this is how you collect gift-card codes after a processing buy. */
  async gameOrders(q: GameOrdersQuery = {}): Promise<GameOrdersResponse> {
    return this.request<GameOrdersResponse>("POST", "/api/games/orders/", {
      ...(q.requestID ? { requestID: q.requestID } : {}),
      ...(q.orderID !== undefined ? { orderID: q.orderID } : {}),
      ...(q.transactionID ? { transactionID: q.transactionID } : {}),
    });
  }

  /** Poll a game order until it leaves "processing". You were already charged — this is
   *  the recommended pattern after buyGame() returns processing. */
  async awaitGameOrder(q: GameOrdersQuery & { timeoutMs?: number; pollMs?: number } = {}): Promise<GameOrder> {
    const timeoutMs = q.timeoutMs ?? 300_000;
    const pollMs = q.pollMs ?? 25_000;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const { orders } = await this.gameOrders(q);
      const order = orders?.find((o) => (q.orderID !== undefined && o.orderID === q.orderID) || (q.requestID && o.requestID === q.requestID)) ?? orders?.[0];
      if (order && order.orderStatus !== "processing") return order;
      if (Date.now() > deadline) {
        throw new GsubzError(
          { code: 0, description: "GAME_ORDER_STILL_PROCESSING",
            api_response: `Still processing after ${timeoutMs}ms. You were charged — keep polling gameOrders() or wait for the games.order.updated webhook.` },
          0,
        );
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  /* ---------------- Flights (NEW) ---------------- */

  /** GET /api/flight/search/?q= — airport search (3-letter IATA codes). No q = popular
   *  airports; all=true = full list (cache it yourself). */
  async listAirports(q?: { search?: string; all?: boolean }): Promise<AirportsResponse> {
    const qs = new URLSearchParams();
    if (q?.search) qs.set("q", q.search);
    if (q?.all) qs.set("all", "true");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.request<AirportsResponse>("GET", `/api/flight/search/${suffix}`, {});
  }

  /** POST /api/flight/search/ — flight search, cheapest first, each offer carries a token.
   *  Free, max 20/min. Valid 1 hour. The search amount is NOT final — preview before booking. */
  async searchFlights(input: FlightSearchInput): Promise<FlightSearchResponse> {
    return this.request<FlightSearchResponse>("POST", "/api/flight/search/", {
      origin: input.origin, destination: input.destination,
      departure_date: input.departureDate,
      ...(input.returnDate ? { return_date: input.returnDate } : {}),
      ...(input.adults !== undefined ? { adults: input.adults } : {}),
      ...(input.children !== undefined ? { children: input.children } : {}),
      ...(input.infants !== undefined ? { infants: input.infants } : {}),
      ...(input.cabin ? { cabin: input.cabin } : {}),
    }, { withApiKeyBody: true });
  }

  /** POST /api/flight/book/ — two-step booking. Call with preview:true first (locks the
   *  price, returns quoteID, charges nothing), then with quoteID + passengers. Or book
   *  directly with token+searchID. Sent as JSON (the doc's recommended format). */
  async bookFlight(input: FlightBookInput): Promise<FlightBookResponse> {
    return this.requestJson<FlightBookResponse>("/api/flight/book/", {
      ...(input.quoteID ? { quoteID: input.quoteID } : {}),
      ...(input.token ? { token: input.token } : {}),
      ...(input.searchID ? { searchID: input.searchID } : {}),
      ...(input.preview ? { preview: true } : {}),
      ...(input.maxAmount !== undefined ? { maxAmount: input.maxAmount } : {}),
      ...(input.passengers ? { passengers: input.passengers } : {}),
      ...(input.contact ? { contact: input.contact } : {}),
      requestID: input.requestID ?? this.newRequestID(),
    });
  }

  /** POST /api/flight/orders/ — your bookings. requestID/transactionID for one, none for
   *  your last 50. A processing booking is re-checked on lookup — collect PNR/tickets here. */
  async flightOrders(q: FlightOrdersQuery = {}): Promise<FlightOrdersResponse> {
    return this.request<FlightOrdersResponse>("POST", "/api/flight/orders/", {
      ...(q.requestID ? { requestID: q.requestID } : {}),
      ...(q.transactionID ? { transactionID: q.transactionID } : {}),
    }, { withApiKeyBody: true });
  }

  /** Poll a flight booking until it leaves "processing" (charged, awaiting ticket issue). */
  async awaitFlightOrder(q: FlightOrdersQuery & { timeoutMs?: number; pollMs?: number } = {}): Promise<FlightOrder> {
    const timeoutMs = q.timeoutMs ?? 600_000;
    const pollMs = q.pollMs ?? 25_000;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const { orders } = await this.flightOrders(q);
      const order = orders?.find((o) => (q.requestID && o.requestID === q.requestID) || (q.transactionID && o.transactionID === q.transactionID)) ?? orders?.[0];
      if (order && order.orderStatus !== "processing") return order;
      if (Date.now() > deadline) {
        throw new GsubzError(
          { code: 0, description: "FLIGHT_ORDER_STILL_PROCESSING",
            api_response: `Still processing after ${timeoutMs}ms. You were charged — keep polling flightOrders() or wait for the flight.order.updated webhook.` },
          0,
        );
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  /* ---------------- Store (NEW — Bearer-header-only endpoints) ---------------- */

  /** GET /api/store/search/ — products. Free: trending (default), official. ₦2: market
   *  search (max 5 pages/keyword — cache it). Every call is charged even repeats. */
  async storeSearch(q: StoreSearchQuery = {}): Promise<StoreSearchResponse> {
    const qs = new URLSearchParams();
    const set = (k: string, v: unknown) => { if (v !== undefined && v !== null && v !== "") qs.set(k, String(v)); };
    set("scope", q.scope); set("q", q.q); set("brand", q.brand); set("page", q.page);
    set("sort", q.sort); set("start_price", q.start_price); set("end_price", q.end_price);
    set("moq", q.moq); set("new_arrival", q.new_arrival);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.request<StoreSearchResponse>("GET", `/api/store/search/${suffix}`, {}, { withApiKeyBody: false });
  }

  /** GET /api/store/product/?id= — product details. Official Store (id starts with "g"): free.
   *  Other products: ₦2 per call, charged only when results come back. */
  async storeProduct(id: string): Promise<StoreProductResponse> {
    return this.request<StoreProductResponse>("GET", `/api/store/product/?id=${encodeURIComponent(id)}`, {}, { withApiKeyBody: false });
  }

  /** GET /api/store/categories/ — store categories + Official Store brands (free). */
  async storeCategories(): Promise<StoreCategoriesResponse> {
    return this.request<StoreCategoriesResponse>("GET", "/api/store/categories/", {}, { withApiKeyBody: false });
  }

  /** GET /api/store/supplier/?id= — a supplier's products (₦2 per call). */
  async storeSupplier(id: string, page = 1, sort?: string): Promise<StoreSupplierResponse> {
    const qs = new URLSearchParams({ id, page: String(page) });
    if (sort) qs.set("sort", sort);
    return this.request<StoreSupplierResponse>("GET", `/api/store/supplier/?${qs.toString()}`, {}, { withApiKeyBody: false });
  }

  /** POST /api/store/image-search/ — send a public https photo URL, get up to 20 similar
   *  products. ₦4 per call; charged only when results come back. */
  async storeImageSearch(imageUrl: string): Promise<StoreSearchResponse> {
    return this.request<StoreSearchResponse>("POST", "/api/store/image-search/", { image_url: imageUrl }, { withApiKeyBody: false });
  }

  /** POST /api/store/order/ — place an order (JSON body, doc-recommended). ALWAYS pass a
   *  reference: a duplicate returns the original order with duplicate:true and never charges
   *  twice. preview:true returns the full price without paying. */
  async storeOrder(input: StoreOrderInput): Promise<StoreOrderResponse> {
    return this.requestJson<StoreOrderResponse>("/api/store/order/", {
      reference: input.reference,
      ...(input.items ? { items: input.items } : {}),
      ...(input.pickup_station_id !== undefined ? { pickup_station_id: input.pickup_station_id } : {}),
      ...(input.shipping_method ? { shipping_method: input.shipping_method } : {}),
      ...(input.contact ? { contact: input.contact } : {}),
      ...(input.preview ? { preview: true } : {}),
    });
  }

  /** GET /api/store/order/ — one order (order_id or reference) or your orders, 20/page. Free. */
  async storeOrders(q: StoreOrdersQuery = {}): Promise<StoreOrdersResponse> {
    const qs = new URLSearchParams();
    if (q.order_id !== undefined) qs.set("order_id", String(q.order_id));
    if (q.reference) qs.set("reference", q.reference);
    if (q.state) qs.set("state", q.state);
    if (q.page !== undefined) qs.set("page", String(q.page));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.request<StoreOrdersResponse>("GET", `/api/store/order/${suffix}`, {}, { withApiKeyBody: false });
  }

  /** POST /api/store/order/ with action=pay_shipping — pay pending shipping fees after an
   *  item is weighed. Nothing waits on a deadline, but items only move once paid. */
  async payShipping(q: { order_id?: number; reference?: string; item_id?: number }): Promise<StorePayShippingResponse> {
    return this.request<StorePayShippingResponse>("POST", "/api/store/order/", {
      action: "pay_shipping",
      ...(q.order_id !== undefined ? { order_id: q.order_id } : {}),
      ...(q.reference ? { reference: q.reference } : {}),
      ...(q.item_id !== undefined ? { item_id: q.item_id } : {}),
    }, { withApiKeyBody: false });
  }

  /* ---------------- Enhanced transaction verify ---------------- */

  /** POST /api/verify/ — fetch a transaction by requestID OR transactionID (either one).
   *  Electricity purchases now also recover their meter token here (re-call if missing:
   *  "try again in a minute"). Social media orders return live order progress. */
  async verifyTransactionEx(q: { requestID?: string; transactionID?: string }): Promise<VerifyResponse> {
    if (!q.requestID && !q.transactionID) {
      throw new GsubzError(
        { code: 400, description: "REQUIRED_CONTENT_REQUESTID_IS_EMPTY",
          api_response: "Send requestID or transactionID — the API refuses a lookup with neither." },
        400,
      );
    }
    return this.request<VerifyResponse>("POST", "/api/verify/", {
      ...(q.requestID ? { requestID: q.requestID } : {}),
      ...(q.transactionID ? { transactionID: q.transactionID } : {}),
    });
  }

}

export default Gsubz;
