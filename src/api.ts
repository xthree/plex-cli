/**
 * Plex Media Server HTTP API client.
 */

import axios, { AxiosInstance } from 'axios';
import type {
  PlexItem,
  PlexClientDevice,
  PlexLibrary,
  PlexPlaylist,
  PlexSession,
  PlexTimeline,
} from './types';

export class PlexAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlexAPIError';
  }
}

export class PlexClient {
  readonly baseUrl: string;
  readonly token: string;
  readonly timeout: number;
  readonly _http: AxiosInstance;

  /**
   * @param baseUrl  e.g. "http://192.168.1.10:32400"
   * @param token    Plex authentication token
   * @param timeout  Request timeout in ms (default 15 000)
   */
  constructor(baseUrl: string, token: string, timeout = 15_000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.timeout = timeout;
    this._http = axios.create({
      baseURL: this.baseUrl,
      timeout,
      headers: {
        'X-Plex-Token': token,
        Accept: 'application/json',
        'X-Plex-Client-Identifier': 'plex-cli',
        'X-Plex-Product': 'plex-cli',
        'X-Plex-Version': '0.1.0',
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Low-level helpers
  // ---------------------------------------------------------------------------

  private async _get<T = unknown>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    try {
      const resp = await this._http.get<T>(path, { params });
      return resp.data ?? ({} as T);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        throw new PlexAPIError(`HTTP ${err.response.status} for ${path}`);
      }
      throw new PlexAPIError(`Request failed: ${(err as Error).message}`);
    }
  }

  private async _post<T = unknown>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    try {
      const resp = await this._http.post<T>(path, null, { params });
      return resp.data ?? ({} as T);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        throw new PlexAPIError(`HTTP ${err.response.status} for ${path}`);
      }
      throw new PlexAPIError(`Request failed: ${(err as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Server info
  // ---------------------------------------------------------------------------

  async serverInfo(): Promise<Record<string, unknown>> {
    const data = await this._get<{ MediaContainer?: Record<string, unknown> }>('/');
    return data.MediaContainer ?? data;
  }

  async _getMachineId(): Promise<string> {
    const info = await this.serverInfo();
    return (info.machineIdentifier as string | undefined) ?? '';
  }

  // ---------------------------------------------------------------------------
  // Libraries
  // ---------------------------------------------------------------------------

  async libraries(): Promise<PlexLibrary[]> {
    const data = await this._get<{ MediaContainer?: { Directory?: PlexLibrary[] } }>(
      '/library/sections'
    );
    return data?.MediaContainer?.Directory ?? [];
  }

  async libraryContents(
    sectionKey: string,
    { sort = 'titleSort:asc', limit = 50, offset = 0 }: { sort?: string; limit?: number; offset?: number } = {}
  ): Promise<{ items: PlexItem[]; total: number }> {
    const data = await this._get<{ MediaContainer?: Record<string, unknown> }>(
      `/library/sections/${sectionKey}/all`,
      { sort, 'X-Plex-Container-Size': limit, 'X-Plex-Container-Start': offset }
    );
    const mc = data?.MediaContainer ?? {};
    const items =
      (mc.Metadata as PlexItem[] | undefined) ??
      (mc.Video as PlexItem[] | undefined) ??
      (mc.Track as PlexItem[] | undefined) ??
      (mc.Photo as PlexItem[] | undefined) ??
      (mc.Directory as PlexItem[] | undefined) ??
      [];
    const total = parseInt(String(mc.totalSize ?? mc.size ?? items.length), 10);
    return { items, total };
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(query: string, limit = 30): Promise<PlexItem[]> {
    const data = await this._get<{
      MediaContainer?: {
        Metadata?: PlexItem[];
        Hub?: Array<{ Metadata?: PlexItem[] }>;
      };
    }>('/search', { query, limit });
    const mc = data?.MediaContainer ?? {};
    const results: PlexItem[] = [];
    if (mc.Metadata) results.push(...mc.Metadata);
    if (mc.Hub) {
      for (const hub of mc.Hub) {
        if (hub.Metadata) results.push(...hub.Metadata);
      }
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  async metadata(ratingKey: string): Promise<PlexItem> {
    const data = await this._get<{ MediaContainer?: { Metadata?: PlexItem[] } }>(
      `/library/metadata/${ratingKey}`
    );
    return data?.MediaContainer?.Metadata?.[0] ?? {};
  }

  async children(ratingKey: string): Promise<PlexItem[]> {
    const data = await this._get<{
      MediaContainer?: { Metadata?: PlexItem[]; Directory?: PlexItem[] };
    }>(`/library/metadata/${ratingKey}/children`);
    return data?.MediaContainer?.Metadata ?? data?.MediaContainer?.Directory ?? [];
  }

  // ---------------------------------------------------------------------------
  // On Deck / Recently Added
  // ---------------------------------------------------------------------------

  async onDeck(): Promise<PlexItem[]> {
    const data = await this._get<{ MediaContainer?: { Metadata?: PlexItem[] } }>('/library/onDeck');
    return data?.MediaContainer?.Metadata ?? [];
  }

  async recentlyAdded(limit = 30): Promise<PlexItem[]> {
    const data = await this._get<{ MediaContainer?: { Metadata?: PlexItem[] } }>(
      '/library/recentlyAdded',
      { 'X-Plex-Container-Size': limit }
    );
    return data?.MediaContainer?.Metadata ?? [];
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  async sessions(): Promise<PlexSession[]> {
    const data = await this._get<{ MediaContainer?: { Metadata?: PlexSession[] } }>(
      '/status/sessions'
    );
    return data?.MediaContainer?.Metadata ?? [];
  }

  // ---------------------------------------------------------------------------
  // Clients
  // ---------------------------------------------------------------------------

  async clients(): Promise<PlexClientDevice[]> {
    const data = await this._get<{ MediaContainer?: { Server?: PlexClientDevice[] } }>('/clients');
    return data?.MediaContainer?.Server ?? [];
  }

  // ---------------------------------------------------------------------------
  // Playback control (Plex HTTP Player API)
  // ---------------------------------------------------------------------------

  async playMedia(clientAddress: string, clientPort: string, ratingKey: string): Promise<void> {
    const machineId = await this._getMachineId();
    const serverUrl = new URL(this.baseUrl);
    const params: Record<string, unknown> = {
      key: `/library/metadata/${ratingKey}`,
      offset: 0,
      machineIdentifier: machineId,
      address: serverUrl.hostname,
      port: serverUrl.port || 32400,
      protocol: 'http',
      mediaIndex: 0,
      directStream: 1,
      directPlay: 1,
      'X-Plex-Token': this.token,
    };
    try {
      await axios.get(
        `http://${clientAddress}:${clientPort}/player/playback/playMedia`,
        { params, timeout: this.timeout }
      );
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        throw new PlexAPIError(`Player HTTP ${err.response.status}`);
      }
      throw new PlexAPIError(`Player request failed: ${(err as Error).message}`);
    }
  }

  async playerCommand(
    clientAddress: string,
    clientPort: string,
    command: string,
    extraParams: Record<string, unknown> = {}
  ): Promise<void> {
    const params = { 'X-Plex-Token': this.token, ...extraParams };
    try {
      await axios.get(
        `http://${clientAddress}:${clientPort}/player/playback/${command}`,
        { params, timeout: this.timeout }
      );
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        throw new PlexAPIError(`Player command HTTP ${err.response.status}`);
      }
      throw new PlexAPIError(`Player command failed: ${(err as Error).message}`);
    }
  }

  async getTimeline(clientAddress: string, clientPort: string): Promise<PlexTimeline> {
    try {
      const resp = await axios.get<{
        MediaContainer?: { Timeline?: PlexTimeline[]; _children?: PlexTimeline[] };
      }>(
        `http://${clientAddress}:${clientPort}/player/timeline/poll`,
        { params: { wait: 0, 'X-Plex-Token': this.token }, timeout: this.timeout }
      );
      const entries: PlexTimeline[] =
        resp.data?.MediaContainer?.Timeline ??
        resp.data?.MediaContainer?._children ??
        [];
      for (const entry of entries) {
        if (['playing', 'paused', 'buffering'].includes(entry.state ?? '')) return entry;
      }
      return entries[0] ?? {};
    } catch {
      return {};
    }
  }

  // ---------------------------------------------------------------------------
  // Scrobbling
  // ---------------------------------------------------------------------------

  async markWatched(ratingKey: string): Promise<void> {
    await this._get('/:/scrobble', {
      key: ratingKey,
      identifier: 'com.plexapp.plugins.library',
    });
  }

  async markUnwatched(ratingKey: string): Promise<void> {
    await this._get('/:/unscrobble', {
      key: ratingKey,
      identifier: 'com.plexapp.plugins.library',
    });
  }

  // ---------------------------------------------------------------------------
  // Playlists
  // ---------------------------------------------------------------------------

  async playlists(): Promise<PlexPlaylist[]> {
    const data = await this._get<{ MediaContainer?: { Metadata?: PlexPlaylist[] } }>('/playlists');
    return data?.MediaContainer?.Metadata ?? [];
  }

  async playlistItems(playlistKey: string): Promise<PlexItem[]> {
    const data = await this._get<{ MediaContainer?: { Metadata?: PlexItem[] } }>(
      `${playlistKey}/items`
    );
    return data?.MediaContainer?.Metadata ?? [];
  }

  async createPlaylist(title: string, mediaType = 'video'): Promise<Record<string, unknown>> {
    const data = await this._post<{ MediaContainer?: Record<string, unknown> }>('/playlists', {
      title,
      type: mediaType,
      smart: 0,
    });
    return data?.MediaContainer ?? {};
  }

  async addToPlaylist(playlistId: string, ratingKey: string): Promise<void> {
    const machineId = await this._getMachineId();
    const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${ratingKey}`;
    await this._post(`/playlists/${playlistId}/items`, { uri });
  }

  // ---------------------------------------------------------------------------
  // Extras / similar
  // ---------------------------------------------------------------------------

  async similar(ratingKey: string): Promise<PlexItem[]> {
    const data = await this._get<{ MediaContainer?: { Metadata?: PlexItem[] } }>(
      `/library/metadata/${ratingKey}/similar`
    );
    return data?.MediaContainer?.Metadata ?? [];
  }

  async extras(ratingKey: string): Promise<PlexItem[]> {
    const data = await this._get<{ MediaContainer?: { Metadata?: PlexItem[] } }>(
      `/library/metadata/${ratingKey}/extras`
    );
    return data?.MediaContainer?.Metadata ?? [];
  }
}
