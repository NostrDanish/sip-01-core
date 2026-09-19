import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// sip-01-core builds as a LIBRARY (ES module, src/index.ts entry).
// Host applications supply the React/Nostr stack — every runtime
// dependency is external and declared as a peer dependency.
const EXTERNAL = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "@tanstack/react-query",
  "@nostrify/nostrify",
  "@nostrify/react",
  "nostr-tools",
];

// https://vitejs.dev/config/
export default defineConfig(() => ({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "sip-01-core.js",
    },
    rollupOptions: {
      external: (id) =>
        EXTERNAL.some((name) => id === name || id.startsWith(`${name}/`)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/{vite,eslint}.config.*',
    ],
    env: {
      DEBUG_PRINT_LIMIT: '0', // Suppress DOM output that exceeds AI context windows
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
