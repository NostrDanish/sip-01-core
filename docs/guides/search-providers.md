# Search providers

How the provider model works, what the 15 built-in providers are, how to compose your own catalog, and where provider credentials live.

## The contract

Every source — Nostr, SearXNG, Wikipedia, Brave, Tor, your proprietary backend — is an object implementing `SearchProvider` (`src/engine/providers/types.ts`) and returning the same `SearchResult[]`:

```ts
interface SearchProvider {
  id: string;                       // unique, e.g. 'searxng'
  name: string;                     // display name
  source: SearchSource;             // 'nostr' | 'web' | 'wiki' | 'news' | 'code' | 'tor' | 'i2p'
  additionalSources?: SearchSource[]; // extra tabs this provider also runs under
  privacy: PrivacyTier;             // 'nostr' | 'direct' | 'proxied'
  privacyNote: string;              // honest "who sees the query" text
  search(options: SearchOptions): Promise<ProviderSearchResponse>;
}
```

`SearchOptions` carries the query, an `AbortSignal`, an optional limit, the host's language filter, and the **pre-parsed structured query** (`parsed`) so providers can translate natively-supported operators. Regardless of what a provider does with operators, the merge layer applies hard constraints to its results afterwards — a provider misunderstanding `site:` can never produce an incorrect final result (see [Query syntax](query-syntax.md)).

The **privacy tier** declares who can observe the query:

| Tier | Meaning |
|---|---|
| `nostr` | Query goes over WebSocket to Nostr relays only. No third-party HTTP API, no CORS proxy. |
| `direct` | Query goes over HTTPS directly from the browser to a public API (Wikipedia, Hacker News, Stack Exchange). |
| `proxied` | Query is routed through a CORS proxy (SearXNG instances, DuckDuckGo HTML, Ahmia). The proxy sees the full request URL. |

## The 15 built-in providers

`ALL_PROVIDERS` (`src/engine/providers/registry.ts`), in display/priority order:

| # | Export | ID | Source | Privacy | What it is |
|---|---|---|---|---|---|
| 1 | `braveProvider` | `brave` | web | proxied / engine proxy | Official Brave Search API. User BYOK key, or the server-side engine proxy; dormant with neither. |
| 2 | `parallelProvider` | `parallel` | web | proxied | Parallel Search API — long dense excerpts. User BYOK key. |
| 3 | `duckduckgoProvider` | `duckduckgo` | web | proxied | DuckDuckGo HTML endpoint via CORS proxy. |
| 4 | `searxngProvider` | `searxng` | web | proxied | The SearXNG metasearch instance pool (discovered + custom instances). |
| 5 | `webIndexProvider` | `web-index` | web | nostr | **The SIP-01 index** — kind 39697 observations read from the index relays. |
| 6 | `cachedIndexProvider` | `cached-index` | web | nostr | The legacy `0xsearchstr:cache:*` query cache (kind 30078, read-only, trusted-indexer allowlist). |
| 7 | `stakesProvider` | `keyword-stakes` | web | nostr | Keyword stakes (`0xsearchstr:stake:*`) — staked URLs for staked keywords. |
| 8 | `communityProvider` | `community` | web (+ tor) | nostr | Community URL submissions (`0xsearchstr:submit:*`) + Nostra/NIP-B0 interop. |
| 9 | `nostrProvider` | `nostr` | nostr | nostr | NIP-50 full-text search across Nostr content on the search relays. |
| 10 | `gitProvider` | `git` | code | nostr | Nostr git ecosystem (NIP-34) repositories. |
| 11 | `nostrWikiProvider` | `nostr-wiki` | wiki | nostr | Wiki articles living on Nostr. |
| 12 | `wikipediaProvider` | `wikipedia` | wiki | direct | Wikipedia API. |
| 13 | `hackerNewsProvider` | `hacker-news` | news | direct | Hacker News (Algolia API). |
| 14 | `stackOverflowProvider` | `stackoverflow` | code | direct | Stack Exchange API. |
| 15 | `torProvider` | `tor` | tor | proxied | .onion search via Ahmia, through the CORS proxy. |

