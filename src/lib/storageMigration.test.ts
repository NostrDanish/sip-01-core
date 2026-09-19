/**
 * Characterization tests — namespaced localStorage migration helpers.
 * Pin the migration semantics: read-through with forward-migration,
 * canonical-only writes, legacy cleanup.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { readStoredWithLegacy, writeStoredCanonical } from './storageMigration';

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
