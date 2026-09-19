# SIP-01-core Architecture

**One sentence:** SIP-01-core is the reusable reference implementation of the
[SIP-01 Search Index Protocol](https://github.com/NostrDanish/SIP-01) — the
protocol *software* layer between the specification and any search engine built
on it.

```
github.com/NostrDanish/SIP-01          ← THE PROTOCOL (spec, wire format, test vectors)
                  │
                  ▼
github.com/NostrDanish/sip-01-core     ← THIS REPO (reference implementation + engine core)
                  │
                  ▼
        ┌─────────┼──────────┬─────────────┐
        ▼         ▼          ▼             ▼
     Dsearch   Savedd   0xSearchstr   your engine   ← APPLICATIONS
```

These are three different levels. Do not confuse them:

| Level | Lives in | Changes when |
|---|---|---|
| **Protocol** (wire format, kinds, tags, hashing, normalization, test vectors) | the SIP-01 repo | rarely — a spec revision + `v` tag bump |
| **Core** (reference implementation, contracts, engine, AI layer, template) | this repo | software releases; may improve without touching the wire format |
| **Application** (branding, trust roots, business logic, pages, deploy config) | Dsearch / Savedd / your repo | whenever the product wants |

Protocol compatibility always takes priority over software architecture.
**sip-01-core version ≠ SIP-01 protocol version** — the core can ship fixes and
features while the wire format (`v: "1"`) stays frozen.

---

## What SIP-01-core is NOT

- Not the protocol specification. The spec is the [`SIP-01`](https://github.com/NostrDanish/SIP-01)
  repo; this repo keeps a vendored copy at [`docs/SIP-01.md`](docs/SIP-01.md) for
  convenience. When they disagree, the spec repo wins.
- Not "Dsearch renamed." Dsearch-specific branding, trust roots, control-plane
  namespaces, business logic, and pages live in the application layer and are
  being isolated (see [`docs/EXTRACTION-MAP.md`](docs/EXTRACTION-MAP.md)).
- Not a hosted service. Everything runs client-side + on public Nostr relays;
  the only optional server piece is a thin secret-injecting proxy (`worker.ts`).

---

## Layers (as they exist in this repo today)

```
src/protocol/          SIP-01 v1.2 reference implementation — byte-critical
    webIndex.ts            kind 39697 build/parse/verify, §7 normalization, §3/§8 hashing
    indexerIdentity.ts     §14 per-device pseudonymous indexer keys
    *.test.ts              §13 spec test vectors + identity tests (45 tests)

src/lib/               contracts + shared machinery (the future "core" packages)
    providers/types.ts     THE provider contract: SearchProvider / SearchResult /
                           SearchOptions / PrivacyTier — every source implements it
    providers/             15 provider implementations (Nostr-tier + clearnet APIs)
    providers/registry.ts  composable catalog: createProviderRegistry([...])
    queryParser.ts         structured query → AST ("Dsearch-local" today, SIP-02 seed)
    queryEngine.ts         authoritative local AST evaluation + hard constraints
    queryMatch.ts          term matching / word coverage
    queryClassify.ts       query classification → provider allowlists (privacy routing)
    resultRank.ts          coverage re-ranking (replaceable)
    calculator.ts          math instant answers
    engineConfig.ts        THE SEAM: configureEngine()/getEngineConfig()
    searchRelays.ts        relay connection cache + pool query/publish helpers
    relayUrls.ts           relay URL normalization (leaf)
    relayDiscovery.ts      NIP-66/NIP-11 relay auto-discovery (uncaged_index aware)
    appRelays.ts           relay pool configuration (mixed: machinery + app defaults)
    corsProxy.ts           CORS proxy pool with failover
    storageMigration.ts    namespaced localStorage read-through migration
    searchIndex.ts         FEDERATION: legacy 0xsearchstr:cache:* (read-only)
    communityIndex.ts      FEDERATION: 0xsearchstr:submit:* + Nostra + NIP-B0 interop
    keywordStakes.ts       FEDERATION: 0xsearchstr:stake:*
    termSignals.ts         FEDERATION: 0xsearchstr:term:* k-anonymity trending
    ai/                    AI answer layer: AIProvider contract, OpenAI-compatible
                           implementation, engine-proxy isomorph (worker-shared)
    aiConfig.ts            credential precedence: user BYOK → engine tier → community
    engine/                engine profile TYPES + observation adapter
                           (profile INSTANCE = Dsearch, moving to the app layer)

src/hooks/             React bindings (orchestrator, indexer, instant answers, …)
src/components/        reusable UI kit (template) + app-specific components
src/pages/             the Dsearch application's pages
worker.ts              thin Cloudflare Worker shell: /api/ai/* + /api/search/brave
                       (secrets injected server-side; imports the app profile)
backend/               legacy self-hosted Meilisearch stack (superseded, frozen)
```

The physical move into `src/engine/`, `src/ai/`, `src/app/` subtrees is staged
and documented in [`docs/EXTRACTION-MAP.md`](docs/EXTRACTION-MAP.md). The
*logical* separation is already real and lint-enforced (below).

---

## The five boundaries that matter

1. **`SearchProvider`** (`src/lib/providers/types.ts`) — every source is an object
   with `{ id, name, source, privacy, search(opts) }`. A proprietary provider
   implements this interface and registers through `createProviderRegistry()` —
   no fork, no access to other components' internals.
2. **`createProviderRegistry`** (`src/lib/providers/registry.ts`) — the plugin
   seam. Compose the built-ins with closed-source providers, or ship a minimal
   catalog. The default export set is unchanged for this app.
3. **`AIProvider`** (`src/lib/ai/types.ts`) — 4 methods (`models`, `answer` …).
   Any OpenAI-compatible backend works; a private AI slots in the same way.
4. **`engineConfig` seam** (`src/lib/engineConfig.ts`) — the host app injects its
   identity once at bootstrap (`configureEngine({ id, search, ai })`). Engine and
   AI internals never import an application profile; they read the seam at call
   time. Neutral, brand-free defaults exist until configured.
5. **The worker proxy contract** (`worker.ts` + `src/lib/ai/engineProxy.ts` +
   `src/lib/providers/braveProxy.ts`) — server-side secret injection behind
   same-origin `/api/*` routes. The proxy *logic* is isomorphic and host-agnostic
   (all defaults are explicit parameters); the worker shell is the app deployment.

## Enforced rules (eslint)

`eslint.config.js` makes the layering mechanical (`no-restricted-imports`):

- `src/protocol/**` — **no `@/` imports at all.** Protocol code may only use npm
  packages and relative modules. It must stay byte-compatible with the spec §13
  vectors forever.
- engine/AI/federation library set — no UI (`components/`, `pages/`), no React
  hooks, **no `@/lib/engine/profile`** (the app profile), **no
  `@/lib/dsearchProtocol`** (the app control plane).
- all of `src/lib/**` — never imports UI or hooks.

If a change needs to cross one of these lines, the architecture is being
changed — do it deliberately, in `PACKAGE_BOUNDARIES.md` first.

---

## Building your own engine

**Path 1 — fork the stack:** clone, write your `EngineProfile` (branding, tabs,
providers, AI prompt), call `configureEngine()` at bootstrap, compose providers
via `createProviderRegistry()`, delete the pages you don't want. You get the
SIP-01 index, auto-indexing, privacy routing, and the UI kit for free.

**Path 2 — protocol-only:** depend on nothing here. Implement from the spec
(`docs/SIP-01.md`), prove byte-compatibility against the §13 vectors (run
`src/protocol/webIndex.test.ts`-equivalent), publish conformant kind 39697
events. You are SIP-01-compatible without this codebase.

**Path 3 — core + closed parts:** use the open protocol/core/engine layers and
keep your ranking, AI, crawler, datasets, and UI proprietary. The interfaces
above are the only touchpoints. (License terms for each layer are a pending
project decision — see the README note; do not assume.)

## Staying SIP-01 compatible

- Never change `normalizeIndexUrl` / `documentId` / `contentHash` behavior —
  the §13 vectors pin them byte-for-byte.
- Never rename the federation namespaces (`0xsearchstr:*` kinds/tags) — they are
  the shared contract with 0xSearchstr and every compatible fork.
- `v` stays `"1"` until the spec itself bumps the schema.
- Extension tags: experiment with `x-` prefixes; register via a spec PR (§9).

---

*Vibed with [Shakespeare](https://shakespeare.diy)*
