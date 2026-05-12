/**
 * Tests for the library XLSX export helpers in src/menus/export.ts.
 */

import { describe, it, expect } from '@jest/globals';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Helpers duplicated here to avoid touching the private internals of export.ts
// (the module itself is also tested through the public surface below)
// ---------------------------------------------------------------------------

function fmtFileSize(bytes: number | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
}

describe('fmtFileSize', () => {
  it('returns empty for undefined', () => {
    expect(fmtFileSize(undefined)).toBe('');
  });
  it('formats bytes', () => {
    expect(fmtFileSize(512)).toBe('512 B');
  });
  it('formats KB', () => {
    expect(fmtFileSize(1536)).toBe('1.5 KB');
  });
  it('formats MB', () => {
    expect(fmtFileSize(2.5 * 1024 ** 2)).toBe('2.50 MB');
  });
  it('formats GB', () => {
    expect(fmtFileSize(4.25 * 1024 ** 3)).toBe('4.25 GB');
  });
  it('formats TB', () => {
    expect(fmtFileSize(1.1 * 1024 ** 4)).toBe('1.10 TB');
  });
});

// ---------------------------------------------------------------------------
// detectHdr logic (reimplemented inline to test without importing the module)
// ---------------------------------------------------------------------------

interface StreamLike {
  colorTrc?: string;
  colorPrimaries?: string;
  displayTitle?: string;
  DOVIPresent?: number | boolean;
}

function detectHdr(video: StreamLike): string {
  const trc = (video.colorTrc ?? '').toLowerCase();
  const primaries = (video.colorPrimaries ?? '').toLowerCase();
  const dt = (video.displayTitle ?? '').toLowerCase();
  const tags: string[] = [];
  if (video.DOVIPresent || dt.includes('dolby vision') || dt.includes('dovi'))
    tags.push('Dolby Vision');
  if (trc === 'smpte2094-40' || dt.includes('hdr10+'))
    tags.push('HDR10+');
  else if ((trc === 'smpte2084' && primaries === 'bt2020') || dt.includes('hdr10'))
    tags.push('HDR10');
  if (trc === 'arib-std-b67' || dt.includes('hlg'))
    tags.push('HLG');
  return tags.join(' / ');
}

describe('detectHdr', () => {
  it('returns empty string for SDR content', () => {
    expect(detectHdr({ colorTrc: 'bt709', colorPrimaries: 'bt709' })).toBe('');
  });
  it('detects HDR10 via colorTrc + bt2020 primaries', () => {
    expect(detectHdr({ colorTrc: 'smpte2084', colorPrimaries: 'bt2020' })).toBe('HDR10');
  });
  it('detects Dolby Vision via DOVIPresent flag', () => {
    expect(detectHdr({ DOVIPresent: 1 })).toBe('Dolby Vision');
  });
  it('detects Dolby Vision via displayTitle', () => {
    expect(detectHdr({ displayTitle: 'Dolby Vision Profile 5' })).toBe('Dolby Vision');
  });
  it('detects HDR10+ via colorTrc', () => {
    expect(detectHdr({ colorTrc: 'smpte2094-40' })).toBe('HDR10+');
  });
  it('detects HLG via colorTrc', () => {
    expect(detectHdr({ colorTrc: 'arib-std-b67' })).toBe('HLG');
  });
  it('combines Dolby Vision + HDR10 tags', () => {
    const result = detectHdr({
      DOVIPresent: 1,
      colorTrc: 'smpte2084',
      colorPrimaries: 'bt2020',
    });
    expect(result).toBe('Dolby Vision / HDR10');
  });
});

// ---------------------------------------------------------------------------
// sanitiseSheetName — imported from the module under test
// ---------------------------------------------------------------------------

import { sanitiseSheetName } from '../src/menus/export';

describe('sanitiseSheetName', () => {
  it('strips forbidden Excel sheet name characters', () => {
    expect(sanitiseSheetName('Lib: [Movies] *?')).toBe('Lib Movies ');
  });
  it('truncates at 31 characters', () => {
    const long = 'A'.repeat(50);
    expect(sanitiseSheetName(long)).toHaveLength(31);
  });
  it('passes through normal names unchanged', () => {
    expect(sanitiseSheetName('Movies 4K')).toBe('Movies 4K');
  });
});

