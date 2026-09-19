/**
 * Characterization tests — relay pool machinery.
 *
 * Pin before extraction: URL normalization, the effective-pool computation
 * (defaults − hidden + customs, deduped), and the hide/restore round-trip.
 * These pools are where the community index lives — silent breakage here
 * silently empties search results.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  SEARCH_RELAYS,
  INDEX_RELAYS,
  GIT_RELAYS,
  WIKI_RELAYS,
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
import { normalizeRelayUrl, toSecureRelayUrl } from './relayUrls';

beforeEach(() => {
  localStorage.clear();
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

describe('effective pools', () => {
  it('returns the shipped defaults in order when storage is empty', () => {
    expect(getSearchRelayUrls()).toEqual([...SEARCH_RELAYS]);
    expect(getIndexRelayUrls()).toEqual([...INDEX_RELAYS]);
    expect(getGitRelayUrls()).toEqual([...GIT_RELAYS]);
    expect(getWikiRelayUrls()).toEqual([...WIKI_RELAYS]);
  });

  it('adds custom relays after defaults, normalized and deduplicated', () => {
    const added = addCustomSearchRelay('custom.example.com');
    expect(added).toBe('wss://custom.example.com/');
    expect(getCustomSearchRelays()).toEqual(['wss://custom.example.com/']);
    const pool = getSearchRelayUrls();
    expect(pool[pool.length - 1]).toBe('wss://custom.example.com/');

    // Adding the same relay twice does not duplicate it.
    addCustomSearchRelay('wss://custom.example.com/');
    expect(getSearchRelayUrls().filter((u) => u === 'wss://custom.example.com/')).toHaveLength(1);

    removeCustomSearchRelay('wss://custom.example.com/');
    expect(getSearchRelayUrls()).toEqual([...SEARCH_RELAYS]);
  });

  it('hides and restores default relays', () => {
    const victim = SEARCH_RELAYS[0];
    hideDefaultSearchRelay(victim);
    expect(getSearchRelayUrls()).not.toContain(victim);
    restoreDefaultSearchRelay(victim);
    expect(getSearchRelayUrls()).toContain(victim);
  });

  it('re-adding a hidden default as a custom un-hides it', () => {
    const victim = SEARCH_RELAYS[SEARCH_RELAYS.length - 1];
    hideDefaultSearchRelay(victim);
    expect(getSearchRelayUrls()).not.toContain(victim);
    addCustomSearchRelay(victim);
    expect(getSearchRelayUrls().filter((u) => u === victim)).toHaveLength(1);
  });

  it('index pool customization is independent from the search pool', () => {
    addCustomIndexRelay('indexer.example.com');
    hideDefaultIndexRelay(INDEX_RELAYS[0]);
    expect(getIndexRelayUrls()).toContain('wss://indexer.example.com/');
    expect(getIndexRelayUrls()).not.toContain(INDEX_RELAYS[0]);
    expect(getSearchRelayUrls()).toEqual([...SEARCH_RELAYS]); // untouched
  });
});
