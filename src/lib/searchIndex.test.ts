/**
 * Characterization tests — legacy federated query cache (0xsearchstr:cache:*,
 * kind 30078, READ-ONLY) and its trusted-indexer contract.
 *
 * Pin before extraction: query normalization, cache staleness window, and
 * the federation trust list (the pubkeys that make the index shared).
 */
import { describe, it, expect } from 'vitest';

import {
  CACHE_MAX_AGE_SECONDS,
  INDEXER_PUBKEYS,
  INDEX_KIND,
  PRESEARCHSTR_INDEX_PUBKEY,
  SEARCHSTR_INDEX_PUBKEY,
  fromCachedResult,
  normalizeQuery,
  parseCacheEvent,
} from './searchIndex';

describe('normalizeQuery', () => {
  it('lowercases, trims, collapses whitespace, and strips punctuation', () => {
    expect(normalizeQuery('  Hello   World!  ')).toBe('hello world');
    expect(normalizeQuery('Nostr, Search; Engine')).toBe('nostr search engine');
    expect(normalizeQuery('already-normalized')).toBe('already-normalized');
  });
});

describe('parseCacheEvent', () => {
  const now = Math.floor(Date.now() / 1000);
  const cachedRow = {
    id: 'https://example.com',
    title: 'Example',
    url: 'https://example.com',
    snippet: 'An example result.',
    source: 'web',
    provider: 'searxng',
  };

  it('parses a fresh cache event and restores results at the cache score band', () => {
    const parsed = parseCacheEvent({
      content: JSON.stringify([cachedRow]),
      tags: [['cached_at', String(now)], ['query', 'example query']],
      created_at: now,
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.query).toBe('example query');
    expect(parsed!.cachedAt).toBe(now);
    expect(parsed!.results).toHaveLength(1);
    expect(parsed!.results[0].title).toBe('Example');
    expect(parsed!.results[0].score).toBe(79); // below organic, per the module contract
  });

  it('rejects stale cache entries (older than the 24h window)', () => {
    const stale = now - CACHE_MAX_AGE_SECONDS - 10;
    expect(
      parseCacheEvent({
        content: JSON.stringify([cachedRow]),
        tags: [['cached_at', String(stale)], ['query', 'q']],
        created_at: stale,
      }),
    ).toBeNull();
    expect(CACHE_MAX_AGE_SECONDS).toBe(86400);
  });

  it('rejects missing query tags, malformed JSON, and non-array payloads', () => {
    expect(parseCacheEvent({ content: '[]', tags: [['cached_at', String(now)]], created_at: now })).toBeNull();
    expect(
      parseCacheEvent({ content: 'not json', tags: [['cached_at', String(now)], ['query', 'q']], created_at: now }),
    ).toBeNull();
    expect(
      parseCacheEvent({ content: '{}', tags: [['cached_at', String(now)], ['query', 'q']], created_at: now }),
    ).toBeNull();
  });
});

describe('federation trust list', () => {
  it('pins the known indexer pubkeys (renaming/removing one forks the cache)', () => {
    expect(INDEX_KIND).toBe(30078);
    expect(INDEXER_PUBKEYS).toContain(PRESEARCHSTR_INDEX_PUBKEY);
    expect(INDEXER_PUBKEYS).toContain(SEARCHSTR_INDEX_PUBKEY);
    expect(INDEXER_PUBKEYS).toHaveLength(2);
    for (const pk of INDEXER_PUBKEYS) expect(pk).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('fromCachedResult', () => {
  it('restores a cached row with the fixed cache score', () => {
    const r = fromCachedResult({
      id: 'x',
      title: 'T',
      url: 'https://x.example.com',
      snippet: 's',
      source: 'web',
      provider: 'duckduckgo',
    });
    expect(r.score).toBe(79);
    expect(r.source).toBe('web');
    expect(r.provider).toBe('duckduckgo');
  });
});