Order drives the provider-status chips and result streaming, not speed — everything runs in parallel. The `index` source selector is special: it means *the community index only* (`web-index` + `cached-index`).

## Composing your own catalog

`createProviderRegistry` is the plugin seam. Build a registry from any mix of built-ins and your own providers — including closed-source ones — without editing shared code:

```ts
import {
  createProviderRegistry,
  ALL_PROVIDERS,
  webIndexProvider,
  nostrProvider,
  type SearchProvider,
} from 'sip-01-core';

// Defaults plus your proprietary provider:
const registry = createProviderRegistry([...ALL_PROVIDERS, myProvider]);

// Or a deliberately minimal engine:
const minimal = createProviderRegistry([webIndexProvider, nostrProvider]);

registry.getProvidersForSource('web');
registry.getProvidersForPrivacy('all', true); // Nostr-tier only
registry.getProvider('brave');
registry.getAvailableSources();
```

A minimal custom provider:

```ts
import type { SearchProvider } from 'sip-01-core';

export const myProvider: SearchProvider = {
  id: 'my-backend',
  name: 'My Backend',
  source: 'web',
  privacy: 'direct',
  privacyNote: 'Your query goes directly to my-backend.example over HTTPS.',
  async search({ query, signal, limit }) {
    const res = await fetch(`https://my-backend.example/search?q=${encodeURIComponent(query)}`, { signal });
    const data = await res.json();
    return {
      results: data.items.slice(0, limit ?? 20).map((item: any) => ({
        id: `my-backend-${item.url}`,
        title: item.title,
        url: item.url,
        snippet: item.snippet ?? '',
        source: 'web' as const,
        provider: 'my-backend',
        engine: 'My Backend',
      })),
    };
  },
};
```

Provider ids must be unique within a registry. The default catalog functions (`getProvidersForSource`, `getProvidersForPrivacy`, `getProvider`, `getAvailableSources`) operate on `ALL_PROVIDERS`; the hooks use the default catalog — hosts that ship a custom registry wire it into their own UI layer.

## Provider config seams and BYOK storage

The core ships **no API keys**. Providers that need credentials resolve them at call time:

| Provider | Credential path | Storage / server key |
|---|---|---|
| `brave` | 1. User BYOK key in localStorage (query goes via the CORS proxy — the proxy sees query + key). 2. Engine tier: same-origin `POST /api/search/brave`, where the host's server injects `BRAVE_API_KEY`. 3. Neither → zero-cost no-op. | `sip01:brave-api-key` (user key); `BRAVE_API_KEY` (server-side only) |
| `parallel` | User BYOK key in localStorage only; sent nowhere except Parallel's API. | `sip01:parallel-api-key` |
| `searxng` | No key — a pool of public instances (discovered + user-added), health-tracked in localStorage. | `0xsearchstr:searxng:*` pool state keys |

The `sip01:*` keys were renamed from their `dsearch:*` predecessors; old values migrate on first read via `STORAGE_KEY_RENAMES` (`src/lib/storageMigration.ts`). The `0xsearchstr:searxng:*` keys predate the rename and are intentionally unchanged.

The **engine tier** for Brave is the server-side proxy pattern: the isomorphic logic lives in `src/engine/providers/braveProxy.ts`, but the secret-holding shell (a worker with `BRAVE_API_KEY`) belongs to your deployment, not to this library — see [Security and privacy](../reference/security.md).

## Privacy Mode

When `EngineRuntime.privacyMode` is true, `useProviderSearch` filters the active set to `privacy: 'nostr'` providers only — no queries leave for clearnet APIs, CORS proxies, or third-party servers. Blocked providers are reported in `suppressedProviders` so your UI can explain the difference. Query classification additionally prevents Nostr identifiers from ever reaching external engines, regardless of mode.
