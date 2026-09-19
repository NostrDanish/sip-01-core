/**
 * Relay URL helpers — leaf module (no internal imports).
 *
 * Home of the two URL normalizers shared by the pool configuration
 * (appRelays.ts), the connection cache (searchRelays.ts), relay discovery
 * (relayDiscovery.ts), and the login/provider components. Kept dependency-
 * free so every layer can import them without inheriting pool policy.
 */

/**
 * Upgrade ws:// → wss:// when the page itself is HTTPS.
 *
 * Browsers throw a SYNCHRONOUS SecurityError when constructing a ws://
 * WebSocket from an https page — one insecure relay URL in a NIP-65 list
 * can kill a whole connection fan-out (or a NIP-46 handshake) outright.
 * Upgrading preserves intent: nearly every relay host serves TLS on the
 * same address, and one that doesn't simply fails to connect (graceful,
 * async) instead of throwing.
 */
export function toSecureRelayUrl(url: string): string {
  if (typeof location !== 'undefined' && location.protocol === 'https:') {
    return url.replace(/^ws:\/\//i, 'wss://');
  }
  return url;
}

/** Normalize a relay URL: ws/wss only, with trailing slash on bare hosts. */
export function normalizeRelayUrl(input: string): string | null {
  let url = input.trim();
  if (!url) return null;
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = `wss://${url}`;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') return null;
    // Canonical form: origin + pathname, trailing slash on bare hosts.
    const path = parsed.pathname === '/' ? '/' : parsed.pathname;
    return `${parsed.protocol}//${parsed.host}${path}`;
  } catch {
    return null;
  }
}
