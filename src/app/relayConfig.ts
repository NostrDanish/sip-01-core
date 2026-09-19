/**
 * Dsearch relay configuration — the application plane's relay identity.
 *
 * The pool machinery (src/lib/appRelays.ts) and discovery persistence
 * (src/lib/relayDiscovery.ts) are generic SIP-01 core; THIS module is where
 * Dsearch's deployment-specific data lives: the default relay lists and the
 * `dsearch:*` localStorage key names (with `0xsearchstr:*` read-through
 * migration for existing users). App.tsx injects it into the core via
 * configureRelays(DSEARCH_RELAY_CONFIG) at startup.
 *
 * Key names are load-bearing: existing users carry pool customizations and
 * discovery state under these exact keys. Renaming a key strands their
 * settings — add a legacy-map entry instead, never rename in place.
 */
import type { RelayMetadata } from '@/contexts/AppContext';
import type { RelayPoolConfig } from '@/lib/relayConfig';

/**
 * App default relays. Used as the initial `relayMetadata` for new users and as
 * a fallback when the user has no NIP-65 relay list configured (e.g. during
 * nostrconnect handshakes before any user relays have been loaded).
 */
export const APP_RELAYS: RelayMetadata = {
  relays: [
    { url: 'wss://relay.ditto.pub/', read: true, write: true },
    { url: 'wss://relay.nostr.band/', read: true, write: false },
    { url: 'wss://relay.primal.net/', read: false, write: true },
    { url: 'wss://relay.damus.io/', read: false, write: true },
  ],
  updatedAt: 0,
};

/**
 * Index relays (SIP-01 crawler/indexer pool).
 *
 * This is where the community index lives: SIP-01 web-index observations
 * (kind 39697), the legacy query cache (kind 30078), community submissions,
 * and keyword stakes are published to AND read from these relays. Every
 * browser running the app is a crawler node — this is its default peer list.
 *
 * Users can extend the pool with custom relays and hide any default in
 * Settings → Index Relays.
 */
export const INDEX_RELAYS = [
  'wss://relay-na1.metanomalist.com/',
  'wss://relay.ditto.pub/',
  // The UNCAGED SIP relay cluster — serverless SIP-01 index relays
  // (Cloudflare Workers + D1; NIP-50 + NIP-45 + NIP-77, kind 39697 native).
  'wss://test-sip-relay.sip-01test.workers.dev/',
  'wss://sip-relay-2.sip-booster-relay.workers.dev/',
  'wss://sip-relay-3.uncaged-sip.workers.dev/',
  'wss://sip-relay-4.sip-relay-4.workers.dev/',
  'wss://jskitty.cat/nostr',
  'wss://search.nos.today/',
  'wss://relay.primal.net/',
];

/**
 * GRASP / ngit relay pool (NIP-34 git collaboration) — READ-ONLY.
 *
 * Read by the git provider for the Code tab: repository announcements
 * (kind 30617), issues (1621), PRs (1618), and patches (1617). Nothing is
 * published here — the app has no git write path. The index.ngit.dev /
 * index.hzrd149.com / indexer.coracle.social indexers answer NIP-50-style
 * search; the GRASP servers return recent events that we filter client-side.
 *
 * Users can extend the pool with custom relays and hide any default in
 * Settings → Git Relays.
 */
export const GIT_RELAYS = [
  'wss://ngit.danconwaydev.com/',
  'wss://gitnostr.com/',
  'wss://relay.ngit.dev/',
  'wss://indexer.coracle.social/',
  'wss://index.ngit.dev/',
  'wss://git.shakespeare.diy/',
];

/**
 * Wiki relay pool (NIP-54 articles) — READ-ONLY.
 *
 * Where Nostr-native wiki content (kind 30818) actually lives. Defaults are
 * the relay set wikistr (fiatjaf's wiki client) reads:
 * relay.wikifreedia.xyz backs Wikifreedia, the largest NIP-54 corpus;
 * nostr.wine / nostr21.com / relay.nostr.band are wikistr's other sources.
 *
 * Users can extend the pool and hide defaults in Settings → Wiki Relays.
 */
