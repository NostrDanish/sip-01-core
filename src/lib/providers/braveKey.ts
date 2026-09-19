/**
 * Brave BYOK key storage — leaf module.
 *
 * Extracted from brave.ts to break the brave ⇄ enginePriority import
 * cycle: enginePriority needs the key state (does Brave lead the organic
 * band?) and brave needs the band bases — both now read the key from here.
 */
import { readStoredWithLegacy, writeStoredCanonical } from '@/lib/storageMigration';

const LS_BRAVE_KEY = 'dsearch:brave-api-key';
const LEGACY_LS_BRAVE_KEY = 'presearchstr:brave-api-key';

/** Read the user's Brave API key (empty when unset). */
export function getBraveApiKey(): string {
  try {
    return (readStoredWithLegacy(LS_BRAVE_KEY, LEGACY_LS_BRAVE_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

/** Store/clear the user's Brave API key (Settings). */
export function setBraveApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    writeStoredCanonical(LS_BRAVE_KEY, LEGACY_LS_BRAVE_KEY, trimmed || null);
  } catch {
    // Storage unavailable — the provider just stays dormant.
  }
}
