/**
 * Characterization tests — namespaced localStorage migration helpers.
 * Pin the migration semantics: read-through with forward-migration,
 * canonical-only writes, legacy cleanup.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { readStoredWithLegacy, writeStoredCanonical, STORAGE_KEY_RENAMES } from './storageMigration';

beforeEach(() => {
  localStorage.clear();
});

describe('readStoredWithLegacy', () => {
  it('returns the canonical value when present (legacy untouched)', () => {
    localStorage.setItem('app:key', 'new');
    localStorage.setItem('old:key', 'old');
    expect(readStoredWithLegacy('app:key', 'old:key')).toBe('new');
    expect(localStorage.getItem('old:key')).toBe('old'); // not migrated when canonical wins
  });

  it('forward-migrates a legacy-only value on first read', () => {
    localStorage.setItem('old:key', 'old');
    expect(readStoredWithLegacy('app:key', 'old:key')).toBe('old');
    expect(localStorage.getItem('app:key')).toBe('old'); // copied
    expect(localStorage.getItem('old:key')).toBeNull(); // legacy removed
  });

  it('returns null when neither key exists', () => {
    expect(readStoredWithLegacy('app:key', 'old:key')).toBeNull();
  });
});

describe('writeStoredCanonical', () => {
  it('writes only the canonical key and clears the legacy one', () => {
    localStorage.setItem('old:key', 'old');
    writeStoredCanonical('app:key', 'old:key', 'new');
    expect(localStorage.getItem('app:key')).toBe('new');
    expect(localStorage.getItem('old:key')).toBeNull();
  });

  it('null removes the canonical key (and still clears legacy)', () => {
    localStorage.setItem('app:key', 'new');
    localStorage.setItem('old:key', 'old');
    writeStoredCanonical('app:key', 'old:key', null);
    expect(localStorage.getItem('app:key')).toBeNull();
    expect(localStorage.getItem('old:key')).toBeNull();
  });
});

describe('multi-legacy renames (string[] legacy chains)', () => {
  it('migrates the newest legacy key first', () => {
    localStorage.setItem('old2:key', 'newer');
    localStorage.setItem('old1:key', 'older');
    expect(readStoredWithLegacy('app:key', ['old2:key', 'old1:key'])).toBe('newer');
    expect(localStorage.getItem('app:key')).toBe('newer');
    expect(localStorage.getItem('old2:key')).toBeNull();
    expect(localStorage.getItem('old1:key')).toBe('older'); // untouched — first hit wins
  });

  it('falls through to the older legacy key', () => {
    localStorage.setItem('old1:key', 'older');
    expect(readStoredWithLegacy('app:key', ['old2:key', 'old1:key'])).toBe('older');
    expect(localStorage.getItem('app:key')).toBe('older');
    expect(localStorage.getItem('old1:key')).toBeNull();
  });

  it('write clears every legacy key in the chain', () => {
    localStorage.setItem('old2:key', 'a');
    localStorage.setItem('old1:key', 'b');
    writeStoredCanonical('app:key', ['old2:key', 'old1:key'], 'new');
    expect(localStorage.getItem('app:key')).toBe('new');
    expect(localStorage.getItem('old2:key')).toBeNull();
    expect(localStorage.getItem('old1:key')).toBeNull();
  });
});

describe('STORAGE_KEY_RENAMES (dsearch:* → sip01:* engine/AI local keys)', () => {
  it('covers the four renamed local-only keys with both legacy names', () => {
    const byCanonical = new Map(STORAGE_KEY_RENAMES.map((r) => [r.canonical, r.legacy]));
    expect(byCanonical.get('sip01:votes')).toEqual(['dsearch:votes', 'presearchstr:votes']);
    expect(byCanonical.get('sip01:brave-api-key')).toEqual(['dsearch:brave-api-key', 'presearchstr:brave-api-key']);
    expect(byCanonical.get('sip01:parallel-api-key')).toEqual(['dsearch:parallel-api-key', 'presearchstr:parallel-api-key']);
    expect(byCanonical.get('sip01:ai-config')).toEqual(['dsearch:ai-config', 'presearchstr:ai-config']);
  });

  it('a dsearch-era value migrates to the sip01 key on first read', () => {
    const rename = STORAGE_KEY_RENAMES.find((r) => r.canonical === 'sip01:votes')!;
    localStorage.setItem('dsearch:votes', '{"u:https://x/":1}');
    expect(readStoredWithLegacy(rename.canonical, rename.legacy)).toBe('{"u:https://x/":1}');
    expect(localStorage.getItem('sip01:votes')).toBe('{"u:https://x/":1}');
    expect(localStorage.getItem('dsearch:votes')).toBeNull();
  });
});
