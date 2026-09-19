# Package Boundaries

The contract per layer: what it exports, what it may depend on, what it must
never depend on, and how stable it is. Enforced mechanically by the
`boundaries/*` blocks in `eslint.config.js` — if a change crosses a line, the
lint fails.

Stability levels: **protocol-critical** (byte-compat with the SIP-01 spec,
change only with a spec revision) · **stable** (public API, semver-style care)
· **experimental** (internals, may change) · **application** (Dsearch-owned).

---

## `src/protocol/` — SIP-01 reference implementation

| | |
|---|---|
| Contents | `webIndex.ts` (kind 39697 build/parse/verify, §7 normalization, §3/§8 hashing), `indexerIdentity.ts` (§14), tests pinning spec §13 vectors |
| Public API | `WEB_INDEX_KIND`, `WEB_INDEX_SCHEMA_VERSION`, `WEB_INDEX_D_PREFIX`, `normalizeIndexUrl`, `documentId`, `contentHash`, `buildIndexEvent`, `parseIndexEvent`, `verifyObservation`, `IndexObservation(Input)`, `getIndexerIdentity`, `regenerateIndexerIdentity`, `exportIndexerNsec`, `getIndexerPubkey`, `getIndexerSecretKey` |
| May depend on | npm packages (`@nostrify/nostrify` types, `nostr-tools`), Web Crypto, relative modules |
| Must NOT depend on | **any `@/` application import** (lint-enforced) |
| Stability | **protocol-critical** |

## Federation layer — shared `0xsearchstr:*` contract

`src/federation/{searchIndex,communityIndex,keywordStakes,termSignals}.ts`

| | |
|---|---|
| Public API | builders/parsers + namespace constants for the legacy cache, submissions, stakes, term signals |
| May depend on | protocol, `engine/providers/types` (the `SearchResult` *type*), `contentType` |
| Must NOT depend on | UI, hooks, app profile, app control plane (lint-enforced) |
| Known debt | Dsearch-branded `alt` strings on submission events (`communityIndex.ts`) — cosmetic, but they ride the shared contract |
| Stability | **protocol-critical (frozen)** — renaming a namespace forks the network. Never rename; extend only via new tags/kinds. |

## Core contracts & infrastructure

`src/engine/providers/types.ts` · `src/lib/engineConfig.ts` · `src/lib/relayConfig.ts` · `src/lib/appRelays.ts` · `src/lib/searchRelays.ts` · `src/lib/relayUrls.ts` · `src/lib/corsProxy.ts` · `src/lib/storageMigration.ts` · `src/lib/sanitizeUrl.ts` · `src/lib/contentType.ts` · `src/lib/languageFilter.ts` · `src/lib/relayDiscovery.ts`

| | |
|---|---|
| Public API | `SearchProvider` / `SearchResult` / `SearchOptions` / `ProviderSearchResponse` / `PrivacyTier` / `SearchSource`; `configureEngine` / `getEngineConfig` / `EngineRuntimeConfig` / `DEFAULT_ENGINE_SYSTEM_PROMPT`; `configureRelays` / `getRelayConfig` / `RelayPoolConfig` (the relay seam — host injects default pools + storage-key names once at startup); relay pool query/publish helpers; URL sanitizers |
| May depend on | protocol, federation |
| Must NOT depend on | UI, hooks, app profile, app control plane |
| Known debt | `corsProxy.ts` ships default proxy URLs that a private deployment must be able to override |
| Stability | **stable** |

## Engine — `src/engine/**` + `src/lib/engine/observation.ts`

`src/engine/providers/**` (contract + 15 built-ins + registry) · `src/engine/query/**` (query/rank stack) · `src/engine/votes.ts` · `src/engine/hooks/**` (12 orchestration/read hooks) · `src/lib/engine/observation.ts` (observation adapter with injected `indexerSource`)

| | |
|---|---|
| Public API | `createProviderRegistry` (plugin seam), `ALL_PROVIDERS`, the 15 built-in providers, `parseQuery`/`evaluateQuery`/`applyHardConstraints`, `sortByQueryRelevance`, `classifyQuery`, `useProviderSearch`, `useSearchIndexer`, `useInstantAnswer`, index/trending/stakes read hooks |
| Replaceable parts | any single provider · the registry set · the ranker · the AI provider |
| May depend on | core, federation, protocol, `engineConfig`/`relayConfig` seams |
| Must NOT depend on | UI, pages, app profile, app control plane — with **one documented exception**: `engine/hooks/useProviderSearch.ts` reads the owner-signed moderation set via `@/app/moderation` + `@/app/hooks/useModeration` (enforced by the dedicated `boundaries/engine-hooks-provider-search-exception` eslint block; resolution deferred to the apps split — see `docs/EXTRACTION-MAP.md`) |
| Known debt | 3 per-feature `dsearch:*` localStorage keys: `votes.ts` (`dsearch:votes`), `providers/braveKey.ts` (`dsearch:brave-api-key`), `providers/parallel.ts` (`dsearch:parallel-api-key`); Dsearch-branded `alt` strings on vote events (`votes.ts`) |
| Stability | contracts **stable**, provider internals **experimental** |

