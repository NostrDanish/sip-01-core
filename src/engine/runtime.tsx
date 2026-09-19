/**
 * Engine runtime — the host-injected React context for the engine hooks.
 *
 * The core library has no application shell of its own: hosts wrap their UI
 * in <EngineRuntimeProvider> and supply the pieces of engine behavior that
 * are product decisions, not protocol:
 *
 *   <EngineRuntimeProvider runtime={{
 *     privacyMode: settings.privacyMode,
 *     autoIndex: settings.autoIndex,
 *     disabledProviders: settings.disabledProviders,
 *     languageFilter: settings.languageFilter,
 *     voteWithIdentity: settings.voteWithIdentity,
 *     userSigner: loggedInUser?.signer,
 *     moderation: myModerationSet, // built from the host's own trust policy
 *   }}>
 *
 * Every field is optional and falls back to a neutral default; the hooks
 * (useProviderSearch, useInstantAnswer, useSearxngInstances, useVotes,
 * useSearchIndexer) also work WITHOUT any provider — they simply run on
 * DEFAULT_ENGINE_RUNTIME.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';

import type { ModerationSet } from './moderation';

/** A signer for the host's logged-in user identity (NIP-07-style shape). */
export interface EngineSigner {
  signEvent(t: { kind: number; content: string; tags: string[][]; created_at: number }): Promise<NostrEvent>;
}

export interface EngineRuntime {
  /**
   * Privacy Mode — when true, only Nostr-tier providers run. No queries
   * leave for clearnet APIs, CORS proxies, or third-party servers.
   */
  privacyMode: boolean;
  /**
   * Automatic indexing — when true, useful web results discovered during
   * searches are anonymously contributed to the shared Nostr index as
   * kind 39697 document observations, signed by this device's dedicated
   * indexing identity (never the personal Nostr identity, never the query).
   */
  autoIndex: boolean;
  /** Search engines (provider ids) the host has turned off. */
  disabledProviders: string[];
  /**
   * Result language filter — ISO 639-1 codes, lowercase, in priority order.
   * Empty = off (any language). Engines that support it get the filter as a
   * request parameter; SIP-01 index observations are filtered by their `l`
   * tag; the SearXNG instance pool prefers matching instances.
   */
  languageFilter: string[];
  /**
   * Vote identity — when false (default), 👍/👎 votes are anonymous: signed
   * by this device's built-in SIP-01 indexing identity. When true, votes
   * are signed with the host's logged-in user identity (attributable) and
   * `userSigner` MUST be provided.
   */
  voteWithIdentity: boolean;
  /** Host's logged-in user signer (for attributable votes). Undefined = no user identity. */
  userSigner?: EngineSigner;
  /** Host-supplied moderation set. Undefined = no filtering. */
  moderation?: ModerationSet;
}

/** Neutral defaults — a working, brand-free engine runtime. */
export const DEFAULT_ENGINE_RUNTIME: EngineRuntime = {
  privacyMode: false,
  autoIndex: false,
  disabledProviders: [],
  languageFilter: [],
  voteWithIdentity: false,
};

const EngineRuntimeContext = createContext<EngineRuntime>(DEFAULT_ENGINE_RUNTIME);

export interface EngineRuntimeProviderProps {
  /** Partial runtime — merged over the parent runtime (defaults at the root). */
  runtime?: Partial<EngineRuntime>;
  children: ReactNode;
}

/**
 * Provides the engine runtime to the hooks below it. Partial values merge
 * over the enclosing runtime, so nested providers can override single
 * fields. Without any provider, the hooks see DEFAULT_ENGINE_RUNTIME.
 */
export function EngineRuntimeProvider({ runtime, children }: EngineRuntimeProviderProps) {
  const parent = useContext(EngineRuntimeContext);
  const value = useMemo<EngineRuntime>(() => ({ ...parent, ...runtime }), [parent, runtime]);
  return (
    <EngineRuntimeContext.Provider value={value}>
      {children}
    </EngineRuntimeContext.Provider>
  );
}

/** The active engine runtime (neutral defaults when no provider is present). */
export function useEngineRuntime(): EngineRuntime {
  return useContext(EngineRuntimeContext);
}
