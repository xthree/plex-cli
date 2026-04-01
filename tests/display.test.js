/**
 * Tests for display helper functions.
 */

import { fmtDuration, fmtYear, fmtType, fmtWatched, progressBar } from '../src/display.js';

describe('fmtDuration', () => {
  test.each([
    [null, '--:--'],
    [undefined, '--:--'],
    [0, '0:00'],
    [60000, '1:00'],
    [3661000, '1:01:01'],
    [5400000, '1:30:00'],
  ])('fmtDuration(%s) === %s', (ms, expected) => {
    expect(fmtDuration(ms)).toBe(expected);
  });
});

describe('fmtYear', () => {
  test('uses year field', () => {
    expect(fmtYear({ year: 2020 })).toBe('2020');
  });
  test('falls back to parentYear', () => {
    expect(fmtYear({ year: null, parentYear: 2019 })).toBe('2019');
  });
  test('returns empty string when no year', () => {
    expect(fmtYear({})).toBe('');
  });
});

describe('fmtType', () => {
  test.each([
    [{ type: 'movie' }, '🎬 Movie'],
    [{ type: 'show' }, '📺 Show'],
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

describe('progressBar', () => {
  test('returns a non-empty string', () => {
    expect(progressBar(30000, 90000)).toBeTruthy();
  });
  test('shows 0% at start', () => {
    const bar = progressBar(0, 90000);
    expect(bar).toContain('0%');
  });
  test('shows 100% at end', () => {
    const bar = progressBar(90000, 90000);
    expect(bar).toContain('100%');
  });
  test('handles zero duration gracefully', () => {
    expect(() => progressBar(0, 0)).not.toThrow();
  });
});
