# Architecture

How sip-01-core is layered, what lives in each layer, and how the eslint-enforced boundaries keep the protocol byte-compatible while the engine evolves. This page condenses [`ARCHITECTURE.md`](../ARCHITECTURE.md) and [`PACKAGE_BOUNDARIES.md`](../PACKAGE_BOUNDARIES.md) at the repo root — those two files are the authoritative versions.

## Three levels, not one

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

| Level | Lives in | Changes when |
|---|---|---|
| **Protocol** (wire format, kinds, tags, hashing, normalization, test vectors) | the SIP-01 repo | rarely — a spec revision + `v` tag bump |
| **Core** (reference implementation, contracts, engine, AI layer) | this repo | software releases; may improve without touching the wire format |
| **Application** (branding, trust roots, business logic, pages, deploy config) | your repo | whenever the product wants |

Protocol compatibility always takes priority over software architecture. The core can ship fixes and features while the wire format (`v: "1"`) stays frozen.

## The layer model

```
src/protocol/          SIP-01 v1.2 reference implementation — byte-critical
src/federation/        shared 0xsearchstr:* event contracts (frozen namespaces)
src/lib/               core contracts + relay/proxy machinery (config seams)
src/engine/            providers + query/rank stack + votes + moderation + hooks
src/ai/                AIProvider contract + OpenAI-compatible layer
src/index.ts           the public API barrel (library entry point)
```

Dependency direction: `engine`/`ai` → `lib` → `federation` → `protocol`. Lower layers never import from higher ones.

### `src/protocol/` — SIP-01 reference implementation

| | |
|---|---|
| Contents | `webIndex.ts` (kind 39697 build/parse/verify, §7 normalization, §3/§8 hashing), `indexerIdentity.ts` (§14 per-device pseudonymous indexer keys), tests pinning spec §13 vectors |
| May depend on | npm packages, Web Crypto, relative modules — **no `@/` imports at all** |
| Stability | **protocol-critical**: byte-compat with the spec forever |

### `src/federation/` — shared `0xsearchstr:*` contract

| | |
|---|---|
| Contents | `searchIndex.ts` (legacy `0xsearchstr:cache:*`, read-only), `communityIndex.ts` (`0xsearchstr:submit:*` + Nostra + NIP-B0 interop), `keywordStakes.ts` (`0xsearchstr:stake:*`), `termSignals.ts` (`0xsearchstr:term:*` k-anonymity trending) |
| May depend on | protocol + npm + two documented shared contracts (the `SearchResult` *type*, `lib/contentType`) |
| Stability | **protocol-critical (frozen)** — renaming a namespace forks the network. Never rename; extend only via new tags/kinds. |

### `src/lib/` — core contracts and infrastructure

`engineConfig.ts` and `relayConfig.ts` are **the seams** (`configureEngine()`/`configureRelays()` — see [Relays and configuration](guides/relays-and-config.md)). The rest is host-agnostic machinery: `appRelays.ts` (relay pool helpers), `searchRelays.ts` (connection cache + pool query/publish), `relayUrls.ts` (URL normalization leaf), `relayDiscovery.ts` (NIP-66/NIP-11 discovery, `uncaged_index` aware), `corsProxy.ts` (proxy pool with failover), `storageMigration.ts` (namespaced localStorage read-through migration, including the `dsearch:*` → `sip01:*` renames), `sanitizeUrl.ts`, `contentType.ts`, `languageFilter.ts`, and `engine/observation.ts` (the SearchResult → observation adapter with injected `indexerSource`). May depend on protocol + federation; never reaches up into engine or AI internals.

### `src/engine/` — the reusable search engine

- `providers/types.ts` — **the provider contract**: `SearchProvider` / `SearchResult` / `SearchOptions` / `PrivacyTier`. Every source implements it.
- `providers/` — 15 built-in providers plus `registry.ts` (`createProviderRegistry`, the plugin seam). See [Search providers](guides/search-providers.md).
- `query/` — the query/rank stack: `queryParser.ts` (structured query → AST), `queryEngine.ts` (authoritative local evaluation + hard constraints), `queryClassify.ts` (query classification → provider allowlists), `queryMatch.ts`, `resultRank.ts` (replaceable coverage re-ranking), `calculator.ts`. See [Query syntax](guides/query-syntax.md).
- `votes.ts` — NIP-25 (kind 7) votes.
- `moderation.ts` — the **pure** moderation matcher (`ModerationSet`, `toModerationSet`, `isHiddenResult`). No trust policy lives here.
- `runtime.tsx` — `EngineRuntime`, the React injection point (below).
- `hooks/` — 12 orchestration/read hooks (`useProviderSearch`, `useSearchIndexer`, `useInstantAnswer`, `useVotes`, index/trending/stakes/network reads, relay pool UIs).

