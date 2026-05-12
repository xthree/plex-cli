#!/usr/bin/env node
'use strict';
/**
 * plex-cli launcher.
 * Delegates to tsx so TypeScript source is executed directly – no build step needed.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const tsx = path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');
const main = path.join(__dirname, '..', 'src', 'index.ts');

const result = spawnSync(tsx, [main, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 0);
