# Security and privacy

The security model of the core: where secrets may live, where they may never live, and what leaves the browser. Every claim on this page is grounded in the code — the module is named with each one.

## The env model

The library reads exactly **one** build-time environment variable:

| Variable | Where read | Purpose |
|---|---|---|
| `VITE_ENGINE_API_BASE` | `src/ai/aiConfig.ts` (`ENGINE_AI_BASE`) | Non-secret base URL of the host's engine-AI proxy. Default: same-origin `/api/ai`. |

`VITE_*` variables are baked into the public bundle — by design, nothing secret may ever be placed in one. This is the only `import.meta.env` read in `src/`.

Server-side secrets exist only in the **host's deployment**, never in this library: the isomorphic proxy modules read `OPENAI_API_KEY` (with `AI_API_KEY` as a deprecated alias) and `BRAVE_API_KEY` from an injected env object (`EngineAIEnv` in `src/ai/engineProxy.ts`, `BraveProxyEnv` in `src/engine/providers/braveProxy.ts`). `.env.example` documents the pattern — note that its worker and legacy-stack sections describe the *old Dsearch deployment*; the worker shell and backend were removed from this repo with the application plane, and hosts deploy their own equivalents.

## No client-side API keys by default

- The core ships **no keys** — nothing in the bundle, nothing in code.
- The AI layer resolves credentials by precedence (user BYOK → keyless provider → engine proxy → host-injected community tier → unavailable; `resolveAIConfig` in `src/ai/aiConfig.ts`). With no configuration, the result is `unavailable` — there is no hidden default key.
- The optional `community` tier is a host decision: a shared, rate-limited key that is **public by design** and ships in the host's bundle (`EngineRuntimeConfig.ai.community`).

## BYOK storage keys

User-supplied keys live in this browser's localStorage only, under `sip01:*` keys, and are sent nowhere except the corresponding provider's request path:

| Key | Module | Sent to |
|---|---|---|
| `sip01:ai-config` (contains the user's AI key) | `src/ai/aiConfig.ts` | The user's chosen AI provider (via the CORS proxy — disclosed behavior) |
| `sip01:brave-api-key` | `src/engine/providers/braveKey.ts` | Brave's API via the CORS proxy (the proxy sees query + key) |
| `sip01:parallel-api-key` | `src/engine/providers/parallel.ts` | Parallel's API |

Old `dsearch:*`/`presearchstr:*` values migrate on first read (`STORAGE_KEY_RENAMES`, `src/lib/storageMigration.ts`); writes go to the canonical key and remove the legacy ones. The device indexing identity secret lives separately at `sip:indexer:secret` (`src/protocol/indexerIdentity.ts`) — plaintext in localStorage like any browser-side Nostr key, acceptable because the key is disposable, pseudonymous, and signs only public document metadata.

## The server-side proxy pattern

Providers and AI tiers that need operator secrets use the same pattern: the browser calls a **same-origin** route with no key, and the host's server injects the secret upstream.

- AI: `POST {ENGINE_AI_BASE}/chat/completions`-style calls; status from `GET {ENGINE_AI_BASE}/status`. The key is never in the bundle, localStorage, or any API response.
- Brave: `POST {base}/search/brave` (derived from `ENGINE_AI_BASE` in `src/engine/providers/brave.ts`).

The proxy **logic** (`src/ai/engineProxy.ts`, `src/engine/providers/braveProxy.ts`) is isomorphic and host-agnostic — all defaults are explicit parameters, no browser-only or vendor-only APIs — so hosts can run it on any serverless/Node stack. The secret-holding **shell** (worker + secrets) belongs to the deploying application's infrastructure repo. The old Dsearch worker was removed with the application plane; nothing in this repo holds secrets server-side because nothing in this repo is a server.

## Privacy Mode

`EngineRuntime.privacyMode: true` restricts searching to `privacy: 'nostr'` providers (`getProvidersForPrivacy`, used by `useProviderSearch`): no queries leave for clearnet APIs, CORS proxies, or third-party servers. Relay auto-discovery additionally skips its NIP-11 probe phase while Privacy Mode is on — "no CORS-proxy traffic" wins over discovery (`src/lib/relayDiscovery.ts`). Query classification (`classifyQuery`) keeps Nostr identifiers (npub/note/NIP-05) from ever being sent to external engines, in any mode.

## No telemetry

The core contains **no analytics and no telemetry code** — no beacons, no trackers, no usage reporting. The only "analytics" reference in the codebase is a filter that *excludes* SearXNG instances advertising trackers from the instance pool (`src/engine/providers/searxngInstances.ts`). The privacy-sensitive writes the engine does make are all user-visible protocol behavior: kind 39697 observations (page metadata only — never the query, never the personal identity), NIP-25 votes, and **hashed** term signals whose plaintext is revealed only after `TRENDING_THRESHOLD` distinct devices signaled the same term (`src/federation/termSignals.ts`).

## Honesty notes

- **Key separation ≠ network anonymity.** Relay operators and network observers can still see IP addresses and timing (spec §16).
- **CORS-proxy tiers are disclosed, not hidden.** Providers with `privacy: 'proxied'` route the full request URL — including the query — through a proxy; the `PrivacyTier` type and each provider's `privacyNote` exist so hosts can surface this honestly.
- **Signatures prove authorship, not accuracy.** The trust signal is agreement between independent indexers (spec §18), and moderation policy is the host's own — see [Identity, votes, and moderation](../guides/identity-votes-moderation.md).
