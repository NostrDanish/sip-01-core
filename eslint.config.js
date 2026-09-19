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
      "src/engine/providers/**/*.ts",
      "src/lib/engine/**/*.ts",
      "src/ai/**/*.ts",
      "src/engine/query/**/*.ts",
      "src/engine/votes.ts",
      "src/ai/aiConfig.ts",
      "src/lib/engineConfig.ts",
      "src/federation/**/*.ts",
    ],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/app/profile",
              message:
                "Engine/AI code must not import the app profile. Read host config via getEngineConfig() (src/lib/engineConfig.ts).",
            },
            {
              name: "@/app/dsearchProtocol",
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
            {
              group: ["@/app/**"],
              message:
                "The engine/AI library layer must not import the application plane (src/app/**). Host identity arrives via the engineConfig seam.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "boundaries/engine-hooks",
    // The engine hooks (orchestration + index/trending/stakes reads) get the
    // same constraints as the engine/AI library layer: no UI, no app
    // profile, no app control plane — host identity arrives via the
    // engineConfig seam. `@/hooks/**` is NOT banned here: hooks legitimately
    // compose other hooks (useAppContext & co.).
    // useProviderSearch additionally imports the app moderation set
    // (@/app/moderation + @/app/hooks/useModeration) — the documented
    // cross-layer edge (docs/EXTRACTION-MAP.md, "Known cross-layer edge");
    // it is covered by the dedicated block below while the moderation seam
    // is deferred to the apps/dsearch split.
    files: [
      "src/engine/hooks/useSearchIndexer.ts",
      "src/engine/hooks/useInstantAnswer.ts",
      "src/engine/hooks/useTrendingTerms.ts",
      "src/engine/hooks/useRecentIndexedDocs.ts",
      "src/engine/hooks/useRecentStakes.ts",
      "src/engine/hooks/useMyNode.ts",
      "src/engine/hooks/useNetworkStats.ts",
      "src/engine/hooks/useVotes.ts",
      "src/engine/hooks/useRelayDiscovery.ts",
      "src/engine/hooks/useSearchRelayPool.ts",
      "src/engine/hooks/useSearxngInstances.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/app/profile",
              message:
                "Engine hooks must not import the app profile. Read host config via getEngineConfig() (src/lib/engineConfig.ts).",
            },
            {
              name: "@/app/dsearchProtocol",
              message:
                "Engine hooks must not import an application's control plane (trust root, roles, namespaces).",
            },
          ],
          patterns: [
            {
              group: ["@/components/**"],
              message: "Engine hooks must not import UI components.",
            },
            {
              group: ["@/pages/**"],
              message: "Engine hooks must not import pages.",
            },
            {
              group: ["@/app/**"],
              message:
                "Engine hooks must not import the application plane (src/app/**). Host identity arrives via the engineConfig seam.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "boundaries/engine-hooks-provider-search-exception",
    // The single documented cross-layer edge (docs/EXTRACTION-MAP.md,
    // "Known cross-layer edge"): useProviderSearch (engine orchestrator)
    // reads the owner-signed moderation set via @/app/moderation and
    // @/app/hooks/useModeration. Resolving it cleanly requires a
    // moderation-provider injection point in the engineConfig seam, deferred
    // to the apps/dsearch split. Until then this block keeps every other
    // engine-hook constraint in force for this file (later flat-config
    // blocks override earlier ones, so the bans are restated here).
    files: ["src/engine/hooks/useProviderSearch.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/app/profile",
              message:
                "Engine hooks must not import the app profile. Read host config via getEngineConfig() (src/lib/engineConfig.ts).",
            },
            {
              name: "@/app/dsearchProtocol",
              message:
                "Engine hooks must not import an application's control plane (trust root, roles, namespaces).",
            },
          ],
          patterns: [
            {
              group: ["@/components/**"],
              message: "Engine hooks must not import UI components.",
            },
            {
              group: ["@/pages/**"],
              message: "Engine hooks must not import pages.",
            },
            {
              group: [
                "@/app/reports",
                "@/app/affiliates",
                "@/app/referrals",
                "@/app/hooks/useAdminAccess",
                "@/app/hooks/useAffiliates",
                "@/app/hooks/useReferrals",
                "@/app/hooks/useCachedQueries",
              ],
              message:
                "useProviderSearch may read the app moderation set only (documented cross-layer edge); all other application-plane imports are banned.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "boundaries/core-contracts",
    // Core contracts & infrastructure (PACKAGE_BOUNDARIES.md): generic relay
    // pool/proxy machinery every layer builds on. Adds the app-profile /
    // app-control-plane ban on top of the general lib-no-ui block (whose
    // rule config this replaces for these files — hence the repeated UI
    // bans).
    files: [
      "src/lib/appRelays.ts",
      "src/lib/relayDiscovery.ts",
      "src/lib/searchRelays.ts",
      "src/lib/corsProxy.ts",
    ],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/app/profile",
              message:
                "Core contracts must not import the app profile. Host defaults arrive via the engineConfig seam or explicit parameters.",
            },
            {
              name: "@/app/dsearchProtocol",
              message:
                "Core contracts must not import an application's control plane (trust root, roles, namespaces).",
            },
          ],
          patterns: [
            {
              group: ["@/components/**"],
              message: "Core contracts must not import UI components.",
            },
            {
              group: ["@/pages/**"],
              message: "Core contracts must not import pages.",
            },
            {
              group: ["@/hooks/**"],
              message: "Core contracts must not import React hooks (hooks consume this layer, not vice versa).",
            },
            {
              group: ["@/app/**"],
              message:
                "Core contracts must not import the application plane (src/app/**). Host defaults arrive via the engineConfig seam or explicit parameters.",
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
