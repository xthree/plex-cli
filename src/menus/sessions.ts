/**
 * Sessions, On Deck, and Recently Added menus.
 */

import inquirer from 'inquirer';
import { sessionTable, mediaTable, printError, printInfo, printHeader } from '../display';
import { runMediaMenu } from './media';
import type { PlexClient } from '../api';
import type { PlexItem } from '../types';

export async function runSessionsMenu(client: PlexClient): Promise<void> {
  printHeader('Active Sessions');
  try {
    const sessions = await client.sessions();
    if (!sessions.length) { printInfo('No active sessions.'); return; }
    sessionTable(sessions);
  } catch (err: unknown) {
    printError((err as Error).message);
    return;
  }
  await inquirer.prompt([{ type: 'input', name: '_', message: 'Press Enter to return…' }]);
}

export async function runOnDeckMenu(client: PlexClient): Promise<void> {
  printHeader('On Deck');
  let items: PlexItem[];
  try {
    items = await client.onDeck();
  } catch (err: unknown) {
    printError((err as Error).message);
    return;
  }
  if (!items.length) { printInfo('Nothing on deck.'); return; }

  mediaTable(items, 'On Deck');
  const { chosen } = await inquirer.prompt<{ chosen: PlexItem | null }>([
    {
      type: 'list',
      name: 'chosen',
      message: 'Select an item:',
      choices: [
        ...items.map((it) => ({
          name: [it.grandparentTitle, it.title].filter(Boolean).join(' – ') || '?',
          value: it,
        })),
        { name: '← Back', value: null },
      ],
    },
  ]);
  if (chosen) await runMediaMenu(client, chosen);
}

export async function runRecentlyAddedMenu(client: PlexClient): Promise<void> {
  printHeader('Recently Added');
  let items: PlexItem[];
  try {
    items = await client.recentlyAdded();
  } catch (err: unknown) {
    printError((err as Error).message);
    return;
  }
  if (!items.length) { printInfo('Nothing recently added.'); return; }

  mediaTable(items, 'Recently Added');
  const { chosen } = await inquirer.prompt<{ chosen: PlexItem | null }>([
    {
      type: 'list',
      name: 'chosen',
      message: 'Select an item:',
      choices: [
        ...items.map((it) => ({ name: it.title ?? '?', value: it })),
        { name: '← Back', value: null },
      ],
    },
  ]);
  if (chosen) await runMediaMenu(client, chosen);
}
