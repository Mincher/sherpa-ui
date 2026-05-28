#!/usr/bin/env node
/**
 * cached-tokens-generate.js — Cached wrapper for tokens:generate
 *
 * Skips token generation if figma-variables.json hasn't changed.
 */

import { BuildCache } from './build-cache.js';
import { execSync } from 'child_process';

const cache = new BuildCache('tokens-generate');

const sourcePatterns = [
  'figma-tokens/figma-variables.json',
  'figma-tokens/alias-snapshot.json',
  'scripts/generate-css-tokens.js',
];

const hasChanged = await cache.hasChanged(sourcePatterns);

if (hasChanged) {
  console.log('[cache] Tokens source changed — regenerating...\n');
  execSync('npm run tokens:generate', { stdio: 'inherit' });
  await cache.saveHashes(sourcePatterns);
} else {
  console.log('[cache] Tokens unchanged — skipping generation');
}
