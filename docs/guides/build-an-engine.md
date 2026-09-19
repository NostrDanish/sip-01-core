# Build a search engine on the core

The flagship walkthrough: from an empty React app to a working search engine on the SIP-01 core — configured, wrapped in the runtime, searching, rendering, auto-indexing, and voting. Every name used here is a real export from the library barrel (`src/index.ts`).

## What you are building

sip-01-core is a library, not an app. Your application supplies the shell (routing, pages, branding), its identity (engine profile, relay pools), and its policy (moderation, vote identity). The core supplies the protocol, the providers, the query engine, the hooks, and the relay machinery. The pieces meet at three places, always in this order:

1. **Bootstrap** — `configureEngine()` + `configureRelays()`, once, before rendering.
2. **React tree** — `QueryClientProvider` (the hooks use `@tanstack/react-query`), then `EngineRuntimeProvider`.
3. **Components** — engine hooks like `useProviderSearch`.

## 1. Install

The package is not published to npm yet, so depend on the repository directly (git dependency or vendored `dist/` build — see [Getting started](../getting-started.md#consuming-the-core-today)). Install the peer dependencies in your app:

```bash
npm install react react-dom @tanstack/react-query @nostrify/nostrify nostr-tools
```

## 2. Configure the seams at bootstrap

Call both configurators once, at the top of your entry point, **before** any engine module is used. Both have neutral brand-free defaults until you call them; skipping them is legal but leaves you with empty relay pools and a generic engine id.

```ts
// main.tsx (excerpt)
import { configureEngine, configureRelays, DEFAULT_ENGINE_SYSTEM_PROMPT } from 'sip-01-core';

configureEngine({
  id: 'my-engine',
  search: {
    brave: false,                 // true if you deploy the server-side Brave proxy tier
    indexerSource: 'my-engine/1', // stamped as the SIP-01 `source` tag on observations
  },
  ai: {
    enabledDefault: false,
    providerId: 'custom',
    providerName: 'Custom',
    endpoint: '',
    model: 'auto',
    systemPrompt: DEFAULT_ENGINE_SYSTEM_PROMPT,
    // community: { providerId, endpoint, apiKey, model } — optional shared
    // free tier; the key ships in your bundle by design. Omit to disable.
  },
});

configureRelays({
  searchRelays: ['wss://your-search-relay.example'],
  indexRelays: ['wss://your-index-relay.example'],
  gitRelays: [],
  wikiRelays: [],
  storageKeys: {
    customSearchRelays: 'myengine:search-relays:custom',
    hiddenSearchRelays: 'myengine:search-relays:hidden',
    customIndexRelays: 'myengine:index-relays:custom',
    hiddenIndexRelays: 'myengine:index-relays:hidden',
    customGitRelays: 'myengine:git-relays:custom',
    hiddenGitRelays: 'myengine:git-relays:hidden',
    customWikiRelays: 'myengine:wiki-relays:custom',
    hiddenWikiRelays: 'myengine:wiki-relays:hidden',
    discoveredRelays: 'myengine:relay-discovery:verified',
    relayDiscoveryEnabled: 'myengine:relay-discovery:enabled',
    appConfig: 'myengine:app-config',
  },
  legacyStorageKeys: {}, // or a map for read-through migration of old keys
});
```

The full field-by-field reference is [Relays and configuration](relays-and-config.md). The core hardcodes **no** relay URLs — you must supply pools for the index features to have anything to talk to.

## 3. Wrap your app in the providers

```tsx
// main.tsx (continued)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EngineRuntimeProvider } from 'sip-01-core';

const queryClient = new QueryClient();

root.render(
  <QueryClientProvider client={queryClient}>
    <EngineRuntimeProvider
      runtime={{
        privacyMode: false,
        autoIndex: true,          // contribute results back to the shared index
        disabledProviders: [],
        languageFilter: [],
        voteWithIdentity: false,  // anonymous device-identity votes (default)
        // userSigner: …           // required if voteWithIdentity is true
        // moderation: …           // your ModerationSet — see the moderation guide
      }}
    >
      <App />
    </EngineRuntimeProvider>
  </QueryClientProvider>,
);
```

Every `EngineRuntime` field is optional and merges over the parent runtime, so nested providers can override single fields. With no provider at all, the hooks run on `DEFAULT_ENGINE_RUNTIME` (privacy mode off, auto-index off, no moderation).

## 4. Run a search

`useProviderSearch` is the orchestrator: it runs every applicable provider in parallel, streams results as each resolves, deduplicates, applies your query's hard constraints locally, filters hidden results through your moderation set, and — when `autoIndex` is on — contributes useful web results back to the SIP-01 index.

```tsx
import { useState } from 'react';
import { useProviderSearch } from 'sip-01-core';

function SearchPage() {
  const [query, setQuery] = useState('');
  const { results, providers, isLoading, isEmpty, suggestions } = useProviderSearch({
    query,
    source: 'all',   // a SearchSource, 'all', or 'index' (community index only)
  });

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ol>
        {providers.map((p) => (
          <li key={p.id}>
            {p.name}: {p.status}
            {p.status === 'done' && ` (${p.resultCount} in ${p.latencyMs}ms)`}
          </li>
        ))}
      </ol>
      {isEmpty && !isLoading && <p>No results.</p>}
      <ul>
        {results.map((r) => (
          <li key={r.id}>
            <a href={r.url}>{r.title}</a>
            <p>{r.snippet}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

What you get back (`UseProviderSearchResult`):

| Field | Meaning |
|---|---|
| `results` | All results, merged, deduplicated, coverage-ranked, moderation-filtered. |
| `providers` | Per-provider status (`idle`/`searching`/`done`/`error`, result count, latency) for live progress UI. |
| `isLoading` / `isFetching` | At least one provider still searching / fetching. |
| `isEmpty` | Everything finished, nothing found. |
| `suggestions` | Related-query suggestions from web providers (≤ 8). |
| `counts` | Result counts per source category. |
| `privacyMode` | Whether Privacy Mode is active (Nostr-tier providers only). |
| `suppressedProviders` | Providers blocked by Privacy Mode for the current source. |

Query classification runs first: an npub/note/URL in the search box never leaves for external engines, and structured operators (`site:`, `lang:`, `before:`, …) are enforced locally after every provider answers — see [Query syntax](query-syntax.md).

## 5. Instant answers (optional)

```tsx
import { useInstantAnswer } from 'sip-01-core';

const { answer, isLoading } = useInstantAnswer(query, true);
// answer is a discriminated union: calculator | profile | event | url | wikipedia | duckduckgo
```

## 6. Votes

Votes are NIP-25 (kind 7) reactions on either the result's Nostr event or its normalized URL. Anonymous (device indexing identity) by default; attributable when `voteWithIdentity: true` and a `userSigner` is injected.

```tsx
import { useVoteCounts, useVoteActions, voteTargetFor } from 'sip-01-core';

const targets = results.map(voteTargetFor).filter((t) => t !== null);
const { data: tallies } = useVoteCounts(targets.map((t) => t.key));
const { vote } = useVoteActions();

// later, on a click:
await vote(result, 1); // or -1
```

Tally rule: latest vote per pubkey per target wins; `score = up − down`. The identity model and signer requirements are covered in [Identity, votes, and moderation](identity-votes-moderation.md).

## 7. Auto-indexing

With `autoIndex: true` in the runtime, `useProviderSearch` automatically publishes kind 39697 observations for useful web results (capped at 10 per search), signed by the device's indexing identity, to the index relay pool. It never publishes the query, never uses the user's personal key, and never re-indexes results that came *out of* the index (echo-loop prevention). Each successful text search also publishes a **hashed** term signal for k-anonymity trending. Nothing else is required of you — but your `indexRelays` pool must be configured for the events to land anywhere.

## 8. Add the AI answer layer (optional)

```tsx
import { useAIAnswer } from 'sip-01-core';

const { answer, isLoading } = useAIAnswer(query, results, aiEnabled);
```

AI is off by default and fully opt-in; credential resolution follows the precedence chain documented in [AI answers](ai-answers.md).

## Checklist

- [ ] Peer dependencies installed
- [ ] `configureEngine()` + `configureRelays()` called once at bootstrap
- [ ] `QueryClientProvider` outside `EngineRuntimeProvider`
- [ ] Search rendered from `useProviderSearch`
- [ ] `autoIndex` / votes / AI / moderation enabled as your product decides

Next: [Search providers](search-providers.md) to shape the catalog, [Relays and configuration](relays-and-config.md) for the full config reference.
