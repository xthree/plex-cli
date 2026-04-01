/**
 * Server info and profile management menus.
 */

import inquirer from 'inquirer';
import Table from 'cli-table3';
import chalk from 'chalk';
import { printError, printSuccess, printHeader } from '../display.js';

export async function runServerInfo(client) {
  printHeader('Server Info');
  let info;
  try {
    info = await client.serverInfo();
  } catch (err) {
    printError(err.message);
    return;
  }

  const table = new Table({ style: { head: ['cyan'] } });
  const fields = [
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

export async function runProfileManager(config) {
  while (true) {
    printHeader('Profiles');
    const profiles = config.listProfiles();
    const defaultProfile = config.defaultProfile;

    const choices = [
      ...profiles.map((name) => ({
        name: `  ${name}${name === defaultProfile ? ' [default]' : ''}`,
        value: { action: 'select', name },
      })),
      new inquirer.Separator(),
      { name: '➕ Add profile', value: { action: 'add' } },
      { name: '🗑  Delete profile', value: { action: 'delete' } },
      { name: '← Back', value: { action: 'back' } },
    ];

    const { result } = await inquirer.prompt([
      { type: 'list', name: 'result', message: 'Profiles:', choices },
    ]);

    if (result.action === 'back') break;

    if (result.action === 'select') {
      config.setDefaultProfile(result.name);
      printSuccess(`Default profile set to '${result.name}'.`);

    } else if (result.action === 'add') {
      const answers = await inquirer.prompt([
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
      const { toDelete } = await inquirer.prompt([
        {
          type: 'list',
          name: 'toDelete',
          message: 'Delete which profile?',
          choices: [...profiles.map((p) => ({ name: p, value: p })), { name: '← Cancel', value: null }],
        },
      ]);
      if (toDelete) {
        config.deleteProfile(toDelete);
        printSuccess(`Profile '${toDelete}' deleted.`);
      }
    }
  }
}
