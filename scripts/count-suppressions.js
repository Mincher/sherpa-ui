#!/usr/bin/env node
/**
 * count-suppressions.js — Enforce a budget on @ts-expect-error directives.
 *
 * Reads .ts-suppression-budget from the repo root. Counts @ts-expect-error
 * (and legacy @ts-ignore) occurrences across components/**\/*.ts. Fails if
 * the count exceeds the budget.
 *
 * Usage:
 *   node scripts/count-suppressions.js            # check against budget
 *   node scripts/count-suppressions.js --write    # write current count to budget
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const COMPONENTS_DIR = join(ROOT, 'components');
const BUDGET_FILE = join(ROOT, '.ts-suppression-budget');
const PATTERN = /@ts-(expect-error|ignore)\b/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if (s.isFile() && p.endsWith('.ts') && !p.endsWith('.d.ts')) yield p;
  }
}

function countSuppressions() {
  let total = 0;
  for (const file of walk(COMPONENTS_DIR)) {
    const text = readFileSync(file, 'utf8');
    const matches = text.match(PATTERN);
    if (matches) total += matches.length;
  }
  return total;
}

function readBudget() {
  try {
    return parseInt(readFileSync(BUDGET_FILE, 'utf8').trim(), 10);
  } catch {
    return null;
  }
}

const count = countSuppressions();
const writeMode = process.argv.includes('--write');

if (writeMode) {
  writeFileSync(BUDGET_FILE, `${count}\n`);
  console.log(`Wrote budget: ${count} suppressions`);
  process.exit(0);
}

const budget = readBudget();
if (budget === null) {
  console.error(`No budget file at ${BUDGET_FILE}. Run with --write to initialize.`);
  process.exit(1);
}

if (count > budget) {
  console.error(
    `\n❌ TypeScript suppression budget exceeded: ${count} > ${budget}\n` +
    `   Every @ts-expect-error is technical debt. Fix the underlying types\n` +
    `   instead of adding suppressions, or reduce the count elsewhere.\n`
  );
  process.exit(1);
}

if (count < budget) {
  console.log(
    `✅ TS suppressions: ${count} (budget ${budget}). ` +
    `Run \`node scripts/count-suppressions.js --write\` to tighten the budget.`
  );
} else {
  console.log(`✅ TS suppressions: ${count}/${budget}`);
}
