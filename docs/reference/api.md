# API reference

Every export of the public barrel (`src/index.ts`), grouped by layer. This is the only supported API surface — deep imports into `src/` are internals. Generated from the actual barrel; source module noted per group. Types and interfaces are listed alongside functions and constants.

## Protocol — `src/protocol/`

SIP-01 reference layer (wire-critical). Spec-pinned; changes only with a spec revision.

| Export | Kind | Description |
|---|---|---|
| `WEB_INDEX_KIND` | const | Web Index Observation event kind: `39697` (addressable). |
| `WEB_INDEX_SCHEMA_VERSION` | const | Wire schema version (the `v` tag): `'1'`. |
| `WEB_INDEX_D_PREFIX` | const | d-tag namespace prefix: `'widx:'` (spec §3). |
| `TOPIC_RE` | const | Topic tag shape regex (spec §6). |
| `EXTENSION_VALUE_RE` | const | Extension keyword shape regex (spec §9.1 rule 5). |
| `MIME_RE` | const | MIME type regex for the `mime` extension (spec §9.2). |
| `normalizeIndexUrl` | fn | §7 URL normalization; `null` for invalid/non-http(s). Byte-critical. |
| `documentId` | fn | §3 URL identity: `'widx:' + sha256(normalized)[0:32]`. |
| `contentHash` | fn | §8 content identity: `sha256(title + '\n' + description)`. |
| `buildIndexEvent` | fn | Build an unsigned kind 39697 observation; `null` on unusable input. |
| `parseIndexEvent` | fn | Parse + validate a kind 39697 event into an `IndexObservation`; `null` when malformed. |
| `verifyObservation` | fn | §18 step 2 integrity check (`d`↔`u`, `x`↔content). Async. |
| `IndexObservationInput` | type | Input for `buildIndexEvent` (incl. registered extension fields). |
| `UnsignedIndexEvent` | type | `{ kind, content, tags }` before signing. |
| `IndexObservation` | type | Parsed, validated observation (incl. `extensions`, `observedAt`, `indexer`, raw `event`). |

### Indexer identity — `src/protocol/indexerIdentity.ts` (spec §14)

| Export | Kind | Description |
|---|---|---|
| `getIndexerIdentity` | fn | Get (or generate + persist) this device's indexing identity. |
| `regenerateIndexerIdentity` | fn | Discard the key; start a new indexer (history does not transfer). |
| `exportIndexerNsec` | fn | Export the secret as bech32 `nsec` — explicit-request only. |
| `getIndexerPubkey` | fn | Device indexer pubkey (hex). |
| `getIndexerSecretKey` | fn | Raw secret bytes for signing; never expose beyond signing. |
| `IndexerIdentity` | type | `{ secretHex, pubkeyHex, npub, fresh }`. |

## Federation — `src/federation/`

Shared `0xsearchstr:*` event contracts. **Frozen namespaces — renaming forks the network.**

| Export | Kind | Description |
|---|---|---|
| `SEARCHSTR_INDEX_PUBKEY` / `PRESEARCHSTR_INDEX_PUBKEY` | const | Known legacy-cache indexer pubkeys (0xSearchstr bot; retired Dsearch signer). |
| `INDEXER_PUBKEYS` | const | Trusted indexer allowlist for the legacy cache. |
| `INDEX_KIND` | const | Legacy cache kind: `30078` (`0xsearchstr:cache:*`, read-only). |
| `CACHE_MAX_AGE_SECONDS` | const | Cache staleness window on read (24h). |
| `normalizeQuery` | fn | Query normalization shared by cache/stakes d-tags. |
| `fromCachedResult` | fn | Map a cached record to a `SearchResult`. |
| `parseCacheEvent` | fn | Parse a legacy cache event. |
| `COMMUNITY_KIND` / `COMMUNITY_T_TAG` | const | Community submission kind (`30078`) / t-tag (`0xsearchstr-submit`). |
| `NOSTRA_D_TAG` / `BOOKMARK_KIND` | const | Nostra interop d-tag (`nostra:index`) / NIP-B0 bookmark kind (`39701`). |
| `submissionDTag` | fn | `0xsearchstr:submit:<url-hash>` d-tag construction. |
| `buildSubmissionEvent` / `parseSubmissionEvent` | fn | Build/parse community URL submissions. |
| `parseBookmarkEvent` / `parseNostraEvent` | fn | Parse NIP-B0 bookmarks / Nostra index events. |
| `SubmissionInput` | type | Input for `buildSubmissionEvent`. |
| `STAKE_KIND` / `STAKE_T_TAG` | const | Keyword-stake kind (`30078`) / t-tag (`0xsearchstr-stake`). |
| `stakeDTag` | fn | `0xsearchstr:stake:<normalized-keyword>` d-tag construction. |
| `buildStakeEvent` / `parseStakeEvent` | fn | Build/parse keyword stakes. |
| `StakeInput` | type | Input for `buildStakeEvent`. |
| `TERM_SIGNAL_D_PREFIX` / `TERM_REVEAL_D_PREFIX` | const | `0xsearchstr:term:` / `0xsearchstr:term-reveal:` d-tag prefixes. |
| `TERM_SIGNAL_T_TAG` / `TERM_REVEAL_T_TAG` | const | Matching t-tags (`0xsearchstr-term[-reveal]`). |
| `TRENDING_THRESHOLD` | const | Distinct devices before a term may be revealed (k-anonymity). |
| `hashTerm` | fn | SHA-256 hash a query term (never published in plaintext). |
| `buildTermSignalEvent` / `buildTermRevealEvent` | fn | Build hashed term signals / threshold reveals. |
| `parseTermSignal` / `parseTermReveal` | fn | Parse signals / reveals. |
| `verifyTermReveal` | fn | Check a reveal matches its hash. |

