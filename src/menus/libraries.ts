/**
 * Libraries browser menu with pagination.
 */

import inquirer from 'inquirer';
import { mediaTable, printError, printInfo, printHeader } from '../display.js';
import { runMediaMenu } from './media.js';
import type { PlexClient } from '../api.js';
import type { PlexItem, PlexLibrary } from '../types.js';

const PAGE_SIZE = 20;

export async function runLibrariesMenu(client: PlexClient): Promise<void> {
  printHeader('Libraries');
  let libs: PlexLibrary[];
  try {
    libs = await client.libraries();
  } catch (err: unknown) {
    printError((err as Error).message);
    return;
  }

  if (!libs.length) {
    printInfo('No libraries found.');
    return;
  }

  const { chosen } = await inquirer.prompt<{ chosen: PlexLibrary | null }>([
    {
      type: 'list',
      name: 'chosen',
      message: 'Select a library:',
      choices: [
        ...libs.map((l) => ({ name: `${l.title ?? '?'} (${l.type ?? '?'})`, value: l })),
        { name: '← Back', value: null },
      ],
    },
  ]);
  if (chosen) await browseLibrary(client, chosen);
}

async function browseLibrary(client: PlexClient, lib: PlexLibrary): Promise<void> {
  const sectionKey = lib.key ?? '';
  const title = lib.title ?? '?';
  let offset = 0;

  while (true) {
    printHeader(`Library: ${title}`);
    let items: PlexItem[];
    let total: number;
    try {
      ({ items, total } = await client.libraryContents(sectionKey, { limit: PAGE_SIZE, offset }));
    } catch (err: unknown) {
      printError((err as Error).message);
      return;
    }

    if (!items.length) {
      printInfo('No items in this library.');
      return;
    }

    mediaTable(items, `${title}  (${offset + 1}–${offset + items.length} of ${total})`);

    type NavValue = PlexItem | '__prev__' | '__next__' | '__back__';
    const navChoices: Array<{ name: string; value: NavValue }> = items.map((it) => ({
      name: it.title ?? '?',
      value: it as NavValue,
    }));
    if (offset > 0) navChoices.unshift({ name: '← Previous page', value: '__prev__' });
    if (offset + items.length < total) navChoices.push({ name: 'Next page →', value: '__next__' });
    navChoices.push({ name: '← Back to libraries', value: '__back__' });

    const { chosen } = await inquirer.prompt<{ chosen: NavValue }>([
      { type: 'list', name: 'chosen', message: 'Select an item:', choices: navChoices },
    ]);

    if (chosen === '__back__') break;
    if (chosen === '__next__') { offset += PAGE_SIZE; continue; }
    if (chosen === '__prev__') { offset = Math.max(0, offset - PAGE_SIZE); continue; }
    await runMediaMenu(client, chosen as PlexItem);
  }
}
