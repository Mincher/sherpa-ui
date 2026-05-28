#!/usr/bin/env node
/**
 * cached-component-docs.js — Cached wrapper for component-docs
 *
 * Skips doc generation if schemas haven't changed.
 */

import { BuildCache } from './build-cache.js';
import { execSync } from 'child_process';

const cache = new BuildCache('component-docs');

const sourcePatterns = [
  'schemas/components/*.json',
  'scripts/generate-component-docs.js',
];

const hasChanged = await cache.hasChanged(sourcePatterns);

if (hasChanged) {
  console.log('[cache] Component schemas changed — regenerating docs...\n');
  execSync('npm run component-docs', { stdio: 'inherit' });
  await cache.saveHashes(sourcePatterns);
} else {
  console.log('[cache] Component schemas unchanged — skipping doc generation');
}
