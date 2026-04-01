/**
 * Player view – live progress bar and keyboard controls.
 */

import readline from 'readline';
import { progressBar } from '../display';
import type { PlexClient } from '../api';
import type { PlexTimeline } from '../types';

const POLL_INTERVAL = 2000;

/**
 * Run an interactive player view in the current terminal.
 * Keys: p=pause/play, s=stop, left/right=seek ±30s, up/down=volume, q=quit.
 */
export async function runPlayerView(
  client: PlexClient,
  clientAddress: string,
  clientPort: string,
  initialTimeline: PlexTimeline = {}
): Promise<void> {
  if (!process.stdin.isTTY) {
    console.log('Player view requires an interactive terminal.');
    return;
  }

  const timeline: PlexTimeline = { ...initialTimeline };
  let polling = false;

  // Poll timeline in background
  const pollTimer = setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      const tl = await client.getTimeline(clientAddress, clientPort);
      if (tl && Object.keys(tl).length) Object.assign(timeline, tl);
    } catch {
      // ignore poll errors
    } finally {
      polling = false;
    }
  }, POLL_INTERVAL);

  let drawn = false;

  function render(): void {
    if (drawn) process.stdout.write('\x1B[4A\x1B[0J');
    drawn = true;

    const gpTitle = timeline.grandparentTitle ?? timeline.parentTitle ?? '';
    const epTitle = timeline.title ?? 'No media';
    const fullTitle = gpTitle ? `${gpTitle} – ${epTitle}` : epTitle;
    const state = timeline.state ?? 'stopped';
    const stateIcon: Record<string, string> = {
      playing: '▶', paused: '⏸', stopped: '⏹', buffering: '⏳',
    };
    const icon = stateIcon[state] ?? '?';
    const offset = parseInt(String(timeline.viewOffset ?? 0), 10);
    const duration = parseInt(String(timeline.duration ?? 0), 10);
    const bar = progressBar(offset, duration, 44);

    const lines = [
      `  ${icon}  ${fullTitle}`,
      `  ${bar}`,
      `  [p] Play/Pause   [s] Stop   [←] -30s   [→] +30s   [↑/↓] Volume   [q] Quit`,
      '',
    ];
    process.stdout.write(lines.join('\n'));
  }

  render();

  const renderTimer = setInterval(render, 1000);

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  await new Promise<void>((resolve) => {
    const keypressHandler = async (_str: string, key: { name: string; ctrl?: boolean; sequence?: string }) => {
      const k = key?.name ?? _str;

      if (k === 'q' || (key?.ctrl && k === 'c')) {
        cleanup();
        resolve();
        return;
      }

      try {
        if (k === 'p' || k === 'space') {
          const cmd = timeline.state === 'playing' ? 'pause' : 'play';
          await client.playerCommand(clientAddress, clientPort, cmd);
        } else if (k === 's') {
          await client.playerCommand(clientAddress, clientPort, 'stop');
        } else if (k === 'right') {
          const offset = parseInt(String(timeline.viewOffset ?? 0), 10) + 30_000;
          await client.playerCommand(clientAddress, clientPort, 'seekTo', { offset });
        } else if (k === 'left') {
          const offset = Math.max(0, parseInt(String(timeline.viewOffset ?? 0), 10) - 30_000);
          await client.playerCommand(clientAddress, clientPort, 'seekTo', { offset });
        } else if (k === 'up') {
          await client.playerCommand(clientAddress, clientPort, 'stepUp');
        } else if (k === 'down') {
          await client.playerCommand(clientAddress, clientPort, 'stepDown');
        }
      } catch {
        // swallow errors so the view stays open
      }
    };

    process.stdin.on('keypress', keypressHandler);

    function cleanup(): void {
      process.stdin.off('keypress', keypressHandler);
      clearInterval(pollTimer);
      clearInterval(renderTimer);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      console.log('\n');
    }
  });
}
