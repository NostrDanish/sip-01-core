# Package Boundaries

The contract per layer: what it exports, what it may depend on, what it must
never depend on, and how stable it is. Enforced mechanically by the
`boundaries/*` blocks in `eslint.config.js` — if a change crosses a line, the
lint fails.

Stability levels: **protocol-critical** (byte-compat with the SIP-01 spec,
change only with a spec revision) · **stable** (public API, semver-style care)
· **experimental** (internals, may change).

There is no application plane in this repository. The Dsearch application
(profile, trust anchors, control plane, pages, UI, deploy config) was split
out — the extraction program is CLOSED (see `docs/EXTRACTION-MAP.md`). The
public API of every layer below is exported from the library entry point
`src/index.ts`.

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
| Must NOT depend on | engine internals, the AI layer, any other lib module (lint-enforced) |
| Stability | **protocol-critical (frozen)** — renaming a namespace forks the network. Never rename; extend only via new tags/kinds. |

## Core contracts & infrastructure

`src/engine/providers/types.ts` · `src/lib/engineConfig.ts` · `src/lib/relayConfig.ts` · `src/lib/appRelays.ts` · `src/lib/searchRelays.ts` · `src/lib/relayUrls.ts` · `src/lib/corsProxy.ts` · `src/lib/storageMigration.ts` · `src/lib/sanitizeUrl.ts` · `src/lib/contentType.ts` · `src/lib/languageFilter.ts` · `src/lib/relayDiscovery.ts`

| | |
|---|---|
| Public API | `SearchProvider` / `SearchResult` / `SearchOptions` / `ProviderSearchResponse` / `PrivacyTier` / `SearchSource`; `configureEngine` / `getEngineConfig` / `EngineRuntimeConfig` / `DEFAULT_ENGINE_SYSTEM_PROMPT`; `configureRelays` / `getRelayConfig` / `RelayPoolConfig` (the relay seam — host injects default pools + storage-key names once at startup); relay pool query/publish helpers; URL sanitizers; `STORAGE_KEY_RENAMES` (the `dsearch:*` → `sip01:*` local-key migration registry) |
| May depend on | protocol, federation |
| Must NOT depend on | engine internals (beyond the `SearchResult` type), the AI layer (lint-enforced) |
| Known debt | `corsProxy.ts` ships default proxy URLs that a private deployment must be able to override |
| Stability | **stable** |

## Engine — `src/engine/**` + `src/lib/engine/observation.ts`

`src/engine/providers/**` (contract + 15 built-ins + registry) · `src/engine/query/**` (query/rank stack) · `src/engine/votes.ts` · `src/engine/moderation.ts` · `src/engine/runtime.tsx` · `src/engine/hooks/**` (12 orchestration/read hooks) · `src/lib/engine/observation.ts` (observation adapter with injected `indexerSource`)

| | |
|---|---|
| Public API | `createProviderRegistry` (plugin seam), `ALL_PROVIDERS`, the 15 built-in providers, `parseQuery`/`evaluateQuery`/`applyHardConstraints`, `sortByQueryRelevance`, `classifyQuery`, `EngineRuntime` / `EngineRuntimeProvider` / `useEngineRuntime`, `ModerationSet` / `toModerationSet` / `isHiddenResult`, `useProviderSearch`, `useSearchIndexer`, `useInstantAnswer`, index/trending/stakes read hooks |
| Replaceable parts | any single provider · the registry set · the ranker · the AI provider · the moderation set · the runtime values |
| May depend on | core, federation, protocol, `engineConfig`/`relayConfig` seams, the host-injected `EngineRuntime` |
| Must NOT depend on | any application plane — none exists in this repo. Host identity arrives exclusively via the `engineConfig`/`relayConfig` seams and `EngineRuntime`. The old `useProviderSearch` → `@/app/moderation` cross-layer exception is **RESOLVED**: moderation is host-supplied data (`EngineRuntime.moderation`), not an import. |
| Stability | contracts **stable**, provider internals **experimental** |

## AI — `src/ai/**`

`src/ai/{types,registry,openai-compatible,prompts,aiConfig,engineProxy,engineAdmin,index}.ts` · `src/ai/hooks/{useAIAnswer,useEngineAIStatus}.ts`

| | |
|---|---|
| Public API | `AIProvider` (`models` + `answer`, with endpoint/key metadata), `AI_PROVIDERS` catalog, `createOpenAICompatibleProvider`, `resolveAIConfig` (credential precedence), `useAIAnswer`, engine-proxy isomorph (`engineProxy.ts`: `readEngineConfig` / `validateChatPayload` / `buildUpstreamBody` / `verifyAdminAuth` / `applyAdminAction` … — all host defaults are explicit `EngineAIDefaults` parameters) |
| May depend on | core (`corsProxy`, `engineConfig`), engine query classifier + `SearchResult` type (documented cross-imports) |
| Must NOT depend on | any application plane; never hard-requires one vendor |
| Stability | interface **stable**, provider catalog **experimental** |

## Enforcement (eslint `boundaries/*` blocks)

The blocks in `eslint.config.js`, general → specific (later flat-config
blocks override earlier ones for the same files):

- `boundaries/protocol` — `src/protocol/**` may not import any `@/` module
  at all.
- `boundaries/federation` — `src/federation/**` imports protocol + npm +
  the two documented shared contracts (`engine/providers/types`,
  `lib/contentType`) only.
- `boundaries/lib` — `src/lib/**` imports protocol + federation + npm +
  the `SearchResult` type; never engine internals or the AI layer.
- `boundaries/engine-and-ai` — `src/engine/**` + `src/ai/**` sit on
  protocol/federation/lib; shipped code never imports the test harness.
  The two existing engine↔ai cross-imports are documented above and stay.

## Server boundary

The isomorphic proxy modules (`src/ai/engineProxy.ts`,
`src/engine/providers/braveProxy.ts`) are runtime-agnostic: all host defaults
are explicit parameters, no browser-only or CF-only APIs. The secret-holding
shell (worker, secrets like `OPENAI_API_KEY`/`BRAVE_API_KEY`) belongs to the
deploying application's infrastructure, not to this library.

---

*Vibed with [Shakespeare](https://shakespeare.diy)*
