/**
 * Search menus (media and clients).
 */

import inquirer from 'inquirer';
import { mediaTable, clientTable, printError, printInfo, printHeader } from '../display.js';
import { runMediaMenu } from './media.js';
import { runClientMenu } from './client.js';

export async function runSearchMedia(client) {
  printHeader('Search Media');
  const { query } = await inquirer.prompt([
    { type: 'input', name: 'query', message: 'Enter search query (blank to cancel):' },
  ]);
  if (!query.trim()) return;

  let results;
  try {
    results = await client.search(query);
  } catch (err) {
    printError(err.message);
    return;
  }

  if (!results.length) {
    printInfo('No results found.');
    return;
  }

  mediaTable(results, `Results for "${query}"`);

  const { chosen } = await inquirer.prompt([
    {
      type: 'list',
      name: 'chosen',
      message: 'Select an item:',
      choices: [
        ...results.map((r) => ({
          name: `${r.title ?? '?'} (${r.type ?? '?'}, ${r.year ?? ''})`,
          value: r,
        })),
        { name: '← Back', value: null },
      ],
    },
  ]);
  if (chosen) await runMediaMenu(client, chosen);
}

export async function runSearchClients(client) {
  printHeader('Clients');
  let clients;
  try {
    clients = await client.clients();
  } catch (err) {
    printError(err.message);
    return;
  }

  if (!clients.length) {
    printInfo('No clients found. Make sure a Plex player is running.');
    return;
  }

  clientTable(clients);

  const { chosen } = await inquirer.prompt([
    {
      type: 'list',
      name: 'chosen',
      message: 'Select a client:',
      choices: [
        ...clients.map((c) => ({ name: c.name ?? c.title ?? '?', value: c })),
        { name: '← Back', value: null },
      ],
    },
  ]);
  if (chosen) await runClientMenu(client, chosen);
}
