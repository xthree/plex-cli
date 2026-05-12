#!/usr/bin/env node
/**
 * plex-cli – interactive and scriptable Plex Media Server CLI.
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';

import { PlexClient } from './api';
import { Config } from './config';
import {
  mediaTable,
  clientTable,
  sessionTable,
  printError,
  printSuccess,
  printInfo,
} from './display';
import type { Profile } from './types';

// Menus (imported lazily to keep --help fast)
async function loadMenus() {
  const [search, libs, pl, sess, settings, hass] = await Promise.all([
    import('./menus/search'),
    import('./menus/libraries'),
    import('./menus/playlists'),
    import('./menus/sessions'),
    import('./menus/settings'),
    import('./menus/hass'),
  ]);
  return { search, libs, pl, sess, settings, hass };
}

const VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------

function resolveClient(
  opts: { url?: string; token?: string; profile?: string },
  config: Config
): PlexClient | null {
  const url = opts.url ?? process.env['PLEX_URL'];
  const token = opts.token ?? process.env['PLEX_TOKEN'];
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

function requireClient(
  opts: { url?: string; token?: string; profile?: string },
  config: Config
): PlexClient {
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
// Interactive mode
// ---------------------------------------------------------------------------

async function runInteractive(client: PlexClient, config: Config): Promise<void> {
  const { search, libs, pl, sess, settings, hass } = await loadMenus();

  console.log(
    '\n' + chalk.cyan.bold('┌─────────────────────────────┐') +
    '\n' + chalk.cyan.bold('│      🎬  plex-cli  v' + VERSION + '      │') +
    '\n' + chalk.cyan.bold('└─────────────────────────────┘') + '\n'
  );

  while (true) {
    const { action } = await inquirer.prompt<{ action: string }>([
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
          { name: '🏠 Generate Home Assistant automation', value: 'ha_automation' },
          new inquirer.Separator(),
          { name: '⚙️  Manage profiles', value: 'profiles' },
          new inquirer.Separator(),
          { name: '🚪 Quit', value: 'quit' },
        ],
      },
    ]);

    if (action === 'quit') { console.log(chalk.dim('Goodbye!')); break; }

    if (action === 'search_media')        await search.runSearchMedia(client);
    else if (action === 'clients')        await search.runSearchClients(client);
    else if (action === 'libraries')      await libs.runLibrariesMenu(client);
    else if (action === 'on_deck')        await sess.runOnDeckMenu(client);
    else if (action === 'recently_added') await sess.runRecentlyAddedMenu(client);
    else if (action === 'playlists')      await pl.runPlaylistsMenu(client);
    else if (action === 'sessions')       await sess.runSessionsMenu(client);
    else if (action === 'server_info')    await settings.runServerInfo(client);
    else if (action === 'ha_automation')  await hass.runHassMenu(client);
    else if (action === 'profiles')       await settings.runProfileManager(config);
  }
}

async function interactiveConnect(config: Config): Promise<PlexClient | null> {
  const profiles = config.listProfiles();

  if (!profiles.length) {
    console.log(
      chalk.cyan.bold('\nWelcome to plex-cli!\n') +
      "No profiles configured. You'll need your Plex server URL and token.\n" +
      chalk.dim('Find your token at: https://support.plex.tv/articles/204059436/\n')
    );
    const answers = await inquirer.prompt<{ name: string; url: string; token: string }>([
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
  const { chosen } = await inquirer.prompt<{ chosen: string | null }>([
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
  const profile: Profile | null = config.getProfile(chosen);
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
  .option('-t, --token <token>', 'Plex token', process.env['PLEX_TOKEN'])
  .option('-p, --profile <name>', 'Saved profile name')
  .action(async (opts: { url?: string; token?: string; profile?: string }) => {
    const config = new Config();
    let client = resolveClient(opts, config);
    if (!client) {
      client = await interactiveConnect(config);
      if (!client) process.exit(1);
    }
    await runInteractive(client, config);
  });

// ---------------------------------------------------------------------------
// Sub-commands
// ---------------------------------------------------------------------------

program
  .command('search <query>')
  .description('Search for media across all libraries')
  .option('-n, --limit <n>', 'Max results', '20')
  .action(async (query: string, opts: { limit: string }, cmd: Command) => {
    const config = new Config();
    const client = requireClient(cmd.parent!.opts(), config);
    try {
      const results = await client.search(query, parseInt(opts.limit, 10));
      if (!results.length) { printInfo('No results found.'); return; }
      mediaTable(results, `Results for "${query}"`);
    } catch (err: unknown) {
      printError((err as Error).message); process.exit(1);
    }
  });

program
  .command('clients')
  .description('List all available Plex clients')
  .action(async (_opts: unknown, cmd: Command) => {
    const config = new Config();
    const client = requireClient(cmd.parent!.opts(), config);
    try {
      const result = await client.clients();
      if (!result.length) { printInfo('No clients found.'); return; }
      clientTable(result);
    } catch (err: unknown) {
      printError((err as Error).message); process.exit(1);
    }
  });

program
  .command('sessions')
  .description('Show currently active playback sessions')
  .action(async (_opts: unknown, cmd: Command) => {
    const config = new Config();
    const client = requireClient(cmd.parent!.opts(), config);
    try {
      const result = await client.sessions();
      if (!result.length) { printInfo('No active sessions.'); return; }
      sessionTable(result);
    } catch (err: unknown) {
      printError((err as Error).message); process.exit(1);
    }
  });

program
  .command('on-deck')
  .description('Show On Deck items (continue watching)')
  .option('-n, --limit <n>', 'Max results', '20')
  .action(async (opts: { limit: string }, cmd: Command) => {
    const config = new Config();
    const client = requireClient(cmd.parent!.opts(), config);
    try {
      const items = (await client.onDeck()).slice(0, parseInt(opts.limit, 10));
      if (!items.length) { printInfo('Nothing on deck.'); return; }
      mediaTable(items, 'On Deck');
    } catch (err: unknown) {
      printError((err as Error).message); process.exit(1);
    }
  });

program
  .command('recently-added')
  .description('Show recently added items')
  .option('-n, --limit <n>', 'Max results', '20')
  .action(async (opts: { limit: string }, cmd: Command) => {
    const config = new Config();
    const client = requireClient(cmd.parent!.opts(), config);
    try {
      const items = await client.recentlyAdded(parseInt(opts.limit, 10));
      if (!items.length) { printInfo('Nothing recently added.'); return; }
      mediaTable(items, 'Recently Added');
    } catch (err: unknown) {
      printError((err as Error).message); process.exit(1);
    }
  });

program
  .command('libraries')
  .description('List all library sections')
  .action(async (_opts: unknown, cmd: Command) => {
    const config = new Config();
    const client = requireClient(cmd.parent!.opts(), config);
    try {
      const libList = await client.libraries();
      const table = new Table({ head: ['#', 'Title', 'Type', 'Key'], style: { head: ['cyan'] } });
      libList.forEach((l, i) =>
        table.push([String(i + 1), l.title ?? '?', l.type ?? '?', l.key ?? ''])
      );
      console.log('\n' + chalk.cyan.bold('Libraries'));
      console.log(table.toString());
    } catch (err: unknown) {
      printError((err as Error).message); process.exit(1);
    }
  });

program
  .command('playlists')
  .description('List all playlists')
  .action(async (_opts: unknown, cmd: Command) => {
    const config = new Config();
    const client = requireClient(cmd.parent!.opts(), config);
    try {
      const pls = await client.playlists();
      if (!pls.length) { printInfo('No playlists found.'); return; }
      const table = new Table({ head: ['#', 'Title', 'Type', 'Items'], style: { head: ['cyan'] } });
      pls.forEach((p, i) =>
        table.push([String(i + 1), p.title ?? '?', p.playlistType ?? '?', String(p.leafCount ?? '')])
      );
      console.log('\n' + chalk.cyan.bold('Playlists'));
      console.log(table.toString());
    } catch (err: unknown) {
      printError((err as Error).message); process.exit(1);
    }
  });

program
  .command('server-info')
  .description('Show server info and capabilities')
  .action(async (_opts: unknown, cmd: Command) => {
    const config = new Config();
    const client = requireClient(cmd.parent!.opts(), config);
    try {
      const info = await client.serverInfo();
      const table = new Table({ style: { head: [] } });
      for (const [k, v] of Object.entries(info)) {
        if (typeof v !== 'object' && v != null && v !== '') {
          table.push([chalk.cyan(k), String(v)]);
        }
      }
      console.log(table.toString());
    } catch (err: unknown) {
      printError((err as Error).message); process.exit(1);
    }
  });

program
  .command('ha-automation <query>')
  .description('Generate a Home Assistant automation YAML to trigger Plex playback')
  .option('--player <entity>', 'HA media_player entity ID', 'media_player.plex_player')
  .option('--output <path>', 'Output file path (default: homeassistant/<title>.yaml)')
  .option('--resume', 'Resume TV show from On Deck (default: true for shows)')
  .option('--no-resume', 'Start TV show from S01E01 instead of resuming')
  .option('--type <type>', 'Filter results by type (movie, show, episode, track, …)')
  .action(
    async (
      query: string,
      opts: { player?: string; output?: string; resume?: boolean; type?: string },
      cmd: Command
    ) => {
      const config = new Config();
      const client = requireClient(cmd.parent!.opts(), config);
      const { generateHassAutomation } = await import('./menus/hass');
      await generateHassAutomation(client, query, opts);
    }
  );

await program.parseAsync(process.argv);
