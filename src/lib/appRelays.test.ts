/**
 * Characterization tests — generic relay pool machinery (SIP-01 core).
 *
 * The machinery is host-agnostic: default relay lists and storage key names
 * arrive via the relayConfig seam. These tests exercise it against a TEST
 * config (not the Dsearch deployment's data — that is pinned separately in
 * src/app/relayConfig.test.ts).
 *
 * Pins: URL normalization, the effective-pool computation (defaults −
 * hidden + customs, deduped), the hide/restore round-trip, and legacy-key
 * read-through migration. These pools are where the community index lives —
 * silent breakage here silently empties search results.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  getSearchRelayUrls,
  getCustomSearchRelays,
  addCustomSearchRelay,
  removeCustomSearchRelay,
  hideDefaultSearchRelay,
  restoreDefaultSearchRelay,
  getIndexRelayUrls,
  addCustomIndexRelay,
  hideDefaultIndexRelay,
  getGitRelayUrls,
  getWikiRelayUrls,
} from './appRelays';
import { configureRelays, resetRelayConfig, type RelayPoolConfig } from './relayConfig';
import { normalizeRelayUrl, toSecureRelayUrl } from './relayUrls';

const TEST_SEARCH_RELAYS = ['wss://search-a.example.com/', 'wss://search-b.example.com/'];
const TEST_INDEX_RELAYS = ['wss://index-a.example.com/', 'wss://index-b.example.com/'];
const TEST_GIT_RELAYS = ['wss://git-a.example.com/'];
const TEST_WIKI_RELAYS = ['wss://wiki-a.example.com/'];

const TEST_RELAY_CONFIG: RelayPoolConfig = {
  searchRelays: TEST_SEARCH_RELAYS,
  indexRelays: TEST_INDEX_RELAYS,
  gitRelays: TEST_GIT_RELAYS,
  wikiRelays: TEST_WIKI_RELAYS,
  storageKeys: {
    customSearchRelays: 'test:search-relays:custom',
    hiddenSearchRelays: 'test:search-relays:hidden',
    customIndexRelays: 'test:index-relays:custom',
    hiddenIndexRelays: 'test:index-relays:hidden',
    customGitRelays: 'test:git-relays:custom',
    hiddenGitRelays: 'test:git-relays:hidden',
    customWikiRelays: 'test:wiki-relays:custom',
    hiddenWikiRelays: 'test:wiki-relays:hidden',
    discoveredRelays: 'test:relay-discovery:verified',
    relayDiscoveryEnabled: 'test:relay-discovery:enabled',
    appConfig: 'test:app-config',
  },
  legacyStorageKeys: {
    'test:search-relays:custom': 'legacy:search-relays:custom',
  },
};

beforeEach(() => {
  localStorage.clear();
  configureRelays(TEST_RELAY_CONFIG);
});

afterEach(() => {
  resetRelayConfig();
});

describe('normalizeRelayUrl', () => {
  it('upgrades bare hosts to wss with a trailing slash', () => {
    expect(normalizeRelayUrl('relay.example.com')).toBe('wss://relay.example.com/');
    expect(normalizeRelayUrl('wss://relay.example.com')).toBe('wss://relay.example.com/');
  });

  it('keeps non-root paths and rejects non-ws schemes and garbage', () => {
    expect(normalizeRelayUrl('wss://relay.example.com/nostr')).toBe('wss://relay.example.com/nostr');
    expect(normalizeRelayUrl('ws://relay.example.com')).toBe('ws://relay.example.com/');
    expect(normalizeRelayUrl('http://relay.example.com')).toBeNull();
    expect(normalizeRelayUrl('')).toBeNull();
    expect(normalizeRelayUrl('wss://')).toBeNull();
  });
});

describe('toSecureRelayUrl', () => {
  it('leaves ws:// untouched on an http page (jsdom location is http)', () => {
    // The https-page upgrade branch is exercised in production; under the
    // test environment's http origin the URL must pass through unchanged.
    expect(toSecureRelayUrl('ws://relay.example.com')).toBe('ws://relay.example.com');
    expect(toSecureRelayUrl('wss://relay.example.com')).toBe('wss://relay.example.com');
  });
});

describe('effective pools (generic machinery, test config)', () => {
  it('returns the configured defaults in order when storage is empty', () => {
    expect(getSearchRelayUrls()).toEqual(TEST_SEARCH_RELAYS);
    expect(getIndexRelayUrls()).toEqual(TEST_INDEX_RELAYS);
    expect(getGitRelayUrls()).toEqual(TEST_GIT_RELAYS);
    expect(getWikiRelayUrls()).toEqual(TEST_WIKI_RELAYS);
  });

  it('adds custom relays after defaults, normalized and deduplicated', () => {
    const added = addCustomSearchRelay('custom.example.com');
    expect(added).toBe('wss://custom.example.com/');
    expect(getCustomSearchRelays()).toEqual(['wss://custom.example.com/']);
    // Customs persist under the CONFIGURED key, not a hard-coded one.
    expect(localStorage.getItem('test:search-relays:custom')).toBe('["wss://custom.example.com/"]');
    const pool = getSearchRelayUrls();
    expect(pool[pool.length - 1]).toBe('wss://custom.example.com/');

    // Adding the same relay twice does not duplicate it.
    addCustomSearchRelay('wss://custom.example.com/');
    expect(getSearchRelayUrls().filter((u) => u === 'wss://custom.example.com/')).toHaveLength(1);

    removeCustomSearchRelay('wss://custom.example.com/');
    expect(getSearchRelayUrls()).toEqual(TEST_SEARCH_RELAYS);
  });

  it('hides and restores default relays', () => {
    const victim = TEST_SEARCH_RELAYS[0];
    hideDefaultSearchRelay(victim);
    expect(getSearchRelayUrls()).not.toContain(victim);
    expect(localStorage.getItem('test:search-relays:hidden')).toBe(`["${victim}"]`);
    restoreDefaultSearchRelay(victim);
    expect(getSearchRelayUrls()).toContain(victim);
  });

  it('re-adding a hidden default as a custom un-hides it', () => {
    const victim = TEST_SEARCH_RELAYS[TEST_SEARCH_RELAYS.length - 1];
    hideDefaultSearchRelay(victim);
    expect(getSearchRelayUrls()).not.toContain(victim);
    addCustomSearchRelay(victim);
    expect(getSearchRelayUrls().filter((u) => u === victim)).toHaveLength(1);
  });

  it('index pool customization is independent from the search pool', () => {
    addCustomIndexRelay('indexer.example.com');
    hideDefaultIndexRelay(TEST_INDEX_RELAYS[0]);
    expect(getIndexRelayUrls()).toContain('wss://indexer.example.com/');
    expect(getIndexRelayUrls()).not.toContain(TEST_INDEX_RELAYS[0]);
    expect(getSearchRelayUrls()).toEqual(TEST_SEARCH_RELAYS); // untouched
  });

  it('reads through to a configured legacy key and forward-migrates on first read', () => {
    // Existing user state under the legacy key only.
    localStorage.setItem('legacy:search-relays:custom', '["wss://old.example.com/"]');
    expect(getCustomSearchRelays()).toEqual(['wss://old.example.com/']);
    // First read migrated the value to the canonical key and cleared the legacy one.
    expect(localStorage.getItem('test:search-relays:custom')).toBe('["wss://old.example.com/"]');
    expect(localStorage.getItem('legacy:search-relays:custom')).toBeNull();
    expect(getSearchRelayUrls()).toContain('wss://old.example.com/');
  });
});
