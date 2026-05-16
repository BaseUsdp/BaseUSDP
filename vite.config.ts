import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Required by @veil-cash/sdk (uses Node built-ins like fs, path, url, crypto).
    // Browser-side proof generation still needs work, but this lets the bundle
    // build and the deposit / read-only flows run.
    nodePolyfills({
      include: ["buffer", "crypto", "path", "fs", "url", "stream", "events", "http", "https", "zlib", "assert", "util"],
      globals: { Buffer: true, global: true, process: true },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
