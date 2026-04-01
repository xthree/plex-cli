/**
 * Shared display helpers using chalk and cli-table3.
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import type { PlexItem, PlexClientDevice, PlexSession } from './types';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return '--:--';
  const totalS = Math.floor(Number(ms) / 1000);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  if (h) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtYear(item: PlexItem): string {
  return String(item.year ?? item.parentYear ?? '');
}

export function fmtType(item: PlexItem): string {
  const map: Record<string, string> = {
    movie: '🎬 Movie',
    show: '📺 Show',
    season: '📅 Season',
    episode: '📺 Episode',
    artist: '🎤 Artist',
    album: '💿 Album',
    track: '🎵 Track',
    photo: '📷 Photo',
    clip: '🎞  Clip',
    playlist: '📋 Playlist',
    collection: '📁 Collection',
  };
  const t = item.type ?? 'unknown';
  return map[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
}

export function fmtWatched(item: PlexItem): string {
  if (item.viewCount) return '✓';
  if (item.viewOffset) return '▶';
  return '';
}

export function fmtItemLabel(item: PlexItem): string {
  const t = item.title ?? item.name ?? '(no title)';
  if (item.type === 'episode' && item.grandparentTitle) {
    return `${item.grandparentTitle} – ${t}`;
  }
  return t;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

// Sum of all fixed column widths: # (5) + Type (16) + Year (7) + Duration (10) + Watched (9) + Rating (8)
// plus 8 chars for the table borders (one per column boundary including outer left/right edges).
const FIXED_COLS_WIDTH = 5 + 16 + 7 + 10 + 9 + 8 + 8; // columns (63) + borders (8)
const MIN_TITLE_COL_WIDTH = 20;
const FALLBACK_TERMINAL_WIDTH = 100;

function titleColWidth(): number {
  const termWidth = process.stdout.columns ?? FALLBACK_TERMINAL_WIDTH;
  return Math.max(MIN_TITLE_COL_WIDTH, termWidth - FIXED_COLS_WIDTH);
}

export function mediaTable(items: PlexItem[], title = ''): void {
  if (title) {
    console.log('\n' + chalk.cyan.bold(title));
  }
  const titleWidth = titleColWidth();
  const table = new Table({
    head: ['#', 'Title', 'Type', 'Year', 'Duration', 'Watched', 'Rating'],
    colWidths: [5, titleWidth, 16, 7, 10, 9, 8],
    style: { head: ['cyan'] },
  });
  items.forEach((item, i) => {
    const itemTitle = fmtItemLabel(item).substring(0, titleWidth - 3);
    const rating = item.rating ?? item.userRating ?? '';
    let ratingStr = '';
    if (rating !== '' && rating != null) {
      const ratingNum = Number.parseFloat(String(rating));
      if (Number.isFinite(ratingNum)) {
        ratingStr = ratingNum.toFixed(1);
      }
    }
    table.push([
      String(i + 1),
      itemTitle,
      fmtType(item),
      fmtYear(item),
      fmtDuration(item.duration),
      fmtWatched(item),
      ratingStr,
    ]);
  });
  console.log(table.toString());
}

export function clientTable(clients: PlexClientDevice[]): void {
  const table = new Table({
    head: ['#', 'Name', 'Product', 'Platform', 'State', 'Address'],
    style: { head: ['cyan'] },
  });
  clients.forEach((c, i) => {
    table.push([
      String(i + 1),
      c.name ?? c.title ?? '?',
      c.product ?? '',
      c.platform ?? '',
      c.state ?? '',
      c.address ?? '',
    ]);
  });
  console.log('\n' + chalk.cyan.bold('Clients'));
  console.log(table.toString());
}

export function sessionTable(sessions: PlexSession[]): void {
  const table = new Table({
    head: ['#', 'User', 'Title', 'Player', 'State', 'Progress'],
    colWidths: [5, 16, 32, 18, 10, 24],
    style: { head: ['magenta'] },
  });
  sessions.forEach((s, i) => {
    const user = s.User?.title ?? '?';
    const gpTitle = s.grandparentTitle ?? '';
    const epTitle = s.title ?? '?';
    const title = gpTitle ? `${gpTitle} – ${epTitle}` : epTitle;
    const player = s.Player ?? {};
    const playerName = player.title ?? player.product ?? '?';
    const state = (player.state as string | undefined) ?? '?';
    const offset = parseInt(String(s.viewOffset ?? 0), 10);
    const duration = parseInt(String(s.duration ?? 0), 10);
    let progress = fmtDuration(offset);
    if (duration) {
      const pct = Math.round((offset / duration) * 100);
      progress = `${fmtDuration(offset)} / ${fmtDuration(duration)} (${pct}%)`;
    }
    table.push([String(i + 1), user, title.substring(0, 29), String(playerName), state, progress]);
  });
  console.log('\n' + chalk.magenta.bold('Active Sessions'));
  console.log(table.toString());
}

export function metadataPanel(item: PlexItem): void {
  const title = item.title ?? '?';
  const showName = item.type === 'episode' && item.grandparentTitle ? item.grandparentTitle : null;
  const tagline = item.tagline as string | undefined;
  const lines: string[] = [
    ...(showName ? [chalk.dim(showName)] : []),
    chalk.yellow.bold(title),
    ...(tagline ? [chalk.italic(tagline)] : []),
    '',
    chalk.cyan('Type:     ') + fmtType(item),
    chalk.cyan('Year:     ') + fmtYear(item),
    chalk.cyan('Duration: ') + fmtDuration(item.duration),
  ];
  if (item.contentRating) lines.push(chalk.cyan('Rating:   ') + item.contentRating);
  if (item.audienceRating)
    lines.push(chalk.cyan('Audience: ') + parseFloat(String(item.audienceRating)).toFixed(1));
  if (item.studio) lines.push(chalk.cyan('Studio:   ') + item.studio);

  const summary = item.summary ?? '';
  if (summary) {
    lines.push('');
    lines.push(chalk.cyan('Summary:'));
    lines.push(summary.substring(0, 400) + (summary.length > 400 ? '…' : ''));
  }

  const genres = (item.Genre ?? []).map((g) => g.tag).join(', ');
  if (genres) lines.push(chalk.cyan('Genres:   ') + genres);

  const directors = (item.Director ?? []).map((d) => d.tag).join(', ');
  if (directors) lines.push(chalk.cyan('Director: ') + directors);

  const cast = (item.Role ?? [])
    .slice(0, 6)
    .map((r) => r.tag)
    .join(', ');
  if (cast) lines.push(chalk.cyan('Cast:     ') + cast);

  const border = '─'.repeat(60);
  console.log('\n' + chalk.cyan(border));
  lines.forEach((l) => console.log('  ' + l));
  console.log(chalk.cyan(border) + '\n');
}

// ---------------------------------------------------------------------------
// Simple helpers
// ---------------------------------------------------------------------------

export function printError(msg: string): void {
  console.error(chalk.red.bold('Error: ') + msg);
}

export function printSuccess(msg: string): void {
  console.log(chalk.green.bold('✓ ') + msg);
}

export function printInfo(msg: string): void {
  console.log(chalk.dim(msg));
}

export function printHeader(title: string): void {
  console.log('\n' + chalk.cyan.bold('─── ' + title + ' ───') + '\n');
}

export function progressBar(offset: number, duration: number, width = 40): string {
  const pct = duration > 0 ? Math.min(1, offset / duration) : 0;
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const bar = chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  const elapsed = fmtDuration(offset);
  const total = fmtDuration(duration);
  return `${elapsed} ${bar} ${total} (${Math.round(pct * 100)}%)`;
}
