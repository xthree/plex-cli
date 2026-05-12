/**
 * Library spreadsheet export.
 *
 * Generates an XLSX workbook with one sheet per Plex library.
 * - Movies: one row per file, sorted alphabetically by title.
 * - TV Shows: rows grouped by show (alphabetically), then sorted by
 *   season × episode within each show, with a show-title divider row.
 * - Music: one row per track, sorted alphabetically by title.
 * - Other library types: one row per item.
 *
 * Each data row contains the technical specs extracted from the first
 * Media/Part/Stream on the item.
 */

import path from 'node:path';
import fs from 'node:fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ExcelJS from 'exceljs';
import type { PlexClient } from '../api';
import type { PlexItem, PlexLibrary, PlexStream } from '../types';
import { printInfo, printError, printSuccess } from '../display';

// ---------------------------------------------------------------------------
// Plex type constants
// ---------------------------------------------------------------------------
const PLEX_TYPE_MOVIE   = 1;
const PLEX_TYPE_EPISODE = 4;
const PLEX_TYPE_TRACK   = 10;

// ---------------------------------------------------------------------------
// Technical spec helpers (mirrors logic in display.ts metadataPanel)
// ---------------------------------------------------------------------------

function fmtFileSize(bytes: number | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
}

function detectHdr(video: PlexStream): string {
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

interface TechRow {
  /** Full display title for the item */
  title: string;
  year: string;
  /** For episodes: show name */
  showTitle: string;
  /** For episodes: season number */
  season: number;
  /** For episodes: episode number */
  episode: number;
  container: string;
  videoCodec: string;
  videoProfile: string;
  resolution: string;
  hdr: string;
  aspectRatio: string;
  bitrateKbps: string;
  frameRate: string;
  audioTracks: string;
  audioLanguages: string;
  atmos: string;
  subtitleLanguages: string;
  filePath: string;
  fileSize: string;
  /** Raw values for sorting */
  _sortTitle: string;
  _season: number;
  _episode: number;
}

function extractTechRow(item: PlexItem): TechRow {
  const media = item.Media?.[0];
  const part = media?.Part?.[0];
  const streams: PlexStream[] = part?.Stream ?? [];

  const videoStream = streams.find((s) => s.streamType === 1);
  const audioStreams = streams.filter((s) => s.streamType === 2);
  const subtitleStreams = streams.filter((s) => s.streamType === 3);

  // Video
  const videoCodec = videoStream?.codec?.toUpperCase() ?? media?.videoCodec?.toUpperCase() ?? '';
  const videoProfile = videoStream?.profile ?? media?.videoProfile ?? '';
  const width = videoStream?.width ?? media?.width ?? 0;
  const height = videoStream?.height ?? media?.height ?? 0;
  const resolution = width && height ? `${width}×${height}` : (media?.videoResolution ?? '');
  const hdr = videoStream ? detectHdr(videoStream) : '';

  const ar = media?.aspectRatio;
  const aspectRatio = ar != null
    ? (typeof ar === 'number' ? `${ar.toFixed(2)}:1` : String(ar))
    : '';
  const bitrateKbps = media?.bitrate != null ? String(media.bitrate) : '';
  const fr = videoStream?.frameRate ?? '';
  const frameRate = fr !== '' ? String(fr) : '';

  // Audio
  const audioTracks = audioStreams
    .map((a) => {
      const codec = a.displayTitle ?? a.codec?.toUpperCase() ?? '';
      const ch = a.channels ? ` (${a.channels}ch)` : '';
      return `${codec}${ch}`;
    })
    .join(' | ');

  const audioLanguages = [...new Set(
    audioStreams.map((a) => a.languageTag ?? a.language ?? '').filter(Boolean)
  )].join(', ');

  const hasAtmos =
    audioStreams.some((a) =>
      (a.audioProfile ?? '').toLowerCase().includes('atmos') ||
      (a.displayTitle ?? '').toLowerCase().includes('atmos')
    ) ||
    (media?.audioProfile ?? '').toLowerCase().includes('atmos');
  const atmos = hasAtmos ? 'Yes' : '';

  const subtitleLanguages = [...new Set(
    subtitleStreams.map((s) => s.languageTag ?? s.language ?? '').filter(Boolean)
  )].join(', ');

  const title = item.title ?? item.name ?? '';
  const year = String(item.year ?? item.parentYear ?? '');
  const showTitle = item.grandparentTitle ?? '';
  const season = Number(item.parentIndex ?? 0);
  const episode = Number(item.index ?? 0);

  return {
    title,
    year,
    showTitle,
    season,
    episode,
    container: part?.container ?? media?.container ?? '',
    videoCodec,
    videoProfile,
    resolution,
    hdr,
    aspectRatio,
    bitrateKbps,
    frameRate,
    audioTracks,
    audioLanguages,
    atmos,
    subtitleLanguages,
    filePath: part?.file ?? '',
    fileSize: fmtFileSize(part?.size),
    _sortTitle: (item.title ?? item.name ?? '').toLowerCase(),
    _season: season,
    _episode: episode,
  };
}

// ---------------------------------------------------------------------------
// Sheet builders
// ---------------------------------------------------------------------------

const HEADER_MOVIE = [
  'Title', 'Year', 'Container', 'Video Codec', 'Video Profile',
  'Resolution', 'HDR', 'Aspect Ratio', 'Bitrate (kbps)', 'Frame Rate',
  'Audio Tracks', 'Audio Languages', 'Atmos', 'Subtitle Languages',
  'File Path', 'File Size',
];

const HEADER_EPISODE = [
  'Show', 'Season', 'Episode', 'Title', 'Container', 'Video Codec',
  'Video Profile', 'Resolution', 'HDR', 'Aspect Ratio', 'Bitrate (kbps)',
  'Frame Rate', 'Audio Tracks', 'Audio Languages', 'Atmos',
  'Subtitle Languages', 'File Path', 'File Size',
];

const HEADER_TRACK = [
  'Title', 'Artist', 'Album', 'Container', 'Audio Codec',
  'Audio Channels', 'Sample Rate', 'Bitrate (kbps)',
  'File Path', 'File Size',
];

function addMovieSheet(wb: ExcelJS.Workbook, name: string, rows: TechRow[]): void {
  const ws = wb.addWorksheet(name);
  ws.addRow(HEADER_MOVIE).font = { bold: true };

  const sorted = [...rows].sort((a, b) => a._sortTitle.localeCompare(b._sortTitle));
  for (const r of sorted) {
    ws.addRow([
      r.title, r.year, r.container, r.videoCodec, r.videoProfile,
      r.resolution, r.hdr, r.aspectRatio, r.bitrateKbps, r.frameRate,
      r.audioTracks, r.audioLanguages, r.atmos, r.subtitleLanguages,
      r.filePath, r.fileSize,
    ]);
  }

  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.columns.forEach((col) => { col.width = 20; });
  ws.getColumn(1).width = 40;  // Title
  ws.getColumn(15).width = 60; // File Path
}

function addTvSheet(wb: ExcelJS.Workbook, name: string, rows: TechRow[]): void {
  const ws = wb.addWorksheet(name);
  ws.addRow(HEADER_EPISODE).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Group by show name, sorted alphabetically
  const byShow = new Map<string, TechRow[]>();
  for (const r of rows) {
    const key = r.showTitle || r.title;
    const list = byShow.get(key) ?? [];
    list.push(r);
    byShow.set(key, list);
  }

  const sortedShows = [...byShow.keys()].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  for (const show of sortedShows) {
    const episodes = byShow.get(show)!.sort((a, b) =>
      a._season !== b._season ? a._season - b._season : a._episode - b._episode
    );

    // Divider row for the show name
    const divRow = ws.addRow([show]);
    divRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
    divRow.font = { bold: true, italic: true, color: { argb: 'FFCCCCFF' } };
    ws.mergeCells(divRow.number, 1, divRow.number, HEADER_EPISODE.length);

    for (const r of episodes) {
      ws.addRow([
        r.showTitle, r.season || '', r.episode || '', r.title,
        r.container, r.videoCodec, r.videoProfile, r.resolution,
        r.hdr, r.aspectRatio, r.bitrateKbps, r.frameRate,
        r.audioTracks, r.audioLanguages, r.atmos, r.subtitleLanguages,
        r.filePath, r.fileSize,
      ]);
    }
  }

  ws.columns.forEach((col) => { col.width = 18; });
  ws.getColumn(1).width = 35;  // Show
  ws.getColumn(4).width = 35;  // Episode title
  ws.getColumn(17).width = 60; // File Path
}

function addMusicSheet(wb: ExcelJS.Workbook, name: string, items: PlexItem[]): void {
  const ws = wb.addWorksheet(name);
  ws.addRow(HEADER_TRACK).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  const sorted = [...items].sort((a, b) =>
    (a.title ?? '').toLowerCase().localeCompare((b.title ?? '').toLowerCase())
  );

  for (const item of sorted) {
    const media = item.Media?.[0];
    const part = media?.Part?.[0];
    const streams: PlexStream[] = part?.Stream ?? [];
    const audio = streams.find((s) => s.streamType === 2);
    ws.addRow([
      item.title ?? '',
      item.grandparentTitle ?? '',
      item.parentTitle ?? '',
      part?.container ?? media?.container ?? '',
      audio?.codec?.toUpperCase() ?? media?.audioCodec?.toUpperCase() ?? '',
      audio?.channels ?? media?.audioChannels ?? '',
      audio?.samplingRate ?? '',
      media?.bitrate ?? '',
      part?.file ?? '',
      fmtFileSize(part?.size),
    ]);
  }

  ws.columns.forEach((col) => { col.width = 20; });
  ws.getColumn(1).width = 40;
  ws.getColumn(9).width = 60;
}

// ---------------------------------------------------------------------------
// Public: build the workbook
// ---------------------------------------------------------------------------

export interface ExportOptions {
  /** Output file path */
  output?: string;
  /** Progress callback (current, total, label) */
  onProgress?: (current: number, total: number, label: string) => void;
}

export async function exportLibrarySpreadsheet(
  client: PlexClient,
  opts: ExportOptions = {}
): Promise<string> {
  const libs = await client.libraries();
  if (!libs.length) throw new Error('No libraries found on server.');

  const outPath = opts.output ?? 'plex-library-export.xlsx';
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'plex-cli';
  workbook.created = new Date();

  let libIndex = 0;
  for (const lib of libs) {
    libIndex++;
    const libKey = lib.key ?? '';
    const libTitle = lib.title ?? `Library ${libKey}`;
    const libType = lib.type ?? '';

    // Sheet names max 31 chars; strip invalid chars
    const sheetName = libTitle.replace(/[\\/*?:\[\]]/g, '').slice(0, 31);

    opts.onProgress?.(libIndex, libs.length, libTitle);

    if (libType === 'movie') {
      const items = await client.libraryAllLeaves(libKey, PLEX_TYPE_MOVIE);
      const rows = items.map(extractTechRow);
      addMovieSheet(workbook, sheetName, rows);

    } else if (libType === 'show') {
      const items = await client.libraryAllLeaves(libKey, PLEX_TYPE_EPISODE);
      const rows = items.map(extractTechRow);
      addTvSheet(workbook, sheetName, rows);

    } else if (libType === 'artist') {
      const items = await client.libraryAllLeaves(libKey, PLEX_TYPE_TRACK);
      addMusicSheet(workbook, sheetName, items);

    } else {
      // Generic sheet: just list titles
      const { items } = await client.libraryContents(libKey, { limit: 500 });
      const ws = workbook.addWorksheet(sheetName);
      ws.addRow(['Title', 'Type', 'Year']);
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      for (const it of items) {
        ws.addRow([it.title ?? '', it.type ?? '', String(it.year ?? '')]);
      }
    }
  }

  // Ensure output directory exists
  const dir = path.dirname(path.resolve(outPath));
  fs.mkdirSync(dir, { recursive: true });

  await workbook.xlsx.writeFile(outPath);
  return outPath;
}

// ---------------------------------------------------------------------------
// Interactive menu entry
// ---------------------------------------------------------------------------

export async function runExportMenu(client: PlexClient): Promise<void> {
  const { output } = await inquirer.prompt<{ output: string }>([
    {
      type: 'input',
      name: 'output',
      message: 'Output file path:',
      default: 'plex-library-export.xlsx',
    },
  ]);

  printInfo('Fetching library data — this may take a moment for large libraries…');

  try {
    const outPath = await exportLibrarySpreadsheet(client, {
      output,
      onProgress: (cur, total, label) => {
        process.stdout.write(
          `\r  ${chalk.cyan(`[${cur}/${total}]`)} ${chalk.dim(label)}                    `
        );
      },
    });
    process.stdout.write('\n');
    printSuccess(`Spreadsheet written to: ${chalk.bold(outPath)}`);
  } catch (err: unknown) {
    printError((err as Error).message);
  }
}
