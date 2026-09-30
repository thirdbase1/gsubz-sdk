// Post-build: mark the CJS directory as CommonJS so Node resolves it correctly
// even though the package root is "type": "module". Also sanity-check both
// builds really emitted the SDK.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";

const esm = "dist/index.js";
const cjs = "dist/cjs/index.js";
const dts = "dist/index.d.ts";

for (const f of [esm, cjs, dts]) {
  if (!existsSync(f)) {
    console.error(`postbuild: ${f} missing — build incomplete, aborting.`);
    process.exit(1);
  }
}

const esmSrc = readFileSync(esm, "utf8");
if (!esmSrc.includes("export class Gsubz")) {
  console.error("postbuild: dist/index.js does not look like the SDK build.");
  process.exit(1);
}

mkdirSync("dist/cjs", { recursive: true });
writeFileSync("dist/cjs/package.json", JSON.stringify({ type: "commonjs" }, null, 2) + "\n");

console.log("postbuild: ESM + CJS builds verified, dist/cjs/package.json written");
