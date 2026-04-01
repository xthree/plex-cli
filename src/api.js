/**
 * Plex Media Server HTTP API client.
 */

import axios from 'axios';

export class PlexAPIError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlexAPIError';
  }
}

export class PlexClient {
  /**
   * @param {string} baseUrl  e.g. "http://192.168.1.10:32400"
   * @param {string} token    Plex authentication token
   * @param {number} [timeout=15000]  Request timeout in ms
   */
  constructor(baseUrl, token, timeout = 15000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.timeout = timeout;
    this._http = axios.create({
      baseURL: this.baseUrl,
      timeout,
      headers: {
        'X-Plex-Token': token,
        'Accept': 'application/json',
        'X-Plex-Client-Identifier': 'plex-cli',
        'X-Plex-Product': 'plex-cli',
        'X-Plex-Version': '0.1.0',
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Low-level helpers
  // ---------------------------------------------------------------------------

  async _get(path, params = {}) {
    try {
      const resp = await this._http.get(path, { params });
      return resp.data ?? {};
    } catch (err) {
      if (err.response) {
        throw new PlexAPIError(`HTTP ${err.response.status} for ${path}`);
      }
      throw new PlexAPIError(`Request failed: ${err.message}`);
    }
  }

  async _post(path, params = {}) {
    try {
      const resp = await this._http.post(path, null, { params });
      return resp.data ?? {};
    } catch (err) {
      if (err.response) {
        throw new PlexAPIError(`HTTP ${err.response.status} for ${path}`);
      }
      throw new PlexAPIError(`Request failed: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Server info
  // ---------------------------------------------------------------------------

  async serverInfo() {
    const data = await this._get('/');
    return data.MediaContainer ?? data;
  }

  async _getMachineId() {
    const info = await this.serverInfo();
    return info.machineIdentifier ?? '';
  }

  // ---------------------------------------------------------------------------
  // Libraries
  // ---------------------------------------------------------------------------

  async libraries() {
    const data = await this._get('/library/sections');
    return data?.MediaContainer?.Directory ?? [];
  }

  async libraryContents(sectionKey, { sort = 'titleSort:asc', limit = 50, offset = 0 } = {}) {
    const data = await this._get(`/library/sections/${sectionKey}/all`, {
      sort,
      'X-Plex-Container-Size': limit,
      'X-Plex-Container-Start': offset,
    });
    const mc = data?.MediaContainer ?? {};
    const items =
      mc.Metadata ?? mc.Video ?? mc.Track ?? mc.Photo ?? mc.Directory ?? [];
    const total = parseInt(mc.totalSize ?? mc.size ?? items.length, 10);
    return { items, total };
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(query, limit = 30) {
    const data = await this._get('/search', { query, limit });
    const mc = data?.MediaContainer ?? {};
    const results = [];
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

  async metadata(ratingKey) {
    const data = await this._get(`/library/metadata/${ratingKey}`);
    const items = data?.MediaContainer?.Metadata ?? [];
    return items[0] ?? {};
  }

  async children(ratingKey) {
    const data = await this._get(`/library/metadata/${ratingKey}/children`);
    const mc = data?.MediaContainer ?? {};
    return mc.Metadata ?? mc.Directory ?? [];
  }

  // ---------------------------------------------------------------------------
  // On Deck / Recently Added
  // ---------------------------------------------------------------------------

  async onDeck() {
    const data = await this._get('/library/onDeck');
    return data?.MediaContainer?.Metadata ?? [];
  }

  async recentlyAdded(limit = 30) {
    const data = await this._get('/library/recentlyAdded', {
      'X-Plex-Container-Size': limit,
    });
    return data?.MediaContainer?.Metadata ?? [];
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  async sessions() {
    const data = await this._get('/status/sessions');
    return data?.MediaContainer?.Metadata ?? [];
  }

  // ---------------------------------------------------------------------------
  // Clients
  // ---------------------------------------------------------------------------

  async clients() {
    const data = await this._get('/clients');
    return data?.MediaContainer?.Server ?? [];
  }

  // ---------------------------------------------------------------------------
  // Playback control (Plex HTTP Player API)
  // ---------------------------------------------------------------------------

  async playMedia(clientAddress, clientPort, ratingKey) {
    const machineId = await this._getMachineId();
    const serverUrl = new URL(this.baseUrl);
    const params = {
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
    } catch (err) {
      if (err.response) {
        throw new PlexAPIError(`Player HTTP ${err.response.status}`);
      }
      throw new PlexAPIError(`Player request failed: ${err.message}`);
    }
  }

  async playerCommand(clientAddress, clientPort, command, extraParams = {}) {
    const params = { 'X-Plex-Token': this.token, ...extraParams };
    try {
      await axios.get(
        `http://${clientAddress}:${clientPort}/player/playback/${command}`,
        { params, timeout: this.timeout }
      );
    } catch (err) {
      if (err.response) {
        throw new PlexAPIError(`Player command HTTP ${err.response.status}`);
      }
      throw new PlexAPIError(`Player command failed: ${err.message}`);
    }
  }

  async getTimeline(clientAddress, clientPort) {
    try {
      const resp = await axios.get(
        `http://${clientAddress}:${clientPort}/player/timeline/poll`,
        {
          params: { wait: 0, 'X-Plex-Token': this.token },
          timeout: this.timeout,
        }
      );
      const entries =
        resp.data?.MediaContainer?.Timeline ??
        resp.data?.MediaContainer?._children ??
        [];
      for (const entry of entries) {
        if (['playing', 'paused', 'buffering'].includes(entry.state)) {
          return entry;
        }
      }
      return entries[0] ?? {};
    } catch {
      return {};
    }
  }

  // ---------------------------------------------------------------------------
  // Scrobbling
  // ---------------------------------------------------------------------------

  async markWatched(ratingKey) {
    await this._get('/:/scrobble', {
      key: ratingKey,
      identifier: 'com.plexapp.plugins.library',
    });
  }

  async markUnwatched(ratingKey) {
    await this._get('/:/unscrobble', {
      key: ratingKey,
      identifier: 'com.plexapp.plugins.library',
    });
  }

  // ---------------------------------------------------------------------------
  // Playlists
  // ---------------------------------------------------------------------------

  async playlists() {
    const data = await this._get('/playlists');
    return data?.MediaContainer?.Metadata ?? [];
  }

  async playlistItems(playlistKey) {
    const data = await this._get(`${playlistKey}/items`);
    return data?.MediaContainer?.Metadata ?? [];
  }

  async createPlaylist(title, mediaType = 'video') {
    const data = await this._post('/playlists', {
      title,
      type: mediaType,
      smart: 0,
    });
    return data?.MediaContainer ?? {};
  }

  async addToPlaylist(playlistId, ratingKey) {
    const machineId = await this._getMachineId();
    const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${ratingKey}`;
    await this._post(`/playlists/${playlistId}/items`, { uri });
  }

  // ---------------------------------------------------------------------------
  // Extras / similar
  // ---------------------------------------------------------------------------

  async similar(ratingKey) {
    const data = await this._get(`/library/metadata/${ratingKey}/similar`);
    return data?.MediaContainer?.Metadata ?? [];
  }

  async extras(ratingKey) {
    const data = await this._get(`/library/metadata/${ratingKey}/extras`);
    return data?.MediaContainer?.Metadata ?? [];
  }
}