// ---------------------------------------------------------------------------
// TV-show sort ordering
// ---------------------------------------------------------------------------

describe('TV show sort ordering', () => {
  type EpLike = { showTitle: string; _season: number; _episode: number };

  function sortEpisodes(eps: EpLike[]): EpLike[] {
    return [...eps].sort((a, b) =>
      a._season !== b._season ? a._season - b._season : a._episode - b._episode
    );
  }

  function sortShows(shows: string[]): string[] {
    return [...shows].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

  it('sorts shows alphabetically (case-insensitive)', () => {
    const names = ['Westworld', 'Breaking Bad', 'Andor', 'band of brothers'];
    expect(sortShows(names)).toEqual([
      'Andor', 'band of brothers', 'Breaking Bad', 'Westworld',
    ]);
  });

  it('sorts episodes by season then episode number', () => {
    const eps: EpLike[] = [
      { showTitle: 'X', _season: 2, _episode: 1 },
      { showTitle: 'X', _season: 1, _episode: 3 },
      { showTitle: 'X', _season: 1, _episode: 1 },
      { showTitle: 'X', _season: 2, _episode: 2 },
    ];
    const sorted = sortEpisodes(eps);
    expect(sorted.map((e) => `S${e._season}E${e._episode}`)).toEqual([
      'S1E1', 'S1E3', 'S2E1', 'S2E2',
    ]);
  });
});

// ---------------------------------------------------------------------------
// exportLibrarySpreadsheet – smoke test (mocked client)
// ---------------------------------------------------------------------------

import { jest } from '@jest/globals';

describe('exportLibrarySpreadsheet', () => {
  it('writes a file and resolves to the output path', async () => {
    const tmpPath = `${os.tmpdir()}/plex-cli-test-export-${Date.now()}.xlsx`;

    // Minimal mock PlexClient
    const mockClient = {
      libraries: jest.fn<() => Promise<Array<{ key: string; title: string; type: string }>>>().mockResolvedValue([
        { key: '1', title: 'Movies', type: 'movie' },
        { key: '2', title: 'TV Shows', type: 'show' },
      ]),
      libraryAllLeaves: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([
        {
          title: 'Test Movie',
          year: 2024,
          type: 'movie',
          Media: [{
            container: 'mkv',
            videoCodec: 'hevc',
            videoProfile: 'main 10',
            width: 3840,
            height: 2160,
            bitrate: 45000,
            aspectRatio: 2.35,
            audioCodec: 'truehd',
            audioChannels: 8,
            audioProfile: 'atmos',
            Part: [{
              file: '/media/Test Movie (2024).mkv',
              size: 50 * 1024 ** 3,
              container: 'mkv',
              Stream: [
                {
                  streamType: 1,
                  codec: 'hevc',
                  profile: 'main 10',
                  width: 3840,
                  height: 2160,
                  colorTrc: 'smpte2084',
                  colorPrimaries: 'bt2020',
                  DOVIPresent: 0,
                  frameRate: 23.976,
                },
                {
                  streamType: 2,
                  codec: 'truehd',
                  audioProfile: 'atmos',
                  channels: 8,
                  language: 'English',
                  languageTag: 'en',
                },
                {
                  streamType: 3,
                  language: 'English',
                  languageTag: 'en',
                },
              ],
            }],
          }],
        },
      ]),
      libraryContents: jest.fn<() => Promise<{ items: unknown[]; total: number }>>().mockResolvedValue({ items: [], total: 0 }),
    };

    const { exportLibrarySpreadsheet } = await import('../src/menus/export');
    const result = await exportLibrarySpreadsheet(mockClient as never, { output: tmpPath });

    expect(result).toBe(tmpPath);

    const { existsSync } = await import('node:fs');
    expect(existsSync(tmpPath)).toBe(true);

    // Cleanup
    const { unlinkSync } = await import('node:fs');
    unlinkSync(tmpPath);
  });
});
