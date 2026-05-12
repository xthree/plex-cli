/**
 * Tests for the Home Assistant automation generator helpers.
 */

import { slugify, haMediaType, buildContentId, renderYaml } from '../src/menus/hass';
import type { PlexItem } from '../src/types';

describe('slugify', () => {
  test('lowercases and replaces spaces', () => {
    expect(slugify('Play Inception on Plex')).toBe('play_inception_on_plex');
  });
  test('strips leading and trailing underscores', () => {
    expect(slugify('  Breaking Bad  ')).toBe('breaking_bad');
  });
  test('collapses multiple special chars', () => {
    expect(slugify('Movie!!  Title??')).toBe('movie_title');
  });
  test('truncates at 60 chars', () => {
    expect(slugify('a'.repeat(100))).toHaveLength(60);
  });
  test('handles non-ASCII gracefully', () => {
    expect(slugify('Amélie')).toBe('am_lie');
  });
});

describe('haMediaType', () => {
  test.each<[Partial<PlexItem>, string]>([
    [{ type: 'movie' }, 'movie'],
    [{ type: 'show' }, 'tvshow'],
    [{ type: 'episode' }, 'episode'],
    [{ type: 'track' }, 'music'],
    [{ type: 'album' }, 'album'],
    [{ type: 'artist' }, 'artist'],
    [{ type: 'season' }, 'season'],
    [{ type: 'unknown_thing' }, 'video'],
    [{}, 'video'],
  ])('type %p → %s', (item, expected) => {
    expect(haMediaType(item as PlexItem)).toBe(expected);
  });
});

describe('buildContentId', () => {
  test('movie — returns title lookup', () => {
    const item: PlexItem = { type: 'movie', title: 'Inception', ratingKey: '1' };
    const parsed = JSON.parse(buildContentId(item, 'Movies', false));
    expect(parsed).toEqual({ library_name: 'Movies', title: 'Inception' });
  });

  test('show with resume', () => {
    const item: PlexItem = { type: 'show', title: 'Breaking Bad', ratingKey: '2' };
    const parsed = JSON.parse(buildContentId(item, 'TV Shows', true));
    expect(parsed).toEqual({ library_name: 'TV Shows', show: 'Breaking Bad', resume: true });
  });

  test('show without resume starts at S01E01', () => {
    const item: PlexItem = { type: 'show', title: 'Breaking Bad', ratingKey: '2' };
    const parsed = JSON.parse(buildContentId(item, 'TV Shows', false));
    expect(parsed).toEqual({
      library_name: 'TV Shows',
      show: 'Breaking Bad',
      season: 1,
      episode: 1,
    });
  });

  test('episode includes season and episode index', () => {
    const item: PlexItem = {
      type: 'episode',
      title: 'Pilot',
      grandparentTitle: 'Breaking Bad',
      parentIndex: 1,
      index: 1,
      ratingKey: '3',
    };
    const parsed = JSON.parse(buildContentId(item, 'TV Shows', false));
    expect(parsed).toEqual({
      library_name: 'TV Shows',
      show: 'Breaking Bad',
      season: 1,
      episode: 1,
    });
  });

  test('episode falls back to title when grandparentTitle missing', () => {
    const item: PlexItem = { type: 'episode', title: 'Solo Episode', ratingKey: '4' };
    const parsed = JSON.parse(buildContentId(item, 'TV Shows', false));
    expect(parsed.show).toBe('Solo Episode');
  });
});

describe('renderYaml', () => {
  const base = {
    alias: 'Play Inception on Plex',
    description: 'Test automation',
    inputButtonSlug: 'play_inception_on_plex',
    mediaPlayerEntity: 'media_player.plex_living_room',
    mediaContentType: 'movie',
    mediaContentId: '{"library_name":"Movies","title":"Inception"}',
  };

  test('output contains the alias', () => {
    expect(renderYaml(base)).toContain('alias: "Play Inception on Plex"');
  });

  test('output contains trigger entity_id', () => {
    expect(renderYaml(base)).toContain('input_button.play_inception_on_plex');
  });

  test('output contains media_player entity', () => {
    expect(renderYaml(base)).toContain('media_player.plex_living_room');
  });

  test('output contains media_content_type', () => {
    expect(renderYaml(base)).toContain('media_content_type: "movie"');
  });

  test('output contains media_content_id', () => {
    expect(renderYaml(base)).toContain('{"library_name":"Movies","title":"Inception"}');
  });

  test('output contains setup instructions comment', () => {
    expect(renderYaml(base)).toContain('SETUP STEPS');
  });

  test('escapes double-quotes in alias', () => {
    const yaml = renderYaml({ ...base, alias: 'Play "Inception" on Plex' });
    expect(yaml).toContain('\\"Inception\\"');
  });
});
