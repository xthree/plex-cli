/**
 * Media item sub-menu.
 */

import inquirer from 'inquirer';
import {
  metadataPanel,
  mediaTable,
  printError,
  printSuccess,
  printInfo,
  printHeader,
} from '../display';
import type { PlexClient } from '../api';
import type { PlexItem, PlexClientDevice } from '../types';

async function chooseClient(client: PlexClient): Promise<PlexClientDevice | null> {
  let clients: PlexClientDevice[];
  try {
    clients = await client.clients();
  } catch (err: unknown) {
    printError((err as Error).message);
    return null;
  }
  if (!clients.length) {
    printError('No clients found. Make sure a Plex player is open.');
    return null;
  }
  const { chosen } = await inquirer.prompt<{ chosen: PlexClientDevice | null }>([
    {
      type: 'list',
      name: 'chosen',
      message: 'Choose a client:',
      choices: [
        ...clients.map((c) => ({ name: c.name ?? c.title ?? '?', value: c })),
        { name: '← Cancel', value: null },
      ],
    },
  ]);
  return chosen;
}

export async function runMediaMenu(client: PlexClient, item: PlexItem): Promise<void> {
  const title = item.title ?? '?';
  const ratingKey = item.ratingKey ?? '';

  while (true) {
    printHeader(`Media: ${title}`);
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'View metadata', value: 'meta' },
          { name: 'Browse children (seasons / episodes / tracks)', value: 'children' },
          { name: 'Play on a client', value: 'play' },
          { name: 'Mark as watched', value: 'watched' },
          { name: 'Mark as unwatched', value: 'unwatched' },
          { name: 'Add to playlist', value: 'playlist' },
          { name: 'Show similar / related', value: 'similar' },
          { name: 'Show extras (trailers, featurettes)', value: 'extras' },
          new inquirer.Separator(),
          { name: '← Back', value: 'back' },
        ],
      },
    ]);

    if (action === 'back') break;

    if (action === 'meta') {
      try {
        const full = await client.metadata(ratingKey);
        metadataPanel(full);
      } catch (err: unknown) {
        printError((err as Error).message);
      }
      await pressAnyKey();

    } else if (action === 'children') {
      try {
        const kids = await client.children(ratingKey);
        if (!kids.length) { printInfo('No children found.'); continue; }
        mediaTable(kids, `Children of ${title}`);
        const { chosen } = await inquirer.prompt<{ chosen: PlexItem | null }>([
          {
            type: 'list',
            name: 'chosen',
            message: 'Select an item (or back):',
            choices: [
              ...kids.map((k) => ({ name: k.title ?? '?', value: k })),
              { name: '← Back', value: null },
            ],
          },
        ]);
        if (chosen) await runMediaMenu(client, chosen);
      } catch (err: unknown) {
        printError((err as Error).message);
      }

    } else if (action === 'play') {
      const chosenClient = await chooseClient(client);
      if (!chosenClient) continue;
      try {
        await client.playMedia(
          chosenClient.address ?? '',
          String(chosenClient.port ?? '32433'),
          ratingKey
        );
        printSuccess(`Sent play command to ${chosenClient.name ?? '?'}`);
      } catch (err: unknown) {
        printError((err as Error).message);
      }

    } else if (action === 'watched') {
      try {
        await client.markWatched(ratingKey);
        printSuccess('Marked as watched.');
      } catch (err: unknown) {
        printError((err as Error).message);
      }

    } else if (action === 'unwatched') {
      try {
        await client.markUnwatched(ratingKey);
        printSuccess('Marked as unwatched.');
      } catch (err: unknown) {
        printError((err as Error).message);
      }

    } else if (action === 'playlist') {
      try {
        const playlists = await client.playlists();
        if (!playlists.length) { printInfo('No playlists found.'); continue; }
        const { chosen } = await inquirer.prompt<{ chosen: PlexItem | null }>([
          {
            type: 'list',
            name: 'chosen',
            message: 'Add to which playlist?',
            choices: [
              ...playlists.map((p) => ({ name: p.title ?? '?', value: p })),
              { name: '← Cancel', value: null },
            ],
          },
        ]);
        if (!chosen) continue;
        await client.addToPlaylist(chosen.ratingKey ?? '', ratingKey);
        printSuccess(`Added to '${chosen.title}'.`);
      } catch (err: unknown) {
        printError((err as Error).message);
      }

    } else if (action === 'similar') {
      try {
        const similar = await client.similar(ratingKey);
        if (!similar.length) { printInfo('No similar items found.'); continue; }
        mediaTable(similar, 'Similar');
      } catch (err: unknown) {
        printError((err as Error).message);
      }
      await pressAnyKey();

    } else if (action === 'extras') {
      try {
        const extras = await client.extras(ratingKey);
        if (!extras.length) { printInfo('No extras found.'); continue; }
        mediaTable(extras, 'Extras');
      } catch (err: unknown) {
        printError((err as Error).message);
      }
      await pressAnyKey();
    }
  }
}

async function pressAnyKey(msg = 'Press Enter to continue…'): Promise<void> {
  await inquirer.prompt([{ type: 'input', name: '_', message: msg }]);
}
