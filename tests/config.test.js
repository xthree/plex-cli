/**
 * Tests for Config using an in-memory store.
 */

import { Config } from '../src/config.js';

/** Simple in-memory store that mimics the Conf API */
function makeStore() {
  const data = Object.create(null);
  return {
    get(key, defaultVal = undefined) {
      const parts = key.split('.');
      let cur = data;
      for (const p of parts) {
        if (cur == null || typeof cur !== 'object') return defaultVal;
        if (!Object.prototype.hasOwnProperty.call(cur, p)) return defaultVal;
        cur = cur[p];
      }
      return cur !== undefined ? cur : defaultVal;
    },
    set(key, value) {
      const parts = key.split('.');
      let cur = data;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!Object.prototype.hasOwnProperty.call(cur, parts[i]) || cur[parts[i]] == null) {
          cur[parts[i]] = Object.create(null);
        }
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
    },
    has(key) {
      return this.get(key) !== undefined;
    },
    delete(key) {
      const parts = key.split('.');
      let cur = data;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!Object.prototype.hasOwnProperty.call(cur, parts[i])) return;
        cur = cur[parts[i]];
      }
      delete cur[parts[parts.length - 1]];
    },
  };
}

let config;

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
  expect(p.url).toBe('http://192.168.1.10:32400');
  expect(p.token).toBe('tok123');
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
  expect(config.activeProfile().url).toBe('http://host2:32400');
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
