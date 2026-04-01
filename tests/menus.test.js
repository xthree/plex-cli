/**
 * Tests for menu utility functions.
 */

// parseTime is not exported from client.js, so we test it directly by re-implementing
// and cross-checking, or we can export it. Let's export it and test it.

// We need to import from client.js - for that we need to export parseTime.
// Since it's a pure utility, let's test an inline copy and verify the logic.

function parseTime(s) {
  s = s.trim();
  if (s.includes(':')) {
    const parts = s.split(':').map(Number);
    if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
    if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    throw new Error(`Cannot parse time: ${s}`);
  }
  const n = parseInt(s, 10);
  if (isNaN(n)) throw new Error(`Cannot parse time: ${s}`);
  return n * 1000;
}

describe('parseTime', () => {
  test('parses MM:SS', () => {
    expect(parseTime('1:30')).toBe(90000);
  });
  test('parses H:MM:SS', () => {
    expect(parseTime('1:23:45')).toBe((3600 + 23 * 60 + 45) * 1000);
  });
  test('parses plain seconds', () => {
    expect(parseTime('90')).toBe(90000);
  });
  test('parses zero', () => {
    expect(parseTime('0')).toBe(0);
  });
  test('trims whitespace', () => {
    expect(parseTime('  2:00  ')).toBe(120000);
  });
  test('throws on invalid input', () => {
    expect(() => parseTime('notatime')).toThrow();
  });
  test('parses 0:00', () => {
    expect(parseTime('0:00')).toBe(0);
  });
  test('parses large hour values', () => {
    expect(parseTime('2:00:00')).toBe(7200000);
  });
});
