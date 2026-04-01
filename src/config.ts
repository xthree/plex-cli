/**
 * Configuration management.
 * Profiles are persisted via the `conf` package (~/.config/plex-cli on Linux/macOS).
 */

import Conf from 'conf';
import type { Profile, Store } from './types';

type ProfileMap = Record<string, Profile>;

function createDefaultStore(): Store {
  return new Conf<{ profiles: ProfileMap; defaultProfile: string | null }>({
    projectName: 'plex-cli',
    projectVersion: '0.1.0',
  }) as unknown as Store;
}

export class Config {
  private readonly _store: Store;

  /**
   * @param store  Optional store override (used in tests).
   */
  constructor(store?: Store) {
    this._store = store ?? createDefaultStore();
  }

  // ---------------------------------------------------------------------------
  // Profiles
  // ---------------------------------------------------------------------------

  listProfiles(): string[] {
    return Object.keys(this._store.get('profiles', {} as ProfileMap) as ProfileMap);
  }

  getProfile(name: string): Profile | null {
    const profiles = this._store.get('profiles', {} as ProfileMap) as ProfileMap;
    return profiles[name] ?? null;
  }

  saveProfile(name: string, url: string, token: string): void {
    const profiles = this._store.get('profiles', {} as ProfileMap) as ProfileMap;
    profiles[name] = { url, token };
    this._store.set('profiles', profiles);
    if (!this._store.get('defaultProfile', null as string | null)) {
      this._store.set('defaultProfile', name);
    }
  }

  deleteProfile(name: string): void {
    const profiles = this._store.get('profiles', {} as ProfileMap) as ProfileMap;
    delete profiles[name];
    this._store.set('profiles', profiles);
    if (this._store.get('defaultProfile', null as string | null) === name) {
      const remaining = Object.keys(profiles);
      this._store.set('defaultProfile', remaining[0] ?? null);
    }
  }

  setDefaultProfile(name: string): void {
    this._store.set('defaultProfile', name);
  }

  get defaultProfile(): string | null {
    return this._store.get('defaultProfile', null as string | null) as string | null;
  }

  activeProfile(): Profile | null {
    const name = this.defaultProfile;
    return name ? this.getProfile(name) : null;
  }
}
