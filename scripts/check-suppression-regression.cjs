#!/usr/bin/env node
/**
 * check-suppression-regression.cjs
 * 
 * Compares current suppression count to the baseline in .ts-suppression-budget.
 * Fails if the count has increased (regression detected).
 * 
 * Usage:
 *   node scripts/check-suppression-regression.cjs
 * 
 * Exit codes:
 *   0 = OK (count stayed same or decreased)
 *   1 = REGRESSION (count increased)
 *   2 = ERROR (budget file not found)
 */

const { readFileSync, statSync, readdirSync } = require('fs');
const { join, resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const BUDGET_FILE = join(ROOT, '.ts-suppression-budget');
const COMPONENTS_DIR = join(ROOT, 'components');
const PATTERN = /@ts-(expect-error|ignore)\b/g;

function countSuppressions() {
  let total = 0;
  
  function walkSync(dir) {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const s = statSync(p);
      if (s.isDirectory()) {
        walkSync(p);
      } else if (s.isFile() && p.endsWith('.ts') && !p.endsWith('.d.ts')) {
        const text = readFileSync(p, 'utf8');
        const matches = text.match(PATTERN);
        if (matches) total += matches.length;
      }
    }
  }
  
  walkSync(COMPONENTS_DIR);
  return total;
}

function readBudget() {
  try {
    return parseInt(readFileSync(BUDGET_FILE, 'utf8').trim(), 10);
  } catch {
    return null;
  }
}

function main() {
  const budget = readBudget();
  
  if (budget === null) {
    console.error('❌ .ts-suppression-budget file not found');
    process.exit(2);
  }
  
  const current = countSuppressions();
  
  console.log(`📊 Suppression Count Analysis:`);
  console.log(`   Previous: ${budget}`);
  console.log(`   Current:  ${current}`);
  console.log(`   Change:   ${current - budget > 0 ? '+' : ''}${current - budget}`);
  console.log('');
  
  if (current > budget) {
    console.error(`❌ REGRESSION DETECTED: Suppression count increased by ${current - budget}`);
    console.error(`   Previous budget: ${budget}`);
    console.error(`   Current count:   ${current}`);
    console.error(`   Please reduce suppressions or update .ts-suppression-budget`);
    process.exit(1);
  } else if (current < budget) {
    console.log(`✅ IMPROVEMENT: Suppression count decreased by ${budget - current}`);
    console.log(`   Consider updating .ts-suppression-budget to: ${current}`);
    process.exit(0);
  } else {
    console.log(`✅ NO REGRESSION: Suppression count remains stable`);
    process.exit(0);
  }
}

main();
