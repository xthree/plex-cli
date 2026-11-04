/**
 * Tests for display helper functions.
 */

import { fmtDuration, fmtYear, fmtType, fmtWatched, fmtItemLabel, progressBar, fmtFileSize } from '../src/display';
import type { PlexItem } from '../src/types';

describe('fmtDuration', () => {
  test.each<[number | null | undefined, string]>([
    [null, '--:--'],
    [undefined, '--:--'],
    [0, '0:00'],
    [60_000, '1:00'],
    [3_661_000, '1:01:01'],
    [5_400_000, '1:30:00'],
  ])('fmtDuration(%s) === %s', (ms, expected) => {
    expect(fmtDuration(ms)).toBe(expected);
  });
});

describe('fmtYear', () => {
  test('uses year field', () => {
    expect(fmtYear({ year: 2020 })).toBe('2020');
  });
  test('falls back to parentYear', () => {
    expect(fmtYear({ year: undefined, parentYear: 2019 })).toBe('2019');
  });
  test('returns empty string when no year', () => {
    expect(fmtYear({})).toBe('');
  });
});

describe('fmtType', () => {
  test.each<[PlexItem, string]>([
    [{ type: 'movie' }, '🎬 Movie'],
    [{ type: 'show' },  '📺 Show'],
    [{ type: 'track' }, '🎵 Track'],
  ])('known type %p => %s', (item, expected) => {
    expect(fmtType(item)).toBe(expected);
  });

  test('capitalises unknown types', () => {
    expect(fmtType({ type: 'funky' })).toBe('Funky');
  });
});

describe('fmtWatched', () => {
  test('unwatched returns empty string', () => {
    expect(fmtWatched({ viewCount: 0 })).toBe('');
  });
  test('watched returns checkmark', () => {
    expect(fmtWatched({ viewCount: 3 })).toBe('✓');
  });
  test('in progress returns play icon', () => {
    expect(fmtWatched({ viewCount: 0, viewOffset: 5000 })).toBe('▶');
  });
});

describe('fmtItemLabel', () => {
  test('returns title for non-episode items', () => {
    expect(fmtItemLabel({ type: 'movie', title: 'Inception' })).toBe('Inception');
  });
  test('returns title for episode without grandparentTitle', () => {
    expect(fmtItemLabel({ type: 'episode', title: 'Pilot' })).toBe('Pilot');
  });
  test('prefixes show name for episode with grandparentTitle', () => {
    expect(fmtItemLabel({ type: 'episode', title: 'Pilot', grandparentTitle: 'Breaking Bad' }))
      .toBe('Breaking Bad – Pilot');
  });
  test('falls back to name field when title is missing', () => {
    expect(fmtItemLabel({ type: 'movie', name: 'Some Movie' })).toBe('Some Movie');
  });
  test('returns (no title) when both title and name are missing', () => {
    expect(fmtItemLabel({})).toBe('(no title)');
  });
});

describe('progressBar', () => {
  test('returns a non-empty string', () => {
    expect(progressBar(30_000, 90_000)).toBeTruthy();
  });
  test('shows 0% at start', () => {
    expect(progressBar(0, 90_000)).toContain('0%');
  });
  test('shows 100% at end', () => {
    expect(progressBar(90_000, 90_000)).toContain('100%');
  });
  test('handles zero duration gracefully', () => {
    expect(() => progressBar(0, 0)).not.toThrow();
  });
});

describe('fmtFileSize', () => {
  test.each<[number, string]>([
    [0,              '0 B'],
    [512,            '512 B'],
    [1_023,          '1023 B'],
    [1_024,          '1.0 KB'],
    [1_536,          '1.5 KB'],
    [1_048_576,      '1.0 MB'],
    [1_572_864,      '1.5 MB'],
    [1_073_741_824,  '1.00 GB'],
    [5_368_709_120,  '5.00 GB'],
    [1_099_511_627_776, '1.00 TB'],
  ])('fmtFileSize(%i) === %s', (bytes, expected) => {
    expect(fmtFileSize(bytes)).toBe(expected);
  });
});
