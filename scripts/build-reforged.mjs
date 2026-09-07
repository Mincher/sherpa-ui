/**
 * build-reforged.mjs — compile the reforged src/ tree and copy its CSS/HTML
 * assets into dist/ (components load them at runtime via import.meta.url).
 *
 *   node scripts/build-reforged.mjs
 */
import { execSync } from 'node:child_process';
import { readdirSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist');

// Project Figma tokens first so each <comp>.css carries a fresh inlined token
// region before the copy step (one .css per component — no separate .tokens.css).
console.log('› project-tokens');
execSync('node scripts/project-tokens.mjs', { stdio: 'inherit' });

// Structural CSS lint — guards the shadow-DOM rules (no chained :host, no `&`
// nesting inside :host{}, no light-dark/opacity-disabled). Fails the build on error.
console.log('› lint:css');
execSync('node scripts/lint-css.mjs', { stdio: 'inherit' });

console.log('› tsc -p tsconfig.reforged.json');
execSync('npx tsc -p tsconfig.reforged.json', { stdio: 'inherit' });

/** Recursively copy every .css / .html under src/ into the mirrored dist path. */
function copyAssets(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      copyAssets(full);
    } else if (/\.(css|html)$/.test(entry)) {
      const dest = join(OUT, relative(SRC, full));
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(full, dest);
    }
  }
}
copyAssets(SRC);
console.log('✓ assets copied into dist/');
