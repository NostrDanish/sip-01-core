# What is SIP-01?

A primer on the Search Index Protocol — what a web-index observation is, how documents are identified, and the rules that keep every implementation byte-compatible. Everything on this page is a summary of the vendored specification, [SIP-01.md](SIP-01.md) (v1.2); the canonical authority is the [`NostrDanish/SIP-01`](https://github.com/NostrDanish/SIP-01) repository, and when anything disagrees, the spec wins.

## The idea in one paragraph

SIP-01 turns web indexing into a public good on Nostr. Anyone — a crawler, a browser, a bot — can publish a signed **observation** about a web page: "I saw this URL, and this was its title and description." Because observations are ordinary Nostr events on public relays, no one needs permission to publish them and no one needs permission to read them. A search engine is just a reader: it queries relays, groups observations by document, counts how many *independent* indexers agree, and ranks however it likes.

## The event: kind 39697

One addressable Nostr event per indexed web document (spec §2):

| Property | Value |
|---|---|
| Kind | **39697** |
| Name | Web Index Observation |
| Range | Addressable (30000–39999, NIP-01 kind-range conventions) |
| Status | Draft allocation — unused by any registered NIP |

Addressability is the point. Re-observing a page **replaces** the indexer's previous observation (one live slot per `(pubkey, d)`), while *different* indexers observing the same URL produce different events with the **same `d` tag** — that is the "N independent indexers saw this page" signal engines rank on (spec §2).

The event never contains a search query, a user identity, or anything about who surfaced the page. The indexer identity **is** the event pubkey (spec §14).

## Required and optional tags

Required (spec §5):

| Field | Location | Rule |
|---|---|---|
| `d` | tag | Exactly one. `widx:` + 32 lowercase hex chars; must equal the SHA-256-derived id of the normalized `u` (§3, §7). |
| `u` | tag | Exactly one. Canonical URL; `http(s)`, ≤ 2048 chars, allowlisted scheme (§11). |
| `title` | content JSON | 1–300 chars after trim. |
| `v` | tag | Exactly one. Schema version — `"1"` for this spec revision. |
| `alt` | tag | Exactly one. Human-readable summary, ≤ 1000 chars. |

Optional (spec §6):

| Field | Location | Meaning |
|---|---|---|
| `description` | content JSON | ≤ 1000 chars, plain text. |
| `image` | content JSON | Representative image, `https:` only, ≤ 2048 chars. |
| `t` | tag | 0–8 lowercase topic tags (`^[a-z0-9][a-z0-9-]{0,99}$`) — relay-filterable, so topical engines can slice the index. |
| `l` | tag | ISO 639-1 language code, bare two-letter form (see §12.5 for the NIP-32 labeling-convention note). |
| `x` | tag | Content hash (§8), 64-char lowercase hex SHA-256. |
| `published` | tag | Unix seconds — the page's own claimed publication time, if known. |
| `source` | tag | Indexer software id (e.g. `crawlstr/1`), ≤ 100 chars. Informational only — the pubkey is the real identity. |

## Document identity: the `d` tag

```
d = "widx:" + sha256_utf8(normalized_url)[0:32]   (lowercase hex, truncated)
```

The `widx:` prefix namespaces the slot so it cannot collide with other addressable schemas (spec §3). Because the `d` is derived from the *normalized* URL, every conformant indexer arrives at the same slot for the same page — that is what makes cross-indexer deduplication and agreement counting work at all.

## Content identity: the `x` tag

```
x = sha256_utf8(title + "\n" + description)   (absent description = "")
```

A cheap agreement signal (spec §8): same `d` + same `x` means two indexers observed the same metadata; same `d` + different `x` means the page changed or indexers disagree. It is deliberately a hash of the *metadata*, not the full HTML.

## URL normalization (spec §7, summary)

Before hashing into `d`, URLs are normalized. Implementations MUST produce byte-identical output:

1. Parse; reject anything not `http://` or `https://`.
2. Lowercase scheme and host; strip a leading `www.`.
3. Remove default ports (`:80` http, `:443` https).
4. Remove the fragment entirely.
5. Remove known tracking parameters (`utm_*`, `fbclid`, `gclid`, `dclid`, `mc_cid`, `mc_eid`, `igshid`, `ref_src`, `spm`, `si`) — **all other parameters are preserved**.
6. Sort remaining query parameters alphabetically by key (stable for duplicates).
7. Remove a trailing `/` from non-root paths.
8. Re-serialize with WHATWG URL semantics.

The path stays **case-sensitive** — only scheme and host are lowercased. The reference implementation is `normalizeIndexUrl()` in `src/protocol/webIndex.ts`, pinned by the §13 vectors (see [Protocol conformance](reference/protocol-conformance.md)).

## Wire schema version

The `v` tag versions the **schema**, not any software: it is `"1"` for spec v1.x. Consumers must ignore (or best-effort parse) unknown versions; publishers must not change a field's meaning without bumping `v` (spec §10). Software can improve freely while the wire format stays frozen — see [Versioning](reference/versioning.md).

## Extension tags (spec §9)

The core schema is fixed, but engines need facets. Extensions are optional tags registered in spec §9.2 — currently `type`, `platform`, `category`, `network` (keyword-shaped, lowercased), `country` (ISO 3166-1 alpha-2, uppercase), and `mime`. Experimental extensions use an `x-` name prefix; registration happens via a spec PR. Application-specific signals (votes, stakes, badges) go in **separate events referencing the observation**, never by changing core field meanings (§9.4).

## Frozen federation namespaces

Alongside SIP-01 proper, this repo implements shared event contracts under the `0xsearchstr:*` namespaces (legacy query cache, community submissions, keyword stakes, term signals — see [Architecture](architecture.md)). **These namespaces are frozen: renaming one forks the network.** Compatibility with 0xSearchstr and every existing fork depends on them staying exactly as they are; extend only with new tags or kinds.

## Privacy posture (spec §16)

An observation reveals the page's public metadata and the indexer's pseudonymous key — nothing about a user or a query. The reference identity model is a per-device keypair, generated and stored locally, never uploaded, replaceable at any time. Key separation is not network anonymity: relay operators can still observe IP and timing.

## Where to go next

- The full spec: [SIP-01.md](SIP-01.md) (vendored v1.2) — canonical: [`NostrDanish/SIP-01`](https://github.com/NostrDanish/SIP-01)
- How to publish/consume/relay: [SIP-01 implementation guide](IMPLEMENTATION-GUIDE.md)
- How this repo proves conformance: [Protocol conformance](reference/protocol-conformance.md)
