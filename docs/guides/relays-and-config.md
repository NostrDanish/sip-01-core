# Relays and configuration

The two bootstrap config seams — `configureEngine()` and `configureRelays()` — the relay pool machinery, relay discovery, and every storage key the core uses. The core hardcodes **no relay URLs and no brand**: until you configure it, pools are empty and keys are neutral `sip01:*` names.

## configureRelays — the relay seam

Call once at startup (`src/lib/relayConfig.ts`). `RelayPoolConfig`:

| Field | Type | Meaning |
|---|---|---|
| `searchRelays` | `readonly string[]` | Default **search pool** — relays queried for NIP-50 Nostr search and general reads. |
| `indexRelays` | `readonly string[]` | Default **index pool** — where SIP-01 observations (kind 39697), votes, stakes, and submissions are read from and published to. |
| `gitRelays` | `readonly string[]` | Default **git pool** — Nostr git (NIP-34) ecosystem relays. |
| `wikiRelays` | `readonly string[]` | Default **wiki pool** — Nostr wiki relays. |
| `storageKeys` | `RelayStorageKeys` | Canonical localStorage key names for pool customization and discovery state (11 keys — table below). |
| `legacyStorageKeys` | `Record<string, string>` | Legacy key per canonical key for read-through migration (see `storageMigration.ts`). Keys absent from this map have no legacy name. |

`RelayStorageKeys` fields and their neutral defaults:

| Field | Neutral default | Holds |
|---|---|---|
| `customSearchRelays` / `hiddenSearchRelays` | `sip01:search-relays:custom` / `:hidden` | User-added / user-hidden search pool relays (JSON arrays) |
| `customIndexRelays` / `hiddenIndexRelays` | `sip01:index-relays:custom` / `:hidden` | Same, for the index pool |
| `customGitRelays` / `hiddenGitRelays` | `sip01:git-relays:custom` / `:hidden` | Same, for the git pool |
| `customWikiRelays` / `hiddenWikiRelays` | `sip01:wiki-relays:custom` / `:hidden` | Same, for the wiki pool |
| `discoveredRelays` | `sip01:relay-discovery:verified` | Verified discovery cache (`{ relays, fetchedAt }`) |
| `relayDiscoveryEnabled` | `sip01:relay-discovery:enabled` | Auto-discovery on/off flag (JSON boolean) |
| `appConfig` | `sip01:app-config` | Stored app config JSON; discovery reads only its `privacyMode` flag |

Read the active config with `getRelayConfig()`; `resetRelayConfig()` restores neutral defaults (test helper).

**Why hosts supply their own relay set:** the pools are a deployment decision — which relays an engine trusts for reads, where its users' observations land, and what storage namespace its settings live in. Hardcoding one deployment's relays into the library would couple every consumer to that deployment and would silently publish user-generated events to relays the host never chose. Defaults are *suggestions, not mandates*: users can hide any default and add customs through the pool machinery.

## The pool machinery (appRelays)

`src/lib/appRelays.ts` implements the default/custom/hidden model per pool: `getSearchRelayUrls()`, `getIndexRelayUrls()`, `getGitRelayUrls()`, `getWikiRelayUrls()` return the effective sets (defaults minus hidden, plus customs, normalized via `toSecureRelayUrl` — `ws://` upgrades to `wss://`). Mutators follow the same pattern per pool, e.g. for the search pool: `addCustomSearchRelay`, `removeCustomSearchRelay`, `hideDefaultSearchRelay`, `restoreDefaultSearchRelay`, `restoreAllDefaultSearchRelays` (and the index/git/wiki equivalents). `src/lib/searchRelays.ts` adds the connection cache (`getSearchRelay`) and the pool helpers `queryRelayPool` and `publishToRelayPool` used by every read/publish path.

## Relay discovery

`src/lib/relayDiscovery.ts` finds NIP-50- and SIP-01-capable relays instead of relying on configured defaults alone — two phases, fully client-side:

