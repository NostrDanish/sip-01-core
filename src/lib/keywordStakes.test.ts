/**
 * Characterization tests — keyword stakes (0xsearchstr:stake:*, kind 30078).
 *
 * Pin the shared contract before extraction: d-tag derivation, event shape,
 * parse validation, and the ranking score that keeps exact-match stakes at
 * their contractual placement.
 */
import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

import {
  STAKE_T_TAG,
  buildStakeEvent,
  parseStakeEvent,
  stakeDTag,
} from './keywordStakes';

const PUBKEY = 'b'.repeat(64);

function asEvent(built: { kind: number; content: string; tags: string[][] }): NostrEvent {
  return {
    id: 'f'.repeat(64),
    pubkey: PUBKEY,
    created_at: 1_800_000_000,
    kind: built.kind,
    tags: built.tags,
    content: built.content,
    sig: 's'.repeat(128),
  };
}

describe('stakeDTag', () => {
  it('derives the shared-namespace d-tag from the normalized keyword', () => {
    expect(stakeDTag('Monero Wallet')).toBe('0xsearchstr:stake:monero wallet');
    expect(stakeDTag('  Nostr   Search  ')).toBe('0xsearchstr:stake:nostr search');
  });
});

describe('buildStakeEvent', () => {
  it('builds a kind 30078 addressable event with the shared t-tag', () => {
    const built = buildStakeEvent({
      keyword: 'monero wallet',
      url: 'https://xmrwallet.example.com',
      title: 'XMR Wallet',
      pitch: 'A wallet for Monero.',
    });
    expect(built).not.toBeNull();
    expect(built!.kind).toBe(30078);
    expect(built!.content).toBe('A wallet for Monero.');
    expect(built!.tags).toContainEqual(['d', '0xsearchstr:stake:monero wallet']);
    expect(built!.tags).toContainEqual(['t', '0xsearchstr-stake']);
    expect(built!.tags).toContainEqual(['keyword', 'monero wallet']);
    expect(built!.tags).toContainEqual(['title', 'XMR Wallet']);
    expect(built!.tags).toContainEqual(['url', 'https://xmrwallet.example.com']);
    expect(built!.tags.some(([n]) => n === 'alt')).toBe(true);
  });

  it('rejects empty keywords and disallowed URL schemes', () => {
    expect(buildStakeEvent({ keyword: '!!!', url: 'https://x.example.com', title: 'T', pitch: '' })).toBeNull();
    expect(buildStakeEvent({ keyword: 'k', url: 'javascript:alert(1)', title: 'T', pitch: '' })).toBeNull();
    expect(buildStakeEvent({ keyword: 'k', url: 'https://x.example.com', title: '  ', pitch: '' })).toBeNull();
  });

  it('trims overlong pitches to the 280-char cap', () => {
    const built = buildStakeEvent({
      keyword: 'k',
      url: 'https://x.example.com',
      title: 'T',
      pitch: 'p'.repeat(400),
    });
    expect(built!.content.length).toBe(280);
  });
});

describe('parseStakeEvent', () => {
  it('round-trips a built stake into a SearchResult at the stake score band', () => {
    const built = buildStakeEvent({
      keyword: 'monero wallet',
      url: 'https://xmrwallet.example.com',
      title: 'XMR Wallet',
      pitch: 'A wallet for Monero.',
    })!;
    const parsed = parseStakeEvent(asEvent(built));
    expect(parsed).not.toBeNull();
    expect(parsed!.provider).toBe('keyword-stake');
    expect(parsed!.title).toBe('XMR Wallet');
    expect(parsed!.url).toBe('https://xmrwallet.example.com'); // kept exactly as tagged (no URL normalization on read)
    expect(parsed!.score).toBe(97);
    expect(parsed!.source).toBe('web');
    expect(parsed!.timestamp).toBe(1_800_000_000);
    expect(parsed!.domain).toBe('xmrwallet.example.com');
    expect(parsed!.engine).toBe('monero wallet');
  });

  it('rejects wrong kinds, missing t-tags, foreign d-prefixes, and bad URLs', () => {
    const built = buildStakeEvent({
      keyword: 'monero wallet',
      url: 'https://xmrwallet.example.com',
      title: 'XMR Wallet',
      pitch: 'p',
    })!;
    expect(parseStakeEvent(asEvent({ ...built, kind: 1 }))).toBeNull();
    expect(
      parseStakeEvent(asEvent({ ...built, tags: built.tags.filter(([n, v]) => !(n === 't' && v === STAKE_T_TAG)) })),
    ).toBeNull();
    expect(
      parseStakeEvent(asEvent({ ...built, tags: built.tags.map((t) => (t[0] === 'd' ? ['d', 'other:stake:x'] : t)) })),
    ).toBeNull();
    expect(
      parseStakeEvent(asEvent({ ...built, tags: built.tags.map((t) => (t[0] === 'url' ? ['url', 'javascript:x'] : t)) })),
    ).toBeNull();
  });

  it('falls back to the d-tag suffix when the keyword tag is absent', () => {
    const built = buildStakeEvent({
      keyword: 'monero wallet',
      url: 'https://xmrwallet.example.com',
      title: 'XMR Wallet',
      pitch: 'p',
    })!;
    const noKeyword = built.tags.filter(([n]) => n !== 'keyword');
    const parsed = parseStakeEvent(asEvent({ ...built, tags: noKeyword }));
    expect(parsed!.engine).toBe('monero wallet');
  });
});