## Core contracts & infrastructure — `src/lib/`

| Export | Kind | Description |
|---|---|---|
| `configureEngine` / `getEngineConfig` / `resetEngineConfig` | fn | The engine identity seam (call once at bootstrap; read at call time; test reset). |
| `EngineRuntimeConfig` | type | The seam's config shape (id, search, ai). |
| `DEFAULT_ENGINE_SYSTEM_PROMPT` | const | Brand-free fallback AI system prompt. |
| `configureRelays` / `getRelayConfig` / `resetRelayConfig` | fn | The relay pool seam (default pools + storage keys). |
| `RelayPoolConfig` / `RelayStorageKeys` | type | The relay seam's config shapes. |
| `getSearchRelayUrls` / `getIndexRelayUrls` / `getGitRelayUrls` / `getWikiRelayUrls` | fn | Effective relay URL sets per pool (defaults − hidden + customs). |
| `getCustomSearchRelays` / `getHiddenSearchRelays` / `addCustomSearchRelay` / `removeCustomSearchRelay` / `hideDefaultSearchRelay` / `restoreDefaultSearchRelay` / `restoreAllDefaultSearchRelays` | fn | Search-pool customization mutators (index/git/wiki pools export the equivalents). |
| `gitRelays` / `wikiRelays` | const | Git/wiki pool helper objects. |
| `getSearchRelay` | fn | Shared relay connection cache (ws→wss upgrade included). |
| `queryRelayPool` / `publishToRelayPool` | fn | Fan-out query/publish across a pool with per-relay failure isolation. |
| `toSecureRelayUrl` / `normalizeRelayUrl` | fn | Relay URL upgrade/normalization (leaf module). |
| `isLoopbackOrPrivateUrl` / `proxiedFetch` | fn | SSRF guard / CORS-proxy fetch with failover. |
| `STORAGE_KEY_RENAMES` | const | The `dsearch:*` → `sip01:*` localStorage migration registry. |
| `readStoredWithLegacy` / `writeStoredCanonical` | fn | Read-through migration / canonical write helpers. |
| `StorageKeyRename` | type | `{ canonical, legacy[] }` rename record. |
| `sanitizeUrl` / `sanitizeResultUrl` / `sanitizePublicUrl` | fn | URL sanitizers (scheme allowlists) for DOM use. |
| `detectContentType` / `contentTypeLabel` / `isValidSubmissionUrl` | fn | URL content-type detection / labels / submission validation. |
| `ContentType` | type | The content-type union. |
| `normalizeLangCode` / `normalizeLangList` / `passesLanguageFilter` | fn | ISO 639-1 language-filter helpers. |
| `searxngLanguageParam` / `braveLanguageParam` | fn | Per-engine language request parameters. |
| `getBrowserLanguage` / `COMMON_LANGUAGES` / `LANG_CODE_RE` | fn/const | Browser language detection / common list / code regex. |
| `refreshDiscoveredRelays` / `getDiscoveredSearchRelays` / `getDiscoveredIndexRelays` | fn | NIP-66/NIP-11 relay discovery (`uncaged_index` aware). |
| `getDiscoveryCache` / `isRelayDiscoveryEnabled` / `setRelayDiscoveryEnabled` | fn | Discovery cache + toggle. |
| `VerifiedRelay` | type | A verified discovered relay record. |
| `observationFromResult` | fn | `SearchResult` → `IndexObservationInput` adapter (injected `indexerSource`). |

## Engine — providers

The contract (`src/engine/providers/types.ts`):

| Export | Kind | Description |
|---|---|---|
| `SearchProvider` | type | The provider contract: `{ id, name, source, privacy, privacyNote, search }`. |
| `SearchResult` | type | The universal result shape every provider returns. |
| `SearchOptions` / `ProviderSearchResponse` | type | Search call input (query, signal, limit, languages, parsed) / output. |
| `SearchSource` / `PrivacyTier` | type | Source category union / privacy tier union (`nostr`/`direct`/`proxied`). |

