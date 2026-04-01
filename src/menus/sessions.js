/**
 * Sessions, On Deck, and Recently Added menus.
 */

import inquirer from 'inquirer';
import { sessionTable, mediaTable, printError, printInfo, printHeader } from '../display.js';
import { runMediaMenu } from './media.js';

export async function runSessionsMenu(client) {
  printHeader('Active Sessions');
  let sessions;
  try {
    sessions = await client.sessions();
  } catch (err) {
    printError(err.message);
    return;
  }
  if (!sessions.length) {
    printInfo('No active sessions.');
    return;
  }
  sessionTable(sessions);
  await inquirer.prompt([{ type: 'input', name: '_', message: 'Press Enter to return…' }]);
}

export async function runOnDeckMenu(client) {
  printHeader('On Deck');
  let items;
  try {
    items = await client.onDeck();
  } catch (err) {
    printError(err.message);
    return;
  }
  if (!items.length) {
    printInfo('Nothing on deck.');
    return;
  }
  mediaTable(items, 'On Deck');

  const { chosen } = await inquirer.prompt([
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

export async function runRecentlyAddedMenu(client) {
  printHeader('Recently Added');
  let items;
  try {
    items = await client.recentlyAdded();
  } catch (err) {
    printError(err.message);
    return;
  }
  if (!items.length) {
    printInfo('Nothing recently added.');
    return;
  }
  mediaTable(items, 'Recently Added');

  const { chosen } = await inquirer.prompt([
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
