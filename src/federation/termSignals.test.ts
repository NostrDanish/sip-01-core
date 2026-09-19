/**
 * Characterization tests — k-anonymity term signals (0xsearchstr:term:*).
 *
 * Pin the privacy contract before any extraction work:
 *   - signals carry ONLY a one-way hash (never the plaintext query);
 *   - a reveal is accepted only when the claimed plaintext hashes back to
 *     the d-tag hash (self-verifying — fake reveals are dropped);
 *   - the threshold constant and namespaces must not drift.
 */
import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

import {
  TERM_SIGNAL_D_PREFIX,
  TERM_REVEAL_D_PREFIX,
  TERM_SIGNAL_T_TAG,
  TERM_REVEAL_T_TAG,
  TRENDING_THRESHOLD,
  buildTermSignalEvent,
  buildTermRevealEvent,
  hashTerm,
  parseTermReveal,
  parseTermSignal,
  verifyTermReveal,
} from './termSignals';
import { INDEX_KIND } from './searchIndex';

function fakeEvent(partial: Partial<NostrEvent>): NostrEvent {
  return {
    id: 'e'.repeat(64),
    pubkey: 'a'.repeat(64),
    created_at: 1_800_000_000,
    kind: INDEX_KIND,
    tags: [],
    content: '',
    sig: 's'.repeat(128),
    ...partial,
  };
}

describe('hashTerm', () => {
  it('produces a 64-char lowercase hex sha256 of the normalized query', async () => {
    const hash = await hashTerm('bitcoin');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic and normalization-stable', async () => {
    expect(await hashTerm('Hello   World')).toBe(await hashTerm('hello world'));
    expect(await hashTerm('bitcoin')).not.toBe(await hashTerm('ethereum'));
  });
});

describe('term signal events', () => {
  it('buildTermSignalEvent carries only the hash — no plaintext field exists', () => {
    const hash = 'ab'.repeat(32);
    const ev = buildTermSignalEvent(hash);
    expect(ev.kind).toBe(INDEX_KIND);
    expect(ev.content).toBe('');
    expect(ev.tags).toContainEqual(['d', `${TERM_SIGNAL_D_PREFIX}${hash}`]);
    expect(ev.tags).toContainEqual(['t', TERM_SIGNAL_T_TAG]);
    expect(ev.tags.some(([n]) => n === 'alt')).toBe(true);
    // No tag may carry a plaintext term.
    expect(ev.tags.some(([n]) => n === 'term')).toBe(false);
  });

  it('parseTermSignal round-trips a built signal', () => {
    const hash = 'cd'.repeat(32);
    const built = buildTermSignalEvent(hash);
    const parsed = parseTermSignal(fakeEvent({ kind: built.kind, tags: built.tags, content: built.content }));
    expect(parsed).toEqual({ hash, searcher: 'a'.repeat(64), signaledAt: 1_800_000_000 });
  });

  it('parseTermSignal rejects wrong kind, wrong prefix, and malformed hashes', () => {
    const hash = 'ab'.repeat(32);
    const tags = [['d', `${TERM_SIGNAL_D_PREFIX}${hash}`]];
    expect(parseTermSignal(fakeEvent({ kind: 1, tags }))).toBeNull();
    expect(parseTermSignal(fakeEvent({ tags: [['d', 'other:prefix' + hash]] }))).toBeNull();
    expect(parseTermSignal(fakeEvent({ tags: [['d', `${TERM_SIGNAL_D_PREFIX}not-hex`]] }))).toBeNull();
    expect(parseTermSignal(fakeEvent({ tags: [] }))).toBeNull();
  });
});

describe('term reveal events', () => {
  it('parseTermReveal round-trips a built reveal', async () => {
    const hash = await hashTerm('nostr search');
    const built = buildTermRevealEvent(hash, 'nostr search');
    expect(built.tags).toContainEqual(['d', `${TERM_REVEAL_D_PREFIX}${hash}`]);
    expect(built.tags).toContainEqual(['t', TERM_REVEAL_T_TAG]);
    expect(built.tags).toContainEqual(['term', 'nostr search']);

    const parsed = parseTermReveal(fakeEvent({ kind: built.kind, tags: built.tags, content: built.content }));
    expect(parsed).toEqual({ hash, term: 'nostr search', revealedAt: 1_800_000_000 });
  });

  it('parseTermReveal rejects malformed hashes and missing/oversized terms', () => {
    const hash = 'ef'.repeat(32);
    expect(parseTermReveal(fakeEvent({ tags: [['d', `${TERM_REVEAL_D_PREFIX}zz`], ['term', 'x']] }))).toBeNull();
    expect(parseTermReveal(fakeEvent({ tags: [['d', `${TERM_REVEAL_D_PREFIX}${hash}`]] }))).toBeNull();
    expect(
      parseTermReveal(fakeEvent({ tags: [['d', `${TERM_REVEAL_D_PREFIX}${hash}`], ['term', 'x'.repeat(201)]] })),
    ).toBeNull();
  });

  it('verifyTermReveal accepts only the plaintext that hashes to the d-tag', async () => {
    const hash = await hashTerm('decentralized search');
    expect(await verifyTermReveal(hash, 'decentralized search')).toBe(true);
    expect(await verifyTermReveal(hash, 'something else')).toBe(false);
  });
});

describe('threshold + namespaces (federation constants)', () => {
  it('the k-anonymity threshold and d-tag prefixes must not drift', () => {
    expect(TRENDING_THRESHOLD).toBe(3);
    expect(TERM_SIGNAL_D_PREFIX).toBe('0xsearchstr:term:');
    expect(TERM_REVEAL_D_PREFIX).toBe('0xsearchstr:term-reveal:');
    expect(TERM_SIGNAL_T_TAG).toBe('0xsearchstr-term');
    expect(TERM_REVEAL_T_TAG).toBe('0xsearchstr-term-reveal');
  });
});
