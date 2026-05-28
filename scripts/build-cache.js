#!/usr/bin/env node
/**
 * build-cache.js — Hash-based build caching system
 *
 * Speeds up incremental builds by skipping regeneration of unchanged files.
 *
 * Usage:
 *   import { BuildCache } from './build-cache.js';
 *
 *   const cache = new BuildCache('schema-extraction');
 *
 *   // Check if files have changed
 *   if (cache.hasChanged(['components/**\/*.js'])) {
 *     // Regenerate schemas
 *     // ...
 *     cache.saveHash(['components/**\/*.js']);
 *   }
 *
 * CLI:
 *   node scripts/build-cache.js clear              # Clear all caches
 *   node scripts/build-cache.js status             # Show cache status
 *   node scripts/build-cache.js analyze <task>     # Analyze task cache
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { glob } from 'glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.build-cache');

// ─── Cache Metadata ──────────────────────────────────────────────────

class CacheMetadata {
  constructor(taskName) {
    this.taskName = taskName;
    this.cacheFile = path.join(CACHE_DIR, `${taskName}.json`);
    this.data = this.#load();
  }

  #load() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        return JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      }
    } catch (e) {
      console.warn(`[build-cache] Failed to load cache for ${this.taskName}:`, e.message);
    }
    return { files: {}, lastRun: null, hits: 0, misses: 0 };
  }

  save() {
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    fs.writeFileSync(this.cacheFile, JSON.stringify(this.data, null, 2), 'utf8');
  }

  getFileHash(filePath) {
    return this.data.files[filePath] || null;
  }

  setFileHash(filePath, hash) {
    this.data.files[filePath] = hash;
  }

  markRun() {
    this.data.lastRun = new Date().toISOString();
  }

  recordHit() {
    this.data.hits = (this.data.hits || 0) + 1;
  }

  recordMiss() {
    this.data.misses = (this.data.misses || 0) + 1;
  }

  get stats() {
    const total = this.data.hits + this.data.misses;
    const hitRate = total > 0 ? ((this.data.hits / total) * 100).toFixed(1) : 0;
    return {
      taskName: this.taskName,
      lastRun: this.data.lastRun,
      fileCount: Object.keys(this.data.files).length,
      hits: this.data.hits,
      misses: this.data.misses,
      total,
      hitRate: `${hitRate}%`,
    };
  }

  clear() {
    this.data = { files: {}, lastRun: null, hits: 0, misses: 0 };
    if (fs.existsSync(this.cacheFile)) {
      fs.unlinkSync(this.cacheFile);
    }
  }
}

// ─── Build Cache ─────────────────────────────────────────────────────

export class BuildCache {
  constructor(taskName) {
    this.taskName = taskName;
    this.metadata = new CacheMetadata(taskName);
  }

  /**
   * Compute hash for a single file.
   * @param {string} filePath - Absolute path to file
   * @returns {string} SHA-256 hash of file contents
   */
  #computeFileHash(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (e) {
      console.warn(`[build-cache] Failed to hash ${filePath}:`, e.message);
      return null;
    }
  }

  /**
   * Resolve glob patterns to absolute file paths.
   * @param {string[]} patterns - Glob patterns
   * @returns {Promise<string[]>} Resolved file paths
   */
  async #resolvePatterns(patterns) {
    const allFiles = [];
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          cwd: ROOT,
          absolute: true,
          nodir: true,
          ignore: ['**/node_modules/**', '**/.git/**', '**/.build-cache/**'],
        });
        allFiles.push(...files);
      } catch (e) {
        console.warn(`[build-cache] Failed to resolve pattern ${pattern}:`, e.message);
      }
    }
    return [...new Set(allFiles)];
  }

  /**
   * Check if any files matching the patterns have changed since last build.
   * @param {string[]} patterns - Glob patterns to check
   * @returns {Promise<boolean>} True if any file changed
   */
  async hasChanged(patterns) {
    const files = await this.#resolvePatterns(patterns);

    if (files.length === 0) {
      console.warn(`[build-cache] No files matched patterns for ${this.taskName}`);
      this.metadata.recordMiss();
      this.metadata.save();
      return true;
    }

    let changed = false;

    for (const filePath of files) {
      const currentHash = this.#computeFileHash(filePath);
      const cachedHash = this.metadata.getFileHash(filePath);

      if (currentHash !== cachedHash) {
        changed = true;
        break; // Early exit on first change
      }
    }

    if (changed) {
      this.metadata.recordMiss();
    } else {
      this.metadata.recordHit();
    }

    // Save stats after recording hit/miss
    this.metadata.save();

    return changed;
  }

  /**
   * Save hashes for files matching the patterns (after successful build).
   * @param {string[]} patterns - Glob patterns to save
   * @returns {Promise<void>}
   */
  async saveHashes(patterns) {
    const files = await this.#resolvePatterns(patterns);

    for (const filePath of files) {
      const hash = this.#computeFileHash(filePath);
      if (hash) {
        this.metadata.setFileHash(filePath, hash);
      }
    }

    this.metadata.markRun();
    this.metadata.save();
  }

  /**
   * Clear cache for this task.
   */
  clear() {
    this.metadata.clear();
    console.log(`[build-cache] Cleared cache for ${this.taskName}`);
  }

  /**
   * Get cache statistics.
   * @returns {Object}
   */
  stats() {
    return this.metadata.stats;
  }
}

