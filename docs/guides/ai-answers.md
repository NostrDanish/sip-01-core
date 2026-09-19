# AI answers

How the AI answer layer works, the `AIProvider` contract, how to plug in a custom backend, and how credentials resolve. AI sits **after** the search federation: providers gather evidence, the AI synthesizes an answer with `[n]` citations back to that evidence. AI answers are ephemeral — never indexed, never fed back into SIP-01.

## The contract

`AIProvider` (`src/ai/types.ts`) — two methods plus four metadata fields:

```ts
interface AIProvider {
  id: string;                // e.g. 'openrouter'
  name: string;              // display name
  defaultEndpoint: string;   // API base URL, no trailing slash
  requiresKey: boolean;      // false for keyless backends (Ollama, local gateways)
  models(endpoint: string, apiKey: string, signal?: AbortSignal): Promise<AIModel[]>;
  answer(endpoint: string, apiKey: string, req: AIAnswerRequest): Promise<AIAnswer>;
}
```

`AIAnswerRequest` carries the query, an evidence pack (`AIEvidenceItem[]` — numbered title/URL/snippet items that become the `[n]` citations), the model id, and an optional abort signal. `AIAnswer` is `{ text, model, provider }`.

Any OpenAI-compatible API works out of the box. The built-in catalog (`AI_PROVIDERS`, `src/ai/registry.ts`) is five entries — PPQ.ai, OpenRouter, OpenAI, Ollama (local), and a generic Custom endpoint — all created with the same factory:

```ts
import { createOpenAICompatibleProvider, getAIProvider, AI_PROVIDERS } from 'sip-01-core';

const myBackend = createOpenAICompatibleProvider({
  id: 'my-llm',
  name: 'My LLM',
  defaultEndpoint: 'https://llm.example.com/v1',
  requiresKey: true,
});
```

A fully custom (non-OpenAI-compatible) backend implements the two methods directly against the same interface — nothing else in the layer changes.

## Using it in the UI

```tsx
import { useAIAnswer } from 'sip-01-core';

const { answer, evidence, isLoading, error, active } = useAIAnswer(query, results, aiEnabled);
```

The hook builds the evidence pack from your search results, resolves credentials (below), and only runs when the query is text-class, AI is enabled, evidence exists, and a usable tier resolved. `buildEvidence` is exported if you want to construct packs yourself. `useEngineAIStatus()` reports the engine-proxy tier's availability (`{ status, isLoading }`).

## Credential precedence

AI is **off by default and fully opt-in**. `resolveAIConfig()` (`src/ai/aiConfig.ts`) resolves, in exactly this order:

| Tier | When | Where the key lives |
|---|---|---|
| 1. `user` | The user pasted their own API key | This browser's localStorage only (`sip01:ai-config`); sent nowhere except the chosen provider's request path |
| 2. `keyless` | Selected provider has `requiresKey: false` (e.g. local Ollama) | No key at all |
| 3. `engine` | The host deployed the engine-AI proxy and it reports configured + enabled | **Server-side only** — the browser calls the same-origin proxy with no key |
| 4. `community` | The host injected `ai.community` via `configureEngine()` | In the host's bundle — public by design; a shared, rate-limited key with a locked model |
| 5. `unavailable` | None of the above | — |

Local user settings (the `AIConfig` shape: `enabled`, `providerId`, `endpoint`, `apiKey`, `model`, `includeNostr`) persist under the `sip01:ai-config` localStorage key, with read-through migration from the old `dsearch:ai-config` / `presearchstr:ai-config` keys. First-run defaults come from the host's `configureEngine({ ai: … })` seam via `getDefaultAIConfig()`.

## The engine proxy (server-side keys)

The engine tier lets a host offer AI answers without any key in the browser. The browser calls a same-origin base — `ENGINE_AI_BASE`, which defaults to `/api/ai` and can be pointed at a separate deployment with the non-secret build-time variable **`VITE_ENGINE_API_BASE`** (verified in `.env.example`) — and the server injects the operator's key upstream.

The proxy *logic* ships in the library as an isomorphic, runtime-agnostic module (`src/ai/engineProxy.ts`): `readEngineConfig`, `buildPublicStatus`, `validateChatPayload`, `applyEngineSystemPrompt`, `buildUpstreamBody`, `verifyAdminAuth`, `parseAdminAction`, `applyAdminAction`, `writeEngineConfig`. All host defaults are explicit `EngineAIDefaults` parameters — no browser-only or vendor-only APIs. The secret-holding **shell** (a worker with `OPENAI_API_KEY`; `AI_API_KEY` accepted as a deprecated alias) belongs to your deployment repo, not to this library. The old Dsearch worker was removed with the application plane; hosts deploy their own.

Admin operations (changing the engine-tier endpoint/model from an admin UI) go through `src/ai/engineAdmin.ts` (`sendEngineAIAction`, `testEngineAI`), authenticated against the operator's configured owner pubkey.

## Keyless default behavior

With no configuration at all, the resolution falls through to `unavailable` and `useAIAnswer` simply stays inactive (`active: false`) — there is no hidden default key and no telemetry. Selecting a keyless provider (Ollama at `http://localhost:11434/v1`, or a Custom endpoint) yields the `keyless` tier with the user's own config as-is. A host that wants out-of-the-box answers injects the `community` tier explicitly in `configureEngine()`.
