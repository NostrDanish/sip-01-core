// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import customRules from "./eslint-rules/index.js";

export default defineConfig(
  globalIgnores(["dist"]),
  {
    name: "app/ts",
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    plugins: {
      custom: customRules,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "custom/no-placeholder-comments": "error",
      "no-warning-comments": ["error", { terms: ["fixme"] }],
    },
  },
  {
    name: "lib/engine-runtime",
    // The engine runtime module intentionally co-exports the provider
    // component, the hook, and the defaults (a context module) —
    // fast-refresh component-only export rules don't apply to a library
    // context module.
    files: ["src/engine/runtime.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  // ─── Architectural boundaries (import direction) ─────────────────────
  // sip-01-core is layered: protocol → federation → lib (core contracts)
  // → engine/ai. The application plane was removed; these rules keep the
  // remaining boundaries mechanical, not social. Flat-config ordering
  // matters: when several blocks match a file, the LATER block's rule
  // wins — so blocks run general → specific below.
  // See PACKAGE_BOUNDARIES.md for the full per-layer contract.
  {
    name: "boundaries/protocol",
    // The SIP-01 reference layer: byte-critical protocol code. It must
    // never import application code — only npm packages and relative
    // modules.
    files: ["src/protocol/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/",
              message:
                "The SIP-01 protocol layer (src/protocol) must not import application code. Keep it app-pure: npm packages and relative imports only.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "boundaries/federation",
    // The federation layer (shared, frozen 0xsearchstr:* contract) sits
    // directly on the protocol layer. It may additionally use the two
    // documented shared contracts: the SearchResult TYPE
    // (engine/providers/types) and the contentType helpers (lib/contentType).
    files: ["src/federation/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/engine/(?!providers/types$)",
              message:
                "The federation layer may import only the SearchResult type from the engine (engine/providers/types); everything else is off-limits.",
            },
            {
              group: ["@/ai/**"],
              message: "The federation layer must not import the AI layer.",
            },
            {
              regex: "^@/lib/(?!contentType$)",
              message:
                "The federation layer may import only lib/contentType from the core contracts.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "boundaries/lib",
    // Core contracts & infrastructure: generic relay pool/proxy/config
    // machinery. Sits on protocol + federation (+ the SearchResult type);
    // never reaches UP into engine or AI internals.
    files: ["src/lib/**/*.ts", "src/lib/**/*.tsx"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^@/engine/(?!providers/types$)",
              message:
                "Core contracts may import only the SearchResult type from the engine (engine/providers/types); engine internals are off-limits.",
            },
            {
              group: ["@/ai/**"],
              message: "Core contracts must not import the AI layer.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "boundaries/engine-and-ai",
    // Engine + AI sit on protocol/federation/lib. Cross-imports between
    // engine and ai exist today (ai/hooks/useAIAnswer reads the query
    // classifier; engine/providers/brave reads ENGINE_AI_BASE) and stay —
    // see PACKAGE_BOUNDARIES.md. Shipped library code never imports the
    // test harness.
    files: ["src/engine/**/*.ts", "src/engine/**/*.tsx", "src/ai/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/test/**"],
              message: "Shipped library code must not import the test harness.",
            },
          ],
        },
      ],
    },
  },
);
