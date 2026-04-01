/**
 * Shared domain types for plex-cli.
 */

/** A Plex Media Server metadata item. */
export interface PlexItem {
  ratingKey?: string;
  key?: string;
  title?: string;
  name?: string;
  type?: string;
  year?: number;
  parentYear?: number;
  duration?: number;
  viewCount?: number;
  viewOffset?: number;
  summary?: string;
  tagline?: string;
  contentRating?: string;
  audienceRating?: number | string;
  rating?: number | string;
  userRating?: number | string;
  studio?: string;
  addedAt?: number;
  leafCount?: number;
  playlistType?: string;
  grandparentTitle?: string;
  parentTitle?: string;
  Genre?: Array<{ tag: string }>;
  Director?: Array<{ tag: string }>;
  Writer?: Array<{ tag: string }>;
  Role?: Array<{ tag: string }>;
  Media?: PlexMediaPart[];
  [key: string]: unknown;
}

export interface PlexMediaPart {
  id?: string;
  videoResolution?: string;
  bitrate?: number;
  [key: string]: unknown;
}

/** A Plex client (player) device. */
export interface PlexClientDevice {
  name?: string;
  title?: string;
  product?: string;
  platform?: string;
  state?: string;
  address?: string;
  port?: string | number;
  [key: string]: unknown;
}

/** A Plex session (active playback). */
export interface PlexSession extends PlexItem {
  User?: { title?: string };
  Player?: {
    title?: string;
    product?: string;
    state?: string;
    [key: string]: unknown;
  };
}

/** A Plex library section. */
export interface PlexLibrary {
  key?: string;
  title?: string;
  type?: string;
  [key: string]: unknown;
}

/** A Plex playlist. */
export interface PlexPlaylist extends PlexItem {
  leafCount?: number;
  playlistType?: string;
}

/** Playback timeline from a client. */
export interface PlexTimeline {
  state?: 'playing' | 'paused' | 'stopped' | 'buffering';
  viewOffset?: number | string;
  duration?: number | string;
  title?: string;
  grandparentTitle?: string;
  parentTitle?: string;
  ratingKey?: string;
  [key: string]: unknown;
}

/** A saved server profile. */
export interface Profile {
  url: string;
  token: string;
}

/** Simple key-value store interface (used for Config). */
export interface Store {
  get<T>(key: string, defaultValue: T): T;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}
