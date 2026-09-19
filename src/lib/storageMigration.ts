/**
 * Namespaced localStorage migration helpers — generic, app-agnostic.
 *
 * When an app renames a storage key (rebrand, namespace cleanup), existing
 * users carry state under the old key. These helpers read through to a
 * legacy key (forward-migrating on first read) and write only the canonical
 * key. They know nothing about Nostr, Dsearch, or any specific key naming —
 * the caller supplies both keys.
 *
 * Extracted from dsearchProtocol.ts: a storage primitive must not live in
 * an application's trust-root module, or every consumer silently inherits
 * the app's control-plane namespace.
 */

/**
 * Read a namespaced localStorage key, falling back to its legacy name. On a
 * legacy hit the value is copied to the canonical key and the legacy key
 * removed — settings migrate on first read.
 */
export function readStoredWithLegacy(canonicalKey: string, legacyKey: string): string | null {
  try {
    const value = localStorage.getItem(canonicalKey);
    if (value !== null) return value;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) {
      localStorage.setItem(canonicalKey, legacy);
      localStorage.removeItem(legacyKey);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

/** Write ONLY the canonical key (and clear the legacy one). null removes. */
export function writeStoredCanonical(canonicalKey: string, legacyKey: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(canonicalKey);
    else localStorage.setItem(canonicalKey, value);
    localStorage.removeItem(legacyKey);
  } catch {
    // Storage unavailable — non-fatal everywhere it's used.
  }
}
