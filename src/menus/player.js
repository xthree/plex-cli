/**
 * Player view – live progress bar and keyboard controls.
 */

import readline from 'readline';
import { fmtDuration, progressBar, printSuccess, printError } from '../display.js';
import { PlexAPIError } from '../api.js';

const POLL_INTERVAL = 2000;

/**
 * Run an interactive player view in the current terminal.
 * Keys: p=pause/play, s=stop, left/right=seek ±30s, up/down=volume, q=quit.
 *
 * @param {import('../api.js').PlexClient} client
 * @param {string} clientAddress
 * @param {string} clientPort
 * @param {object} [initialTimeline={}]
 */
export async function runPlayerView(client, clientAddress, clientPort, initialTimeline = {}) {
  if (!process.stdin.isTTY) {
    console.log('Player view requires an interactive terminal.');
    return;
  }

  const timeline = { ...initialTimeline };

  // Poll timeline in background
  const pollTimer = setInterval(async () => {
    try {
      const tl = await client.getTimeline(clientAddress, clientPort);
      if (tl && Object.keys(tl).length) Object.assign(timeline, tl);
    } catch {
      // ignore poll errors
    }
  }, POLL_INTERVAL);

  function render() {
    // Move cursor up to overwrite previous output (3 lines)
    if (render._drawn) process.stdout.write('\x1B[4A\x1B[0J');
    render._drawn = true;

    const gpTitle = timeline.grandparentTitle ?? timeline.parentTitle ?? '';
    const epTitle = timeline.title ?? 'No media';
    const fullTitle = gpTitle ? `${gpTitle} – ${epTitle}` : epTitle;
    const state = timeline.state ?? 'stopped';
    const stateIcon = { playing: '▶', paused: '⏸', stopped: '⏹', buffering: '⏳' }[state] ?? '?';
    const offset = parseInt(timeline.viewOffset ?? 0, 10);
    const duration = parseInt(timeline.duration ?? 0, 10);

    const bar = progressBar(offset, duration, 44);

    const lines = [
      `  ${stateIcon}  ${fullTitle}`,
      `  ${bar}`,
      `  [p] Play/Pause   [s] Stop   [←] -30s   [→] +30s   [↑/↓] Volume   [q] Quit`,
      '',
    ];
    process.stdout.write(lines.join('\n'));
  }

  render._drawn = false;
  render();

  const renderTimer = setInterval(render, 1000);

  // Read raw keystrokes
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  await new Promise((resolve) => {
    process.stdin.on('keypress', async (str, key) => {
      const k = key?.name ?? str;
      const seq = key?.sequence ?? '';

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
          const offset = parseInt(timeline.viewOffset ?? 0, 10) + 30000;
          await client.playerCommand(clientAddress, clientPort, 'seekTo', { offset });
        } else if (k === 'left') {
          const offset = Math.max(0, parseInt(timeline.viewOffset ?? 0, 10) - 30000);
          await client.playerCommand(clientAddress, clientPort, 'seekTo', { offset });
        } else if (k === 'up') {
          await client.playerCommand(clientAddress, clientPort, 'stepUp');
        } else if (k === 'down') {
          await client.playerCommand(clientAddress, clientPort, 'stepDown');
        }
      } catch (err) {
        // Swallow errors during playback so the view stays open
      }
    });
  });

  function cleanup() {
    clearInterval(pollTimer);
    clearInterval(renderTimer);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    console.log('\n');
  }
}
