#!/usr/bin/env node
/**
 * Runs tsc --noEmit and removes every @ts-expect-error directive that tsc
 * reports as TS2578 ("Unused '@ts-expect-error' directive").
 *
 * Works by:
 *  1. Running tsc and capturing stderr
 *  2. Parsing TS2578 error lines → (file, lineNumber)
 *  3. For each file, removing those lines in DESCENDING order so line
 *     numbers don't shift as we delete.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TSCONFIG = path.join(ROOT, 'tsconfig.json');

console.log('Running tsc to find unused @ts-expect-error directives...');

let tscOutput = '';
try {
  execSync(`npx tsc --noEmit -p "${TSCONFIG}"`, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  tscOutput = (e.stdout || '') + (e.stderr || '');
}

// Parse TS2578 lines: "path/to/file.ts(LINE,COL): error TS2578: ..."
const re = /^([^(]+)\((\d+),\d+\): error TS2578:/gm;
const byFile = new Map(); // absolutePath → Set<number>
let match;
while ((match = re.exec(tscOutput)) !== null) {
  const [, filePath, lineStr] = match;
  const abs = path.resolve(ROOT, filePath.trim());
  if (!byFile.has(abs)) byFile.set(abs, new Set());
  byFile.get(abs).add(parseInt(lineStr, 10));
}

if (byFile.size === 0) {
  console.log('No TS2578 errors found — nothing to remove.');
  process.exit(0);
}

let totalRemoved = 0;
for (const [filePath, lineNums] of byFile) {
  if (!fs.existsSync(filePath)) continue;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  // Sort descending so we can splice without shifting
  const sorted = [...lineNums].sort((a, b) => b - a);
  for (const lineNum of sorted) {
    const idx = lineNum - 1; // 0-indexed
    if (idx >= 0 && idx < lines.length && /\/\/ @ts-expect-error/.test(lines[idx])) {
      lines.splice(idx, 1);
      totalRemoved++;
    }
  }
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log(`  ${path.relative(ROOT, filePath)}: removed ${lineNums.size} directive(s)`);
}

console.log(`\nTotal removed: ${totalRemoved} @ts-expect-error directives.`);
