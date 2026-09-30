/**
 * Live smoke test against the real GSUBZ API — only the PUBLIC endpoints,
 * so it needs no key and spends no money:
 *
 *   npm run example:live
 *
 * Purchase endpoints are NOT exercised here on purpose: they cost real
 * naira. Use test/contract.test.mjs (offline mock) for full coverage.
 */
import Gsubz from "../dist/index.js";

const gsubz = new Gsubz({ apiKey: "ap_not-needed-for-public-endpoints" });

console.log("1. Plans for mtn_sme (public, no key):");
const plans = await gsubz.getPlans("mtn_sme");
console.log(`   ${plans.plans.length} plans. Cheapest first:`);
for (const p of plans.plans.slice(0, 3)) {
  console.log(`   - ${p.displayName}  ₦${p.api_price}  (value: ${p.value})`);
}

console.log("\n2. Find a plan by name:");
const gb = await gsubz.findPlan("mtn_sme", "1gb");
console.log(`   findPlan("mtn_sme", "1gb") → ${gb.displayName}, value ${gb.value}`);

console.log("\n3. eSIM countries (public):");
const { countries } = await gsubz.esimCountries();
console.log(`   ${countries.length} countries. First: ${countries[0].country}`);

console.log("\n4. Packages for the first country:");
const code = countries[0].locationCodes.split(",")[0].trim();
const { packages } = await gsubz.esimPackages(code);
console.log(`   ${code}: ${packages.length} packages. First: ${packages[0]?.name ?? "none"}`);

console.log("\n5. Typed errors — a bad key on a protected endpoint:");
try {
  await gsubz.getBalance();
  console.log("   (unexpected: balance worked with a fake key)");
} catch (e) {
  console.log(`   GsubzError { code: ${e.code}, description: ${e.description} }`);
}

console.log("\nAll public checks passed. Purchases (buyData, buyEsim, …) are covered");
console.log("by the offline contract tests — run `npm test`.");
