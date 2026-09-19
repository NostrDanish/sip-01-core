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
 * A storage-key rename: `canonical` is the current key, `legacy` the older
 * names (oldest last) that still migrate forward on first read.
 */
export interface StorageKeyRename {
  canonical: string;
  legacy: readonly string[];
}

/**
 * The key renames sip-01-core applies to the engine/AI local state it took
 * over from the Dsearch application. These keys are LOCAL-ONLY (settings,
 * BYOK credentials, my-vote UI state) — they never appear in protocol event
 * content, tags, d-tags, or namespaces, so renaming them does not fork
 * anything on the wire. Call sites pass the matching entry's keys to
 * readStoredWithLegacy/writeStoredCanonical below.
 */
export const STORAGE_KEY_RENAMES: readonly StorageKeyRename[] = [
  { canonical: 'sip01:votes', legacy: ['dsearch:votes', 'presearchstr:votes'] },
  { canonical: 'sip01:brave-api-key', legacy: ['dsearch:brave-api-key', 'presearchstr:brave-api-key'] },
  { canonical: 'sip01:parallel-api-key', legacy: ['dsearch:parallel-api-key', 'presearchstr:parallel-api-key'] },
  { canonical: 'sip01:ai-config', legacy: ['dsearch:ai-config', 'presearchstr:ai-config'] },
];

/**
 * Read a namespaced localStorage key, falling back to its legacy names. On a
 * legacy hit the value is copied to the canonical key and the legacy key
 * removed — settings migrate on first read. With several legacy names the
 * FIRST hit wins (newest legacy first).
 */
export function readStoredWithLegacy(canonicalKey: string, legacyKey: string | readonly string[]): string | null {
  try {
    const value = localStorage.getItem(canonicalKey);
    if (value !== null) return value;
    for (const legacy of typeof legacyKey === 'string' ? [legacyKey] : legacyKey) {
      const legacyValue = localStorage.getItem(legacy);
      if (legacyValue !== null) {
        localStorage.setItem(canonicalKey, legacyValue);
        localStorage.removeItem(legacy);
        return legacyValue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Write ONLY the canonical key (and clear the legacy ones). null removes. */
export function writeStoredCanonical(canonicalKey: string, legacyKey: string | readonly string[], value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(canonicalKey);
    else localStorage.setItem(canonicalKey, value);
    for (const legacy of typeof legacyKey === 'string' ? [legacyKey] : legacyKey) {
      localStorage.removeItem(legacy);
    }
  } catch {
    // Storage unavailable — non-fatal everywhere it's used.
  }
}
