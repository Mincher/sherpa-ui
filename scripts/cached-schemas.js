#!/usr/bin/env node
/**
 * cached-schemas.js — Cached wrapper for schemas
 *
 * Skips schema extraction if component JSDoc hasn't changed.
 */

import { BuildCache } from './build-cache.js';
import { execSync } from 'child_process';

const cache = new BuildCache('schemas');

const sourcePatterns = [
  'components/**/*.js',
  'scripts/extract-component-schemas.js',
];

const hasChanged = await cache.hasChanged(sourcePatterns);

if (hasChanged) {
  console.log('[cache] Component JSDoc changed — regenerating schemas...\n');
  execSync('npm run schemas', { stdio: 'inherit' });
  await cache.saveHashes(sourcePatterns);
} else {
  console.log('[cache] Component JSDoc unchanged — skipping schema extraction');
}
