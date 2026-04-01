#!/usr/bin/env node
/**
 * plex-cli – interactive and scriptable Plex Media Server CLI.
 *
 * Interactive mode:
 *   plex-cli
 *
 * Scriptable sub-commands:
 *   plex-cli search "Inception"
 *   plex-cli clients
 *   plex-cli sessions
 *   plex-cli on-deck
 *   plex-cli recently-added
 *   plex-cli libraries
 *   plex-cli playlists
 *   plex-cli server-info
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';

import { PlexClient, PlexAPIError } from './api.js';
import { Config } from './config.js';
import {
  mediaTable,
  clientTable,
  sessionTable,
  printError,
  printSuccess,
  printInfo,
} from './display.js';

// Menus (loaded lazily for faster --help)
async function menus() {
  const [search, libs, pl, sess, settings] = await Promise.all([
    import('./menus/search.js'),
    import('./menus/libraries.js'),
    import('./menus/playlists.js'),
    import('./menus/sessions.js'),
    import('./menus/settings.js'),
  ]);
  return { search, libs, pl, sess, settings };
}

const VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------

function resolveClient(opts, config) {
  const url = opts.url ?? process.env.PLEX_URL;
  const token = opts.token ?? process.env.PLEX_TOKEN;
  if (url && token) return new PlexClient(url, token);

  if (opts.profile) {
    const p = config.getProfile(opts.profile);
    if (!p) { printError(`Profile '${opts.profile}' not found.`); return null; }
    return new PlexClient(p.url, p.token);
  }

  const active = config.activeProfile();
  if (active) return new PlexClient(active.url, active.token);
  return null;
}

function requireClient(opts, config) {
  const c = resolveClient(opts, config);
  if (!c) {
    printError(
      'No credentials found. Use --url and --token flags, ' +
      'set PLEX_URL / PLEX_TOKEN env vars, or run without arguments to configure interactively.'
    );
    process.exit(1);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Interactive menu
// ---------------------------------------------------------------------------

async function runInteractive(client, config) {
  const { search, libs, pl, sess, settings } = await menus();

  console.log(
    '\n' + chalk.cyan.bold('┌─────────────────────────────┐') +
    '\n' + chalk.cyan.bold('│      🎬  plex-cli  v' + VERSION + '      │') +
    '\n' + chalk.cyan.bold('└─────────────────────────────┘') + '\n'
  );

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Main Menu',
        choices: [
          { name: '🔍 Search media', value: 'search_media' },
          { name: '📡 Clients', value: 'clients' },
          { name: '📚 Browse libraries', value: 'libraries' },
          { name: '▶  On Deck (continue watching)', value: 'on_deck' },
          { name: '🆕 Recently Added', value: 'recently_added' },
          { name: '📋 Playlists', value: 'playlists' },
          { name: '📺 Active Sessions', value: 'sessions' },
          { name: 'ℹ️  Server Info', value: 'server_info' },
          new inquirer.Separator(),
          { name: '⚙️  Manage profiles', value: 'profiles' },
          new inquirer.Separator(),
          { name: '🚪 Quit', value: 'quit' },
        ],
      },
    ]);

    if (action === 'quit') { console.log(chalk.dim('Goodbye!')); break; }

    if (action === 'search_media')   await search.runSearchMedia(client);
    else if (action === 'clients')   await search.runSearchClients(client);
    else if (action === 'libraries') await libs.runLibrariesMenu(client);
    else if (action === 'on_deck')   await sess.runOnDeckMenu(client);
    else if (action === 'recently_added') await sess.runRecentlyAddedMenu(client);
    else if (action === 'playlists') await pl.runPlaylistsMenu(client);
    else if (action === 'sessions')  await sess.runSessionsMenu(client);
    else if (action === 'server_info') await settings.runServerInfo(client);
    else if (action === 'profiles')  await settings.runProfileManager(config);
  }
}

async function interactiveConnect(config) {
  const profiles = config.listProfiles();

  if (!profiles.length) {
    console.log(
      chalk.cyan.bold('\nWelcome to plex-cli!\n') +
      'No profiles configured. You\'ll need your Plex server URL and token.\n' +
      chalk.dim('Find your token at: https://support.plex.tv/articles/204059436/\n')
    );
    const answers = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'Profile name (e.g. "home"):', default: 'home' },
      { type: 'input', name: 'url', message: 'Plex server URL (e.g. http://192.168.1.10:32400):' },
      { type: 'password', name: 'token', message: 'Plex token:', mask: '*' },
    ]);
    if (!answers.url || !answers.token) return null;
    config.saveProfile(answers.name || 'home', answers.url, answers.token);
    printSuccess(`Profile '${answers.name || 'home'}' saved.`);
    return new PlexClient(answers.url, answers.token);
  }

  if (profiles.length === 1) {
    const active = config.activeProfile();
    if (active) return new PlexClient(active.url, active.token);
  }

  const defaultProfile = config.defaultProfile;
  const { chosen } = await inquirer.prompt([
    {
      type: 'list',
      name: 'chosen',
      message: 'Select a profile:',
      choices: [
        ...profiles.map((p) => ({
          name: p + (p === defaultProfile ? ' (default)' : ''),
          value: p,
        })),
        { name: '← Cancel', value: null },
      ],
    },
  ]);
  if (!chosen) return null;
  const profile = config.getProfile(chosen);
  return profile ? new PlexClient(profile.url, profile.token) : null;
}

// ---------------------------------------------------------------------------
// CLI program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('plex-cli')
  .description('Interactive CLI for Plex Media Server')
  .version(VERSION, '-v, --version')
  .option('-u, --url <url>', 'Plex server URL')
  .option('-t, --token <token>', 'Plex token', process.env.PLEX_TOKEN)
  .option('-p, --profile <name>', 'Saved profile name')
  // Default action (no subcommand) = interactive mode
  .action(async (opts) => {
    const config = new Config();
    let client = resolveClient(opts, config);
    if (!client) {
      client = await interactiveConnect(config);
      if (!client) process.exit(1);
    }
    await runInteractive(client, config);
  });

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

program
  .command('search <query>')
  .description('Search for media across all libraries')
  .option('-n, --limit <n>', 'Max results', '20')
  .action(async (query, opts, cmd) => {
    const config = new Config();
    const client = requireClient(cmd.parent.opts(), config);
    try {
      const results = await client.search(query, parseInt(opts.limit, 10));
      if (!results.length) { printInfo('No results found.'); return; }
      mediaTable(results, `Results for "${query}"`);
    } catch (err) {
      printError(err.message); process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// clients
// ---------------------------------------------------------------------------

program
  .command('clients')
  .description('List all available Plex clients')
  .action(async (opts, cmd) => {
    const config = new Config();
    const client = requireClient(cmd.parent.opts(), config);
    try {
      const result = await client.clients();
      if (!result.length) { printInfo('No clients found.'); return; }
      clientTable(result);
    } catch (err) {
      printError(err.message); process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

program
  .command('sessions')
  .description('Show currently active playback sessions')
  .action(async (opts, cmd) => {
    const config = new Config();
    const client = requireClient(cmd.parent.opts(), config);
    try {
      const result = await client.sessions();
      if (!result.length) { printInfo('No active sessions.'); return; }
      sessionTable(result);
    } catch (err) {
      printError(err.message); process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// on-deck
// ---------------------------------------------------------------------------

program
  .command('on-deck')
  .description('Show On Deck items (continue watching)')
  .option('-n, --limit <n>', 'Max results', '20')
  .action(async (opts, cmd) => {
    const config = new Config();
    const client = requireClient(cmd.parent.opts(), config);
    try {
      const items = (await client.onDeck()).slice(0, parseInt(opts.limit, 10));
      if (!items.length) { printInfo('Nothing on deck.'); return; }
      mediaTable(items, 'On Deck');
    } catch (err) {
      printError(err.message); process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// recently-added
// ---------------------------------------------------------------------------

program
  .command('recently-added')
  .description('Show recently added items')
  .option('-n, --limit <n>', 'Max results', '20')
  .action(async (opts, cmd) => {
    const config = new Config();
    const client = requireClient(cmd.parent.opts(), config);
    try {
      const items = await client.recentlyAdded(parseInt(opts.limit, 10));
      if (!items.length) { printInfo('Nothing recently added.'); return; }
      mediaTable(items, 'Recently Added');
    } catch (err) {
      printError(err.message); process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// libraries
// ---------------------------------------------------------------------------

program
  .command('libraries')
  .description('List all library sections')
  .action(async (opts, cmd) => {
    const config = new Config();
    const client = requireClient(cmd.parent.opts(), config);
    try {
      const libs = await client.libraries();
      const table = new Table({
        head: ['#', 'Title', 'Type', 'Key'],
        style: { head: ['cyan'] },
      });
      libs.forEach((l, i) => table.push([String(i + 1), l.title ?? '?', l.type ?? '?', l.key ?? '']));
      console.log('\n' + chalk.cyan.bold('Libraries'));
      console.log(table.toString());
    } catch (err) {
      printError(err.message); process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// playlists
// ---------------------------------------------------------------------------

program
  .command('playlists')
  .description('List all playlists')
  .action(async (opts, cmd) => {
    const config = new Config();
    const client = requireClient(cmd.parent.opts(), config);
    try {
      const pls = await client.playlists();
      if (!pls.length) { printInfo('No playlists found.'); return; }
      const table = new Table({
        head: ['#', 'Title', 'Type', 'Items'],
        style: { head: ['cyan'] },
      });
      pls.forEach((p, i) =>
        table.push([String(i + 1), p.title ?? '?', p.playlistType ?? '?', String(p.leafCount ?? '')])
      );
      console.log('\n' + chalk.cyan.bold('Playlists'));
      console.log(table.toString());
    } catch (err) {
      printError(err.message); process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// server-info
// ---------------------------------------------------------------------------

program
  .command('server-info')
  .description('Show server info and capabilities')
  .action(async (opts, cmd) => {
    const config = new Config();
    const client = requireClient(cmd.parent.opts(), config);
    try {
      const info = await client.serverInfo();
      const table = new Table({ style: { head: [] } });
      for (const [k, v] of Object.entries(info)) {
        if (typeof v !== 'object' && v != null && v !== '') {
          table.push([chalk.cyan(k), String(v)]);
        }
      }
      console.log(table.toString());
    } catch (err) {
      printError(err.message); process.exit(1);
    }
  });

program.parseAsync(process.argv);
