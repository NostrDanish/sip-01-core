/**
 * Pinning tests — Dsearch's relay configuration (app plane).
 *
 * The generic pool machinery lives in src/lib/appRelays.ts (tested there
 * against a test config); THIS suite pins the deployment data Dsearch
 * injects into it: the exact default relay lists, the exact `dsearch:*`
 * localStorage keys existing users' settings live under, and the
 * `0xsearchstr:*` → `dsearch:*` read-through migration. A regression here
 * strands existing users' pool customizations or silently changes the
 * pools their searches hit.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  APP_RELAYS,
  SEARCH_RELAYS,
  INDEX_RELAYS,
  GIT_RELAYS,
  WIKI_RELAYS,
  DSEARCH_RELAY_CONFIG,
} from './relayConfig';
import {
  getSearchRelayUrls,
  getIndexRelayUrls,
  getGitRelayUrls,
  getWikiRelayUrls,
  getCustomSearchRelays,
  addCustomSearchRelay,
} from '@/lib/appRelays';
import { configureRelays, resetRelayConfig } from '@/lib/relayConfig';
import {
  isRelayDiscoveryEnabled,
  setRelayDiscoveryEnabled,
} from '@/lib/relayDiscovery';

beforeEach(() => {
  localStorage.clear();
  configureRelays(DSEARCH_RELAY_CONFIG);
});

afterEach(() => {
  resetRelayConfig();
});

describe('Dsearch default relay lists', () => {
  it('pins the app default relays (NIP-65 fallback)', () => {
    expect(APP_RELAYS).toEqual({
      relays: [
        { url: 'wss://relay.ditto.pub/', read: true, write: true },
        { url: 'wss://relay.nostr.band/', read: true, write: false },
        { url: 'wss://relay.primal.net/', read: false, write: true },
        { url: 'wss://relay.damus.io/', read: false, write: true },
      ],
      updatedAt: 0,
    });
  });

  it('pins the search / index / git / wiki default pools', () => {
    expect(SEARCH_RELAYS).toEqual([
      'wss://relay.ditto.pub/',
      'wss://relay-na1.metanomalist.com/',
      'wss://test-sip-relay.sip-01test.workers.dev/',
      'wss://sip-relay-2.sip-booster-relay.workers.dev/',
      'wss://sip-relay-3.uncaged-sip.workers.dev/',
      'wss://sip-relay-4.sip-relay-4.workers.dev/',
      'wss://relay.nostr.band/',
      'wss://search.nos.today/',
      'wss://relay.noswhere.com/',
      'wss://relay.pocketnostr.com/',
    ]);
    expect(INDEX_RELAYS).toEqual([
      'wss://relay-na1.metanomalist.com/',
      'wss://relay.ditto.pub/',
      'wss://test-sip-relay.sip-01test.workers.dev/',
      'wss://sip-relay-2.sip-booster-relay.workers.dev/',
      'wss://sip-relay-3.uncaged-sip.workers.dev/',
      'wss://sip-relay-4.sip-relay-4.workers.dev/',
      'wss://jskitty.cat/nostr',
      'wss://search.nos.today/',
      'wss://relay.primal.net/',
    ]);
    expect(GIT_RELAYS).toEqual([
      'wss://ngit.danconwaydev.com/',
      'wss://gitnostr.com/',
      'wss://relay.ngit.dev/',
      'wss://indexer.coracle.social/',
      'wss://index.ngit.dev/',
      'wss://git.shakespeare.diy/',
    ]);
    expect(WIKI_RELAYS).toEqual([
      'wss://relay.wikifreedia.xyz/',
      'wss://nostr.wine/',
      'wss://nostr21.com/',
    ]);
  });
});

describe('Dsearch storage keys', () => {
  it('pins the dsearch:* key names existing users carry state under', () => {
    expect(DSEARCH_RELAY_CONFIG.storageKeys).toEqual({
      customSearchRelays: 'dsearch:search-relays:custom',
      hiddenSearchRelays: 'dsearch:search-relays:hidden',
      customIndexRelays: 'dsearch:index-relays:custom',
      hiddenIndexRelays: 'dsearch:index-relays:hidden',
      customGitRelays: 'dsearch:git-relays:custom',
      hiddenGitRelays: 'dsearch:git-relays:hidden',
      customWikiRelays: 'dsearch:wiki-relays:custom',
      hiddenWikiRelays: 'dsearch:wiki-relays:hidden',
      discoveredRelays: 'dsearch:relay-discovery:verified',
      relayDiscoveryEnabled: 'dsearch:relay-discovery:enabled',
      appConfig: 'dsearch:app-config',
    });
  });

  it('pins the 0xsearchstr:* legacy keys (read-through migration)', () => {
    expect(DSEARCH_RELAY_CONFIG.legacyStorageKeys).toEqual({
      'dsearch:search-relays:custom': '0xsearchstr:search-relays:custom',
      'dsearch:search-relays:hidden': '0xsearchstr:search-relays:hidden',
      'dsearch:index-relays:custom': '0xsearchstr:index-relays:custom',
      'dsearch:index-relays:hidden': '0xsearchstr:index-relays:hidden',
      'dsearch:git-relays:custom': '0xsearchstr:git-relays:custom',
      'dsearch:git-relays:hidden': '0xsearchstr:git-relays:hidden',
      'dsearch:wiki-relays:custom': '0xsearchstr:wiki-relays:custom',
      'dsearch:wiki-relays:hidden': '0xsearchstr:wiki-relays:hidden',
      'dsearch:relay-discovery:verified': '0xsearchstr:relay-discovery:verified',
      'dsearch:relay-discovery:enabled': '0xsearchstr:relay-discovery:enabled',
      'dsearch:app-config': 'nostr:app-config',
    });
  });
});

describe('Dsearch config through the generic machinery', () => {
  it('yields the shipped default pools when storage is empty', () => {
    expect(getSearchRelayUrls()).toEqual([...SEARCH_RELAYS]);
    expect(getIndexRelayUrls()).toEqual([...INDEX_RELAYS]);
    expect(getGitRelayUrls()).toEqual([...GIT_RELAYS]);
    expect(getWikiRelayUrls()).toEqual([...WIKI_RELAYS]);
  });

  it('persists customs under the dsearch:* keys', () => {
    addCustomSearchRelay('custom.example.com');
    expect(localStorage.getItem('dsearch:search-relays:custom')).toBe('["wss://custom.example.com/"]');
  });

  it('migrates a legacy 0xsearchstr:* customization on first read', () => {
    localStorage.setItem('0xsearchstr:search-relays:custom', '["wss://old.example.com/"]');
    expect(getCustomSearchRelays()).toEqual(['wss://old.example.com/']);
    expect(localStorage.getItem('dsearch:search-relays:custom')).toBe('["wss://old.example.com/"]');
    expect(localStorage.getItem('0xsearchstr:search-relays:custom')).toBeNull();
    expect(getSearchRelayUrls()).toContain('wss://old.example.com/');
  });

  it('stores the discovery toggle under the dsearch:* key with legacy read-through', () => {
    expect(isRelayDiscoveryEnabled()).toBe(true); // ON by default
    setRelayDiscoveryEnabled(false);
    expect(localStorage.getItem('dsearch:relay-discovery:enabled')).toBe('false');
    expect(isRelayDiscoveryEnabled()).toBe(false);

    // Legacy-only state is honored (and migrated) on read.
    localStorage.clear();
    localStorage.setItem('0xsearchstr:relay-discovery:enabled', 'false');
    expect(isRelayDiscoveryEnabled()).toBe(false);
    expect(localStorage.getItem('dsearch:relay-discovery:enabled')).toBe('false');
    expect(localStorage.getItem('0xsearchstr:relay-discovery:enabled')).toBeNull();
  });
});
