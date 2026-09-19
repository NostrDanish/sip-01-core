# Contributing

The working agreements for changes to sip-01-core: boundaries discipline, the move-don't-rewrite philosophy, commit conventions, and how to decide what belongs in the core at all.

## The gate is law

Every change lands with `npm run test` green — typecheck, lint (including the boundary rules), 253 tests, and the library build. See [Testing](testing.md). If a change breaks the gate, the change is not done.

## Boundaries discipline

The layer model is enforced mechanically (`boundaries/*` eslint blocks — [Architecture](../architecture.md#enforced-rules-eslint)):

- `src/protocol/**` imports no `@/` module at all.
- `src/federation/**` imports protocol + npm + the two documented shared contracts.
- `src/lib/**` never reaches engine internals or the AI layer.
- `src/engine/**` and `src/ai/**` sit on protocol/federation/lib; shipped code never imports the test harness.

If your change *needs* to cross a line, the architecture is being changed — do it deliberately: update `PACKAGE_BOUNDARIES.md` first, get agreement, then change code and lint rules together. Smuggling a boundary crossing into a feature PR is the one unforgivable sin here.

Protocol behavior is even stricter: `normalizeIndexUrl` / `documentId` / `contentHash`, the `v` tag, and the `0xsearchstr:*` namespaces are frozen (see [Versioning](../reference/versioning.md) and [Protocol conformance](../reference/protocol-conformance.md)).

## MOVE → ADAPT → TEST

The philosophy that carried the extraction, and the default for any large restructuring:

1. **MOVE** the code physically (mechanical, behavior-preserving).
2. **ADAPT** the imports and call sites (still behavior-preserving).
3. **TEST** — the gate must be green before the move lands.

Never rewrite-and-hope. Coupling inversions (introducing a seam so a dependency flips direction) come *before* physical moves. Characterization tests come before coupling inversions: pin the current behavior, then change the structure underneath it.

## Commit conventions

Conventional Commits, matching the repo history:

```text
<type>(<optional scope>): <imperative summary>
```

Types in active use: `feat`, `fix`, `refactor(<layer>)`, `test(<area>)`, `docs(<area>)`, `build`, `ci`, `chore`. Examples from the log: `refactor(engine): decouple core from the app plane — EngineRuntime + engine moderation`, `test(app): pin Dsearch relay config defaults…`, `build: convert to library mode — vite lib build, public barrel, peer deps`. Documentation changes in this repository's GitBook space use the `docs(gitbook):` prefix.

## What belongs in core vs in apps

| Belongs in **core** (this repo) | Belongs in an **app** (your repo) |
|---|---|
| Protocol reference implementation (`src/protocol/`) | Branding, engine profile values, product pages |
| Frozen federation contracts (`src/federation/`) | Trust anchors, owner pubkeys, moderation policy |
| Host-agnostic machinery + config seams (`src/lib/`) | Relay pool defaults, storage key namespaces |
| The engine: providers, query stack, votes, moderation matcher, hooks (`src/engine/`) | UI components, routing, theme, layout |
| The `AIProvider` contract + OpenAI-compatible layer (`src/ai/`) | API keys, server shells holding secrets, deploy config |

The tests for "core-shaped":

- **No brand.** The core holds no product name, no hardcoded relay URLs, no credentials, no trust anchors — host identity arrives through `configureEngine()`, `configureRelays()`, and `EngineRuntime`.
- **No application imports.** If a module needs something from the host, add a seam (config injection) — never an import.
- **Protocol fidelity.** Wire behavior changes only through a spec revision, not a software PR.
- **Replaceable by design.** Providers, ranking, AI backends, and the moderation set are components behind contracts; a proprietary alternative must be able to slot in behind the same interface.

If a proposed feature fails one of those tests, it belongs in the application repo — or it needs an architecture discussion first, in `PACKAGE_BOUNDARIES.md` terms.

## Practical setup

Node 20, `npm ci`, `npm run test`. There is no separate dev server in this repo — it is a library; the test suite and the build are the feedback loop.
