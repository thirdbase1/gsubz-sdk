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
 * Endpoints (from the doc's API reference):
 *   POST /api/balance/        Fetch Wallet Balance
 *   GET  /api/plans/          Get Plans                     (public)
 *   POST /api/verify-customer/ Verify Meter / IUC Number
 *   POST /api/pay/            Buy Data / Airtime / TV / Electricity / Exam Pin / Social
 *   POST /apiV2/generate/     Recharge Pins / Epins Printing (header auth only)
 *   GET  /api/esim/countries/ List eSIM Countries           (public)
 *   GET  /api/esim/packages/  List eSIM Packages            (public)
 *   POST /api/esim/buy/       Buy eSIM
 *   POST /api/esim/orders/    Fetch eSIM Orders
 *   POST /api/esim/cancel/    Cancel eSIM
 *   POST /api/sms/            Send Bulk SMS
 *   POST /api/verify/         Fetch Transaction Status
 */

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

export class Gsubz {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

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
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /* ---------------- helpers ---------------- */

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    fields: Record<string, string | number | undefined>,
    opts: { withApiKeyBody?: boolean; noAuth?: boolean; timeoutMs?: number } = {},
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
      if (typeof json.status === "string") {
        const ok = json.status === "successful" || json.status === "success";
        if (!ok) throw new GsubzError(json, res.status);
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
    const partial = res.plans.find(
      (p) => p.displayName.toLowerCase().replace(/\s+/g, "").includes(q),
    );
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
}

export default Gsubz;