// ─── CLI Commands ────────────────────────────────────────────────────

async function clearAllCaches() {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
    console.log('[build-cache] All caches cleared');
  } else {
    console.log('[build-cache] No cache directory found');
  }
}

async function showStatus() {
  if (!fs.existsSync(CACHE_DIR)) {
    console.log('[build-cache] No cache directory found');
    return;
  }

  const cacheFiles = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));

  if (cacheFiles.length === 0) {
    console.log('[build-cache] No task caches found');
    return;
  }

  console.log('\n[build-cache] Cache Status\n');

  const tasks = cacheFiles.map(f => path.basename(f, '.json'));
  for (const task of tasks) {
    const cache = new BuildCache(task);
    const stats = cache.stats();

    console.log(`  ${stats.taskName}:`);
    console.log(`    Last run:   ${stats.lastRun || 'Never'}`);
    console.log(`    Files:      ${stats.fileCount}`);
    console.log(`    Hit rate:   ${stats.hitRate} (${stats.hits}/${stats.total})`);
    console.log('');
  }
}

async function analyzeTask(taskName) {
  const cache = new BuildCache(taskName);
  const stats = cache.stats();

  console.log(`\n[build-cache] Analysis: ${taskName}\n`);
  console.log(`  Last run:     ${stats.lastRun || 'Never'}`);
  console.log(`  Tracked files: ${stats.fileCount}`);
  console.log(`  Cache hits:   ${stats.hits}`);
  console.log(`  Cache misses: ${stats.misses}`);
  console.log(`  Total builds: ${stats.total}`);
  console.log(`  Hit rate:     ${stats.hitRate}`);
  console.log('');

  if (cache.metadata.data.files && Object.keys(cache.metadata.data.files).length > 0) {
    console.log('  Tracked files:');
    const files = Object.keys(cache.metadata.data.files).sort();
    const displayLimit = 20;

    files.slice(0, displayLimit).forEach(f => {
      const relPath = path.relative(ROOT, f);
      const hash = cache.metadata.data.files[f].slice(0, 8);
      console.log(`    ${relPath} (${hash}...)`);
    });

    if (files.length > displayLimit) {
      console.log(`    ... and ${files.length - displayLimit} more`);
    }
  }
}

// ─── CLI Entry Point ─────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  switch (command) {
    case 'clear':
      await clearAllCaches();
      break;

    case 'status':
      await showStatus();
      break;

    case 'analyze':
      const taskName = process.argv[3];
      if (!taskName) {
        console.error('Usage: node build-cache.js analyze <task-name>');
        process.exit(1);
      }
      await analyzeTask(taskName);
      break;

    default:
      console.log('Usage: node build-cache.js <command>');
      console.log('');
      console.log('Commands:');
      console.log('  clear              Clear all caches');
      console.log('  status             Show cache status for all tasks');
      console.log('  analyze <task>     Analyze cache for specific task');
      console.log('');
      console.log('Examples:');
      console.log('  node build-cache.js clear');
      console.log('  node build-cache.js status');
      console.log('  node build-cache.js analyze tokens');
      process.exit(1);
  }
}
