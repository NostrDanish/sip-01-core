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
| 3-M5 | `bae8b82` | Physical home for the AI layer: `src/lib/ai/` → `src/ai/`, `src/lib/aiConfig.ts` (+test) → `src/ai/`, `useAIAnswer`/`useEngineAIStatus` → `src/ai/hooks/` |
| 3-M6 | `d86fa9d` | Engine hooks → `src/engine/hooks/` (the 12 hooks of the eslint `boundaries/engine-hooks` block) |
| 3-M7 | `d1875de` | Dsearch application plane → `src/app/` (`dsearchProtocol`, `moderation`, `reports`, `affiliates`, `referrals` +tests, `engine/profile.ts`, app hooks → `src/app/hooks/`); `src/lib/engine/index.ts` barrel dropped (no consumers); `boundaries/*` globs updated to the new paths, app-plane bans extended to `src/app/**` with the single documented `useProviderSearch` → moderation exception |
| 3-M8 | `d9c93f6`, `da712f4` | `appRelays.ts` split: generic pool machinery stays core (`src/lib/appRelays.ts`); default relay lists + `dsearch:*` pool storage keys moved to the app plane (`src/app/relayConfig.ts`, `DSEARCH_RELAY_CONFIG`) behind the new `configureRelays`/`getRelayConfig` seam (`src/lib/relayConfig.ts`). Neutral brand-free defaults (`sip01:*` keys, empty pools) until configured |
| 3-M9 | `c30c35c` | Retired proven-dead legacy search paths (zero live consumers, re-verified before deletion): `useWebSearch` + `lib/searxng`, `useDarkWebSearch` + `lib/ahmia` + `DarkWebResultCard`, `useNostrSearch` + `KindFilter`, `NostrResultCard`, `WebResultCard` |

## Staged physical moves (next phases)

| # | Move | Importer rewrite |
|---|---|---|
| M10 | decide `backend/`'s home (candidate: separate legacy repo) | none (disconnected) |

The `boundaries/*` globs in `eslint.config.js` already track the post-M8
paths. Consider npm workspaces (`packages/*`) **only when npm publishing
is actually needed** — the single-build layout is intentional until then.

## Remaining debt

Debt that survives the completed moves, recorded so it is not rediscovered
the hard way:

- **4 per-feature `dsearch:*` localStorage keys inside the engine/AI layers**
  (they should read host key names from a seam like `relayConfig` does):
  `src/engine/votes.ts` (`dsearch:votes`),
  `src/engine/providers/braveKey.ts` (`dsearch:brave-api-key`),
  `src/engine/providers/parallel.ts` (`dsearch:parallel-api-key`),
  `src/ai/aiConfig.ts` (`dsearch:ai-config`).
- **Dsearch-branded `alt` strings on shared federation events** (cosmetic,
  but the strings ride the shared `0xsearchstr:*` contract):
  `src/engine/votes.ts` (vote events),
  `src/federation/communityIndex.ts` (submission events).
- **M10: `backend/` decision** — the legacy 0xSearchstr-era self-hosted
  stack (Meilisearch + crawlers + NIP-50 relay proxy) is disconnected from
  the app build; keep, extract to its own repo, or drop. Staged above.
- **No LICENSE file** — without one, no reuse rights are granted by
  default; a licensing decision is required before third-party
  reuse/distribution. See the README licensing note.

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
