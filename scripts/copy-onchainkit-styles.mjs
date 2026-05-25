/**
 * Copies OnchainKit's prebuilt stylesheet to public/ so it can be loaded via
 * a <link> tag in index.html. The OnchainKit CSS contains empty `@layer base`
 * blocks that trip Tailwind v3's PostCSS plugin when imported through the
 * normal CSS pipeline, so we serve it as a plain static asset instead.
 */

import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "node_modules/@coinbase/onchainkit/dist/assets/style.css");
const dest = resolve(root, "public/onchainkit-styles.css");

if (!existsSync(src)) {
  console.error(
    `[onchainkit-styles] source not found: ${src}\n` +
      `Run \`npm install\` first.`
  );
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
const sizeKb = (statSync(dest).size / 1024).toFixed(1);
console.log(`[onchainkit-styles] copied to public/onchainkit-styles.css (${sizeKb} KB)`);
