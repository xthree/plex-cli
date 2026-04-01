/**
 * Playlists menu.
 */

import inquirer from 'inquirer';
import { mediaTable, printError, printSuccess, printInfo, printHeader } from '../display.js';
import { runMediaMenu } from './media.js';
import type { PlexClient } from '../api.js';
import type { PlexItem, PlexPlaylist } from '../types.js';

export async function runPlaylistsMenu(client: PlexClient): Promise<void> {
  while (true) {
    printHeader('Playlists');
    let playlists: PlexPlaylist[];
    try {
      playlists = await client.playlists();
    } catch (err: unknown) {
      printError((err as Error).message);
      return;
    }

    type ChoiceValue = PlexPlaylist | '__create__' | '__back__';
    const choices: Array<{ name: string; value: ChoiceValue } | ReturnType<typeof inquirer.Separator>> = [
      ...playlists.map((p) => ({
        name: `${p.title ?? '?'} (${p.leafCount ?? 0} items)`,
        value: p as ChoiceValue,
      })),
      new inquirer.Separator(),
      { name: '➕ Create new playlist', value: '__create__' as ChoiceValue },
      { name: '← Back', value: '__back__' as ChoiceValue },
    ];

    const { chosen } = await inquirer.prompt<{ chosen: ChoiceValue }>([
      { type: 'list', name: 'chosen', message: 'Select a playlist:', choices },
    ]);

    if (chosen === '__back__') break;

    if (chosen === '__create__') {
      const { title } = await inquirer.prompt<{ title: string }>([
        { type: 'input', name: 'title', message: 'Playlist name:' },
      ]);
      if (title.trim()) {
        try {
          await client.createPlaylist(title.trim());
          printSuccess(`Created playlist '${title}'.`);
        } catch (err: unknown) {
          printError((err as Error).message);
        }
      }
      continue;
    }

    const playlist = chosen as PlexPlaylist;
    printHeader(`Playlist: ${playlist.title}`);
    let items: PlexItem[];
    try {
      items = await client.playlistItems(playlist.key ?? '');
    } catch (err: unknown) {
      printError((err as Error).message);
      continue;
    }

    if (!items.length) {
      printInfo('Playlist is empty.');
      continue;
    }

    mediaTable(items, playlist.title ?? '');

    const { selected } = await inquirer.prompt<{ selected: PlexItem | null }>([
      {
        type: 'list',
        name: 'selected',
        message: 'Select an item to open:',
        choices: [
          ...items.map((it) => ({ name: it.title ?? '?', value: it })),
          { name: '← Back', value: null },
        ],
      },
    ]);
    if (selected) await runMediaMenu(client, selected);
  }
}