1. **Candidates** — NIP-66 relay announcements (kind 30166, `#N: ['50']` filter) queried from the search pool, plus a small seed list so discovery works even where no 30166s are stored.
2. **Verification** — each candidate's NIP-11 document is fetched (via the CORS proxy). A relay joins the discovered **search** tier only when `supported_nips` really contains 50, and the discovered **index** tier when it advertises the SIP-01 `uncaged_index` block (spec §15).

Results cache for 24h under the `discoveredRelays` key. Everything is additive: configured pools keep working with zero discovered relays, and users can hide discovered relays like any default. Privacy rule: while Privacy Mode is on, the NIP-11 probe phase (CORS-proxy traffic) is skipped entirely — "no proxy traffic" wins over discovery. API: `refreshDiscoveredRelays`, `getDiscoveredSearchRelays`, `getDiscoveredIndexRelays`, `getDiscoveryCache`, `isRelayDiscoveryEnabled`, `setRelayDiscoveryEnabled`, plus the `useRelayDiscovery` hook.

## configureEngine — the engine seam

Call once at startup (`src/lib/engineConfig.ts`). `EngineRuntimeConfig`:

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | Engine id — used for client-attribution parameters (e.g. DuckDuckGo's `t`). |
| `search.brave` | `boolean` | Whether the host ships Brave as a first-class source (the engine tier may inject the key server-side via the proxy). |
| `search.indexerSource` | `string` | Indexer software id stamped as the SIP-01 `source` tag (spec §6) on auto-indexed observations. |
| `ai.enabledDefault` | `boolean` | AI answers on for first-time visitors (still user-overridable). |
| `ai.providerId` | `string` | Default OpenAI-compatible provider id. |
| `ai.providerName` | `string` | Display name of the intended engine-tier provider. |
| `ai.endpoint` | `string` | Default OpenAI-compatible endpoint (engine tier; no key here). |
| `ai.model` | `string` | Default model id (`'auto'` = provider router default). |
| `ai.systemPrompt` | `string` | Production system prompt (engine policy). `DEFAULT_ENGINE_SYSTEM_PROMPT` is the exported brand-free default. |
| `ai.community?` | `{ providerId, endpoint, apiKey, model }` | Optional shared, rate-limited free tier. **Public by design** — the key ships in the host's bundle. Omit to disable the tier. |

Neutral defaults until configured: `id: 'sip01-engine'`, `search.brave: false`, `search.indexerSource: 'sip01-core/1'`, AI disabled with a custom/keyless shape. Read with `getEngineConfig()`; `resetEngineConfig()` restores defaults (test helper). Both seams are read strictly **at call time**, never captured at module scope — so bootstrap order is the only thing that matters.

## Storage keys the core uses

For reference, the complete localStorage footprint of the library (beyond the pool keys above):

| Key | Module | Holds |
|---|---|---|
| `sip:indexer:secret` | `protocol/indexerIdentity.ts` | The device indexing identity secret (hex). See [Identity, votes, and moderation](identity-votes-moderation.md). |
| `sip01:votes` | `engine/votes.ts` | The user's own vote directions (local UI state). |
| `sip01:ai-config` | `ai/aiConfig.ts` | AI settings incl. the user's own API key. |
| `sip01:brave-api-key` | `engine/providers/braveKey.ts` | Brave BYOK key. |
| `sip01:parallel-api-key` | `engine/providers/parallel.ts` | Parallel BYOK key. |
| `sip01:*` (11 pool keys) | `lib/relayConfig.ts` neutral defaults | Pool customization + discovery state. |
| `0xsearchstr:searxng:*` | `engine/providers/searxngInstances.ts` | SearXNG instance pool state (discovered/custom/health/disabled/extras/discovery). Predates the rename; intentionally unchanged. |

The four renamed keys (`votes`, `ai-config`, `brave-api-key`, `parallel-api-key`) migrate from their `dsearch:*`/`presearchstr:*` predecessors on first read via `STORAGE_KEY_RENAMES` in `src/lib/storageMigration.ts`; writes go to the canonical key and delete the legacy ones.
