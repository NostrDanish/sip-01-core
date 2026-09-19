/**
 * Characterization tests — the provider registry contract.
 *
 * Pin before extraction: catalog invariants (unique ids, complete metadata),
 * source-tab mapping (incl. the special 'index'/'i2p' handling), and the
 * Privacy Mode filter (only Nostr-tier providers survive).
 */
import { describe, it, expect } from 'vitest';

import {
  ALL_PROVIDERS,
  createProviderRegistry,
  getAvailableSources,
  getProvider,
  getProvidersForPrivacy,
  getProvidersForSource,
} from './registry';
import type { SearchProvider } from './types';

describe('ALL_PROVIDERS catalog', () => {
  it('every provider has a unique id and complete contract metadata', () => {
    const ids = ALL_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of ALL_PROVIDERS) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.privacyNote.length).toBeGreaterThan(0);
      expect(['nostr', 'web', 'wiki', 'news', 'code', 'tor', 'i2p']).toContain(p.source);
      expect(['nostr', 'direct', 'proxied']).toContain(p.privacy);
      expect(typeof p.search).toBe('function');
    }
  });

  it('ships the expected provider set (silent removal breaks the engine)', () => {
    const ids = new Set(ALL_PROVIDERS.map((p) => p.id));
    for (const id of [
      'brave', 'parallel', 'duckduckgo', 'searxng', 'web-index', 'cached-index',
      'keyword-stakes', 'community', 'nostr', 'git', 'nostr-wiki', 'wikipedia',
      'hackernews', 'stackoverflow', 'tor',
    ]) {
      expect(ids.has(id), `provider "${id}" registered`).toBe(true);
    }
  });
});

describe('getProvidersForSource', () => {
  it("'all' returns every provider", () => {
    expect(getProvidersForSource('all')).toHaveLength(ALL_PROVIDERS.length);
  });

  it("'index' is exactly the community index (SIP-01 + legacy cache)", () => {
    expect(getProvidersForSource('index').map((p) => p.id)).toEqual(['web-index', 'cached-index']);
  });

  it("'i2p' has no providers (directory links only)", () => {
    expect(getProvidersForSource('i2p')).toEqual([]);
  });

  it('source tabs filter by primary source or additionalSources', () => {
    const tor = getProvidersForSource('tor').map((p) => p.id);
    expect(tor).toContain('tor');
    expect(tor).toContain('community'); // curated onions also serve the Tor tab
    const nostr = getProvidersForSource('nostr').map((p) => p.id);
    expect(nostr).toContain('nostr');
    expect(nostr).not.toContain('searxng');
  });
});

describe('getProvidersForPrivacy', () => {
  it('privacy mode keeps only Nostr-tier providers', () => {
    const privateSet = getProvidersForPrivacy('all', true);
    expect(privateSet.length).toBeGreaterThan(0);
    for (const p of privateSet) expect(p.privacy).toBe('nostr');
    // The community index must survive Privacy Mode — it is the point of it.
    expect(privateSet.map((p) => p.id)).toContain('web-index');
  });

  it('privacy mode off returns the unfiltered source set', () => {
    expect(getProvidersForPrivacy('all', false)).toHaveLength(ALL_PROVIDERS.length);
  });
});

describe('lookup helpers', () => {
  it('getProvider finds by id and returns undefined for unknown ids', () => {
    expect(getProvider('nostr')?.name).toBeTruthy();
    expect(getProvider('definitely-not-a-provider')).toBeUndefined();
  });

  it('getAvailableSources reflects the registered providers', () => {
    const sources = getAvailableSources();
    expect(sources).toContain('nostr');
    expect(sources).toContain('web');
  });
});

describe('createProviderRegistry (the plugin seam)', () => {
  const proprietary: SearchProvider = {
    id: 'acme-secret-engine',
    name: 'ACME Internal',
    source: 'web',
    privacy: 'direct',
    privacyNote: 'Test double.',
    search: async () => ({ results: [] }),
  };

  it('composes built-in providers with external (e.g. closed-source) ones', () => {
    const registry = createProviderRegistry([...ALL_PROVIDERS, proprietary]);
    expect(registry.getProvider('acme-secret-engine')).toBe(proprietary);
    expect(registry.getProvidersForSource('web').map((p) => p.id)).toContain('acme-secret-engine');
    expect(registry.all).toHaveLength(ALL_PROVIDERS.length + 1);
  });

  it('supports a deliberately minimal engine (protocol-only catalog)', () => {
    const minimal = createProviderRegistry(ALL_PROVIDERS.filter((p) => p.privacy === 'nostr'));
    expect(minimal.getProvidersForSource('all').every((p) => p.privacy === 'nostr')).toBe(true);
    expect(minimal.getProvider('searxng')).toBeUndefined();
  });

  it('custom registries do not leak into the default catalog', () => {
    createProviderRegistry([...ALL_PROVIDERS, proprietary]);
    expect(getProvider('acme-secret-engine')).toBeUndefined();
  });
});
