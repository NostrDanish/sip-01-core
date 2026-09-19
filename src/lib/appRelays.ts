import { getDiscoveredSearchRelays, getDiscoveredIndexRelays } from '@/lib/relayDiscovery';
import { getRelayConfig } from '@/lib/relayConfig';
import { normalizeRelayUrl } from '@/lib/relayUrls';
import { readStoredWithLegacy, writeStoredCanonical } from '@/lib/storageMigration';

/**
 * Generic relay pool machinery (SIP-01 core).
 *
 * Four editable relay pools exist — search (NIP-50 reads), index (SIP-01
 * reads + writes), git (NIP-34 reads), wiki (NIP-54 reads) — each computed
 * as: defaults minus user-hidden, then discovered, then user customs
 * (deduped). Customizations persist in localStorage with read-through
 * migration from legacy keys (storageMigration.ts).
 *
 * This module is host-agnostic: the default relay lists and storage key
 * names are injected by the host application via the relayConfig seam
 * (configureRelays() at startup — see src/lib/relayConfig.ts). Everything
 * below reads the config at call time.
 */

/* ------------------------------------------------------------------ */
/* Pool customization (user-managed, localStorage)                     */
/* ------------------------------------------------------------------ */

/** Legacy key for a canonical one, when the host config declares one. */
function legacyKeyFor(key: string): string | undefined {
  return getRelayConfig().legacyStorageKeys[key];
}

function readList(key: string): string[] {
  try {
    const legacy = legacyKeyFor(key);
    const raw = legacy ? readStoredWithLegacy(key, legacy) : localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key: string, urls: string[]): void {
  try {
    const legacy = legacyKeyFor(key);
    if (legacy) writeStoredCanonical(key, legacy, JSON.stringify(urls));
    else localStorage.setItem(key, JSON.stringify(urls));
  } catch {
    // Storage unavailable — non-fatal.
  }
}

/** Effective pool: defaults minus hidden, then discovered, then customs (deduped). */
function effectivePool(
  defaults: readonly string[],
  customKey: string,
  hiddenKey: string,
  discovered: readonly string[] = [],
): string[] {
  const hidden = new Set(readList(hiddenKey));
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const url of [...defaults, ...discovered, ...readList(customKey)]) {
    if (hidden.has(url) || seen.has(url)) continue;
    seen.add(url);
    pool.push(url);
  }
  return pool;
}

/* Search relay pool (NIP-50 reads) */

export function getCustomSearchRelays(): string[] {
  return readList(getRelayConfig().storageKeys.customSearchRelays);
}

export function getHiddenSearchRelays(): string[] {
  return readList(getRelayConfig().storageKeys.hiddenSearchRelays);
}

/** Add a custom search relay. Returns the normalized URL, or null if invalid. */
export function addCustomSearchRelay(input: string): string | null {
  const normalized = normalizeRelayUrl(input);
  if (!normalized) return null;
  const customKey = getRelayConfig().storageKeys.customSearchRelays;
  const current = readList(customKey);
  if (!current.includes(normalized)) {
    writeList(customKey, [...current, normalized]);
  }
  // Re-adding a hidden default un-hides it.
  if (getRelayConfig().searchRelays.includes(normalized)) {
    restoreDefaultSearchRelay(normalized);
  }
  return normalized;
}

/** Remove a custom search relay. */
export function removeCustomSearchRelay(url: string): void {
  const customKey = getRelayConfig().storageKeys.customSearchRelays;
  writeList(customKey, readList(customKey).filter((u) => u !== url));
}

/** Hide a default search relay (user override — restorable). */
export function hideDefaultSearchRelay(url: string): void {
  const hiddenKey = getRelayConfig().storageKeys.hiddenSearchRelays;
  const hidden = readList(hiddenKey);
  if (!hidden.includes(url)) writeList(hiddenKey, [...hidden, url]);
}

/** Restore a previously hidden default search relay. */
export function restoreDefaultSearchRelay(url: string): void {
  const hiddenKey = getRelayConfig().storageKeys.hiddenSearchRelays;
  writeList(hiddenKey, readList(hiddenKey).filter((u) => u !== url));
}

/** Restore all hidden default search relays. */
export function restoreAllDefaultSearchRelays(): void {
  writeList(getRelayConfig().storageKeys.hiddenSearchRelays, []);
}

/**
 * The effective search relay pool: default NIP-50 relays (minus hidden),
 * then NIP-11-verified discovered relays (relayDiscovery.ts — relays that
 * provably advertise NIP-50), then the user's custom relays (deduped).
 */
export function getSearchRelayUrls(): string[] {
  const { searchRelays, storageKeys } = getRelayConfig();
  return effectivePool(
    searchRelays,
    storageKeys.customSearchRelays,
    storageKeys.hiddenSearchRelays,
    getDiscoveredSearchRelays(),
  );
}

/* Index relay pool (SIP-01 reads + writes) */

export function getCustomIndexRelays(): string[] {
  return readList(getRelayConfig().storageKeys.customIndexRelays);
}

export function getHiddenIndexRelays(): string[] {
  return readList(getRelayConfig().storageKeys.hiddenIndexRelays);
}