export const WIKI_RELAYS = [
  'wss://relay.wikifreedia.xyz/',
  'wss://nostr.wine/',
  'wss://nostr21.com/',
];

/**
 * Relays that support NIP-50 search queries (read-only full-text pool).
 * These are queried in parallel for every Nostr search.
 * Users can add customs and hide defaults in Settings → Search Relays.
 * Auto-discovery (relayDiscovery.ts) appends NIP-11-verified NIP-50 relays.
 *
 * relay.ditto.pub — Ditto relay with search support
 * relay-na1.metanomalist.com — Ditto/OpenSearch index relay (NIP-50 + NIP-77)
 * the UNCAGED SIP cluster — serverless SIP-01 index relays (NIP-50 over the
 *   kind 39697 document index, incl. web operators)
 * relay.nostr.band — nostr.band's relay, the original NIP-50 home
 * search.nos.today — NOS search relay
 * relay.noswhere.com — Noswhere relay with NIP-50 (incl. extensions)
 * relay.pocketnostr.com — Pocket Nostr relay with NIP-50
 */
export const SEARCH_RELAYS = [
  'wss://relay.ditto.pub/',
  'wss://relay-na1.metanomalist.com/',
  // The UNCAGED SIP relay cluster answers NIP-50 over the SIP-01 document
  // index directly (web operators: site:, lang:, after:, …).
  'wss://test-sip-relay.sip-01test.workers.dev/',
  'wss://sip-relay-2.sip-booster-relay.workers.dev/',
  'wss://sip-relay-3.uncaged-sip.workers.dev/',
  'wss://sip-relay-4.sip-relay-4.workers.dev/',
  'wss://relay.nostr.band/',
  'wss://search.nos.today/',
  'wss://relay.noswhere.com/',
  'wss://relay.pocketnostr.com/',
];

/** Dsearch's canonical localStorage keys for relay pools + discovery state. */
const STORAGE_KEYS = {
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
} as const;

/**
 * Dsearch's relay identity, injected into the core pool machinery via
 * configureRelays() at startup (App.tsx).
 *
 * Device-local relay customizations live under dsearch:* keys. Reads fall
 * back to the legacy 0xsearchstr:* key (and forward-migrate on first read);
 * writes go to the canonical key only. See src/lib/storageMigration.ts.
 */
export const DSEARCH_RELAY_CONFIG: RelayPoolConfig = {
  searchRelays: SEARCH_RELAYS,
  indexRelays: INDEX_RELAYS,
  gitRelays: GIT_RELAYS,
  wikiRelays: WIKI_RELAYS,
  storageKeys: STORAGE_KEYS,
  legacyStorageKeys: {
    [STORAGE_KEYS.customSearchRelays]: '0xsearchstr:search-relays:custom',
    [STORAGE_KEYS.hiddenSearchRelays]: '0xsearchstr:search-relays:hidden',
    [STORAGE_KEYS.customIndexRelays]: '0xsearchstr:index-relays:custom',
    [STORAGE_KEYS.hiddenIndexRelays]: '0xsearchstr:index-relays:hidden',
    [STORAGE_KEYS.customGitRelays]: '0xsearchstr:git-relays:custom',
    [STORAGE_KEYS.hiddenGitRelays]: '0xsearchstr:git-relays:hidden',
    [STORAGE_KEYS.customWikiRelays]: '0xsearchstr:wiki-relays:custom',
    [STORAGE_KEYS.hiddenWikiRelays]: '0xsearchstr:wiki-relays:hidden',
    [STORAGE_KEYS.discoveredRelays]: '0xsearchstr:relay-discovery:verified',
    [STORAGE_KEYS.relayDiscoveryEnabled]: '0xsearchstr:relay-discovery:enabled',
    [STORAGE_KEYS.appConfig]: 'nostr:app-config',
  },
};
