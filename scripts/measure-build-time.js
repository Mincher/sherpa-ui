#!/usr/bin/env node

/**
 * measure-build-time.js
 * Measures execution time of each build step and total build time.
 *
 * Usage:
 *   node scripts/measure-build-time.js
 *   npm run build:measure
 *
 * Outputs:
 *   - Console summary of build times
 *   - .build-metrics.json file with detailed timing data
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const metricsFile = join(rootDir, '.build-metrics.json');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

/**
 * Measure execution time of a shell command
 * @param {string} name - Display name for the step
 * @param {string} command - Shell command to execute
 * @returns {Object} - { name, duration, success, error }
 */
function measureStep(name, command) {
  console.log(`${colors.blue}▶${colors.reset} ${name}...`);
  const startTime = performance.now();

  try {
    execSync(command, {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    const duration = performance.now() - startTime;
    console.log(`${colors.green}✓${colors.reset} ${name} completed in ${colors.cyan}${(duration / 1000).toFixed(2)}s${colors.reset}\n`);
    return { name, duration, success: true };
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`${colors.yellow}✗${colors.reset} ${name} failed after ${colors.cyan}${(duration / 1000).toFixed(2)}s${colors.reset}\n`);
    return { name, duration, success: false, error: error.message };
  }
}

/**
 * Load historical metrics if they exist
 */
function loadHistoricalMetrics() {
  if (!existsSync(metricsFile)) {
    return [];
  }
  try {
    const data = readFileSync(metricsFile, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.warn(`Warning: Could not parse ${metricsFile}:`, err.message);
    return [];
  }
}

/**
 * Save metrics to file
 */
function saveMetrics(buildMetrics) {
  const history = loadHistoricalMetrics();

  // Keep last 50 builds
  history.push(buildMetrics);
  const trimmedHistory = history.slice(-50);

  writeFileSync(metricsFile, JSON.stringify(trimmedHistory, null, 2));
  console.log(`\n${colors.green}✓${colors.reset} Metrics saved to ${colors.cyan}.build-metrics.json${colors.reset}`);
}

/**
 * Calculate statistics from historical data
 */
function calculateStats(history, stepName) {
  if (history.length === 0) return null;

  const durations = history
    .filter(build => {
      const step = build.steps.find(s => s.name === stepName);
      return step && step.success;
    })
    .map(build => build.steps.find(s => s.name === stepName).duration);

  if (durations.length === 0) return null;

  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);

  return { avg, min, max, count: durations.length };
}

/**
 * Main build measurement function
 */
async function main() {
  console.log(`${colors.bold}Sherpa UI Build Time Measurement${colors.reset}`);
  console.log(`${'='.repeat(50)}\n`);

  const buildSteps = [
    { name: 'Token Generation', command: 'npm run tokens:generate' },
    { name: 'Schema Extraction', command: 'npm run schemas' },
    { name: 'Pattern Extraction', command: 'npm run patterns' },
    { name: 'Component Docs', command: 'npm run component-docs' },
  ];

  const overallStart = performance.now();
  const results = [];

  for (const step of buildSteps) {
    const result = measureStep(step.name, step.command);
    results.push(result);

    // Stop if a step fails
    if (!result.success) {
      console.error(`\n${colors.yellow}⚠${colors.reset} Build stopped due to failure in: ${result.name}`);
      break;
    }
  }

  const overallDuration = performance.now() - overallStart;
  const allSucceeded = results.every(r => r.success);

  // Build metrics object
  const buildMetrics = {
    timestamp: new Date().toISOString(),
    totalDuration: overallDuration,
    success: allSucceeded,
    steps: results,
  };

  // Save metrics
  saveMetrics(buildMetrics);

  // Load historical data
  const history = loadHistoricalMetrics();

  // Print summary
  console.log(`\n${colors.bold}Build Summary${colors.reset}`);
  console.log(`${'='.repeat(50)}`);
  console.log(`${colors.bold}Total Time:${colors.reset} ${colors.cyan}${(overallDuration / 1000).toFixed(2)}s${colors.reset}`);
  console.log(`${colors.bold}Status:${colors.reset} ${allSucceeded ? `${colors.green}SUCCESS${colors.reset}` : `${colors.yellow}FAILED${colors.reset}`}`);
  console.log(`${colors.bold}Steps:${colors.reset} ${results.filter(r => r.success).length}/${results.length} completed\n`);

  // Print step breakdown
  console.log(`${colors.bold}Step Breakdown:${colors.reset}`);
  console.log(`${'─'.repeat(50)}`);

  for (const step of results) {
    const stats = calculateStats(history, step.name);
    const duration = (step.duration / 1000).toFixed(2);
    const status = step.success ? `${colors.green}✓${colors.reset}` : `${colors.yellow}✗${colors.reset}`;

    console.log(`${status} ${step.name.padEnd(20)} ${colors.cyan}${duration}s${colors.reset}`);

    if (stats && stats.count > 1) {
      const avgDiff = ((step.duration - stats.avg) / stats.avg * 100).toFixed(1);
      const diffColor = Math.abs(avgDiff) < 5 ? colors.reset : (avgDiff > 0 ? colors.yellow : colors.green);
      console.log(`  └─ Avg: ${(stats.avg / 1000).toFixed(2)}s | Min: ${(stats.min / 1000).toFixed(2)}s | Max: ${(stats.max / 1000).toFixed(2)}s | ${diffColor}${avgDiff > 0 ? '+' : ''}${avgDiff}%${colors.reset}`);
    }
  }

  console.log(`${'─'.repeat(50)}`);

  // Historical comparison
  if (history.length > 1) {
    const prevBuild = history[history.length - 2];
    const timeDiff = overallDuration - prevBuild.totalDuration;
    const percentDiff = (timeDiff / prevBuild.totalDuration * 100).toFixed(1);
    const diffColor = Math.abs(percentDiff) < 5 ? colors.reset : (percentDiff > 0 ? colors.yellow : colors.green);

    console.log(`\n${colors.bold}Compared to previous build:${colors.reset}`);
    console.log(`${diffColor}${timeDiff > 0 ? '+' : ''}${(timeDiff / 1000).toFixed(2)}s (${percentDiff > 0 ? '+' : ''}${percentDiff}%)${colors.reset}`);
  }

  if (history.length >= 5) {
    const recentBuilds = history.slice(-5);
    const avgTotal = recentBuilds.reduce((sum, b) => sum + b.totalDuration, 0) / recentBuilds.length;
    console.log(`${colors.bold}5-build average:${colors.reset} ${colors.cyan}${(avgTotal / 1000).toFixed(2)}s${colors.reset}`);
  }

  console.log(`\n${colors.bold}Metrics saved:${colors.reset} ${history.length} builds tracked`);

  // Exit with appropriate code
  process.exit(allSucceeded ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
