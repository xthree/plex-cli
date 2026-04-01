/**
 * Tests for the Plex API client.
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { PlexClient, PlexAPIError } from '../src/api.js';

let mock;
let client;

beforeEach(() => {
  client = new PlexClient('http://plex.local:32400', 'test-token');
  mock = new MockAdapter(client._http);
});

afterEach(() => {
  mock.restore();
});

// ---------------------------------------------------------------------------
// serverInfo
// ---------------------------------------------------------------------------

test('serverInfo returns MediaContainer', async () => {
  mock.onGet('/').reply(200, {
    MediaContainer: { machineIdentifier: 'abc123', friendlyName: 'My Plex' },
  });
  const info = await client.serverInfo();
  expect(info.machineIdentifier).toBe('abc123');
  expect(info.friendlyName).toBe('My Plex');
});

test('serverInfo throws PlexAPIError on 401', async () => {
  mock.onGet('/').reply(401);
  await expect(client.serverInfo()).rejects.toThrow(PlexAPIError);
});

// ---------------------------------------------------------------------------
// libraries
// ---------------------------------------------------------------------------

test('libraries returns array of sections', async () => {
  mock.onGet('/library/sections').reply(200, {
    MediaContainer: {
      Directory: [
        { key: '1', title: 'Movies', type: 'movie' },
        { key: '2', title: 'TV Shows', type: 'show' },
      ],
    },
  });
  const libs = await client.libraries();
  expect(libs).toHaveLength(2);
  expect(libs[0].title).toBe('Movies');
});

test('libraries returns empty array when no Directory', async () => {
  mock.onGet('/library/sections').reply(200, { MediaContainer: {} });
  const libs = await client.libraries();
  expect(libs).toEqual([]);
});

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

test('search returns Metadata results', async () => {
  mock.onGet('/search').reply(200, {
    MediaContainer: {
      Metadata: [
        { ratingKey: '1', title: 'Inception', type: 'movie' },
        { ratingKey: '2', title: 'Interstellar', type: 'movie' },
      ],
    },
  });
  const results = await client.search('In');
  expect(results).toHaveLength(2);
  expect(results[0].title).toBe('Inception');
});

test('search handles Hub format', async () => {
  mock.onGet('/search').reply(200, {
    MediaContainer: {
      Hub: [{ type: 'movie', Metadata: [{ ratingKey: '3', title: 'Tenet' }] }],
    },
  });
  const results = await client.search('Tenet');
  expect(results).toHaveLength(1);
  expect(results[0].title).toBe('Tenet');
});

test('search returns empty array when no results', async () => {
  mock.onGet('/search').reply(200, { MediaContainer: {} });
  const results = await client.search('xyzzy');
  expect(results).toEqual([]);
});

// ---------------------------------------------------------------------------
// metadata / children
// ---------------------------------------------------------------------------

test('metadata returns first Metadata item', async () => {
  mock.onGet('/library/metadata/42').reply(200, {
    MediaContainer: { Metadata: [{ ratingKey: '42', title: 'Dune', type: 'movie' }] },
  });
  const meta = await client.metadata('42');
  expect(meta.title).toBe('Dune');
});

test('metadata returns empty object when not found', async () => {
  mock.onGet('/library/metadata/99').reply(200, {
    MediaContainer: { Metadata: [] },
  });
  const meta = await client.metadata('99');
  expect(meta).toEqual({});
});

test('children returns season list', async () => {
  mock.onGet('/library/metadata/10/children').reply(200, {
    MediaContainer: { Metadata: [{ ratingKey: '11', title: 'Season 1', type: 'season' }] },
  });
  const kids = await client.children('10');
  expect(kids).toHaveLength(1);
  expect(kids[0].title).toBe('Season 1');
});

// ---------------------------------------------------------------------------
// onDeck / recentlyAdded / sessions
// ---------------------------------------------------------------------------

test('onDeck returns metadata', async () => {
  mock.onGet('/library/onDeck').reply(200, {
    MediaContainer: { Metadata: [{ ratingKey: '5', title: 'Ep 3', type: 'episode' }] },
  });
  const items = await client.onDeck();
  expect(items[0].title).toBe('Ep 3');
});

test('recentlyAdded returns metadata', async () => {
  mock.onGet('/library/recentlyAdded').reply(200, {
    MediaContainer: { Metadata: [{ ratingKey: '7', title: 'New Film' }] },
  });
  const items = await client.recentlyAdded();
  expect(items[0].title).toBe('New Film');
});

test('sessions returns metadata', async () => {
  mock.onGet('/status/sessions').reply(200, {
    MediaContainer: { Metadata: [{ ratingKey: '6', title: 'Playing Movie' }] },
  });
  const ss = await client.sessions();
  expect(ss[0].title).toBe('Playing Movie');
});

// ---------------------------------------------------------------------------
// clients
// ---------------------------------------------------------------------------

test('clients returns Server array', async () => {
  mock.onGet('/clients').reply(200, {
    MediaContainer: {
      Server: [{ name: 'Living Room TV', address: '192.168.1.50', port: '32433' }],
    },
  });
  const result = await client.clients();
  expect(result[0].name).toBe('Living Room TV');
});

// ---------------------------------------------------------------------------
// playlists
// ---------------------------------------------------------------------------

test('playlists returns Metadata array', async () => {
  mock.onGet('/playlists').reply(200, {
    MediaContainer: { Metadata: [{ ratingKey: '20', title: 'Favorites', leafCount: 5 }] },
  });
  const pls = await client.playlists();
  expect(pls[0].title).toBe('Favorites');
});

// ---------------------------------------------------------------------------
// markWatched / markUnwatched
// ---------------------------------------------------------------------------

test('markWatched does not throw on success', async () => {
  mock.onGet('/:/scrobble').reply(200, {});
  await expect(client.markWatched('42')).resolves.not.toThrow();
});

test('markUnwatched does not throw on success', async () => {
  mock.onGet('/:/unscrobble').reply(200, {});
  await expect(client.markUnwatched('42')).resolves.not.toThrow();
});

// ---------------------------------------------------------------------------
// Network errors
// ---------------------------------------------------------------------------

test('throws PlexAPIError on network failure', async () => {
  mock.onGet('/').networkError();
  await expect(client.serverInfo()).rejects.toThrow(PlexAPIError);
  await expect(client.serverInfo()).rejects.toThrow('Request failed');
});
