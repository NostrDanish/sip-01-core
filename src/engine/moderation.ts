/**
 * Moderation — generic hidden-result filtering for the search pipeline.
 *
 * This module is the PURE core of moderation: a `ModerationSet` lookup and
 * the matching predicate. It carries no trust policy — no owner pubkey, no
 * label namespaces, no relay lists. Hosts inject a `ModerationSet` built
 * from their own trust policy (e.g. NIP-32 labels signed by their own
 * moderators, a local blocklist, or nothing at all) via the EngineRuntime
 * (`EngineRuntime.moderation`, see src/engine/runtime.tsx). Undefined =
 * no filtering.
 */
import { normalizeIndexUrl } from '@/protocol/webIndex';

/** A hidden target parsed from the host's moderation source. */
export interface HiddenTarget {
  /** Source event/record id (needed by hosts that support un-hiding). */
  labelEventId: string;
  /** 'u' (web URL, normalized) or 'e' (Nostr event id). */
  targetType: 'u' | 'e';
  /** The target value (normalized URL or event id hex). */
  value: string;
  /** When the moderation record was created. */
  createdAt: number;
}

/** A set of hidden targets for fast result filtering. */
export interface ModerationSet {
  urls: Set<string>;
  eventIds: Set<string>;
}

export function toModerationSet(targets: HiddenTarget[]): ModerationSet {
  return {
    urls: new Set(targets.filter((t) => t.targetType === 'u').map((t) => t.value)),
    eventIds: new Set(targets.filter((t) => t.targetType === 'e').map((t) => t.value)),
  };
}

/** Is this result hidden by the moderation set? */
export function isHiddenResult(
  result: { url: string; nostrEvent?: { id: string } },
  set: ModerationSet,
): boolean {
  if (result.nostrEvent && set.eventIds.has(result.nostrEvent.id)) return true;
  const normalized = normalizeIndexUrl(result.url);
  if (normalized && set.urls.has(normalized)) return true;
  return false;
}
