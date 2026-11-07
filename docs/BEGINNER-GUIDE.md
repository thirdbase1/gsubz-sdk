# GSUBZ SDK — The Beginner's Guide

**Everything you need to sell airtime, data, cable TV, electricity, exam pins, eSIMs and more from your own website or app — even if you have never written code before.**

---

## Part 1: What is this thing?

GSUBZ (gsubz.com) is a platform that sells VTU services — airtime, data bundles, DStv/GOtv subscriptions, electricity tokens, exam pins, and more — at wholesale prices.

**The SDK is a toolbox.** Instead of you learning how GSUBZ's servers work (complicated), you install a small package of ready-made code. You just say *what* you want:

```js
await gsubz.buyData({ ... })   // "buy this data bundle"
```

…and the SDK handles *how* (authentication, request formats, error handling, safety checks). Think of it like this:

| Without the SDK | With the SDK |
|---|---|
| Write long, manual HTTP requests | Write one short line |
| Memorize API rules | Rules enforced for you |
| One typo = failed purchase | Errors caught and explained |
| Risk of double-charging customers | Built-in idempotency protection |

---

## Part 2: What can it do?

One package, everything GSUBZ sells:

- 📱 **Airtime** — MTN, Glo, Airtel, 9mobile
- 📶 **Data bundles** — SME, gifting, corporate, all networks
- 📺 **Cable TV** — DStv, GOtv, Startimes (verify smartcard first!)
- ⚡ **Electricity** — prepaid tokens & postpaid bills (verify meter first!)
- 🎓 **Exam pins** — WAEC, JAMB, NECO
- 🌍 **eSIMs** — travel data for 190+ countries
- 💬 **Bulk SMS**
- 🎮 **Game top-ups**
- ✈️ **Flight search & booking**
- 🛒 **Gsubz Store** — physical products
- 💰 **Wallet** — balance, transaction history, refunds

**Helper superpowers** you get for free:
- `findPlan("mtn_sme", "1gb")` — find any data plan by name, no IDs to memorize
- `canAfford()` — check your wallet *before* buying, never get "insufficient balance" mid-purchase
- `verifyCustomer()` — confirm a meter/smartcard/IUC number is real before paying

---

## Part 3: Setup (5 minutes)

### Step 1 — Install

