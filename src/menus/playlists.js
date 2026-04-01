/**
 * Playlists menu.
 */

import inquirer from 'inquirer';
import { mediaTable, printError, printSuccess, printInfo, printHeader } from '../display.js';
import { runMediaMenu } from './media.js';

export async function runPlaylistsMenu(client) {
  while (true) {
    printHeader('Playlists');
    let playlists;
    try {
      playlists = await client.playlists();
    } catch (err) {
      printError(err.message);
      return;
    }

    const choices = [
      ...playlists.map((p) => ({
        name: `${p.title ?? '?'} (${p.leafCount ?? 0} items)`,
        value: p,
      })),
      new inquirer.Separator(),
      { name: '➕ Create new playlist', value: '__create__' },
      { name: '← Back', value: '__back__' },
    ];

    const { chosen } = await inquirer.prompt([
      { type: 'list', name: 'chosen', message: 'Select a playlist:', choices },
    ]);

    if (chosen === '__back__' || chosen === null) break;

    if (chosen === '__create__') {
      const { title } = await inquirer.prompt([
        { type: 'input', name: 'title', message: 'Playlist name:' },
      ]);
      if (title.trim()) {
        try {
          await client.createPlaylist(title.trim());
          printSuccess(`Created playlist '${title}'.`);
        } catch (err) {
          printError(err.message);
        }
      }
      continue;
    }

    // Show playlist items
    printHeader(`Playlist: ${chosen.title}`);
    let items;
    try {
      items = await client.playlistItems(chosen.key ?? '');
    } catch (err) {
      printError(err.message);
      continue;
    }

    if (!items.length) {
      printInfo('Playlist is empty.');
      continue;
    }

    mediaTable(items, chosen.title);

    const { selected } = await inquirer.prompt([
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