### `src/ai/` — the AI answer layer

`types.ts` (the `AIProvider` contract), `registry.ts` (the `AI_PROVIDERS` catalog), `openai-compatible.ts` (the one implementation every compatible backend reuses), `aiConfig.ts` (credential precedence: user BYOK → engine tier → community → unavailable), `engineProxy.ts` (the runtime-agnostic engine-proxy isomorph), `engineAdmin.ts`, `prompts.ts`, and hooks (`useAIAnswer`, `useEngineAIStatus`). See [AI answers](guides/ai-answers.md).

## Enforced rules (eslint)

`eslint.config.js` makes the layering mechanical via `no-restricted-imports` blocks (`boundaries/*`); the lint step of the test gate fails if a change crosses a line:

- `boundaries/protocol` — `src/protocol/**` may not import **any** `@/` module.
- `boundaries/federation` — `src/federation/**` imports protocol + npm + the two documented shared contracts only.
- `boundaries/lib` — `src/lib/**` imports protocol + federation + npm + the `SearchResult` type; never engine internals or the AI layer.
- `boundaries/engine-and-ai` — `src/engine/**` + `src/ai/**` sit on protocol/federation/lib + npm. Two documented engine↔ai cross-imports exist and stay (`ai/hooks/useAIAnswer` reads the query classifier; `engine/providers/brave` reads `ENGINE_AI_BASE`). Shipped code never imports the test harness.

If a change needs to cross one of these lines, the architecture is being changed — do it deliberately, in `PACKAGE_BOUNDARIES.md` first.

## The EngineRuntime injection seam

There is no application plane in this repo, so host identity arrives exclusively through seams:

1. `configureEngine()` — engine id, indexer software id (the SIP-01 `source` tag), Brave tier flag, AI defaults. Once, at bootstrap.
2. `configureRelays()` — default relay pools + localStorage key names, with optional legacy-key migration.
3. `createProviderRegistry([...])` — compose any provider set, including closed-source ones.
4. `AIProvider` — two methods plus endpoint/key metadata; any OpenAI-compatible backend works via `createOpenAICompatibleProvider`.
5. `<EngineRuntimeProvider>` — the React runtime for the engine hooks: `privacyMode`, `autoIndex`, `disabledProviders`, `languageFilter`, `voteWithIdentity`, the host's `userSigner`, and the host's `moderation` set. Every field is optional; hooks work with no provider at all via `DEFAULT_ENGINE_RUNTIME`.

**How this replaced the old app coupling:** before the extraction, the engine orchestrator (`useProviderSearch`) imported the Dsearch owner-signed moderation set directly from the application plane — a cross-layer edge that made the core unusable without the app. The extraction resolved it by splitting moderation into a pure matcher (`src/engine/moderation.ts`, no trust anchors) plus host-supplied data (`EngineRuntime.moderation`). The same pattern — a config seam or injected value instead of an import — is how every other piece of host identity (relay pools, storage keys, engine profile, user signer) reaches the core today. The full story is in [Extraction history](development/extraction-history.md).

## Building on it

Three paths, detailed in `ARCHITECTURE.md` and the guides:

1. **Build on the library** — the seams above plus `useProviderSearch` give you the SIP-01 index, auto-indexing, privacy routing, votes, and AI behind stable contracts. Start with [Build a search engine on the core](guides/build-an-engine.md).
2. **Protocol-only** — depend on nothing here; implement from the spec and prove byte-compatibility against the §13 vectors. See [Protocol conformance](reference/protocol-conformance.md).
3. **Core + closed parts** — keep your ranking, AI, crawler, datasets, and UI proprietary behind the same interfaces. (License terms are a pending project decision — see [Licensing](licensing.md); do not assume.)
