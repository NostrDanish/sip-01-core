# SIP-01-core Architecture

**One sentence:** SIP-01-core is the reusable reference implementation of the
[SIP-01 Search Index Protocol](https://github.com/NostrDanish/SIP-01) — the
protocol *software* layer between the specification and any search engine built
on it.

```
github.com/NostrDanish/SIP-01     ← THE PROTOCOL (spec, wire format, test vectors)
                  │
                  ▼
sip-01-core  (THIS REPO)          ← reference implementation + engine core
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

src/federation/        shared 0xsearchstr:* event contracts (frozen namespaces)
    searchIndex.ts         legacy 0xsearchstr:cache:* (read-only)
    communityIndex.ts      0xsearchstr:submit:* + Nostra + NIP-B0 interop
    keywordStakes.ts       0xsearchstr:stake:*
    termSignals.ts         0xsearchstr:term:* k-anonymity trending

src/lib/               core contracts + shared machinery
    engineConfig.ts        THE SEAM: configureEngine()/getEngineConfig()
    relayConfig.ts         THE RELAY SEAM: configureRelays()/getRelayConfig()
    appRelays.ts           generic relay pool machinery (defaults via relayConfig)
    searchRelays.ts        relay connection cache + pool query/publish helpers
    relayUrls.ts           relay URL normalization (leaf)
    relayDiscovery.ts      NIP-66/NIP-11 relay auto-discovery (uncaged_index aware)
    corsProxy.ts           CORS proxy pool with failover
    storageMigration.ts    namespaced localStorage read-through migration
    sanitizeUrl.ts / contentType.ts / languageFilter.ts
    engine/observation.ts  observation adapter (indexerSource injected)

src/engine/            the reusable search engine
    providers/types.ts     THE provider contract: SearchProvider / SearchResult /
                           SearchOptions / PrivacyTier — every source implements it
    providers/             15 provider implementations (Nostr-tier + clearnet APIs)
    providers/registry.ts  composable catalog: createProviderRegistry([...])
    query/queryParser.ts   structured query → AST ("Dsearch-local" today, SIP-02 seed)
    query/queryEngine.ts   authoritative local AST evaluation + hard constraints
    query/queryMatch.ts    term matching / word coverage
    query/queryClassify.ts query classification → provider allowlists (privacy routing)
    query/resultRank.ts    coverage re-ranking (replaceable)
    query/calculator.ts    math instant answers
    votes.ts               NIP-25 (kind 7) 👍/👎 reactions on results
    hooks/                 12 engine hooks (orchestrator, indexer, instant
                           answers, index/trending/stakes reads, …)

src/ai/                AI answer layer
    types.ts               AIProvider contract
    registry.ts            AI_PROVIDERS catalog
    openai-compatible.ts   the one implementation every compatible backend reuses
    aiConfig.ts            credential precedence: user BYOK → engine tier → community
    engineProxy.ts         engine-proxy isomorph (worker-shared, host-agnostic)
    hooks/                 useAIAnswer, useEngineAIStatus

src/app/               the Dsearch application plane
    profile.ts             DSEARCH_PROFILE (branding, tabs, providers, community
                           AI config + PPQ invite) — the EngineProfile instance
    relayConfig.ts         DSEARCH_RELAY_CONFIG (default pools + dsearch:* keys)
    dsearchProtocol.ts     OWNER_PUBKEY, roles, dsearch:* control-plane namespaces
    moderation.ts / reports.ts / affiliates.ts / referrals.ts
    hooks/                 app-plane hooks (moderation, admin access, referrals…)

src/hooks/             remaining app-level React bindings (auth, theme, nostr)
src/components/        reusable UI kit (template) + app-specific components
src/pages/             the Dsearch application's pages
worker.ts              thin Cloudflare Worker shell: /api/ai/* + /api/search/brave
                       (secrets injected server-side; imports the app profile)
backend/               legacy self-hosted Meilisearch stack (superseded,
                       disconnected from the build; future home = M10 decision)
docs/SIP-01.md         vendored copy of the spec (canonical: NostrDanish/SIP-01)
```

The physical moves into `src/protocol/`, `src/federation/`, `src/engine/`,
`src/ai/`, and `src/app/` are complete (M1–M9; see
[`docs/EXTRACTION-MAP.md`](docs/EXTRACTION-MAP.md)) and the separation is
lint-enforced (below). What remains is the *apps split*: moving the Dsearch
application plane out of this repo entirely.

---

## The five boundaries that matter

1. **`SearchProvider`** (`src/engine/providers/types.ts`) — every source is an
   object with `{ id, name, source, privacy, search(opts) }`. A proprietary
   provider implements this interface and registers through
   `createProviderRegistry()` — no fork, no access to other components'
   internals.
2. **`createProviderRegistry`** (`src/engine/providers/registry.ts`) — the
   plugin seam. Compose the built-ins with closed-source providers, or ship a
   minimal catalog. The default export set is unchanged for this app.
3. **`AIProvider`** (`src/ai/types.ts`) — two methods (`models`, `answer`)
   plus endpoint/key metadata. Any OpenAI-compatible backend works via
   `createOpenAICompatibleProvider`; a private AI slots in the same way.
4. **The config seams** (`src/lib/engineConfig.ts` + `src/lib/relayConfig.ts`)
   — the host app injects its identity once at bootstrap
   (`configureEngine({ id, search, ai })`,
   `configureRelays(DSEARCH_RELAY_CONFIG)` for default relay pools and
   storage-key names). Engine, AI, and relay internals never import an
   application profile; they read the seams at call time. Neutral, brand-free
   defaults exist until configured.
5. **The worker proxy contract** (`worker.ts` + `src/ai/engineProxy.ts` +
   `src/engine/providers/braveProxy.ts`) — server-side secret injection behind
   same-origin `/api/*` routes. The proxy *logic* is isomorphic and host-agnostic
   (all defaults are explicit parameters); the worker shell is the app deployment.

## Enforced rules (eslint)

`eslint.config.js` makes the layering mechanical (`no-restricted-imports`):

- `src/protocol/**` — **no `@/` imports at all.** Protocol code may only use npm
  packages and relative modules. It must stay byte-compatible with the spec §13
  vectors forever.
- engine/AI/federation/core-contracts library set — no UI (`components/`,
  `pages/`), no React hooks, **no `@/app/profile`** (the app profile), **no
  `@/app/dsearchProtocol`** (the app control plane), no `@/app/**` at all.
- engine hooks (`src/engine/hooks/`) — same bans, except hooks may compose
  other hooks. **One documented exception:** `useProviderSearch` reads the
  app moderation set (`@/app/moderation`) — pinned by its own eslint block
  and tracked in the extraction map.
- all of `src/lib/**` — never imports UI or hooks.

The full block list is documented in [`PACKAGE_BOUNDARIES.md`](PACKAGE_BOUNDARIES.md)
("Enforcement").

If a change needs to cross one of these lines, the architecture is being
changed — do it deliberately, in `PACKAGE_BOUNDARIES.md` first.

---

## Building your own engine

**Path 1 — fork the stack:** clone, replace `src/app/profile.ts` with your own
`EngineProfile` (branding, tabs, providers, AI prompt) and `src/app/relayConfig.ts`
with your relay pools, call `configureEngine()` + `configureRelays()` at
bootstrap, compose providers via `createProviderRegistry()`, delete the pages
you don't want. You get the SIP-01 index, auto-indexing, privacy routing, and
the UI kit for free.

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