/** Add a custom index relay. Returns the normalized URL, or null if invalid. */
export function addCustomIndexRelay(input: string): string | null {
  const normalized = normalizeRelayUrl(input);
  if (!normalized) return null;
  const customKey = getRelayConfig().storageKeys.customIndexRelays;
  const current = readList(customKey);
  if (!current.includes(normalized)) {
    writeList(customKey, [...current, normalized]);
  }
  if (getRelayConfig().indexRelays.includes(normalized)) {
    restoreDefaultIndexRelay(normalized);
  }
  return normalized;
}

/** Remove a custom index relay. */
export function removeCustomIndexRelay(url: string): void {
  const customKey = getRelayConfig().storageKeys.customIndexRelays;
  writeList(customKey, readList(customKey).filter((u) => u !== url));
}

/** Hide a default index relay (user override — restorable). */
export function hideDefaultIndexRelay(url: string): void {
  const hiddenKey = getRelayConfig().storageKeys.hiddenIndexRelays;
  const hidden = readList(hiddenKey);
  if (!hidden.includes(url)) writeList(hiddenKey, [...hidden, url]);
}

/** Restore a previously hidden default index relay. */
export function restoreDefaultIndexRelay(url: string): void {
  const hiddenKey = getRelayConfig().storageKeys.hiddenIndexRelays;
  writeList(hiddenKey, readList(hiddenKey).filter((u) => u !== url));
}

/** Restore all hidden default index relays. */
export function restoreAllDefaultIndexRelays(): void {
  writeList(getRelayConfig().storageKeys.hiddenIndexRelays, []);
}

/**
 * The effective index relay pool: default SIP-01 index relays (minus hidden),
 * then NIP-11-verified SIP-01 relays discovered via relayDiscovery.ts
 * (relays advertising the `uncaged_index` block), then the user's custom
 * relays (deduped). Indexing writes AND reads (SIP-01 observations, legacy
 * cache, community submissions, keyword stakes) all use this pool so writes
 * land where reads happen.
 */
export function getIndexRelayUrls(): string[] {
  const { indexRelays, storageKeys } = getRelayConfig();
  return effectivePool(
    indexRelays,
    storageKeys.customIndexRelays,
    storageKeys.hiddenIndexRelays,
    getDiscoveredIndexRelays(),
  );
}

/* ------------------------------------------------------------------ */
/* Read-only satellite pools (git + wiki) — generic factory            */
/* ------------------------------------------------------------------ */

/**
 * One editable read-only pool: defaults (hideable) + user customs. Defaults
 * and keys are read through accessors so the host-injected relay config is
 * always read at call time, never captured at module scope.
 */
function makePool(
  getDefaults: () => readonly string[],
  getKeys: () => { custom: string; hidden: string },
) {
  return {
    getCustoms: (): string[] => readList(getKeys().custom),
    getHidden: (): string[] => readList(getKeys().hidden),
    addCustom: (input: string): string | null => {
      const normalized = normalizeRelayUrl(input);
      if (!normalized) return null;
      const current = readList(getKeys().custom);
      if (!current.includes(normalized)) writeList(getKeys().custom, [...current, normalized]);
      // Re-adding a hidden default un-hides it.
      if (getDefaults().includes(normalized)) {
        writeList(getKeys().hidden, readList(getKeys().hidden).filter((u) => u !== normalized));
      }
      return normalized;
    },
    removeCustom: (url: string): void => {
      writeList(getKeys().custom, readList(getKeys().custom).filter((u) => u !== url));
    },
    hideDefault: (url: string): void => {
      const hidden = readList(getKeys().hidden);
      if (!hidden.includes(url)) writeList(getKeys().hidden, [...hidden, url]);
    },
    restoreDefault: (url: string): void => {
      writeList(getKeys().hidden, readList(getKeys().hidden).filter((u) => u !== url));
    },
    restoreAllDefaults: (): void => writeList(getKeys().hidden, []),
    /** Effective pool: defaults minus hidden, then customs (deduped). */
    getUrls: (): string[] => effectivePool(getDefaults(), getKeys().custom, getKeys().hidden),
  };
}

const gitPool = makePool(
  () => getRelayConfig().gitRelays,
  () => {
    const keys = getRelayConfig().storageKeys;
    return { custom: keys.customGitRelays, hidden: keys.hiddenGitRelays };
  },
);

const wikiPool = makePool(
  () => getRelayConfig().wikiRelays,
  () => {
    const keys = getRelayConfig().storageKeys;
    return { custom: keys.customWikiRelays, hidden: keys.hiddenWikiRelays };
  },
);

/** Git relay pool (NIP-34 reads for the Code tab). Read-only. */
export const gitRelays = gitPool;
/** Wiki relay pool (NIP-54 article reads). Read-only. */
export const wikiRelays = wikiPool;

/** Effective git relay URLs (defaults − hidden + customs). */
export function getGitRelayUrls(): string[] {
  return gitPool.getUrls();
}

/** Effective wiki relay URLs (defaults − hidden + customs). */
export function getWikiRelayUrls(): string[] {
  return wikiPool.getUrls();
}
