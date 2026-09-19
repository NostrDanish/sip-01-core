/**
 * AI config — localStorage-backed settings for the AI Answer Layer.
 *
 * AI is OFF by default and fully opt-in. The API key never leaves the
 * browser except inside requests to the chosen provider (via the CORS
 * proxy — disclosed in Settings → AI).
 *
 * Credential precedence (exactly):
 *
 *   1. USER-PROVIDED key — the user's own provider/endpoint/model, stored
 *      in this browser's localStorage only, sent nowhere except the chosen
 *      provider's request path. Removing it drops to the next tier.
 *   2. ENGINE-PROVIDED AI — the operator's key, held SERVER-SIDE by the
 *      /api/ai proxy (see worker.ts). The browser calls the same-origin
 *      proxy with NO key; the key is never in the bundle, localStorage,
 *      or any API response. Available only when the operator deployed the
 *      worker AND configured it (status comes from GET /api/ai/status).
 *   3. COMMUNITY FALLBACK — the host engine's shared, rate-limited key with
 *      a locked model (injected via the engineConfig seam, e.g. Dsearch's
 *      profile), so AI answers work out of the box on that engine's
 *      deployments (including static hosting with no worker). The key is
 *      public by design — it ships in the host's bundle and must stay
 *      rate-limited; the engine tier exists for operators who want a
 *      private key.
 *   4. AI UNAVAILABLE — when the host supplies no community tier.
 */

import { getAIProvider } from '@/ai/registry';
import type { EngineAIStatus } from '@/ai/engineProxy';
import { getEngineConfig } from '@/lib/engineConfig';
import { readStoredWithLegacy, writeStoredCanonical } from '@/lib/storageMigration';

export type { EngineAIStatus } from '@/ai/engineProxy';

/**
 * Base of the engine-AI proxy (worker.ts).
 *
 * Default is same-origin `/api/ai` — correct when the worker serves the
 * static app itself (wrangler deploy with assets) or when the host rewrites
 * /api/* to the worker. Deployments on static hosts whose rewrites cannot
 * forward POST bodies can point the engine base at the worker directly via
 * the non-secret build var VITE_ENGINE_API_BASE
 * (e.g. https://dsearch.workers.dev/api/ai). The worker reflects an
 * allowlisted Origin, so cross-origin calls carry no cookies and expose
 * no keys. Forks that co-locate the worker simply leave the var unset and
 * keep the same-origin default.
 */
export const ENGINE_AI_BASE: string =
  (import.meta.env.VITE_ENGINE_API_BASE as string | undefined)?.replace(/\/$/, '') || '/api/ai';

const LS_KEY = 'dsearch:ai-config';
const LEGACY_LS_KEY = 'presearchstr:ai-config';

export interface AIConfig {
  /** Master switch — AI answers only run when enabled. */
  enabled: boolean;
  /** Provider id from the registry ('ppq', 'openrouter', 'ollama', 'custom', …). */
  providerId: string;
  /** API base URL (editable for custom/self-hosted). */
  endpoint: string;
  /** The USER's API key (sk-…). Empty = fall through to the engine tier. */
  apiKey: string;
  /** Model id ('auto' = provider's router default). Ignored on the engine tier. */
  model: string;
  /** Privacy: also include Nostr-tier results in the evidence sent to the AI. */
  includeNostr: boolean;
}

/**
 * First-run AI defaults from the host engine (via the config seam).
 * A FUNCTION, not a module-scope constant: the host injects its profile at
 * bootstrap, and module evaluation order would freeze neutral defaults
 * into a top-level const. Call time is always after bootstrap.
 */
export function getDefaultAIConfig(): AIConfig {
  const ai = getEngineConfig().ai;
  return {
    enabled: ai.enabledDefault,
    providerId: ai.providerId,
    endpoint: ai.endpoint,
    apiKey: '',
    model: ai.model,
    includeNostr: false,
  };
}

/** True when the user has pasted their own API key (top precedence). */
export function hasOwnAIKey(cfg: AIConfig): boolean {
  return cfg.apiKey.trim().length > 0;
}

/** The effective runtime config after applying the precedence chain. */
export interface ResolvedAIConfig {
  providerId: string;
  endpoint: string;
  apiKey: string;
  model: string;
  /** Which tier answered: user's own key → engine proxy → built-in → none. */
  tier: 'user' | 'engine' | 'keyless' | 'community' | 'unavailable';
  /** Engine-tier display info (provider label + model), when tier='engine'. */
  engine?: { providerName?: string; model?: string };
}

/** Engine tier usable right now? */
export function engineAIAvailable(engine: EngineAIStatus | null | undefined): boolean {
  return !!engine && engine.configured && engine.enabled;
}

/**
 * Resolve what a search actually runs with:
 *  1. user's own key            → their provider/endpoint/model
 *  2. keyless provider selected → their config as-is (e.g. local Ollama)
 *  3. engine configured+enabled → the same-origin proxy (no key, server model)
 *  4. built-in key present      → shared free tier (locked provider+model)
 *  5. otherwise                 → AI unavailable
 */
export function resolveAIConfig(cfg: AIConfig, engine?: EngineAIStatus | null): ResolvedAIConfig {
  if (hasOwnAIKey(cfg)) {
    return {
      providerId: cfg.providerId,
      endpoint: cfg.endpoint,
      apiKey: cfg.apiKey.trim(),
      model: cfg.model,
      tier: 'user',
    };
  }

  const provider = getAIProvider(cfg.providerId);
  if (provider && provider.requiresKey === false) {
    return {
      providerId: cfg.providerId,
      endpoint: cfg.endpoint,
      apiKey: '',
      model: cfg.model,
      tier: 'keyless',
    };
  }

  if (engineAIAvailable(engine) && engine) {
    return {
      providerId: 'engine',
      endpoint: ENGINE_AI_BASE,
      apiKey: '', // the key lives server-side; the browser never holds it
      model: engine.model || 'auto',
      tier: 'engine',
      engine: { providerName: engine.providerName, model: engine.model },
    };
  }

  // Host-injected community tier (the engine profile's shared free key).
  const community = getEngineConfig().ai.community;
  if (community?.apiKey) {
    return {
      providerId: community.providerId,
      endpoint: community.endpoint,
      apiKey: community.apiKey,
      model: community.model, // locked on this tier — user's model choice ignored
      tier: 'community',
    };
  }

  return {
    providerId: cfg.providerId,
    endpoint: cfg.endpoint,
    apiKey: '',
    model: cfg.model,
    tier: 'unavailable',
  };
}

export function getAIConfig(): AIConfig {
  try {
    const raw = readStoredWithLegacy(LS_KEY, LEGACY_LS_KEY);
    if (!raw) return getDefaultAIConfig();
    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    return { ...getDefaultAIConfig(), ...parsed };
  } catch {
    return getDefaultAIConfig();
  }
}

export function setAIConfig(patch: Partial<AIConfig>): AIConfig {
  const next = { ...getAIConfig(), ...patch };
  try {
    writeStoredCanonical(LS_KEY, LEGACY_LS_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — config just won't persist.
  }
  return next;
}
