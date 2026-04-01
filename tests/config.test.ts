/**
 * Tests for Config using an in-memory store.
 */

import { Config } from '../src/config';
import type { Store } from '../src/types';

type StoreData = Record<string, unknown>;

/** Simple in-memory store that mimics the Conf API */
function makeStore(): Store {
  const data: StoreData = Object.create(null) as StoreData;

  function getAt(obj: StoreData, parts: string[]): unknown {
    let cur: unknown = obj;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return undefined;
      if (!Object.prototype.hasOwnProperty.call(cur, p)) return undefined;
      cur = (cur as StoreData)[p];
    }
    return cur;
  }

  function setAt(obj: StoreData, parts: string[], value: unknown): void {
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!Object.prototype.hasOwnProperty.call(cur, p) || cur[p] == null) {
        cur[p] = Object.create(null) as StoreData;
      }
      cur = cur[p] as StoreData;
    }
    cur[parts[parts.length - 1]] = value;
  }

  return {
    get<T>(key: string, defaultValue?: T): T {
      const result = getAt(data, key.split('.'));
      return (result !== undefined ? result : defaultValue) as T;
    },
    set(key: string, value: unknown): void {
      setAt(data, key.split('.'), value);
    },
  };
}

let config: Config;

beforeEach(() => {
  config = new Config(makeStore());
});

test('empty config has no profiles', () => {
  expect(config.listProfiles()).toEqual([]);
  expect(config.defaultProfile).toBeNull();
  expect(config.activeProfile()).toBeNull();
});

test('saveProfile stores url and token', () => {
  config.saveProfile('home', 'http://192.168.1.10:32400', 'tok123');
  const p = config.getProfile('home');
  expect(p).not.toBeNull();
  expect(p!.url).toBe('http://192.168.1.10:32400');
  expect(p!.token).toBe('tok123');
});

test('first saved profile becomes default', () => {
  config.saveProfile('home', 'http://host1:32400', 'tok1');
  expect(config.defaultProfile).toBe('home');
});

test('listProfiles returns all saved profile names', () => {
  config.saveProfile('home', 'http://host1:32400', 'tok1');
  config.saveProfile('work', 'http://host2:32400', 'tok2');
  const profiles = config.listProfiles();
  expect(profiles).toContain('home');
  expect(profiles).toContain('work');
});

test('setDefaultProfile updates the default', () => {
  config.saveProfile('home', 'http://host1:32400', 'tok1');
  config.saveProfile('work', 'http://host2:32400', 'tok2');
  config.setDefaultProfile('work');
  expect(config.defaultProfile).toBe('work');
  expect(config.activeProfile()!.url).toBe('http://host2:32400');
});

test('deleteProfile removes the profile', () => {
  config.saveProfile('home', 'http://host1:32400', 'tok1');
  config.saveProfile('work', 'http://host2:32400', 'tok2');
  config.deleteProfile('home');
  expect(config.listProfiles()).not.toContain('home');
  expect(config.listProfiles()).toContain('work');
});

test('deleting default profile shifts default to remaining', () => {
  config.saveProfile('home', 'http://host1:32400', 'tok1');
  config.saveProfile('work', 'http://host2:32400', 'tok2');
  config.setDefaultProfile('home');
  config.deleteProfile('home');
  expect(config.defaultProfile).not.toBe('home');
});

test('getProfile returns null for unknown profile', () => {
  expect(config.getProfile('nonexistent')).toBeNull();
});
