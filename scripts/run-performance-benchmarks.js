#!/usr/bin/env node

/**
 * Performance Benchmark Runner
 *
 * Runs performance benchmarks in headless browser and generates report.
 * Usage: node scripts/run-performance-benchmarks.js [--baseline] [--compare baseline.json]
 */

import { chromium } from 'playwright';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const BENCHMARK_URL = 'file://' + resolve('./test/performance/run-benchmarks.html');
const BASELINE_PATH = './test/performance/baseline.json';
const OUTPUT_PATH = './test/performance/report.json';

const args = process.argv.slice(2);
const saveBaseline = args.includes('--baseline');
const compareBaseline = args.find(arg => arg.startsWith('--compare='))?.split('=')[1];

console.log('🚀 Starting performance benchmarks...\n');

async function runBenchmarks() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console output
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('📊') || text.includes('✅') || text.includes('❌')) {
      console.log(text);
    }
  });

  try {
    console.log('📄 Loading benchmark page...');
    await page.goto(BENCHMARK_URL);

    console.log('⚡ Running benchmarks...\n');

    // Click "Run All Benchmarks" button
    await page.click('#run-all-btn');

    // Wait for benchmarks to complete (check for export button to be enabled)
    await page.waitForFunction(
      () => !document.getElementById('export-btn').disabled,
      { timeout: 120000 } // 2 minutes timeout
    );

    // Get results from page
    const results = await page.evaluate(() => {
      // Access the reportData variable from the page
      return window.reportData || {};
    });

    console.log('\n📊 Benchmark Results:');
    console.log('━'.repeat(70));
    console.log(`Total tests: ${results.summary.total}`);
    console.log(`Passed: ${results.summary.passed} ✅`);
    console.log(`Failed: ${results.summary.failed} ❌`);
    console.log(`Pass rate: ${results.summary.passRate}%`);
    console.log('━'.repeat(70));

    // Save results
    writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${OUTPUT_PATH}`);

    // Save as baseline if requested
    if (saveBaseline) {
      writeFileSync(BASELINE_PATH, JSON.stringify(results, null, 2));
      console.log(`📌 Baseline saved to: ${BASELINE_PATH}`);
    }

    // Compare with baseline if requested
    if (compareBaseline || existsSync(BASELINE_PATH)) {
      const baselinePath = compareBaseline || BASELINE_PATH;
      if (existsSync(baselinePath)) {
        console.log(`\n📈 Comparing with baseline: ${baselinePath}`);
        const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
        compareResults(results, baseline);
      }
    }

    // Exit with appropriate code
    const exitCode = results.summary.failed > 0 ? 1 : 0;
    await browser.close();

    if (exitCode !== 0) {
      console.log('\n❌ Some benchmarks failed performance budgets');
      process.exit(exitCode);
    }

    console.log('\n✅ All benchmarks passed!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Benchmark error:', error.message);
    await browser.close();
    process.exit(1);
  }
}

function compareResults(current, baseline) {
  console.log('\n📊 Performance Comparison:');
  console.log('━'.repeat(70));

  const regressions = [];
  const improvements = [];

  current.budgetChecks.forEach(currentCheck => {
    const baselineCheck = baseline.budgetChecks.find(
      b => b.name === currentCheck.name
    );

    if (!baselineCheck) return;

    const delta = currentCheck.actual - baselineCheck.actual;
    const percentChange = ((delta / baselineCheck.actual) * 100).toFixed(1);

    if (Math.abs(delta) > 0.1) {
      const emoji = delta < 0 ? '🟢' : '🔴';
      const direction = delta < 0 ? 'faster' : 'slower';
      const message = `${emoji} ${currentCheck.name}: ${Math.abs(delta).toFixed(2)}ms ${direction} (${percentChange}%)`;

      if (delta > 0) {
        regressions.push({ name: currentCheck.name, delta, percentChange });
        console.log(message);
      } else {
        improvements.push({ name: currentCheck.name, delta, percentChange });
        console.log(message);
      }
    }
  });

  console.log('━'.repeat(70));

  if (regressions.length > 0) {
    console.log(`\n⚠️  Performance regressions detected: ${regressions.length}`);
    console.log('   Consider optimizing before merging.');
  }

  if (improvements.length > 0) {
    console.log(`\n✨ Performance improvements: ${improvements.length}`);
  }

  if (regressions.length === 0 && improvements.length === 0) {
    console.log('\n✅ Performance unchanged from baseline');
  }
}

// Run benchmarks
runBenchmarks().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
