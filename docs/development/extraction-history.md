# Extraction history

Where this repository came from: an honest, short account of how sip-01-core was split out of the Dsearch application, what was removed, and where the old tree can still be found.

## Origin

sip-01-core was forked out of **Dsearch**, a Nostr-based decentralized search engine. Dsearch grew the protocol implementation, the federation contracts, the provider stack, and the AI layer inside one application repository — engine code and product code intertwined, with the engine importing the app's profile, trust anchors, and moderation control plane directly.

The SIP-01 protocol needed a reusable reference implementation, and the engine deserved to be buildable without the product. So the codebase was extracted, in phases, under one rule: **MOVE → ADAPT → TEST**, never rewrite-and-hope, with the test gate green after every phase.

## The extraction program (M1–M9 and the final split)

The full phase table with commit hashes lives in [`docs/EXTRACTION-MAP.md`](../EXTRACTION-MAP.md). In brief:

- **Phase 0–2 (preparation).** Repaired the server boundary; wrote characterization tests pinning federation, ranking, registry, and relay-pool behavior; broke the early coupling inversions: storage-migration helpers extracted, `observationFromResult` moved out of the protocol module with an injected `indexerSource`, the `appRelays ⇄ relayDiscovery` cycle broken, the composable `createProviderRegistry` seam introduced, and the `configureEngine` seam created so engine/AI stopped importing the app profile.
- **M1–M6 (physical homes).** The layers moved to their current directories: `src/protocol/`, `src/federation/`, `src/engine/providers/`, `src/engine/query/`, `src/ai/`, `src/engine/hooks/` — each move mechanical, each followed by the gate.
- **M7.** The Dsearch application plane consolidated into `src/app/` (profile, moderation, reports, referrals, pages, hooks) — one side of the line, ready to be cut.
- **M8.** `appRelays.ts` split: generic pool machinery stayed core; Dsearch's default relay lists and storage keys moved to the app plane behind the new `configureRelays` seam, with neutral `sip01:*` defaults.
- **M9.** Proven-dead legacy search paths retired (zero live consumers, re-verified before deletion).
- **M10 + FINAL (the split).** Owner decision: the legacy self-hosted backend (crawlers, NIP-50 relay, abuse API) was removed to separate infrastructure repos. Then the application plane itself — `src/app/`, pages, components, contexts, app shell, brand assets, worker, and deploy infrastructure — was **removed from this repository**. The last cross-layer edge (`useProviderSearch` reading the app-moderation import) was resolved by the `EngineRuntime.moderation` injection point; the four `dsearch:*` engine/AI localStorage keys were renamed to `sip01:*` with read-through migration; Dsearch-branded `alt` strings were reworded to neutral "SIP-01 web index" phrasing (wire shape unchanged).

The extraction program is **closed**. What remains is the library you are reading the docs for.

## What was removed

To be explicit about what is *not* here anymore:

- The entire application plane: pages, UI components, app contexts/hooks, routing, brand assets.
- The Dsearch engine profile, trust anchors (owner pubkey), and moderation control plane.
- The server shell: the Cloudflare worker that held `OPENAI_API_KEY`/`BRAVE_API_KEY` (the isomorphic proxy *logic* stayed, host-agnostic, in `src/ai/engineProxy.ts` and `src/engine/providers/braveProxy.ts`).
- The legacy self-hosted backend stack (crawlers, Meilisearch, NIP-50 relay proxy, abuse API).
- All deployment infrastructure (wrangler config, Pages deploy workflow, backend docker compose).

## The archive branch

The last commit containing the full **core + app** tree is preserved on the branch:

```
archive/pre-core-only
```

That branch is the historical reference for the pre-split state — the application code, the worker, and the deploy setup as they were. It is kept for archaeology and for the Dsearch migration (below), not for development: all active work happens on `main`, which is core-only.

## Relation to Dsearch going forward

Dsearch the product continues in its own repository, to be rebuilt as an **application on top of this core** — injecting its profile, relay pools, trust policy, and UI through the seams (`configureEngine`, `configureRelays`, `createProviderRegistry`, `EngineRuntimeProvider`) instead of owning the engine code. That migration is planned but not part of this repo; when it lands, Dsearch becomes one consumer among the engines in the [architecture diagram](../architecture.md#three-levels-not-one), and the archive branch remains the record of how it used to look.
