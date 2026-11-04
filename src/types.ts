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
  /** Episode number within its season (1-based). */
  index?: number;
  /** Season number (1-based) for episodes. */
  parentIndex?: number;
  /** Library section title the item belongs to. */
  librarySectionTitle?: string;
  Genre?: Array<{ tag: string }>;
  Director?: Array<{ tag: string }>;
  Writer?: Array<{ tag: string }>;
  Role?: Array<{ tag: string }>;
  Media?: PlexMediaPart[];
  [key: string]: unknown;
}

/** An individual audio/video/subtitle stream within a media file. */
export interface PlexStream {
  streamType?: number;        // 1 = video, 2 = audio, 3 = subtitle
  codec?: string;
  displayTitle?: string;
  language?: string;
  languageTag?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  frameRate?: number | string;
  colorPrimaries?: string;
  colorSpace?: string;
  colorRange?: string;
  /** "smpte2084" = HDR10, "arib-std-b67" = HLG, "smpte2094-40" = HDR10+ */
  colorTrc?: string;
  DOVIPresent?: number | boolean;
  DOVIProfile?: number;
  DOVILevel?: number;
  profile?: string;
  channels?: number;
  audioChannelLayout?: string;
  /** "atmos" when Dolby Atmos is present */
  audioProfile?: string;
  samplingRate?: number;
  selected?: number | boolean;
  forced?: number | boolean;
  [key: string]: unknown;
}

/** A physical file part that contains one or more streams. */
export interface PlexFilePart {
  id?: string;
  key?: string;
  duration?: number;
  file?: string;
  size?: number;
  container?: string;
  Stream?: PlexStream[];
  [key: string]: unknown;
}

/** A media encoding (there may be multiple versions of the same item). */
export interface PlexMediaPart {
  id?: string;
  videoResolution?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  aspectRatio?: number | string;
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  /** "atmos" when Dolby Atmos audio is present */
  audioProfile?: string;
  videoProfile?: string;
  Part?: PlexFilePart[];
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
