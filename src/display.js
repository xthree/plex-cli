/**
 * Shared display helpers using chalk and cli-table3.
 */

import chalk from 'chalk';
import Table from 'cli-table3';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function fmtDuration(ms) {
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

export function fmtYear(item) {
  return String(item.year ?? item.parentYear ?? '');
}

export function fmtType(item) {
  const map = {
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
  return map[t] ?? (t.charAt(0).toUpperCase() + t.slice(1));
}

export function fmtWatched(item) {
  if (item.viewCount) return '✓';
  if (item.viewOffset) return '▶';
  return '';
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export function mediaTable(items, title = '') {
  if (title) {
    console.log('\n' + chalk.cyan.bold(title));
  }
  const table = new Table({
    head: ['#', 'Title', 'Type', 'Year', 'Duration', 'Watched', 'Rating'],
    colWidths: [5, 36, 16, 7, 10, 9, 8],
    style: { head: ['cyan'] },
  });
  items.forEach((item, i) => {
    const itemTitle = item.title ?? item.name ?? '(no title)';
    const rating = item.rating ?? item.userRating ?? '';
    const ratingStr = rating ? parseFloat(rating).toFixed(1) : '';
    table.push([
      String(i + 1),
      itemTitle.substring(0, 33),
      fmtType(item),
      fmtYear(item),
      fmtDuration(item.duration),
      fmtWatched(item),
      ratingStr,
    ]);
  });
  console.log(table.toString());
}

export function clientTable(clients) {
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

export function sessionTable(sessions) {
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
    const state = player.state ?? '?';
    const offset = parseInt(s.viewOffset ?? 0, 10);
    const duration = parseInt(s.duration ?? 0, 10);
    let progress = fmtDuration(offset);
    if (duration) {
      const pct = Math.round((offset / duration) * 100);
      progress = `${fmtDuration(offset)} / ${fmtDuration(duration)} (${pct}%)`;
    }
    table.push([String(i + 1), user, title.substring(0, 29), playerName, state, progress]);
  });
  console.log('\n' + chalk.magenta.bold('Active Sessions'));
  console.log(table.toString());
}

export function metadataPanel(item) {
  const title = item.title ?? '?';
  const tagline = item.tagline ?? '';
  const lines = [
    chalk.yellow.bold(title),
    ...(tagline ? [chalk.italic(tagline)] : []),
    '',
    chalk.cyan('Type:     ') + fmtType(item),
    chalk.cyan('Year:     ') + fmtYear(item),
    chalk.cyan('Duration: ') + fmtDuration(item.duration),
  ];
  if (item.contentRating) lines.push(chalk.cyan('Rating:   ') + item.contentRating);
  if (item.audienceRating) lines.push(chalk.cyan('Audience: ') + parseFloat(item.audienceRating).toFixed(1));
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

  const cast = (item.Role ?? []).slice(0, 6).map((r) => r.tag).join(', ');
  if (cast) lines.push(chalk.cyan('Cast:     ') + cast);

  const border = '─'.repeat(60);
  console.log('\n' + chalk.cyan(border));
  lines.forEach((l) => console.log('  ' + l));
  console.log(chalk.cyan(border) + '\n');
}

// ---------------------------------------------------------------------------
// Simple helpers
// ---------------------------------------------------------------------------

export function printError(msg) {
  console.error(chalk.red.bold('Error: ') + msg);
}

export function printSuccess(msg) {
  console.log(chalk.green.bold('✓ ') + msg);
}

export function printInfo(msg) {
  console.log(chalk.dim(msg));
}

export function printHeader(title) {
  console.log('\n' + chalk.cyan.bold('─── ' + title + ' ───') + '\n');
}

export function progressBar(offset, duration, width = 40) {
  const pct = duration > 0 ? Math.min(1, offset / duration) : 0;
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const bar = chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  const elapsed = fmtDuration(offset);
  const total = fmtDuration(duration);
  return `${elapsed} ${bar} ${total} (${Math.round(pct * 100)}%)`;
}
