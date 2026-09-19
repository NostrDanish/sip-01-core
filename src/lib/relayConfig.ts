/**
 * Relay pool configuration seam.
 *
 * The core relay pool machinery (appRelays.ts pool helpers, relayDiscovery.ts
 * persistence) is host-agnostic: it must not hard-code one deployment's
 * default relay lists or localStorage key names. The host application
 * injects its relay identity ONCE at startup:
 *
 *   configureRelays(DSEARCH_RELAY_CONFIG); // see src/app/relayConfig.ts
 *
 * Core internals read the seam via getRelayConfig(). Until configured,
 * neutral brand-free defaults apply (empty pools, `sip01:*` storage keys) —
 * safe for tests and for running the core without any host profile.
 *
 * This mirrors engineConfig.ts: deliberately one flat config object with a
 * single setter, read strictly at call time so module-scope constants never
 * capture defaults before the host boots.
 */

export interface RelayStorageKeys {
  /** User-added search pool relays (JSON string array). */
  customSearchRelays: string;
  /** Hidden default search pool relays (JSON string array). */
  hiddenSearchRelays: string;
  /** User-added index pool relays. */
  customIndexRelays: string;
  /** Hidden default index pool relays. */
  hiddenIndexRelays: string;
  /** User-added git pool relays. */
  customGitRelays: string;
  /** Hidden default git pool relays. */
  hiddenGitRelays: string;
  /** User-added wiki pool relays. */
  customWikiRelays: string;
  /** Hidden default wiki pool relays. */
  hiddenWikiRelays: string;
  /** Verified relay discovery cache (`{ relays, fetchedAt }`). */
  discoveredRelays: string;
  /** Relay auto-discovery on/off flag (JSON boolean). */
  relayDiscoveryEnabled: string;
  /**
   * Stored app config JSON. Discovery reads only its `privacyMode` flag to
   * decide whether NIP-11 probes (CORS-proxy traffic) may run.
   */
  appConfig: string;
}

export interface RelayPoolConfig {
  /**
   * Default relay URLs per pool. Defaults are suggestions, not mandates:
   * users can hide any default and add customs (see appRelays.ts).
   */
  searchRelays: readonly string[];
  indexRelays: readonly string[];
  gitRelays: readonly string[];
  wikiRelays: readonly string[];
  /** Canonical localStorage keys for pool customization + discovery state. */
  storageKeys: RelayStorageKeys;
  /**
   * Legacy localStorage keys for read-through migration, keyed by the
   * canonical key they migrate to (see storageMigration.ts). Canonical keys
   * absent from this map have no legacy name.
   */
  legacyStorageKeys: Record<string, string>;
}

/** Neutral defaults — empty pools, brand-free keys, no legacy migration. */
const NEUTRAL_RELAY_CONFIG: RelayPoolConfig = {
  searchRelays: [],
  indexRelays: [],
  gitRelays: [],
  wikiRelays: [],
  storageKeys: {
    customSearchRelays: 'sip01:search-relays:custom',
    hiddenSearchRelays: 'sip01:search-relays:hidden',
    customIndexRelays: 'sip01:index-relays:custom',
    hiddenIndexRelays: 'sip01:index-relays:hidden',
    customGitRelays: 'sip01:git-relays:custom',
    hiddenGitRelays: 'sip01:git-relays:hidden',
    customWikiRelays: 'sip01:wiki-relays:custom',
    hiddenWikiRelays: 'sip01:wiki-relays:hidden',
    discoveredRelays: 'sip01:relay-discovery:verified',
    relayDiscoveryEnabled: 'sip01:relay-discovery:enabled',
    appConfig: 'sip01:app-config',
  },
  legacyStorageKeys: {},
};

let runtimeRelayConfig: RelayPoolConfig = NEUTRAL_RELAY_CONFIG;

/** Inject the host application's relay configuration. Call once at startup. */
export function configureRelays(config: RelayPoolConfig): void {
  runtimeRelayConfig = config;
}

/** The active relay configuration (neutral defaults until configured). */
export function getRelayConfig(): RelayPoolConfig {
  return runtimeRelayConfig;
}

/**
 * Restore the neutral (unconfigured) defaults. Test helper: suites that
 * call configureRelays() must reset afterwards so module state does not
 * leak between test files sharing a worker.
 */
export function resetRelayConfig(): void {
  runtimeRelayConfig = NEUTRAL_RELAY_CONFIG;
}
