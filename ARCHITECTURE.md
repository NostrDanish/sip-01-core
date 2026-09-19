# sip-01-core Architecture

**One sentence:** sip-01-core is the reusable reference implementation of the
[SIP-01 Search Index Protocol](https://github.com/NostrDanish/SIP-01) — the
protocol *software* layer between the specification and any search engine built
on it, packaged as a library.

```
github.com/NostrDanish/SIP-01     ← THE PROTOCOL (spec, wire format, test vectors)
                  │
                  ▼
sip-01-core  (THIS REPO)          ← reference implementation + engine core (library)
                  │
                  ▼
        ┌─────────┼──────────┬─────────────┐
        ▼         ▼          ▼             ▼
     Dsearch   Savedd   0xSearchstr   your engine   ← APPLICATIONS (separate repos)
```

These are three different levels. Do not confuse them:

| Level | Lives in | Changes when |
|---|---|---|
| **Protocol** (wire format, kinds, tags, hashing, normalization, test vectors) | the SIP-01 repo | rarely — a spec revision + `v` tag bump |
| **Core** (reference implementation, contracts, engine, AI layer) | this repo | software releases; may improve without touching the wire format |
| **Application** (branding, trust roots, business logic, pages, deploy config) | Dsearch / Savedd / your repo | whenever the product wants |

Protocol compatibility always takes priority over software architecture.
**sip-01-core version ≠ SIP-01 protocol version** — the core can ship fixes and
features while the wire format (`v: "1"`) stays frozen.

---

## What sip-01-core is NOT

- Not the protocol specification. The spec is the [`SIP-01`](https://github.com/NostrDanish/SIP-01)
  repo; this repo keeps a vendored copy at [`docs/SIP-01.md`](docs/SIP-01.md) for
  convenience. When they disagree, the spec repo wins.
- Not an application. The Dsearch application plane (profile, trust anchors,
  control-plane namespaces, pages, UI kit, deploy config) was **split out of
  this repo** — the extraction program is closed (see
  [`docs/EXTRACTION-MAP.md`](docs/EXTRACTION-MAP.md)). The legacy backend
  (crawlers, relay, abuse API) moved to separate infrastructure repos (M10).
- Not a hosted service. Everything runs client-side + on public Nostr relays.
  The AI/Brave *proxy logic* (`src/ai/engineProxy.ts`,
  `src/engine/providers/braveProxy.ts`) is isomorphic and host-agnostic; the
  secret-holding worker shell belongs to the deploying application.

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
                           (+ STORAGE_KEY_RENAMES: dsearch:* → sip01:* local keys)
    sanitizeUrl.ts / contentType.ts / languageFilter.ts
    engine/observation.ts  observation adapter (indexerSource injected)

src/engine/            the reusable search engine
    providers/types.ts     THE provider contract: SearchProvider / SearchResult /
                           SearchOptions / PrivacyTier — every source implements it
    providers/             15 provider implementations (Nostr-tier + clearnet APIs)
    providers/registry.ts  composable catalog: createProviderRegistry([...])
    query/queryParser.ts   structured query → AST (engine-local, SIP-02 seed)
    query/queryEngine.ts   authoritative local AST evaluation + hard constraints
    query/queryMatch.ts    term matching / word coverage
    query/queryClassify.ts query classification → provider allowlists (privacy routing)
    query/resultRank.ts    coverage re-ranking (replaceable)
    query/calculator.ts    math instant answers
    votes.ts               NIP-25 (kind 7) 👍/👎 reactions on results
    moderation.ts          pure moderation matcher (ModerationSet) — hosts inject
                           a set built from their OWN trust policy; the core
                           ships no trust anchors
    runtime.tsx            EngineRuntime React context: the injection point for
                           privacyMode/autoIndex/disabledProviders/languageFilter/
                           voteWithIdentity + userSigner + moderation
    hooks/                 12 engine hooks (orchestrator, indexer, instant
                           answers, index/trending/stakes reads, …)

src/ai/                AI answer layer
    types.ts               AIProvider contract
    registry.ts            AI_PROVIDERS catalog
    openai-compatible.ts   the one implementation every compatible backend reuses
    aiConfig.ts            credential precedence: user BYOK → engine tier → community
    engineProxy.ts         engine-proxy isomorph (runtime-agnostic, host-agnostic)
    hooks/                 useAIAnswer, useEngineAIStatus

src/index.ts           the public API barrel (library entry point)
src/test/setup.ts      vitest environment setup
docs/SIP-01.md         vendored copy of the spec (canonical: NostrDanish/SIP-01)
```

There is no application plane in this repo. Host identity arrives exclusively
through the seams below.

---

## The five boundaries that matter

1. **`SearchProvider`** (`src/engine/providers/types.ts`) — every source is an
   object with `{ id, name, source, privacy, search(opts) }`. A proprietary
   provider implements this interface and registers through
   `createProviderRegistry()` — no fork, no access to other components'
   internals.
2. **`createProviderRegistry`** (`src/engine/providers/registry.ts`) — the
   plugin seam. Compose the built-ins with closed-source providers, or ship a
   minimal catalog.
3. **`AIProvider`** (`src/ai/types.ts`) — two methods (`models`, `answer`)
   plus endpoint/key metadata. Any OpenAI-compatible backend works via
   `createOpenAICompatibleProvider`; a private AI slots in the same way.
4. **The config seams** (`src/lib/engineConfig.ts` + `src/lib/relayConfig.ts`)
   — the host injects its identity once at bootstrap
   (`configureEngine({ id, search, ai })`,
   `configureRelays({ searchRelays, …, storageKeys })` for default relay pools
   and storage-key names). Engine, AI, and relay internals never import an
   application profile; they read the seams at call time. Neutral, brand-free
   defaults exist until configured — the core hardcodes no relay URLs, no
   trust anchors, and no credentials.
5. **`EngineRuntime`** (`src/engine/runtime.tsx`) — the React injection point
   for the engine hooks: user-tunable behavior (`privacyMode`, `autoIndex`,
   `disabledProviders`, `languageFilter`, `voteWithIdentity`), the host's
   `userSigner` (attributable votes; anonymous per-device signing is the
   built-in default), and the host's `moderation` set. This seam RESOLVES the
   old `useProviderSearch` cross-layer exception (the engine used to read the
   Dsearch owner-signed moderation set directly from the app plane): the
   moderation trust policy is now host-supplied data, not an import.

A sixth, optional contract stays for hosts that deploy a server tier:
**the engine-proxy contract** (`src/ai/engineProxy.ts` +
`src/engine/providers/braveProxy.ts`) — server-side secret injection behind
same-origin `/api/*` routes. The proxy *logic* is isomorphic and
host-agnostic (all defaults are explicit parameters); the worker shell that
holds the secrets belongs to the application's deployment repo.

## Enforced rules (eslint)

`eslint.config.js` makes the layering mechanical (`no-restricted-imports`):

- `src/protocol/**` — **no `@/` imports at all.** Protocol code may only use npm
  packages and relative modules. It must stay byte-compatible with the spec §13
  vectors forever.
- `src/federation/**` — protocol + npm + the two documented shared contracts
  (the `SearchResult` *type* from `engine/providers/types`, and
  `lib/contentType`). Nothing else from engine/ai/lib.
- `src/lib/**` — protocol + federation + npm + the `SearchResult` type. Never
  reaches up into engine or AI internals.
- `src/engine/**` + `src/ai/**` — protocol/federation/lib + npm. The two
  existing engine↔ai cross-imports (`ai/hooks/useAIAnswer` reads the query
  classifier; `engine/providers/brave` reads `ENGINE_AI_BASE`) are documented
  and stay. Shipped code never imports the test harness.

The full block list is documented in [`PACKAGE_BOUNDARIES.md`](PACKAGE_BOUNDARIES.md)
("Enforcement").

If a change needs to cross one of these lines, the architecture is being
changed — do it deliberately, in `PACKAGE_BOUNDARIES.md` first.

---

## Building your own engine

**Path 1 — build on the library:** depend on this repo, call
`configureEngine()` + `configureRelays()` once at bootstrap with your engine
id/relays, wrap your UI in `<EngineRuntimeProvider>` (your settings, your
signer, your moderation set), compose providers via
`createProviderRegistry()`, and render the results of `useProviderSearch`
however you like. You get the SIP-01 index, auto-indexing, privacy routing,
votes, and the AI layer behind stable contracts.

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
