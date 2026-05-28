#!/usr/bin/env node
/**
 * test-a11y.js — Automated accessibility testing for Sherpa UI
 *
 * Tests all demo pages with pa11y and generates a compliance report.
 * Uses WCAG 2.1 Level AA as the compliance standard.
 *
 * Usage:
 *   node scripts/test-a11y.js                    # Test all demo pages
 *   node scripts/test-a11y.js --verbose          # Detailed output
 *   node scripts/test-a11y.js --standard=AAA     # Test against WCAG AAA
 *   node scripts/test-a11y.js demo/button.html   # Test specific page
 *
 * Exit codes:
 *   0 - All tests passed
 *   1 - One or more accessibility violations found
 */

import pa11y from 'pa11y';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ─── Configuration ───────────────────────────────────────────────────

const WCAG_STANDARD = process.argv.find(arg => arg.startsWith('--standard='))
  ?.split('=')[1] || 'WCAG2AA';

const VERBOSE = process.argv.includes('--verbose');
const SPECIFIC_FILE = process.argv.find(arg => arg.endsWith('.html') && !arg.startsWith('--'));

// Pa11y configuration
const PA11Y_CONFIG = {
  standard: WCAG_STANDARD,
  runners: ['axe'], // Use axe-core as the test runner
  timeout: 30000,
  wait: 2000, // Wait for components to render
  chromeLaunchConfig: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  // Ignore known issues or third-party content
  ignore: [
    // Font Awesome CDN warnings (third-party)
    'WCAG2AA.Principle1.Guideline1_4.1_4_3.G18',
  ],
};

// ─── Utilities ───────────────────────────────────────────────────────

function formatIssue(issue, index) {
  const severity = issue.type.toUpperCase();
  const icon = severity === 'ERROR' ? '❌' : severity === 'WARNING' ? '⚠️' : 'ℹ️';

  return [
    `  ${icon} Issue ${index + 1} [${severity}]`,
    `     Code:     ${issue.code}`,
    `     Message:  ${issue.message}`,
    `     Element:  ${issue.selector}`,
    `     Context:  ${issue.context.slice(0, 100)}${issue.context.length > 100 ? '...' : ''}`,
    '',
  ].join('\n');
}

function formatResults(results) {
  const { documentTitle, pageUrl, issues } = results;
  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');
  const notices = issues.filter(i => i.type === 'notice');

  const passed = errors.length === 0;
  const statusIcon = passed ? '✅' : '❌';

  const lines = [
    '',
    `${statusIcon} ${documentTitle || pageUrl}`,
    `   URL: ${pageUrl}`,
    `   Errors: ${errors.length}`,
    `   Warnings: ${warnings.length}`,
    `   Notices: ${notices.length}`,
  ];

  if (VERBOSE || !passed) {
    lines.push('');
    if (errors.length > 0) {
      lines.push('   ERRORS:');
      errors.forEach((issue, i) => {
        lines.push(formatIssue(issue, i));
      });
    }

    if (warnings.length > 0 && VERBOSE) {
      lines.push('   WARNINGS:');
      warnings.forEach((issue, i) => {
        lines.push(formatIssue(issue, i));
      });
    }

    if (notices.length > 0 && VERBOSE) {
      lines.push('   NOTICES:');
      notices.forEach((issue, i) => {
        lines.push(formatIssue(issue, i));
      });
    }
  }

  return lines.join('\n');
}

// ─── Test Runner ─────────────────────────────────────────────────────

async function testPage(filePath) {
  const absolutePath = path.resolve(ROOT, filePath);
  const fileUrl = `file://${absolutePath}`;

  try {
    const results = await pa11y(fileUrl, PA11Y_CONFIG);
    return results;
  } catch (error) {
    console.error(`\n❌ Failed to test ${filePath}:`);
    console.error(`   ${error.message}\n`);
    return null;
  }
}

async function getAllDemoPages() {
  const demoFiles = await glob('demo/*.html', {
    cwd: ROOT,
    ignore: ['demo/component-doc/**', 'demo/fixtures/**'],
  });
  return demoFiles;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 Sherpa UI Accessibility Testing\n');
  console.log(`   Standard: ${WCAG_STANDARD}`);
  console.log(`   Verbose:  ${VERBOSE}\n`);

  let filesToTest;

  if (SPECIFIC_FILE) {
    filesToTest = [SPECIFIC_FILE];
    console.log(`   Testing specific file: ${SPECIFIC_FILE}\n`);
  } else {
    filesToTest = await getAllDemoPages();
    console.log(`   Found ${filesToTest.length} demo pages to test\n`);
  }

  if (filesToTest.length === 0) {
    console.log('❌ No demo pages found to test\n');
    process.exit(1);
  }

  const results = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalNotices = 0;

  for (const file of filesToTest) {
    const result = await testPage(file);

    if (result) {
      results.push(result);
      console.log(formatResults(result));

      const errors = result.issues.filter(i => i.type === 'error').length;
      const warnings = result.issues.filter(i => i.type === 'warning').length;
      const notices = result.issues.filter(i => i.type === 'notice').length;

      totalErrors += errors;
      totalWarnings += warnings;
      totalNotices += notices;
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(70));
  console.log('\n📊 Summary\n');
  console.log(`   Pages tested:     ${results.length}/${filesToTest.length}`);
  console.log(`   Total errors:     ${totalErrors}`);
  console.log(`   Total warnings:   ${totalWarnings}`);
  console.log(`   Total notices:    ${totalNotices}`);

  const passedPages = results.filter(r => r.issues.filter(i => i.type === 'error').length === 0).length;
  const passRate = results.length > 0 ? ((passedPages / results.length) * 100).toFixed(1) : 0;

  console.log(`\n   Pass rate:        ${passRate}% (${passedPages}/${results.length} pages)\n`);

  // ─── Save Report ───────────────────────────────────────────────────

  const reportPath = path.join(ROOT, 'test', 'a11y', 'report.json');
  const report = {
    timestamp: new Date().toISOString(),
    standard: WCAG_STANDARD,
    summary: {
      pagesTestcasted: results.length,
      totalErrors,
      totalWarnings,
      totalNotices,
      passRate: `${passRate}%`,
      passed: passedPages,
      failed: results.length - passedPages,
    },
    results: results.map(r => ({
      url: r.pageUrl,
      title: r.documentTitle,
      errors: r.issues.filter(i => i.type === 'error').length,
      warnings: r.issues.filter(i => i.type === 'warning').length,
      notices: r.issues.filter(i => i.type === 'notice').length,
      issues: r.issues,
    })),
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`   Report saved to: test/a11y/report.json\n`);

  // ─── Exit Code ─────────────────────────────────────────────────────

  if (totalErrors > 0) {
    console.log('❌ Accessibility violations found\n');
    process.exit(1);
  } else {
    console.log('✅ All accessibility tests passed\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
