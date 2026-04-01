/**
 * Configuration management.
 * Profiles are persisted via the `conf` package (~/.config/plex-cli on Linux/macOS).
 */

import Conf from 'conf';

function createDefaultStore() {
  return new Conf({ projectName: 'plex-cli', projectVersion: '0.1.0' });
}

export class Config {
  /**
   * @param {object} [store]  Optional store override (used in tests).
   *                          Must implement get(key, default), set(key, val), has(key), delete(key).
   */
  constructor(store) {
    this._store = store ?? createDefaultStore();
  }

  // ---------------------------------------------------------------------------
  // Profiles
  // ---------------------------------------------------------------------------

  listProfiles() {
    return Object.keys(this._store.get('profiles', {}));
  }

  getProfile(name) {
    const profiles = this._store.get('profiles', {});
    return profiles[name] ?? null;
  }

  saveProfile(name, url, token) {
    const profiles = this._store.get('profiles', {});
    profiles[name] = { url, token };
    this._store.set('profiles', profiles);
    if (!this._store.get('defaultProfile')) {
      this._store.set('defaultProfile', name);
    }
  }

  deleteProfile(name) {
    const profiles = this._store.get('profiles', {});
    delete profiles[name];
    this._store.set('profiles', profiles);
    if (this._store.get('defaultProfile') === name) {
      const remaining = Object.keys(profiles);
      this._store.set('defaultProfile', remaining[0] ?? null);
    }
  }

  setDefaultProfile(name) {
    this._store.set('defaultProfile', name);
  }

  get defaultProfile() {
    return this._store.get('defaultProfile', null);
  }

  activeProfile() {
    const name = this.defaultProfile;
    return name ? this.getProfile(name) : null;
  }
}
