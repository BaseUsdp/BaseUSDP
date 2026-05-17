import { cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "node_modules/@veil-cash/sdk/keys");
const dest = resolve(root, "public/veil-keys");

if (!existsSync(src)) {
  console.error(
    `[veil-keys] source not found: ${src}\n` +
      `Run \`npm install\` first — @veil-cash/sdk ships proving keys under keys/.`
  );
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

const expected = [
  "transaction2.wasm",
  "transaction2.zkey",
  "transaction16.wasm",
  "transaction16.zkey",
];
const sizes = expected.map((f) => {
  const p = resolve(dest, f);
  if (!existsSync(p)) {
    console.error(`[veil-keys] missing after copy: ${f}`);
    process.exit(1);
  }
  return `${f} (${(statSync(p).size / 1024 / 1024).toFixed(1)} MB)`;
});
console.log(`[veil-keys] copied to public/veil-keys/: ${sizes.join(", ")}`);
