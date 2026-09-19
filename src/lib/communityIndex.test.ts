/**
 * Characterization tests — community index (0xsearchstr:submit:* + NIP-B0).
 *
 * Pin the shared submission contract before extraction: per-URL d-tags,
 * event shape, content-type routing, and parse validation.
 */
import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

import {
  COMMUNITY_KIND,
  COMMUNITY_T_TAG,
  BOOKMARK_KIND,
  buildSubmissionEvent,
  parseBookmarkEvent,
  parseSubmissionEvent,
  submissionDTag,
} from './communityIndex';

const PUBKEY = 'c'.repeat(64);

function asEvent(partial: Partial<NostrEvent>): NostrEvent {
  return {
    id: 'd'.repeat(64),
    pubkey: PUBKEY,
    created_at: 1_800_000_000,
    kind: COMMUNITY_KIND,
    tags: [],
    content: '',
    sig: 's'.repeat(128),
    ...partial,
  };
}

describe('submissionDTag', () => {
  it('derives a per-URL d-tag in the shared namespace (24 hex chars)', async () => {
    const d = await submissionDTag('https://example.com/page');
    expect(d).toMatch(/^0xsearchstr:submit:[0-9a-f]{24}$/);
  });

  it('is deterministic and case/whitespace-insensitive', async () => {
    expect(await submissionDTag('  HTTPS://Example.com/Page ')).toBe(await submissionDTag('https://example.com/page'));
  });
});

describe('buildSubmissionEvent', () => {
  it('builds a kind 30078 submission with shared t-tag and normalized user tags', async () => {
    const built = await buildSubmissionEvent({
      url: 'https://example.com/page',
      title: 'Example Page',
      description: 'An example.',
      tags: ['Nostr Tools', 'Bitcoin'],
    });
    expect(built.kind).toBe(30078);
    expect(built.content).toBe('An example.');
    const d = await submissionDTag('https://example.com/page');
    expect(built.tags[0]).toEqual(['d', d]);
    expect(built.tags).toContainEqual(['t', '0xsearchstr-submit']);
    expect(built.tags).toContainEqual(['t', 'web']); // auto-detected content type
    expect(built.tags).toContainEqual(['t', 'nostr-tools']); // lowercased, dashes
    expect(built.tags).toContainEqual(['t', 'bitcoin']);
    expect(built.tags).toContainEqual(['title', 'Example Page']);
    expect(built.tags).toContainEqual(['url', 'https://example.com/page']);
    expect(built.tags).toContainEqual(['type', 'web']);
    expect(built.tags.some(([n]) => n === 'alt')).toBe(true);
  });

  it('caps user tags at 8 and drops empty ones', async () => {
    const built = await buildSubmissionEvent({
      url: 'https://example.com/',
      title: 'T',
      description: 'D',
      tags: ['', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    });
    const userTags = built.tags.filter(([n, v]) => n === 't' && v !== COMMUNITY_T_TAG && v !== 'web');
    expect(userTags.length).toBe(8);
  });
});

describe('parseSubmissionEvent', () => {
  it('round-trips a built submission into a SearchResult at the community score band', async () => {
    const built = await buildSubmissionEvent({
      url: 'https://example.com/page',
      title: 'Example Page',
      description: 'An example.',
      tags: ['nostr'],
    });
    const parsed = parseSubmissionEvent(
      asEvent({ kind: built.kind, tags: built.tags, content: built.content }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.provider).toBe('community');
    expect(parsed!.title).toBe('Example Page');
    expect(parsed!.url).toBe('https://example.com/page');
    expect(parsed!.snippet).toBe('An example.');
    expect(parsed!.source).toBe('web');
    expect(parsed!.domain).toBe('example.com');
    expect(parsed!.engine).toBe('Community');
    expect(parsed!.score).toBe(96);
    expect(parsed!.tags).toEqual(['nostr']); // shared marker + type tag stripped
  });

  it('routes onion submissions to the tor source', async () => {
    const built = await buildSubmissionEvent({
      url: 'http://exampleonionaddress1234567890abcdef.onion/page',
      title: 'Onion Page',
      description: 'Hidden service.',
      tags: [],
    });
    const parsed = parseSubmissionEvent(asEvent({ kind: built.kind, tags: built.tags, content: built.content }));
    expect(parsed!.source).toBe('tor');
  });

  it('rejects wrong kind, missing shared t-tag, and invalid URLs', async () => {
    const built = await buildSubmissionEvent({
      url: 'https://example.com/page',
      title: 'Example Page',
      description: 'An example.',
      tags: [],
    });
    expect(parseSubmissionEvent(asEvent({ kind: 1, tags: built.tags }))).toBeNull();
    expect(
      parseSubmissionEvent(asEvent({ tags: built.tags.filter(([n, v]) => !(n === 't' && v === COMMUNITY_T_TAG)) })),
    ).toBeNull();
    expect(
      parseSubmissionEvent(
        asEvent({ tags: built.tags.map((t) => (t[0] === 'url' ? ['url', 'javascript:x'] : t)) }),
      ),
    ).toBeNull();
  });
});

describe('parseBookmarkEvent (NIP-B0 interop)', () => {
  it('reconstructs https for scheme-less d-tag URIs', () => {
    const parsed = parseBookmarkEvent(
      asEvent({
        kind: BOOKMARK_KIND,
        tags: [['d', 'example.com/page'], ['title', 'Example'], ['published_at', '1700000000'], ['t', 'nostr']],
        content: 'A bookmarked page.',
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.url).toBe('https://example.com/page');
    expect(parsed!.provider).toBe('nostr-bookmark');
    expect(parsed!.kind).toBe('Bookmark');
    expect(parsed!.timestamp).toBe(1700000000);
    expect(parsed!.score).toBe(94);
  });

  it('keeps an explicit scheme and rejects non-bookmark kinds and unusable URIs', () => {
    const withScheme = parseBookmarkEvent(
      asEvent({ kind: BOOKMARK_KIND, tags: [['d', 'http://example.com/a']], content: '' }),
    );
    expect(withScheme!.url).toBe('http://example.com/a');

    expect(parseBookmarkEvent(asEvent({ kind: COMMUNITY_KIND, tags: [['d', 'example.com']] }))).toBeNull();
    expect(parseBookmarkEvent(asEvent({ kind: BOOKMARK_KIND, tags: [] }))).toBeNull();
    expect(
      parseBookmarkEvent(asEvent({ kind: BOOKMARK_KIND, tags: [['d', 'not a url at all']] })),
    ).toBeNull();
  });
});
