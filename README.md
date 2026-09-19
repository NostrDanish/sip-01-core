<p align="center">
  <img src="public/brand/logo.svg" alt="Dsearch — The community-driven search engine. Powered by Nostr, owned by no one." width="480">
</p>

# SIP-01-core

**The reusable reference implementation of the SIP-01 Search Index Protocol —
engine, contracts, providers, and AI layer that any search engine can build on.**

## What SIP-01 is

[SIP-01](https://github.com/NostrDanish/SIP-01) (Search Index Protocol) is an
open Nostr protocol for a decentralized web-document index: indexers publish
observations about web pages as addressable Nostr events (kind 39697), and any
search engine can read the shared index from public relays — no central
crawler, no central server. The canonical specification (currently **v1.2**,
wire schema `v: "1"`), its test vectors, and the wire format live in the
[`NostrDanish/SIP-01`](https://github.com/NostrDanish/SIP-01) repo; a vendored
copy is kept at [`docs/SIP-01.md`](docs/SIP-01.md) for convenience. When they
disagree, the spec repo wins.

## What sip-01-core is

This repo is the protocol's **reference implementation plus a reusable
search-engine core**: the byte-critical protocol code, the shared federation
contracts, and a complete engine (providers, query/rank stack, relay
machinery, optional AI answers) that any application can build on.

```
src/protocol/    SIP-01 reference implementation (byte-critical, spec-pinned)
src/federation/  shared 0xsearchstr:* event contracts (frozen namespaces)
src/lib/         core contracts + relay/proxy machinery (config seams)
src/engine/      providers + query/rank stack + engine hooks
src/ai/          AIProvider contract + OpenAI-compatible layer
src/app/         the co-hosted application (today: Dsearch)
```

## What it is NOT

- **Not the protocol specification.** The spec is the
  [`NostrDanish/SIP-01`](https://github.com/NostrDanish/SIP-01) repo; this is
  software that implements it.
- **Not a published npm package.** `package.json` is `private: true`; nothing
  here is published to any registry. Building on the core today means working
  from this repository (see below).
- **Not yet split from the application it hosts.** The Dsearch app still lives
  in this repo (`src/app/`, `src/pages/`, most of `src/components/`). Moving
  the application plane out into its own repo (the "apps split") is a future
  phase — see [`docs/EXTRACTION-MAP.md`](docs/EXTRACTION-MAP.md).

## Relationship to Dsearch

[Dsearch](https://github.com/NostrDanish/Dsearch) is the flagship search
engine built on this stack. Today the two are **co-hosted in this repo**:
Dsearch is the in-tree reference application, isolated under `src/app/`
(extraction phases M1–M9 complete). The Dsearch repo will migrate onto the
core as a downstream consumer in the apps-split phase. The Dsearch product
itself is documented below under
[“Co-hosted application: Dsearch”](#co-hosted-application-dsearch).

## Building your own engine on the core (today)

**Fork the stack.** Clone this repo, then:

1. **Replace the app profile** — `src/app/profile.ts` is the Dsearch instance
   of `EngineProfile` (branding, tabs, provider selection, AI prompt,
   community-AI config). Write yours in its place.
2. **Configure the seams** — call `configureEngine()` (`src/lib/engineConfig.ts`)
   and `configureRelays()` (`src/lib/relayConfig.ts`, your default relay pools
   + storage-key names) once at bootstrap. Engine, AI, and relay internals
   never import an application profile; they read these seams at call time.
3. **Compose providers** — `createProviderRegistry([...])`
   (`src/engine/providers/registry.ts`) builds a catalog from any mix of the
   15 built-in providers and your own. Any source that implements
   `SearchProvider` (`src/engine/providers/types.ts`) slots in — including
   closed-source ones.
4. **Slot in your AI** — implement `AIProvider` (`src/ai/types.ts`), or reuse
   `createOpenAICompatibleProvider` for any OpenAI-compatible endpoint.
5. **Replace ranking/UI freely** — `src/engine/query/resultRank.ts` is one
   replaceable ranker behind the same contracts; `src/components/` is a
   reusable UI kit you can keep or discard with the pages.

**Public interfaces vs. implementation details:** the public, semver-cared-for
surface is the protocol layer, the federation namespaces, the two config
seams, `SearchProvider`/`createProviderRegistry`, the query/rank functions,
and `AIProvider` — the per-layer contract with exact export lists is
[`PACKAGE_BOUNDARIES.md`](PACKAGE_BOUNDARIES.md). Everything else (provider
internals, hook composition, page structure) is experimental and may change
between releases.

**Staying SIP-01 compatible:** run the protocol tests
(`npx vitest run src/protocol` — 45 tests pinning the spec §13 vectors
byte-for-byte); never change `normalizeIndexUrl` / `documentId` /
`contentHash` behavior, never rename the `0xsearchstr:*` federation
namespaces, and never change the wire format (`v` stays `"1"`) except through
a spec revision. Architecture deep-dive: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Open contracts, closed components

The protocol layer, federation contracts, config seams, and the provider/AI
interfaces are designed as **open contracts** — stable touchpoints you build
against. Providers, ranking, AI backends, crawlers, datasets, and UI are
designed as **replaceable components**: you can keep the built-ins, swap
individual ones, or keep your own versions proprietary behind the same
interfaces.

**Licensing boundary:** this repository currently has **no LICENSE file**.
Without one, no reuse or distribution rights are granted by default. A
licensing decision is required before third-party reuse or distribution of
any layer; until then, treat the code as all-rights-reserved and do not
assume terms for any derivative, open or closed.

## Versioning — three separate axes

| Axis | Current | Changes when |
|---|---|---|
| **SIP-01 document revision** | v1.2 | the spec repo publishes a revision |
| **Wire schema version** (`v` tag) | `"1"` | only with a spec revision that changes the wire format |
| **sip-01-core software version** | 0.1.0 (semver, this repo) | any software release — internal improvements must not change wire behavior |

Protocol compatibility always takes priority over software architecture: the
core can ship fixes and features while the wire format stays frozen.

---

# Co-hosted application: Dsearch

**The community-driven search engine. Powered by Nostr, owned by no one.**

Dsearch is the **decentralized search engine built by its users** — and the home of an open
search-infrastructure ecosystem. One shared index on Nostr, built by everyone who searches,
crawls, indexes, or runs a relay. No company owns the crawler, the index, the relay network,
or this interface.

**Live:** [dsearch.com](https://dsearch.com)

[![Edit with Shakespeare](https://shakespeare.diy/badge.svg)](https://shakespeare.diy/clone?url=https%3A%2F%2Fgithub.com%2FNostrDanish%2FDsearch.git)

---

## Brand

All brand assets live in [`public/brand/`](public/brand/):

| File | What |
|------|------|
| [`icon.svg`](public/brand/icon.svg) | **The master mark** — vector, scales to any size |
| [`logo.svg`](public/brand/logo.svg) | Horizontal lockup — mark + wordmark + tagline (auto light/dark) |
| [`pwa-icon.png`](public/brand/pwa-icon.png) | **PWA / app icon** — 1024×1024 dark-tile mark (install, home screen, apple-touch) |
| [`icon-1024.png`](public/brand/icon-1024.png) | Raster icon 1024×1024 (same mark, avatars / app stores) |
| [`logo-1024.png`](public/brand/logo-1024.png) | Raster lockup 1024×1024 |
| [`logo-lockup.jpg`](public/brand/logo-lockup.jpg) | Dark-tile lockup (JPEG) |
| [`favicon.svg`](public/favicon.svg) | Browser tab icon (simplified for 16–32px) |
| [`og.jpg`](public/og.jpg) | Social link preview card |

The mark: a magnifying glass revealing a node network shaped like the letter
**D** — search (the glass) over the decentralized index (the constellation).
Teal `#17a398` with deep navy `#1b3a7a` accent nodes. In the app, every teal
element renders in `currentColor`, so the logo follows the active theme and
the user's accent color (`src/components/LogoMark.tsx`).

---

## The Ecosystem

Dsearch is the flagship engine of a modular stack. Every layer is open, separable, and
runnable by anyone:

```
                         ┌─────────────────┐
                         │    DSEARCH      │   ← this repo
                         │  Search Engine  │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │       SIP       │
                         │ Search Protocol │   SIP-01 (documents, v1.2)
                         └────────┬────────┘   SIP-02 (queries, draft)
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
        ┌─────▼─────┐       ┌────▼─────┐       ┌────▼─────┐
        │ CRAWLSTR  │       │ INDEXSTR │       │   SIP    │
        │  crawler  │       │  indexer │       │  RELAYS  │
        └─────┬─────┘       └────┬─────┘       └────┬─────┘
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 │
                         ┌───────▼───────┐
                         │ DECENTRALIZED │
                         │ SEARCH INDEX  │
                         └───────────────┘
```

| Component | Role | Repo | Live |
|-----------|------|------|------|
| **Dsearch** | Search engine + ecosystem hub | this repo | [dsearch.com](https://dsearch.com) |
| **SIP-01** | The protocol spec + test vectors | [SIP-01](https://github.com/NostrDanish/SIP-01) | [spec site](https://sip.shakespeare.wtf) |
| **Crawlstr** | Lightweight browser crawler | [Crawlstr](https://github.com/NostrDanish/Crawlstr) | [crawlstr.vercel.app](https://crawlstr.vercel.app) |
| **Indexstr** | Heavyweight distributed indexer | [indexstr](https://github.com/NostrDanish/indexstr) | [indexstr.vercel.app](https://indexstr.vercel.app) |
| **SIP Booster Relay** | Serverless index relay (Cloudflare) | [SIP-Booster-Relay](https://github.com/NostrDanish/SIP-Booster-Relay) | dashboard |
| **UNCAGED Index Relay** | Self-hosted index relay (OpenSearch) | [UNCAGED-Index-Relay](https://github.com/NostrDanish/UNCAGED-Index-Relay) | — |
| **Crawlstr SIP Relay** | Android index relay | [Crawlstr-SIP-Relay](https://github.com/NostrDanish/Crawlstr-SIP-Relay) | — |

**Lineage:** Dsearch consolidates several iterations of community search work —
**0xSearchstr** (the original aggregator) → **UNCAGED Engine** (the minimal template) →
**Presearchstr** (the community fork) → **Dsearch** (the independent ecosystem).
It is not a rebrand of any single predecessor: it's where the stack becomes one coherent project.

**Federation:** Dsearch and [0xSearchstr](https://github.com/NostrDanish/0xSearchstr) share one
index. Same kinds, same tags, different signers. A search on either app warms the index for both.

---

## What You Can Do Here

- **Search** — the engine: SIP-01 community index first, then 15 parallel providers (Nostr NIP-50,
  SearXNG, DuckDuckGo, Brave BYOK, Hacker News, wiki, git, Tor…). Keyword staking with your Nostr key.
- **Network** (`/network`) — live view: index relays, crawler heartbeats, latest observations.
- **Build** (`/build`) — run a crawler (Crawlstr), an indexer (Indexstr), or a SIP relay.
- **Protocol** (`/protocol`) — SIP-01 explained; SIP-02 (query layer) draft area.
- **Community** (`/community`) — every repo, every contribution path.

---

## How the Search Engine Works

```
User Search
       │
       ▼
 ┌─────────────── All providers run in parallel ──────────────┐
 │  Web Index (SIP-01) · Legacy Cache · Nostr NIP-50 · Stakes │
 │  Community · SearXNG · DuckDuckGo · Brave (BYOK) · HN ·    │
 │  Wiki (NIP-54) · Git (NIP-34) · StackOverflow · Tor · Wiki │
 └──────────────────────┬──────────────────────────────────────┘
                        │
                   Merge + Deduplicate + Rank (coverage-weighted)
                        │
                        ▼
                    Display Results  →  auto-index surfaced pages (SIP-01)
                        │
                   Still nothing? → privacy-respecting fallback links
```

1. **Every source is a provider** — each returns a universal `SearchResult[]`
2. **All providers run in parallel** — results stream in as each completes
3. **The community index scores highest** — decentralized results are prioritized
4. **Auto-indexing** — every search contributes surfaced pages back as SIP-01 observations,
   signed by a per-device pseudonymous keypair (never your identity, never your query)
5. **Never empty** — fallback links to privacy-respecting engines

### Structured queries

The search bar parses real search syntax into an AST and executes it **locally and
authoritatively** — operators are never "stripped and hoped for":

```
"decentralized search"      exact phrase        site:github.com     host + subdomains
nostr AND privacy           boolean (UPPERCASE) lang:de             language
nostr NOT twitter           exclusion           tag:nostr           exact topic tag
(nostr OR bitcoin)          grouping            after:2026-01-01    date boundary
```

This engine is the reference implementation seed for the in-development **SIP-02** query-layer
specification. Full guide: [docs/SEARCH-QUERIES.md](docs/SEARCH-QUERIES.md).

### Query classification & privacy

| Input | What happens |
|-------|--------------|
| `15% of 80` | Calculator instant answer — no providers run at all |
| `npub1…` / `note1…` | Nostr instant card — clearnet engines never see it |
| `name@domain.tld` | NIP-05 resolution to a profile card |
| `https://example.com` | SIP-01 index lookup — only Nostr-tier providers run |
| anything else | Full provider fan-out |

Provider skipping isn't just speed — it's privacy. The honest traffic-light indicator by the
search bar shows exactly who can see each query (Nostr relays / direct APIs / proxied engines).

### Keyword staking

Stake a keyword with your Nostr key — no tokens: sign an addressable event binding a keyword to
your link and it takes the top "Community Stake" placement on every compatible client. One stake
per keyword per npub; recency-ranked today, zap-weighting-ready by schema.

---

## Protocol

Everything this app writes is documented in [NIP.md](NIP.md) and the canonical
[SIP-01 spec](https://github.com/NostrDanish/SIP-01) (local copy: [docs/SIP-01.md](docs/SIP-01.md)):

- **Web document index** (`widx:*`) — SIP-01, kind 39697, per-device indexer identities
- **Search cache** (`0xsearchstr:cache:*`) — federated legacy cache, kind 30078 (frozen, read-only)
- **Term signals** (`0xsearchstr:term:*`) — hashed k-anonymity trending (never plaintext queries)
- **Community submissions** (`0xsearchstr:submit:*`) — user-curated links
- **Keyword stakes** (`0xsearchstr:stake:*`) — Nostr-native keyword placement

The `0xsearchstr:*` namespaces are the **federation contract** shared with 0xSearchstr and every
compatible fork — they are intentionally kept, not legacy accidents.

Application control-plane data (role lists, moderation labels, abuse inboxes, affiliate rules,
invite-friends config) lives in the **`dsearch:*` control plane** (`src/app/dsearchProtocol.ts`),
rooted at the owner key — never in the shared federation namespaces. Legacy `presearchstr:*` /
`0xsearchstr.*` control data stays readable (owner-signed) until migrated. Partner referrals use
pseudonymous per-device keys (kinds 34967 / 6079, `t: dsearch-referral`).

---

## Relay Pools

Four default pools, all user-editable in Settings (hide defaults, add customs, restore):

| Pool | Purpose |
|------|---------|
| **Index Relays** | Where the community index lives — SIP-01 observations, legacy cache, submissions, stakes |
| **Search Relays** | NIP-50 full-text Nostr search (read-only) |
| **Git Relays** | NIP-34 repos/issues/PRs for the Code tab (read-only) |
| **Wiki Relays** | NIP-54 wiki articles (read-only) |

Index and search pools also grow by **auto-discovery** (NIP-66 announcements + NIP-11
verification; the SIP-01 `uncaged_index` block earns a relay its index-pool spot).

---

## AI Answers (optional)

An optional AI answer layer synthesizes cited answers from the result evidence pack — off by
default, ephemeral, never indexed. Credential precedence: **your own key** (any
OpenAI-compatible API, Settings → AI) → **engine-provided** (operator key via the included
Cloudflare worker, `/api/ai`) → **built-in free tier** (public, rate-limited by design) →
unavailable. Nostr results are excluded from evidence unless you opt in.

---

## Self-Hosted Backend (legacy, optional)

The `backend/` directory contains the original 0xSearchstr-era self-hosted stack (Meilisearch +
Nostr/clearnet/Tor crawlers + NIP-50 relay proxy + abuse API, `docker compose up -d`).
It is superseded in practice by the SIP-01 ecosystem (Crawlstr/Indexstr + SIP relays) and kept
for operators who want it. New infrastructure work targets the SIP stack.

---

## Quick Start

```bash
git clone https://github.com/NostrDanish/Dsearch.git
cd Dsearch
npm install
npm run dev
```

Open `http://localhost:8080` and search.

---

## Tech Stack

React 19 · TypeScript · Vite · TailwindCSS 4 · shadcn/ui · Nostrify · TanStack Query ·
optional Cloudflare worker (engine AI proxy only)

## License

No LICENSE file exists in this repository yet — see the
[licensing boundary](#open-contracts-closed-components) above. Until a
licensing decision lands, no reuse or distribution rights are granted by
default.

---

*Vibed with [Shakespeare](https://shakespeare.diy)*
