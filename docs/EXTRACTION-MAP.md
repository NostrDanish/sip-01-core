# Extraction Map — Dsearch → SIP-01-core

Status of the staged extraction, and the exact remaining moves. Rule of the
project: **MOVE → ADAPT → TEST**, never rewrite-and-hope. Coupling inversions
come before physical moves, and every phase must leave the test gate green
(`npm run test`) before it lands.

## Completed

| Phase | Commit | What |
|---|---|---|
| 0 | `25db2b9` | Repaired `worker.ts` (duplicated body-parse block + unterminated `if` — the file could not parse); `worker.ts` added to `tsconfig` so the server boundary is type-checked |
| 1 | `41898b2` | Characterization tests: termSignals, keywordStakes, communityIndex, searchIndex (incl. federation trust list), resultRank, providers/registry, appRelays pools |
| 2a | `4d2d008` | Storage-migration helpers extracted to `src/lib/storageMigration.ts` (were inside the trust-root module; 7 importers) |
| 2b | `7fa3783` | `observationFromResult` moved out of the protocol module → `src/lib/engine/observation.ts` with injected `indexerSource`. `webIndex.ts` is app-pure |
| 2c | `5b40a7d` | `appRelays ⇄ relayDiscovery` cycle broken: `src/lib/relayUrls.ts` leaf; discovery bootstrap relays now caller-supplied |
| 2d | `5091af8` | `createProviderRegistry()` — composable provider catalog (the open/closed plugin seam) |
| 2e | `77978b8` | `src/lib/engineConfig.ts` seam (`configureEngine`/`getEngineConfig`); engine/AI no longer import the app profile; worker injects `ENGINE_PROFILE.ai` into the isomorphic proxy |
| 3-M1 | `55c579b` | Physical home for the protocol layer: `src/protocol/{webIndex,indexerIdentity}.ts` (+tests) |
| 3-M2 | `5c55bc4` | Physical home for the federation layer: `src/lib/{searchIndex,communityIndex,keywordStakes,termSignals}.ts` (+tests) → `src/federation/` |
| 3-M3 | `079f85c` | `src/lib/providers/` → `src/engine/providers/`; `src/lib/searxngInstances.ts` → `src/engine/providers/` |
| 3-M4 | `ebbb3ae` | Query/rank stack → `src/engine/query/` (`queryParser`, `queryEngine`, `queryMatch`, `queryClassify`, `resultRank`, `calculator` +tests); `src/lib/votes.ts` → `src/engine/` |

## Staged physical moves (next phases)

Pure path relocations (`git mv` + uniform import-specifier rewrites). Execute
with the full test suite runnable (`npm run test`) — do them one group per
commit, build + test after each.

| # | Move | Importer rewrite |
|---|---|---|
| M2 | `src/lib/{searchIndex,communityIndex,keywordStakes,termSignals}.ts` (+tests) → `src/federation/` | `@/lib/<name>` → `@/federation/<name>` |
| M3 | `src/lib/providers/` → `src/engine/providers/`; `src/lib/searxngInstances.ts` → `src/engine/providers/` | `@/lib/providers/...` → `@/engine/providers/...`; intra-dir `./x` imports untouched |
| M4 | `src/lib/{queryParser,queryEngine,queryMatch,queryClassify,resultRank,calculator}.ts` (+tests) → `src/engine/query/`; `src/lib/votes.ts` → `src/engine/` | uniform prefix rewrites |
| M5 | `src/lib/ai/` → `src/ai/`; `src/lib/aiConfig.ts` (+test) → `src/ai/`; `useAIAnswer`/`useEngineAIStatus` → `src/ai/hooks/` | prefix rewrites |
| M6 | engine hooks (`useProviderSearch`, `useSearchIndexer`, `useInstantAnswer`, `useTrendingTerms`, `useRecentIndexedDocs`, `useRecentStakes`, `useMyNode`, `useNetworkStats`, `useVotes`, `useRelayDiscovery`, `useSearchRelayPool`, `useSearxngInstances`) → `src/engine/hooks/` | `@/hooks/<name>` → `@/engine/hooks/<name>` per moved hook |
| M7 | app plane → `src/app/`: `dsearchProtocol.ts`, `moderation.ts`, `reports.ts`, `affiliates.ts`, `referrals.ts` (+tests), `src/lib/engine/profile.ts` (the `DSEARCH_PROFILE` instance), app hooks (`useModeration`, `useAdminAccess`, `useAffiliates`, `useReferrals`, `useCachedQueries`) | prefix rewrites; update `engine/index.ts` barrel or drop it |
| M8 | split `appRelays.ts`: pool machinery → core; default relay lists + `dsearch:*` storage keys → app config | see §"Known debt" in PACKAGE_BOUNDARIES.md |
| M9 | retire proven-dead legacy paths (zero consumers, verify again before deleting): `useWebSearch.ts` + `lib/searxng.ts`, `useDarkWebSearch.ts` + `lib/ahmia.ts` + `DarkWebResultCard.tsx`, `useNostrSearch.ts` + `KindFilter.tsx`, `NostrResultCard.tsx`, `WebResultCard.tsx` | deletion only |
| M10 | decide `backend/`'s home (candidate: separate legacy repo) | none (disconnected) |

After M2–M7: update the `boundaries/*` globs in `eslint.config.js` to the new
paths, then consider npm workspaces (`packages/*`) **only when npm publishing
is actually needed** — the single-build layout is intentional until then.

## Known cross-layer edge (accepted, documented)

`useProviderSearch` (engine orchestrator) reads the owner-signed moderation
set via `useModeration` (app control plane). Resolving this cleanly requires a
moderation-provider injection point in the engine config seam. Deferred to the
`apps/dsearch` split — do not hack it during the mechanical moves.

## Verification obligations per move

1. `npm run test` green (typecheck + lint + vitest + build).
2. Protocol-critical files: §13 vectors untouched (`src/protocol/webIndex.test.ts`).
3. No string-level regressions: grep the moved layer for `dsearch`, `OWNER_PUBKEY`,
   `0xsearchstr:` *localStorage* keys (the federation *event* namespaces stay).
