#!/usr/bin/env node
/**
 * cached-patterns.js — Cached wrapper for patterns
 *
 * Skips pattern extraction if pattern files haven't changed.
 */

import { BuildCache } from './build-cache.js';
import { execSync } from 'child_process';

const cache = new BuildCache('patterns');

const sourcePatterns = [
  'patterns/**/*.html',
  'patterns/**/*.md',
  'scripts/extract-pattern-index.js',
];

const hasChanged = await cache.hasChanged(sourcePatterns);

if (hasChanged) {
  console.log('[cache] Pattern files changed — regenerating index...\n');
  execSync('npm run patterns', { stdio: 'inherit' });
  await cache.saveHashes(sourcePatterns);
} else {
  console.log('[cache] Pattern files unchanged — skipping extraction');
}
