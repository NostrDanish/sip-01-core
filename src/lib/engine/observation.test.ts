/**
 * Tests for the SearchResult → SIP-01 observation adapter (engine glue).
 * The indexer identity (`source` tag) is injected by the host application —
 * these tests pin the injection contract.
 */
import { describe, it, expect } from 'vitest';

import { observationFromResult } from './observation';

describe('observationFromResult', () => {
  it('converts web results, attributing the injected indexer source', () => {
    const web = observationFromResult(
      {
        id: 'x', title: 'Page', url: 'https://example.com/', snippet: 'S',
        source: 'web', provider: 'example-provider',
      },
      'test-engine/1',
    );
    expect(web).not.toBeNull();
    expect(web!.source).toBe('test-engine/1');
    expect(web!.description).toBe('S');
  });

  it('skips nostr-internal routes and empty titles regardless of source', () => {
    const internal = observationFromResult(
      {
        id: 'x', title: 'Note', url: '/note1abc', snippet: 'S',
        source: 'nostr', provider: 'nostr',
      },
      'test-engine/1',
    );
    expect(internal).toBeNull();

    const untitled = observationFromResult(
      {
        id: 'y', title: '   ', url: 'https://example.com/', snippet: 'S',
        source: 'web', provider: 'example-provider',
      },
      'test-engine/1',
    );
    expect(untitled).toBeNull();
  });
});
