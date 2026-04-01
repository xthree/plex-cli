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

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export function mediaTable(items: PlexItem[], title = ''): void {
  if (title) {
    console.log('\n' + chalk.cyan.bold(title));
  }
  const table = new Table({
    head: ['#', 'Title', 'Type', 'Year', 'Duration', 'Watched', 'Rating'],
    colWidths: [5, 36, 16, 7, 10, 9, 8],
    style: { head: ['cyan'] },
  });
  items.forEach((item, i) => {
    const itemTitle = (item.title ?? item.name ?? '(no title)').substring(0, 33);
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
  const tagline = item.tagline as string | undefined;
  const lines: string[] = [
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