## AI — `src/ai/**`

`src/ai/{types,registry,openai-compatible,prompts,aiConfig,engineProxy,engineAdmin,index}.ts` · `src/ai/hooks/{useAIAnswer,useEngineAIStatus}.ts`

| | |
|---|---|
| Public API | `AIProvider` (`models` + `answer`, with endpoint/key metadata), `AI_PROVIDERS` catalog, `createOpenAICompatibleProvider`, `resolveAIConfig` (credential precedence), `useAIAnswer`, engine-proxy isomorph (`engineProxy.ts`: `readEngineConfig` / `validateChatPayload` / `buildUpstreamBody` / `verifyAdminAuth` / `applyAdminAction` … — all host defaults are explicit `EngineAIDefaults` parameters) |
| May depend on | core (`corsProxy`, `engineConfig`) |
| Must NOT depend on | UI, app profile, app control plane; never hard-requires one vendor |
| App-side remainder | none — Dsearch's community free-tier key (`ai.community`) and PPQ invite URL live in the app profile (`src/app/profile.ts`) and reach this layer only via the engineConfig seam |
| Known debt | 1 per-feature `dsearch:*` localStorage key: `aiConfig.ts` (`dsearch:ai-config`) |
| Stability | interface **stable**, provider catalog **experimental** |

## Application — Dsearch (isolated under `src/app/`; see extraction map)

`src/app/profile.ts` (`DSEARCH_PROFILE` + community AI config + PPQ invite) · `src/app/relayConfig.ts` (`DSEARCH_RELAY_CONFIG`: default relay pools + `dsearch:*` pool storage keys) · `src/app/dsearchProtocol.ts` (OWNER_PUBKEY, roles, `dsearch:*` namespaces) · `src/app/moderation.ts` · `src/app/reports.ts` · `src/app/affiliates.ts` · `src/app/referrals.ts` · `src/app/hooks/**` · `src/pages/**` · app components · brand assets · `worker.ts` · deploy configs

| | |
|---|---|
| Rule | anything Dsearch-branded, Dsearch-namespaced, Dsearch-owned (trust root, business logic, hub pages) lives here and must never be required by the layers above |
| Stability | **application** — free to change with the product |

## Enforcement (eslint `boundaries/*` blocks)

The blocks in `eslint.config.js`, general → specific (later flat-config
blocks override earlier ones for the same files):

- `boundaries/lib-no-ui` — nothing in `src/lib/**` imports UI, pages, or
  React hooks.
- `boundaries/core-contracts` — `src/lib/{appRelays,relayDiscovery,searchRelays,corsProxy}.ts`:
  additionally no app profile, no app control plane, no `@/app/**`.
- `boundaries/engine-and-ai` — `src/engine/providers/**`, `src/engine/query/**`,
  `src/engine/votes.ts`, `src/lib/engine/**`, `src/ai/**`,
  `src/lib/engineConfig.ts`, `src/federation/**`: no UI, no hooks, no
  `@/app/**` (host identity via the seams).
- `boundaries/engine-hooks` — the 11 non-orchestrator engine hooks in
  `src/engine/hooks/`: same bans, but `@/hooks/**` stays allowed (hooks
  compose hooks).
- `boundaries/engine-hooks-provider-search-exception` — the **single
  documented exception**: `src/engine/hooks/useProviderSearch.ts` may import
  `@/app/moderation` + `@/app/hooks/useModeration` only; every other
  application-plane import is banned by name. Tracked in
  `docs/EXTRACTION-MAP.md` ("Known cross-layer edge").
- `boundaries/protocol` — `src/protocol/**` may not import any `@/` module
  at all.

## Server boundary

`worker.ts` + the isomorphic proxy modules (`src/ai/engineProxy.ts`, `src/engine/providers/braveProxy.ts`).
Secrets (`OPENAI_API_KEY`/`AI_API_KEY`, `BRAVE_API_KEY`) exist only in the worker
environment; the browser tier never holds them. `OWNER_PUBKEY` is a public
constant by design. The worker imports the app profile (it *is* the app
deployment); the shared proxy logic must stay runtime-agnostic (no
browser-only or CF-only APIs).

---

*Vibed with [Shakespeare](https://shakespeare.diy)*
