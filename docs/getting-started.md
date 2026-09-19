# Getting started

Get the sip-01-core repository building and tested locally, and make your first import from the library.

## Requirements

- **Node.js 20** (the version CI builds and tests with)
- npm (ships with Node)
- git

No other services are required. The library builds and tests entirely locally; nothing is deployed from this repository.

## Clone and install

```bash
git clone https://github.com/NostrDanish/sip-01-core.git
cd sip-01-core
npm ci
```

`npm ci` installs the exact dependency set from `package-lock.json`, including the peer dependencies the host application would normally supply (`react`, `react-dom`, `@tanstack/react-query`, `@nostrify/nostrify`, `nostr-tools`) — they are declared as devDependencies here so the repo is self-contained for development and testing.

## Run the test gate

```bash
npm run test
```

The gate is four steps, all of which must pass:

| Step | Command | What it proves |
|---|---|---|
| 1 | `tsc --noEmit` | The whole tree type-checks. |
| 2 | `eslint --cache` | Style rules **and the layer boundaries** hold — e.g. `src/protocol/**` may not import any `@/` module (see [Architecture](architecture.md#enforced-rules-eslint)). |
| 3 | `vitest run` | 253 tests pass across 17 files, including the 45 protocol tests that pin the SIP-01 §13 test vectors byte-for-byte. |
| 4 | `vite build` | The library builds cleanly. |

To run only the protocol conformance tests:

```bash
npx vitest run src/protocol
```

## Build the library

```bash
npm run build
```

This runs `vite build` (ES module), then `tsc -p tsconfig.build.json` and `tsc-alias` to emit TypeScript declarations. Output:

- `dist/sip-01-core.js` — the ES module bundle
- `dist/index.d.ts` (+ per-module declarations) — types

`react`, `react-dom`, `@tanstack/react-query`, `@nostrify/nostrify`, and `nostr-tools` are external (peer dependencies) — a consuming application supplies them.

## Minimal usage

Everything public is exported from the package root (the barrel, `src/index.ts`). A first protocol-level interaction — normalize a URL and build an unsigned observation event:

```ts
import {
  normalizeIndexUrl,
  buildIndexEvent,
  parseIndexEvent,
  verifyObservation,
} from 'sip-01-core';

const url = normalizeIndexUrl('https://www.example.com/page/?utm_source=x&a=1');
// → 'https://example.com/page?a=1'

const unsigned = await buildIndexEvent({
  url: 'https://example.com/page?a=1',
  title: 'Example Page',
  description: 'A page about examples.',
});
// → { kind: 39697, content: '{"title":…}', tags: [['d', …], ['u', …], ['x', …], ['v', '1'], ['alt', …]] }
```

The unsigned event is then signed by an indexer identity (see [Identity, votes, and moderation](guides/identity-votes-moderation.md)) and published to relays (see [Relays and configuration](guides/relays-and-config.md)).

For the engine level — providers, hooks, the React runtime — continue to [Build a search engine on the core](guides/build-an-engine.md).

## Consuming the core today

The package is `private: true` and not published to any registry. To use it from an application, depend on the repository directly (a git dependency or a vendored build of `dist/`), and install the peer dependencies listed above in your app.

## Next steps

- [What is SIP-01?](what-is-sip-01.md) — the protocol primer
- [Architecture](architecture.md) — the layer model and boundaries
- [API reference](reference/api.md) — the full public surface