You need [Node.js](https://nodejs.org) installed (the green "LTS" button). Then, in your project folder, run:

```bash
npm install gsubz-sdk
```

### Step 2 — Get your API key

1. Create an account on gsubz.com
2. Fund your wallet (start small — ₦2,000 is plenty for testing)
3. Copy your API key from your dashboard. It looks like: `ap_xxxxxxxxxxxx`

### Step 3 — Connect the key (safely!)

⚠️ **Never paste your API key directly into your code.** Anyone who sees it can spend your wallet. Use a `.env` file instead:

```bash
# .env  (a file named exactly ".env" in your project folder)
GSUBZ_API_KEY=ap_xxxxxxxxxxxx
```

Keep the key safe:
- ✅ Keep it in `.env`
- ✅ Add `.env` to your `.gitignore` file
- ❌ Never commit it to GitHub
- ❌ Never put it in frontend (browser) code

---

## Part 4: Your first program

Create a file called `test.js`:

```js
import Gsubz from "gsubz-sdk";

// Reads GSUBZ_API_KEY from your .env automatically
const gsubz = new Gsubz();

// 1. Check your wallet balance (free)
const balance = await gsubz.getBalance();
console.log(`Wallet balance: ₦${balance.toLocaleString()}`);

// 2. Look up MTN data plans (free — no key needed)
const plans = await gsubz.getPlans("mtn_sme");
for (const p of plans.plans.slice(0, 3)) {
  console.log(`${p.displayName} — ₦${p.api_price}`);
}
```

Run it:

```bash
node test.js
```

**If you see your balance and a list of plans — congratulations, you're connected. 🎉**

> Tip: `getPlans`, `findPlan`, and `esimCountries` are **free** — you can practice with them all day without spending a kobo.

---

## Part 5: Your first real purchase

Let's buy ₦100 airtime for a phone number. One line:

```js
const result = await gsubz.buyAirtime({
  serviceID: "mtn",          // network: mtn | airtel | etisalat (9mobile) | glo
  amount: 100,               // naira (minimum 100)
  phone: "08031234567",      // the number to top up
});
console.log("Status:", result.status);   // e.g. "successful"
```

That's it. Behind the scenes the SDK:
1. Generated a unique **requestID** (idempotency key) for this purchase
2. Attached your API key the correct way
3. Checked the response — a "200 OK" that says FAILED still throws an error, so you never get fooled

### Buying data (the easy way)

```js
// findPlan saves you from memorizing plan IDs:
const plan = await gsubz.findPlan("mtn_sme", "1gb");

const result = await gsubz.buyData({
  serviceID: "mtn_sme",      // mtn_sme | airtel_sme | glo_data | mtn_gifting …
  plan: plan.value,          // the plan "value" from getPlans()
  phone: "08031234567",
});
// Or the one-line shorthand:
// const result = await gsubz.buyDataByPlan("mtn_sme", "1gb", "08031234567");
```

### Cable TV — always verify first

```js
// Step 1: confirm the smartcard is real (free)
const cust = await gsubz.verifyCustomer({
  serviceID: "dstv",
  billersCode: "12345678901",   // the customer's smartcard number
});
console.log(cust);  // shows the customer's name — confirm with them!

// Step 2: only then subscribe
await gsubz.buyCable({
  serviceID: "dstv",            // dstv | gotv | startimes
  customerID: "12345678901",    // the smartcard/IUC number you verified
  variationCode: "dstv-padi",   // package value from getPlans("dstv")
  phone: "08031234567",
});
```

### Electricity — same pattern

```js
const meter = await gsubz.verifyCustomer({ serviceID: "ikeja-electric", billersCode: "1234567890" });
// confirm the meter owner's name, then:
await gsubz.buyElectricity({
  serviceID: "ikeja-electric",  // hyphen or underscore both work
  customerID: "1234567890",     // the meter number you verified
  amount: 2000,
  type: "prepaid",              // prepaid | postpaid
});
```

> **Golden rule: verify → confirm with the customer → buy.** Never skip step 2.

---

## Part 6: Don't lose money — the 4 safety rules

1. **One purchase = one requestID.** The SDK auto-generates them. If a request is ever sent twice (network hiccup), GSUBZ returns the *original* result instead of charging twice. The SDK tells you when that happens (`e.duplicateRequestID`).

2. **HTTP 200 does not mean success.** A purchase can "succeed" at the network level and still be failed. The SDK checks the real `status` and throws a typed `GsubzError` with GSUBZ's own error code — handle it:

```js
try {
  await gsubz.buyAirtime({ serviceID: "mtn", amount: 100, phone: "08031234567" });
  console.log("✅ sent");
} catch (e) {
  if (e.duplicateRequestID) {
    console.log("ℹ️ This was a repeat — original result returned, no double charge.");
  } else {
    console.log("❌ Purchase failed:", e.message, "(code:", e.code + ")");
    // The SDK never auto-retries money movement. Check gsubz.verifyTransaction().
  }
}
```

3. **Timeouts are scary on purpose.** If the connection drops mid-purchase, the SDK throws with an instruction — it never blindly retries a purchase. Use `verifyTransaction()` to find out what actually happened.

4. **Check your wallet before buying:**

```js
if (await gsubz.canAfford(500)) {
  await gsubz.buyData({ serviceID: "mtn_sme", plan, phone });  // safe to buy
}
```

---

## Part 7: The full catalog at a glance

```js
// Wallet & records
await gsubz.getBalance();
await gsubz.verifyTransaction("T123456");

// Networks
await gsubz.buyAirtime({ serviceID, amount, phone });
await gsubz.buyData({ serviceID, plan, mobile, amount });
await gsubz.buyDataByPlan("mtn_sme", "1gb", "08031234567");  // shorthand!

// Utilities
await gsubz.buyCable({ serviceID, billersCode, variation_code, amount });
await gsubz.buyElectricity({ serviceID, billersCode, variation_code, amount });
await gsubz.buyExamPin({ serviceID, amount, quantity });

// Extras
await gsubz.buyEsim(...)          // travel eSIMs
await gsubz.sendSmsOne(...)       // bulk SMS
await gsubz.buyGame(...)          // game top-ups
await gsubz.searchFlights(...)    // flights
await gsubz.storeSearch(...)      // Gsubz Store
```

Every method is documented in the full [README](https://www.npmjs.com/package/gsubz-sdk) and there's an [AI-agent guide](https://github.com/…/docs/AGENT-GUIDE.md) that maps each task → method → cost → traps.

---

## Part 8: Common beginner mistakes

| Mistake | What happens | The fix |
|---|---|---|
| Key pasted in browser code | Strangers drain your wallet | Key only in server-side `.env` |
| Buying before `verifyCustomer` | Wrong meter/smartcard = lost money | Verify → confirm → buy |
| Retrying a failed purchase blindly | Double charge risk | Use `verifyTransaction` first |
| `HTTP 200` treated as success | You tell the customer "done" when it failed | The SDK throws — always use try/catch |
| Testing with your whole wallet | One bug = expensive lesson | Start with ₦100 purchases |

---

## Part 9: Where to go next

- 📖 Full docs: https://www.npmjs.com/package/gsubz-sdk
- 🤖 Building an AI agent on top? Read `docs/AGENT-GUIDE.md` in the package
- 💬 Questions about GSUBZ itself: gsubz.com / their WhatsApp support

**You now know enough to build a real VTU business on top of GSUBZ. Start with the free endpoints, make your first ₦100 purchase, and grow from there.** 🚀
