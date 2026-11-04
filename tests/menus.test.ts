/**
 * Tests for the parseTime utility exported from the client menu.
 */

import { parseTime } from '../src/menus/client';

describe('parseTime', () => {
  test('parses MM:SS', () => {
    expect(parseTime('1:30')).toBe(90_000);
  });
  test('parses H:MM:SS', () => {
    expect(parseTime('1:23:45')).toBe((3600 + 23 * 60 + 45) * 1000);
  });
  test('parses plain seconds', () => {
    expect(parseTime('90')).toBe(90_000);
  });
  test('parses zero', () => {
    expect(parseTime('0')).toBe(0);
  });
  test('trims whitespace', () => {
    expect(parseTime('  2:00  ')).toBe(120_000);
  });
  test('throws on invalid input', () => {
    expect(() => parseTime('notatime')).toThrow();
  });
  test('parses 0:00', () => {
    expect(parseTime('0:00')).toBe(0);
  });
  test('parses large hour value', () => {
    expect(parseTime('2:00:00')).toBe(7_200_000);
  });
  test('throws on non-numeric colon part', () => {
    expect(() => parseTime('1:xx')).toThrow();
  });
  test('throws when seconds out of range', () => {
    expect(() => parseTime('1:60')).toThrow();
  });
  test('throws when minutes out of range in H:MM:SS', () => {
    expect(() => parseTime('1:60:00')).toThrow();
  });
  test('throws when seconds out of range in H:MM:SS', () => {
    expect(() => parseTime('1:00:60')).toThrow();
  });
  test('throws on too many colon-separated parts', () => {
    expect(() => parseTime('1:2:3:4')).toThrow();
  });
});
