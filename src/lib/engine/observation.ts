/**
 * Observation adapter — converts engine SearchResults into SIP-01
 * IndexObservationInput for the auto-indexer.
 *
 * Lives OUTSIDE the protocol module (webIndex.ts) on purpose: SIP-01 defines
 * the wire format, but which engine identity an observation carries in its
 * `source` tag is the host application's choice (spec §6, informational
 * only). The caller injects it — the protocol layer never imports an app
 * profile.
 */
import type { IndexObservationInput } from '@/protocol/webIndex';
import type { SearchResult } from '@/lib/providers/types';

/** Convert a search result into an observation input (for auto-indexing). */
export function observationFromResult(result: SearchResult, indexerSource: string): IndexObservationInput | null {
  if (!result.url || !/^https?:\/\//i.test(result.url)) return null;
  if (!result.title?.trim()) return null;
  return {
    url: result.url,
    title: result.title,
    description: result.snippet,
    image: result.thumbnail,
    tags: result.tags,
    published: result.timestamp,
    // Attributed to the host engine — injected by the caller.
    source: indexerSource,
  };
}
