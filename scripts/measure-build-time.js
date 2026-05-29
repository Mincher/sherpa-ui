#!/usr/bin/env node
/**
 * measure-build-time.js
 *
 * Measures and tracks build performance metrics for the Sherpa UI build pipeline.
 *
 * Usage:
 *   node scripts/measure-build-time.js
 *   npm run build:measure
 *
 * Outputs:
 *   - Console report with timing for each build step
 *   - JSON metrics file (.build-metrics.json) for trend analysis
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const metricsFile = join(rootDir, '.build-metrics.json');

/**
 * Execute a command and measure its duration
 */
function measureCommand(name, command) {
  const startTime = performance.now();

  try {
    execSync(command, {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    const duration = performance.now() - startTime;
    return { success: true, duration };
  } catch (error) {
    const duration = performance.now() - startTime;
    return { success: false, duration, error: error.message };
  }
}

/**
 * Format milliseconds to human-readable time
 */
function formatTime(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Load historical metrics
 */
function loadMetrics() {
  if (!existsSync(metricsFile)) {
    return { builds: [] };
  }
  try {
    return JSON.parse(readFileSync(metricsFile, 'utf8'));
  } catch {
    return { builds: [] };
  }
}

/**
 * Save metrics
 */
function saveMetrics(metrics) {
  writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
}

/**
 * Calculate statistics from historical data
 */
function calculateStats(builds, stepName) {
  const durations = builds
    .filter(b => b.steps[stepName] && b.steps[stepName].success)
    .map(b => b.steps[stepName].duration)
    .slice(-10); // Last 10 successful builds

  if (durations.length === 0) return null;

  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  return { avg, median, min: sorted[0], max: sorted[sorted.length - 1] };
}

// Build steps to measure
const buildSteps = [
  { name: 'tokens:generate', command: 'npm run tokens:generate' },
  { name: 'schemas', command: 'npm run schemas' },
  { name: 'patterns', command: 'npm run patterns' },
  { name: 'component-docs', command: 'npm run component-docs' },
];

console.log('🔨 Sherpa UI Build Performance Measurement\n');
console.log('='.repeat(60));

const buildStart = performance.now();
const results = {};

// Run each build step and measure
for (const step of buildSteps) {
  console.log(`\n📦 Running: ${step.name}`);
  console.log('-'.repeat(60));

  const result = measureCommand(step.name, step.command);
  results[step.name] = result;

  const statusIcon = result.success ? '✅' : '❌';
  console.log(`${statusIcon} ${step.name}: ${formatTime(result.duration)}`);
}

const totalDuration = performance.now() - buildStart;

// Display summary
console.log('\n' + '='.repeat(60));
console.log('📊 Build Summary\n');

let allSucceeded = true;
for (const [name, result] of Object.entries(results)) {
  const icon = result.success ? '✅' : '❌';
  console.log(`${icon} ${name.padEnd(20)} ${formatTime(result.duration).padStart(8)}`);
  if (!result.success) allSucceeded = false;
}

console.log('-'.repeat(60));
console.log(`⏱️  Total Build Time:     ${formatTime(totalDuration)}`);
console.log(`🎯 Status:               ${allSucceeded ? '✅ SUCCESS' : '❌ FAILED'}`);

// Load historical metrics
const metrics = loadMetrics();

// Add current build to history
metrics.builds.push({
  timestamp: new Date().toISOString(),
  totalDuration,
  success: allSucceeded,
  steps: results
});

// Keep only last 50 builds
if (metrics.builds.length > 50) {
  metrics.builds = metrics.builds.slice(-50);
}

// Save metrics
saveMetrics(metrics);

// Show trends if we have historical data
if (metrics.builds.length > 1) {
  console.log('\n📈 Performance Trends (last 10 successful builds)\n');

  const allSteps = [...buildSteps.map(s => s.name), 'total'];

  for (const stepName of allSteps) {
    const stats = stepName === 'total'
      ? calculateStats(metrics.builds.map(b => ({ steps: { total: { duration: b.totalDuration, success: b.success } } })), 'total')
      : calculateStats(metrics.builds, stepName);

    if (stats) {
      const current = stepName === 'total' ? totalDuration : results[stepName].duration;
      const diff = current - stats.avg;
      const diffPercent = ((diff / stats.avg) * 100).toFixed(1);
      const trend = diff > 0 ? '📈' : '📉';
      const sign = diff > 0 ? '+' : '';

      console.log(`${stepName.padEnd(20)} avg: ${formatTime(stats.avg)} ${trend} ${sign}${formatTime(diff)} (${sign}${diffPercent}%)`);
    }
  }
}

console.log('\n✨ Metrics saved to .build-metrics.json');
console.log('='.repeat(60) + '\n');

// Exit with appropriate code
process.exit(allSucceeded ? 0 : 1);
