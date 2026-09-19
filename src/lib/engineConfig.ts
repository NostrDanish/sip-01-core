/**
 * Engine runtime configuration seam.
 *
 * The reference engine (providers, ranking, AI layer) is host-agnostic: it
 * must not import an application's branding/profile module. Instead the host
 * application injects its identity ONCE at startup:
 *
 *   configureEngine({
 *     id: ENGINE_PROFILE.id,
 *     search: { brave: ENGINE_PROFILE.search.brave, indexerSource: ENGINE_PROFILE.search.indexerSource },
 *     ai: ENGINE_PROFILE.ai,
 *   });
 *
 * Engine internals read the seam via getEngineConfig(). Until configured,
 * neutral brand-free defaults apply (safe for tests and for running the
 * engine without any profile).
 *
 * This is deliberately a single flat config object with one setter — not a
 * plugin framework. It exists because engine modules may not import the app
 * layer, and module-scope constants would capture defaults before the app
 * boots; both are read strictly at call time.
 */

/** Brand-free fallback system prompt for the AI answer layer. */
export const DEFAULT_ENGINE_SYSTEM_PROMPT = `You are an answer engine — a synthesis layer over a decentralized search network.

Rules:
- Answer using ONLY the supplied evidence whenever possible.
- NEVER invent sources or URLs.
- Cite every factual statement with [n] markers referencing the evidence items.
- Clearly separate what the evidence says from your own inference.
- If the evidence is insufficient, say so plainly and say what is missing.
- Be concise: a direct answer first, then supporting detail. No preamble.`;

export interface EngineRuntimeConfig {
  /** Engine id — used for client-attribution parameters (e.g. DDG's `t`). */
  id: string;
  search: {
    /** Whether the host engine ships Brave as a first-class source (engine
     *  tier may inject the key server-side via the worker proxy). */
    brave: boolean;
    /** Indexer software id stamped as the SIP-01 `source` tag (spec §6). */
    indexerSource: string;
  };
  ai: {
    /** AI answers on for first-time visitors (still user-overridable). */
    enabledDefault: boolean;
    /** Default OpenAI-compatible provider id. */
    providerId: string;
    /** Display name of the intended engine-tier provider. */
    providerName: string;
    /** Default OpenAI-compatible endpoint (engine-tier; no key here). */
    endpoint: string;
    /** Default model id (engine-tier; operator can override via env). */
    model: string;
    /** Production system prompt (engine policy, not per-request data). */
    systemPrompt: string;
  };
}

/** Neutral defaults — a working, brand-free engine until the host configures one. */
const NEUTRAL_CONFIG: EngineRuntimeConfig = {
  id: 'sip01-engine',
  search: {
    brave: false,
    indexerSource: 'sip01-core/1',
  },
  ai: {
    enabledDefault: false,
    providerId: 'custom',
    providerName: 'Custom',
    endpoint: '',
    model: 'auto',
    systemPrompt: DEFAULT_ENGINE_SYSTEM_PROMPT,
  },
};

let runtimeConfig: EngineRuntimeConfig = NEUTRAL_CONFIG;

/** Inject the host application's engine configuration. Call once at startup. */
export function configureEngine(config: EngineRuntimeConfig): void {
  runtimeConfig = config;
}

/** The active engine configuration (neutral defaults until configured). */
export function getEngineConfig(): EngineRuntimeConfig {
  return runtimeConfig;
}

/**
 * Restore the neutral (unconfigured) defaults. Test helper: suites that
 * call configureEngine() must reset afterwards so module state does not
 * leak between test files sharing a worker.
 */
export function resetEngineConfig(): void {
  runtimeConfig = NEUTRAL_CONFIG;
}
