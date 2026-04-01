/**
 * Client sub-menu – playback controls and live player view.
 */

import inquirer from 'inquirer';
import { printError, printSuccess, printInfo, printHeader, fmtDuration } from '../display';
import { runPlayerView } from './player';
import type { PlexClient } from '../api';
import type { PlexClientDevice } from '../types';

export async function runClientMenu(client: PlexClient, plexClient: PlexClientDevice): Promise<void> {
  const name = plexClient.name ?? plexClient.title ?? '?';
  const address = plexClient.address ?? '127.0.0.1';
  const port = String(plexClient.port ?? '32433');

  while (true) {
    printHeader(`Client: ${name}`);
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Open live player view (progress bar + controls)', value: 'player' },
          { name: 'Play / Resume', value: 'play' },
          { name: 'Pause', value: 'pause' },
          { name: 'Stop', value: 'stop' },
          { name: 'Skip forward 30 s', value: 'fwd' },
          { name: 'Skip back 30 s', value: 'rew' },
          { name: 'Jump to position', value: 'seek' },
          { name: 'Volume up', value: 'volup' },
          { name: 'Volume down', value: 'voldown' },
          { name: 'Skip to next item', value: 'next' },
          { name: 'Skip to previous item', value: 'prev' },
          { name: 'Show timeline / current state', value: 'timeline' },
          new inquirer.Separator(),
          { name: '← Back', value: 'back' },
        ],
      },
    ]);

    if (action === 'back') break;

    if (action === 'player') {
      let tl = {};
      try { tl = await client.getTimeline(address, port); } catch { /* ok */ }
      await runPlayerView(client, address, port, tl);

    } else if (action === 'play') {
      try { await client.playerCommand(address, port, 'play'); printSuccess('▶ Play sent.'); }
      catch (err: unknown) { printError((err as Error).message); }

    } else if (action === 'pause') {
      try { await client.playerCommand(address, port, 'pause'); printSuccess('⏸ Pause sent.'); }
      catch (err: unknown) { printError((err as Error).message); }

    } else if (action === 'stop') {
      try { await client.playerCommand(address, port, 'stop'); printSuccess('⏹ Stop sent.'); }
      catch (err: unknown) { printError((err as Error).message); }

    } else if (action === 'fwd') {
      try {
        const tl = await client.getTimeline(address, port);
        const offset = parseInt(String(tl.viewOffset ?? 0), 10) + 30_000;
        await client.playerCommand(address, port, 'seekTo', { offset });
        printSuccess(`⏭ Jumped to ${fmtDuration(offset)}.`);
      } catch (err: unknown) { printError((err as Error).message); }

    } else if (action === 'rew') {
      try {
        const tl = await client.getTimeline(address, port);
        const offset = Math.max(0, parseInt(String(tl.viewOffset ?? 0), 10) - 30_000);
        await client.playerCommand(address, port, 'seekTo', { offset });
        printSuccess(`⏮ Jumped to ${fmtDuration(offset)}.`);
      } catch (err: unknown) { printError((err as Error).message); }

    } else if (action === 'seek') {
      const { timeStr } = await inquirer.prompt<{ timeStr: string }>([
        {
          type: 'input',
          name: 'timeStr',
          message: 'Enter position (e.g. 1:23:45  or  83:45  or  5025 seconds):',
        },
      ]);
      if (!timeStr) continue;
      try {
        const offsetMs = parseTime(timeStr);
        await client.playerCommand(address, port, 'seekTo', { offset: offsetMs });
        printSuccess(`Seeked to ${fmtDuration(offsetMs)}.`);
      } catch (err: unknown) { printError((err as Error).message); }

    } else if (action === 'volup') {
      try { await client.playerCommand(address, port, 'stepUp'); printSuccess('🔊 Volume up.'); }
      catch (err: unknown) { printError((err as Error).message); }

    } else if (action === 'voldown') {
      try { await client.playerCommand(address, port, 'stepDown'); printSuccess('🔉 Volume down.'); }
      catch (err: unknown) { printError((err as Error).message); }

    } else if (action === 'next') {
      try { await client.playerCommand(address, port, 'skipNext'); printSuccess('⏭ Skipped to next.'); }
      catch (err: unknown) { printError((err as Error).message); }

    } else if (action === 'prev') {
      try { await client.playerCommand(address, port, 'skipPrevious'); printSuccess('⏮ Skipped to previous.'); }
      catch (err: unknown) { printError((err as Error).message); }

    } else if (action === 'timeline') {
      try {
        const tl = await client.getTimeline(address, port);
        if (!tl || !Object.keys(tl).length) { printInfo('No active playback.'); continue; }
        const gp = tl.grandparentTitle ?? tl.parentTitle ?? '';
        const ep = tl.title ?? '';
        const full = gp ? `${gp} – ${ep}` : ep;
        const offset = parseInt(String(tl.viewOffset ?? 0), 10);
        const duration = parseInt(String(tl.duration ?? 0), 10);
        console.log(`\n  ${full}`);
        console.log(`  State: ${tl.state ?? '?'}   Position: ${fmtDuration(offset)} / ${fmtDuration(duration)}\n`);
      } catch (err: unknown) { printError((err as Error).message); }
      await inquirer.prompt([{ type: 'input', name: '_', message: 'Press Enter to continue…' }]);
    }
  }
}

export function parseTime(s: string): number {
  s = s.trim();
  if (s.includes(':')) {
    const parts = s.split(':').map(Number);
    if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
    if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    throw new Error(`Cannot parse time: ${s}`);
  }
  const n = parseInt(s, 10);
  if (isNaN(n)) throw new Error(`Cannot parse time: ${s}`);
  return n * 1000;
}