The registry (`registry.ts`):

| Export | Kind | Description |
|---|---|---|
| `createProviderRegistry` | fn | The plugin seam: build a catalog from any provider set. |
| `ALL_PROVIDERS` | const | The 15 built-in providers, in display/priority order. |
| `getProvidersForSource` / `getProvidersForPrivacy` / `getProvider` / `getAvailableSources` | fn | Default-catalog queries. |
| `ProviderRegistry` / `SourceSelector` | type | Registry shape / source selector (`SearchSource | 'all' | 'index' | 'i2p'`). |

The 15 built-ins (one module each): `braveProvider`, `parallelProvider`, `duckduckgoProvider`, `searxngProvider`, `webIndexProvider`, `cachedIndexProvider`, `stakesProvider`, `communityProvider`, `nostrProvider`, `gitProvider`, `nostrWikiProvider`, `wikipediaProvider`, `hackerNewsProvider`, `stackOverflowProvider`, `torProvider`. Supporting exports: `getBraveApiKey` / `setBraveApiKey` (Brave BYOK), `getParallelApiKey` / `setParallelApiKey` (Parallel BYOK), `getWebEngineBases` / `WebEngineBases` (web-engine ordering), and the SearXNG instance-pool API (`searxngInstances.ts`): `SEED_INSTANCES`, `MAX_ACTIVE_DISCOVERED`, `normalizeInstanceUrl`, `getCustomInstances`, `addCustomInstance`, `removeCustomInstance`, `getDisabledInstances`, `isInstanceDisabled`, `getExtraInstances`, `instanceState`, `toggleInstanceState`, `getHealthMap`, `recordInstanceSuccess`, `recordInstanceFailure`, `isCoolingDown`, `getDiscoveredCache`, `isDiscoveryEnabled`, `setDiscoveryEnabled`, `refreshDiscoveredInstances`, `getInstancePool`, `getInstanceUrls` (+ types `InstanceHealth`, `DiscoveredCache`, `InstanceOrigin`, `PoolInstance`, `InstanceState`).

## Engine — query stack

| Export | Kind | Description |
|---|---|---|
| `parseQuery` | fn | Structured query → `ParsedQuery` AST (memoized). |
| `ParsedQuery` / `QueryNode` / `FilterClause` / `FilterField` / `FILTER_FIELDS` | type/const | The AST shapes and filter-field registry. |
| `collectTextLeaves` / `textOnly` / `toEngineQuery` | fn | AST utilities (text extraction, engine-native query string). |
| `evaluateQuery` / `evaluateRaw` | fn | Authoritative local AST evaluation against a `FilterDoc`. |
| `applyHardConstraints` / `collectHardConstraints` / `passesHardConstraints` | fn | The local backstop: filters + NOT applied to every result set. |
| `docFromObservation` / `docFromSearchResult` | fn | Build a `FilterDoc` from an observation / result. |
| `parseDateBoundary` / `evalFilter` | fn | Date parsing / single-filter evaluation. |
| `FilterDoc` / `EvalResult` / `HardConstraints` | type | Evaluation shapes. |
| `classifyQuery` / `providerAllowlistFor` | fn | Query classification (`nip19`/`nip05`/`url`/`math`/`text`) → privacy allowlists. |
| `QueryClass` | type | The classification union. |
| `tokenizeQuery` / `tokenizeRaw` / `normalizeText` | fn | Term tokenization/normalization. |
| `termMatches` / `matchWithRelevance` / `matchesTerms` / `queryMatches` / `queryRelevance` / `wordCoverage` | fn | Term matching and word-coverage scoring. |
| `STOP_WORDS` / `QueryTerms` / `TermMatch` | const/type | Stop-word set / matching shapes. |
| `sortByQueryRelevance` | fn | Coverage re-ranking (replaceable ranker). |
| `isMathQuery` / `evaluateMath` / `formatMathResult` | fn | Calculator instant answers. |

## Engine — votes, moderation, runtime

| Export | Kind | Description |
|---|---|---|
| `VOTE_KIND` | const | NIP-25 reaction kind: `7`. |
| `voteTargetFor` | fn | Build the votable target (`e:` event or `u:` normalized URL) for a result. |
| `buildVoteEvent` | fn | Build a NIP-25 vote event template (`+`/`-`). |
| `tallyVotes` | fn | Tally votes; latest per pubkey per target wins. |
| `getMyVote` / `setMyVote` | fn | Local vote-state persistence (`sip01:votes`). |
| `VoteDirection` / `VoteTarget` / `VoteTally` | type | Vote shapes. |
| `toModerationSet` / `isHiddenResult` | fn | Build a `ModerationSet` / the hidden-result predicate. |
| `HiddenTarget` / `ModerationSet` | type | Moderation shapes (pure; no trust policy). |
| `EngineRuntime` / `EngineRuntimeProvider` / `useEngineRuntime` | type/fn | The host-injection React context for the engine hooks. |
| `DEFAULT_ENGINE_RUNTIME` | const | Neutral runtime defaults (used with no provider). |
| `EngineSigner` / `EngineRuntimeProviderProps` | type | NIP-07-style signer shape / provider props. |

