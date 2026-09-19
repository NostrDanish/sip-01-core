# Testing

How the test gate works, where tests live, and the patterns to follow when adding tests for a new provider or module.

## The gate

```bash
npm run test
```

Four steps, all must pass — this is the same gate CI runs on every push and pull request to `main`:

| Step | Command | What it proves |
|---|---|---|
| 1 | `tsc --noEmit` | The whole tree type-checks (strict). |
| 2 | `eslint --cache` | Style **and the layer boundaries** — the `boundaries/*` blocks make illegal cross-layer imports a lint failure (see [Architecture](../architecture.md#enforced-rules-eslint)). |
| 3 | `vitest run` | 253 tests across 17 files, in a jsdom environment (`src/test/setup.ts`). |
| 4 | `vite build` | The library builds cleanly. |

Useful subsets:

```bash
npx vitest run src/protocol      # protocol conformance only (45 tests, §13 vectors)
npx vitest run src/engine        # engine tests
npx vitest run --watch           # TDD loop
```

The project rule (from the extraction program): **every phase must leave the gate green before it lands.** There is no "merge red, fix later."

## Test layout

Tests live next to the code they pin, as `*.test.ts` in the same directory:

| Area | Files | Character |
|---|---|---|
| `src/protocol/` | `webIndex.test.ts`, `indexerIdentity.test.ts` | **Protocol-critical.** §13 test vectors pinned byte-for-byte, plus build/parse/verify behavior. Touch nothing here without a spec reason. |
| `src/federation/` | `searchIndex`, `communityIndex`, `keywordStakes`, `termSignals` | Characterization tests for the frozen `0xsearchstr:*` contracts — builders, parsers, trust lists, thresholds. |
| `src/lib/` | `appRelays`, `storageMigration`, `privacy`, `engine/observation` | Pool defaults/mutation, migration semantics, privacy behavior, the observation adapter. |
| `src/engine/` | `providers/registry`, `providers/braveProxy`, `query/{queryParser,queryEngine,resultRank}` | Registry composition, proxy validation, query AST/evaluation/ranking. |
| `src/ai/` | `aiConfig`, `engineProxy` | Credential precedence chain, engine-proxy pipeline (config, validation, admin auth). |

## Adding tests for a new module

- **New provider** (`src/engine/providers/my-provider.ts`): add `my-provider.test.ts` beside it. Pin the mapping from the upstream API response to `SearchResult` (ids, `source`, `provider`, `engine` attribution), the privacy tier declaration, and edge behavior (empty responses, malformed items, abort). If the provider is registered as a built-in, extend `registry.test.ts` so `ALL_PROVIDERS` composition stays pinned.
- **New lib module**: test the pure behavior directly — jsdom gives you `localStorage` and `crypto.subtle`; relay/network layers are not mocked globally, so keep units pure or inject dependencies (the seams exist precisely so tests can inject; remember to call `resetEngineConfig()`/`resetRelayConfig()` after suites that configure, so module state does not leak between test files sharing a worker).
- **Anything protocol-adjacent**: if a change could alter `d`/`x` outputs, run `npx vitest run src/protocol` first and last. A green vector suite is the definition of "did not break the wire."

## The storageMigration test pattern

`src/lib/storageMigration.test.ts` is the template for testing namespaced localStorage behavior. The pattern:

1. `beforeEach(() => localStorage.clear())` — full isolation per test.
2. Pin **read-through migration**: legacy-only value → first read returns it, copies it to the canonical key, and deletes the legacy key.
3. Pin **canonical precedence**: when both keys exist, the canonical value wins and the legacy key is left untouched.
4. Pin **canonical-only writes**: `writeStoredCanonical` writes only the canonical key and clears legacy keys; `null` removes the canonical key (and still clears legacy).

Follow the same shape whenever you introduce or rename a `sip01:*` storage key: register the rename in `STORAGE_KEY_RENAMES` and add a test pinning the migration semantics, so old user state never silently disappears.
