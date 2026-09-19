/**
 * Provider registry — catalog of search providers.
 *
 * Two ways to use this module:
 *
 *   1. DEFAULT CATALOG (this app): the named exports (getProvidersForSource,
 *      getProvidersForPrivacy, getProvider, getAvailableSources) operate on
 *      the built-in ALL_PROVIDERS list. Existing call sites unchanged.
 *
 *   2. CUSTOM REGISTRY (forks, third-party engines, proprietary plugins):
 *      createProviderRegistry([...]) builds an independent catalog from any
 *      provider set — e.g. the defaults plus a closed-source provider:
 *
 *        const registry = createProviderRegistry([...ALL_PROVIDERS, myProvider]);
 *
 *      or a deliberately minimal engine:
 *
 *        const registry = createProviderRegistry([webIndexProvider, nostrProvider]);
 *
 *      A provider is just an object implementing SearchProvider — registering
 *      one never requires editing this file.
 *
 * Add a new built-in provider:
 *   1. Create `src/lib/providers/my-provider.ts` implementing `SearchProvider`
 *   2. Import it here and add to the `ALL_PROVIDERS` array
 *   3. Done — the default registry picks it up automatically
 */
import type { SearchProvider, SearchSource } from './types';
import { webIndexProvider } from './web-index';
import { cachedIndexProvider } from './cached-index';
import { nostrProvider } from './nostr';
import { communityProvider } from './community';
import { stakesProvider } from './stakes';
import { searxngProvider } from './searxng';
import { duckduckgoProvider } from './duckduckgo';
import { braveProvider } from './brave';
import { parallelProvider } from './parallel';
import { torProvider } from './tor';
import { wikipediaProvider } from './wikipedia';
import { hackerNewsProvider } from './hacker-news';
import { stackOverflowProvider } from './stackoverflow';
import { gitProvider } from './git';
import { nostrWikiProvider } from './wiki';

/**
 * All built-in providers, in display/priority order.
 *
 * Web engines lead — Brave first (it's the default engine when the user's
 * API key is set, and hidden entirely when not), then Parallel (same BYOK
 * pattern — long dense excerpts), then DuckDuckGo, then the SearXNG
 * fallback — then the community index (web-index + cached-index), then the
 * rest. Everything runs in parallel — order drives the provider-status
 * chips and result streaming, not speed.
 */
export const ALL_PROVIDERS: SearchProvider[] = [
  braveProvider,
  parallelProvider,
  duckduckgoProvider,
  searxngProvider,
  webIndexProvider,
  cachedIndexProvider,
  stakesProvider,
  communityProvider,
  nostrProvider,
  gitProvider,
  nostrWikiProvider,
  wikipediaProvider,
  hackerNewsProvider,
  stackOverflowProvider,
  torProvider,
];

/** The source selector accepted by registry queries. */
export type SourceSelector = SearchSource | 'all' | 'index' | 'i2p';

/** An independent provider catalog. See createProviderRegistry. */
export interface ProviderRegistry {
  /** Every provider in this registry, in display/priority order. */
  readonly all: readonly SearchProvider[];
  /** Providers that contribute to a given source tab. */
  getProvidersForSource(source: SourceSelector): SearchProvider[];
  /** Providers filtered by Privacy Mode (Nostr-tier only when enabled). */
  getProvidersForPrivacy(source: SearchSource | 'all', privacyOnly: boolean): SearchProvider[];
  /** Get a provider by ID. */
  getProvider(id: string): SearchProvider | undefined;
  /** All unique source categories in this registry. */
  getAvailableSources(): SearchSource[];
}

/**
 * Build an independent provider registry from any provider set.
 *
 * This is the engine's plugin seam: a host application (or a proprietary
 * extension) composes its own catalog — adding, replacing, or removing
 * providers — without modifying shared code. Provider ids must be unique
 * within a registry.
 */
export function createProviderRegistry(providers: readonly SearchProvider[]): ProviderRegistry {
  const all = Object.freeze([...providers]);

  function getProvidersForSource(source: SourceSelector): SearchProvider[] {
    if (source === 'all') return [...all];
    if (source === 'i2p') return []; // directory links only, no providers
    // The Index tab = the community index only (SIP-01 observations + legacy cache).
    if (source === 'index') {
      return all.filter((p) => p.id === 'web-index' || p.id === 'cached-index');
    }
    return all.filter((p) => p.source === source || p.additionalSources?.includes(source));
  }

  function getProvidersForPrivacy(
    source: SearchSource | 'all',
    privacyOnly: boolean,
  ): SearchProvider[] {
    const selected = getProvidersForSource(source);
    if (!privacyOnly) return selected;
    return selected.filter((p) => p.privacy === 'nostr');
  }

  function getProvider(id: string): SearchProvider | undefined {
    return all.find((p) => p.id === id);
  }

  function getAvailableSources(): SearchSource[] {
    const sources = new Set<SearchSource>();
    for (const p of all) sources.add(p.source);
    return [...sources];
  }

  return { all, getProvidersForSource, getProvidersForPrivacy, getProvider, getAvailableSources };
}

/** The default catalog: every built-in provider. */
const defaultRegistry = createProviderRegistry(ALL_PROVIDERS);

/** Get default-catalog providers that contribute to a given source tab. */
export function getProvidersForSource(source: SourceSelector): SearchProvider[] {
  return defaultRegistry.getProvidersForSource(source);
}

/**
 * Get default-catalog providers filtered by Privacy Mode.
 * When `privacyOnly` is true, only Nostr-tier providers are returned —
 * no clearnet APIs, no CORS proxies, no third-party servers.
 */
export function getProvidersForPrivacy(
  source: SearchSource | 'all',
  privacyOnly: boolean,
): SearchProvider[] {
  return defaultRegistry.getProvidersForPrivacy(source, privacyOnly);
}

/** Get a default-catalog provider by ID. */
export function getProvider(id: string): SearchProvider | undefined {
  return defaultRegistry.getProvider(id);
}

/** All unique source categories from the default catalog. */
export function getAvailableSources(): SearchSource[] {
  return defaultRegistry.getAvailableSources();
}