## Engine — hooks

| Export | Description |
|---|---|
| `useProviderSearch` | The orchestrator: parallel providers, streaming, dedupe, constraints, moderation, auto-index. (+ types `ProviderStatus`, `ProviderState`, `UseProviderSearchOptions`, `UseProviderSearchResult`) |
| `useSearchIndexer` | Auto-indexing: publish kind 39697 observations + hashed term signals. |
| `useInstantAnswer` | Calculator/profile/event/URL/Wikipedia/DuckDuckGo instant answers. (+ type `InstantAnswer`) |
| `useSearxngInstances` | SearXNG instance pool state and actions. |
| `useVoteCounts` / `useVoteActions` | Batch vote tallies / vote publishing. |
| `useTrendingTerms` | K-anonymity trending terms from revealed signals. (+ type `TrendingTerm`) |
| `useRecentIndexedDocs` | Recent kind 39697 observations from the index. (+ type `IndexedDocEntry`) |
| `useRecentStakes` | Recent keyword stakes. (+ type `StakeEntry`) |
| `useMyNode` | This device's indexer stats and observations. (+ type `MyObservation`) |
| `useIndexRelayStatus` / `useNodeHeartbeats` | Index relay health / kind 16919 heartbeat reads. (+ `NODE_HEARTBEAT_KIND`, types `RelayStatus`, `NodeHeartbeat`) |
| `useRelayDiscovery` | Relay discovery state and refresh. |
| `useSearchRelayPool` / `useIndexRelayPool` / `useGitRelayPool` / `useWikiRelayPool` | Pool management hooks with per-relay status. (+ types `SearchRelayOrigin`, `SearchRelayStatus`, `SearchRelayEntry`) |

## AI — `src/ai/`

| Export | Kind | Description |
|---|---|---|
| `AIProvider` | type | The AI contract: 4 metadata fields + `models` + `answer`. |
| `AIModel` / `AIEvidenceItem` / `AIAnswerRequest` / `AIAnswer` | type | AI shapes. |
| `AI_PROVIDERS` / `getAIProvider` | const/fn | The built-in catalog (PPQ, OpenRouter, OpenAI, Ollama, Custom). |
| `ENGINE_PROXY_PROVIDER` | const | The engine-tier provider (same-origin proxy, no key). |
| `createOpenAICompatibleProvider` | fn | The one implementation every OpenAI-compatible backend reuses. |
| `getAnswerSystemPrompt` / `buildEvidencePrompt` | fn | System prompt / evidence-pack prompt builders. |
| `resolveAIConfig` | fn | Credential precedence: user → keyless → engine → community → unavailable. |
| `getAIConfig` / `setAIConfig` / `getDefaultAIConfig` / `hasOwnAIKey` / `engineAIAvailable` | fn | AI settings persistence and tier helpers. |
| `ENGINE_AI_BASE` | const | Engine-proxy base (`/api/ai`, or `VITE_ENGINE_API_BASE`). |
| `AIConfig` / `ResolvedAIConfig` | type | AI config shapes. |
| `readEngineConfig` / `buildPublicStatus` | fn | Engine-proxy config resolution (env + KV) / public status shape. |
| `validateChatPayload` / `applyEngineSystemPrompt` / `buildUpstreamBody` / `sanitizeProviderError` | fn | Engine-proxy request pipeline (isomorphic). |
| `verifyAdminAuth` / `parseAdminAction` / `applyAdminAction` / `writeEngineConfig` | fn | Engine-proxy admin auth + actions. |
| `EngineAIDefaults` / `EngineAIConfig` / `EngineAIEnv` / `EngineAIStatus` / `KVLike` / `ChatMessage` / `ValidatedChat` / `AdminAuthResult` / `AdminAction` | type | Engine-proxy shapes. |
| `sendEngineAIAction` / `testEngineAI` / `EngineAdminError` | fn/class | Client side of engine-AI admin. |
| `useAIAnswer` | fn | The AI answer hook (evidence → cited answer). (+ types `UseAIAnswerResult`, `buildEvidence`) |
| `useEngineAIStatus` | fn | Engine-proxy tier availability. |

Everything above is reachable as a named import from the package root:

```ts
import { buildIndexEvent, createProviderRegistry, useProviderSearch, resolveAIConfig } from 'sip-01-core';
```
