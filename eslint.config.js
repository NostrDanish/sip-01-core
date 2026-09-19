// @ts-check
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import htmlEslint from "@html-eslint/eslint-plugin";
import customRules from "./eslint-rules/index.js";

export default defineConfig(
  globalIgnores(["dist", ".agents"]),
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
  // ─── Architectural boundaries (import direction) ─────────────────────
  // SIP-01-core is layered: protocol → federation/core → engine/ai → app.
  // These rules make the boundaries mechanical, not social. See
  // PACKAGE_BOUNDARIES.md for the full per-layer contract.
  // ─── Architectural boundaries (import direction) ─────────────────────
  // SIP-01-core is layered: protocol → federation/core → engine/ai → app.
  // These rules make the boundaries mechanical, not social. Flat-config
  // ordering matters: when several blocks match a file, the LATER block's
  // rule wins — so blocks run general → specific below.
  // See PACKAGE_BOUNDARIES.md for the full per-layer contract.
  {
    name: "boundaries/lib-no-ui",
    // Nothing in the library layer may reach into the UI layer.
    // (privacy.test.ts intentionally exercises a component — tests exempt.)
    files: ["src/lib/**/*.ts", "src/lib/**/*.tsx"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/**"],
              message: "Library code must not import UI components.",
            },
            {
              group: ["@/pages/**"],
              message: "Library code must not import pages.",
            },
            {
              group: ["@/hooks/**"],
              message: "Library code must not import React hooks (hooks consume this layer, not vice versa).",
            },
          ],
        },
      ],
    },
  },
  {
    name: "boundaries/engine-and-ai",
    // The reusable engine + AI + relay machinery: no UI, no app profile, no
    // app control plane. Host identity arrives via the engineConfig seam.
    // (This block repeats the UI bans because its rule config replaces the
    // general lib block's for these files.)
    files: [
      "src/lib/providers/**/*.ts",
      "src/lib/engine/**/*.ts",
      "src/lib/ai/**/*.ts",
      "src/lib/queryParser.ts",
      "src/lib/queryEngine.ts",
      "src/lib/queryMatch.ts",
      "src/lib/queryClassify.ts",
      "src/lib/resultRank.ts",
      "src/lib/calculator.ts",
      "src/lib/votes.ts",
      "src/lib/searxngInstances.ts",
      "src/lib/aiConfig.ts",
      "src/lib/engineConfig.ts",
      "src/lib/termSignals.ts",
      "src/lib/keywordStakes.ts",
      "src/lib/communityIndex.ts",
      "src/lib/searchIndex.ts",
    ],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/engine/profile",
              message:
                "Engine/AI code must not import the app profile. Read host config via getEngineConfig() (src/lib/engineConfig.ts).",
            },
            {
              name: "@/lib/dsearchProtocol",
              message:
                "Engine/AI code must not import an application's control plane (trust root, roles, namespaces).",
            },
          ],
          patterns: [
            {
              group: ["@/components/**"],
              message: "The engine/AI library layer must not import UI components.",
            },
            {
              group: ["@/pages/**"],
              message: "The engine/AI library layer must not import pages.",
            },
            {
              group: ["@/hooks/**"],
              message: "The engine/AI library layer must not import React hooks (hooks consume this layer, not vice versa).",
            },
          ],
        },
      ],
    },
  },
  {
    name: "boundaries/protocol",
    // The SIP-01 reference layer: byte-critical protocol code. It must never
    // import application code — only npm packages and relative modules.
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
    name: "app/html",
    files: ["**/*.html"],
    extends: [htmlEslint.configs["flat/recommended"]],
    plugins: {
      custom: customRules,
    },
    rules: {
      "@html-eslint/require-meta-description": "error",
      "@html-eslint/require-meta-viewport": "error",
      "@html-eslint/require-open-graph-protocol": [
        "error",
        ["og:type", "og:title", "og:description"],
      ],
      // The manifest link below intentionally uses `rel="manifest"`; the
      // baseline data currently flags this attribute value as not widely
      // available, which is a false positive for our use case.
      "@html-eslint/use-baseline": "off",
      "custom/no-inline-script": "error",
      "custom/require-webmanifest": "error",
    },
  },
);
