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

`src/lib/{searchIndex,communityIndex,keywordStakes,termSignals}.ts`

| | |
|---|---|
| Public API | builders/parsers + namespace constants for the legacy cache, submissions, stakes, term signals |
| May depend on | protocol, `providers/types` (the `SearchResult` *type*), `contentType` |
| Must NOT depend on | UI, hooks, app profile, app control plane (lint-enforced) |
| Stability | **protocol-critical (frozen)** — renaming a namespace forks the network. Never rename; extend only via new tags/kinds. |

## Core contracts & infrastructure

`src/lib/providers/types.ts` · `engineConfig.ts` · `searchRelays.ts` · `relayUrls.ts` · `corsProxy.ts` · `storageMigration.ts` · `sanitizeUrl.ts` · `contentType.ts` · `languageFilter.ts` · `relayDiscovery.ts`

| | |
|---|---|
| Public API | `SearchProvider` / `SearchResult` / `SearchOptions` / `ProviderSearchResponse` / `PrivacyTier` / `SearchSource`; `configureEngine` / `getEngineConfig` / `EngineRuntimeConfig` / `DEFAULT_ENGINE_SYSTEM_PROMPT`; relay pool query/publish helpers; URL sanitizers |
| May depend on | protocol, federation |
| Must NOT depend on | UI, hooks, app profile, app control plane |
| Known debt | `appRelays.ts` mixes generic pool machinery with this deployment's default relay lists + `dsearch:*` storage keys (split staged in the extraction map); `corsProxy.ts` ships default proxy URLs that a private deployment must be able to override |
| Stability | **stable** |

## Engine — `src/lib/providers/**` + query/rank stack + `src/lib/engine/**` + engine hooks

| | |
|---|---|
| Public API | `createProviderRegistry` (plugin seam), `ALL_PROVIDERS`, the 15 built-in providers, `parseQuery`/`evaluateQuery`/`applyHardConstraints`, `sortByQueryRelevance`, `classifyQuery`, `useProviderSearch`, `useSearchIndexer`, `useInstantAnswer`, index/trending/stakes read hooks |
| Replaceable parts | any single provider · the registry set · the ranker · the AI provider |
| May depend on | core, federation, protocol, `engineConfig` seam |
| Must NOT depend on | UI, pages, app profile, app control plane |
| Stability | contracts **stable**, provider internals **experimental** |

## AI — `src/lib/ai/**` + `aiConfig.ts` + AI hooks

| | |
|---|---|
| Public API | `AIProvider` (4 methods), `AI_PROVIDERS` catalog, `createOpenAICompatibleProvider`, `resolveAIConfig` (credential precedence), `useAIAnswer`, engine-proxy isomorph (`engineProxy.ts`: `readEngineConfig` / `validateChatPayload` / `buildUpstreamBody` / `verifyAdminAuth` / `applyAdminAction` … — all host defaults are explicit `EngineAIDefaults` parameters) |
| May depend on | core (`corsProxy`, `engineConfig`) |
| Must NOT depend on | UI, app profile, app control plane; never hard-requires one vendor |
| App-side remainder | none — Dsearch's community free-tier key (`ai.community`) and PPQ invite URL live in the app profile (`engine/profile.ts`) and reach this layer only via the engineConfig seam |
| Stability | interface **stable**, provider catalog **experimental** |

## Application — Dsearch (being isolated; see extraction map)

`src/lib/engine/profile.ts` (`DSEARCH_PROFILE`) · `dsearchProtocol.ts` (OWNER_PUBKEY, roles, `dsearch:*` namespaces) · `moderation.ts` · `reports.ts` · `affiliates.ts` · `referrals.ts` · their hooks · `src/pages/**` · app components · brand assets · `worker.ts` · deploy configs

| | |
|---|---|
| Rule | anything Dsearch-branded, Dsearch-namespaced, Dsearch-owned (trust root, business logic, hub pages) lives here and must never be required by the layers above |
| Stability | **application** — free to change with the product |

## Server boundary

`worker.ts` + the isomorphic proxy modules (`ai/engineProxy.ts`, `providers/braveProxy.ts`).
Secrets (`OPENAI_API_KEY`/`AI_API_KEY`, `BRAVE_API_KEY`) exist only in the worker
environment; the browser tier never holds them. `OWNER_PUBKEY` is a public
constant by design. The worker imports the app profile (it *is* the app
deployment); the shared proxy logic must stay runtime-agnostic (no
browser-only or CF-only APIs).

---

*Vibed with [Shakespeare](https://shakespeare.diy)*
