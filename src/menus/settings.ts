/**
 * Server info and profile management menus.
 */

import inquirer from 'inquirer';
import Table from 'cli-table3';
import chalk from 'chalk';
import { printError, printSuccess, printHeader } from '../display.js';
import type { PlexClient } from '../api.js';
import type { Config } from '../config.js';

export async function runServerInfo(client: PlexClient): Promise<void> {
  printHeader('Server Info');
  let info: Record<string, unknown>;
  try {
    info = await client.serverInfo();
  } catch (err: unknown) {
    printError((err as Error).message);
    return;
  }

  const table = new Table({ style: { head: ['cyan'] } });
  const fields: Array<[string, string]> = [
    ['Friendly name', 'friendlyName'],
    ['Machine identifier', 'machineIdentifier'],
    ['Platform', 'platform'],
    ['Platform version', 'platformVersion'],
    ['Version', 'version'],
    ['My Plex username', 'myPlexUsername'],
  ];
  for (const [label, key] of fields) {
    const val = info[key];
    if (val != null && val !== '') table.push([chalk.cyan(label), String(val)]);
  }
  console.log(table.toString());
  await inquirer.prompt([{ type: 'input', name: '_', message: 'Press Enter to return…' }]);
}

export async function runProfileManager(config: Config): Promise<void> {
  while (true) {
    printHeader('Profiles');
    const profiles = config.listProfiles();
    const defaultProfile = config.defaultProfile;

    type ActionValue = { action: 'select'; name: string } | { action: 'add' | 'delete' | 'back' };
    const choices: Array<{ name: string; value: ActionValue } | ReturnType<typeof inquirer.Separator>> = [
      ...profiles.map((name) => ({
        name: `  ${name}${name === defaultProfile ? ' [default]' : ''}`,
        value: { action: 'select' as const, name },
      })),
      new inquirer.Separator(),
      { name: '➕ Add profile', value: { action: 'add' as const } },
      { name: '🗑  Delete profile', value: { action: 'delete' as const } },
      { name: '← Back', value: { action: 'back' as const } },
    ];

    const { result } = await inquirer.prompt<{ result: ActionValue }>([
      { type: 'list', name: 'result', message: 'Profiles:', choices },
    ]);

    if (result.action === 'back') break;

    if (result.action === 'select') {
      config.setDefaultProfile(result.name);
      printSuccess(`Default profile set to '${result.name}'.`);

    } else if (result.action === 'add') {
      const answers = await inquirer.prompt<{ name: string; url: string; token: string }>([
        { type: 'input', name: 'name', message: 'Profile name:' },
        { type: 'input', name: 'url', message: 'Plex server URL (e.g. http://192.168.1.10:32400):' },
        { type: 'password', name: 'token', message: 'Plex token:', mask: '*' },
      ]);
      if (answers.name && answers.url && answers.token) {
        config.saveProfile(answers.name, answers.url, answers.token);
        printSuccess(`Profile '${answers.name}' saved.`);
      }

    } else if (result.action === 'delete') {
      if (!profiles.length) continue;
      const { toDelete } = await inquirer.prompt<{ toDelete: string | null }>([
        {
          type: 'list',
          name: 'toDelete',
          message: 'Delete which profile?',
          choices: [
            ...profiles.map((p) => ({ name: p, value: p })),
            { name: '← Cancel', value: null },
          ],
        },
      ]);
      if (toDelete) {
        config.deleteProfile(toDelete);
        printSuccess(`Profile '${toDelete}' deleted.`);
      }
    }
  }
}
