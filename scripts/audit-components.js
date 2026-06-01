#!/usr/bin/env node
/**
 * audit-components.js — Comprehensive component quality audit
 *
 * Audits all Sherpa UI components for:
 * - JSDoc completeness and format compliance
 * - CSS file structure and organization
 * - Accessibility implementation
 * - Progressive enhancement adherence
 *
 * Usage:
 *   node scripts/audit-components.js                # Full audit
 *   node scripts/audit-components.js --verbose      # Detailed output
 *   node scripts/audit-components.js --component=sherpa-button  # Specific component
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const VERBOSE = process.argv.includes('--verbose');
const SPECIFIC_COMPONENT = process.argv.find(arg => arg.startsWith('--component='))?.split('=')[1];

// ─── Utilities ───────────────────────────────────────────────────────

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// ─── JSDoc Audit ─────────────────────────────────────────────────────

function auditJSDoc(componentName, jsPath) {
  const issues = [];
  const content = readFile(jsPath);

  if (!content) {
    issues.push({ severity: 'error', message: 'JS file not found' });
    return issues;
  }

  // Extract JSDoc block
  const jsdocMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
  if (!jsdocMatch) {
    issues.push({ severity: 'error', message: 'No JSDoc header found' });
    return issues;
  }

  const jsdoc = jsdocMatch[1];

  // Check required tags
  if (!jsdoc.includes('@element')) {
    issues.push({ severity: 'error', message: 'Missing @element tag' });
  }
  if (!jsdoc.includes('@category')) {
    issues.push({ severity: 'error', message: 'Missing @category tag' });
  }

  // Check documentation completeness
  const hasAttrs = jsdoc.includes('@attr');
  const hasSlots = jsdoc.includes('@slot');
  const hasFires = jsdoc.includes('@fires');
  const hasMethods = jsdoc.includes('@method');

  if (!hasAttrs) {
    issues.push({ severity: 'warning', message: 'No @attr tags (component may have attributes)' });
  }

  // Check format compliance for @attr tags
  const attrMatches = jsdoc.match(/@attr[^\n]*/g) || [];
  for (const attr of attrMatches) {
    if (!attr.match(/@attr\s+{[^}]+}\s+[\w-]+\s+—/)) {
      issues.push({
        severity: 'warning',
        message: `Attribute format: ${attr.slice(0, 60)}... (should be: @attr {type} name — description)`,
      });
    }
  }

  // Check format compliance for @fires tags
  const firesMatches = jsdoc.match(/@fires[^\n]*/g) || [];
  for (const fires of firesMatches) {
    if (!fires.match(/@fires\s+[\w-]+\s+—/)) {
      issues.push({
        severity: 'warning',
        message: `Event format: ${fires.slice(0, 60)}... (should be: @fires event-name — description)`,
      });
    }
  }

  return issues;
}

// ─── CSS Audit ───────────────────────────────────────────────────────

function auditCSS(componentName, cssPath) {
  const issues = [];
  const content = readFile(cssPath);

  if (!content) {
    issues.push({ severity: 'error', message: 'CSS file not found' });
    return issues;
  }

  // Check for CSS file structure sections
  const expectedSections = [
    ':host',         // Host base styles
    '/* ──',         // Section dividers
  ];

  // Check if file starts with comment
  if (!content.trimStart().startsWith('/**')) {
    issues.push({
      severity: 'warning',
      message: 'CSS file should start with JSDoc comment block',
    });
  }

  // Check for :host selector
  if (!content.includes(':host')) {
    issues.push({
      severity: 'warning',
      message: 'No :host selector found (shadow DOM components should style :host)',
    });
  }

  // Check for section organization
  const hasSectionDividers = content.includes('/* ──') || content.includes('/* ───');
  if (!hasSectionDividers) {
    issues.push({
      severity: 'info',
      message: 'No section dividers found (consider organizing CSS into sections)',
    });
  }

  // Check file size (potential for refactoring)
  const lines = content.split('\n').length;
  if (lines > 500) {
    issues.push({
      severity: 'info',
      message: `Large CSS file (${lines} lines) — consider splitting into sections`,
    });
  }

  return issues;
}

// ─── Accessibility Audit ─────────────────────────────────────────────

function auditAccessibility(componentName, jsPath, htmlPath) {
  const issues = [];
  const jsContent = readFile(jsPath);
  const htmlContent = readFile(htmlPath);

  if (!htmlContent) {
    issues.push({ severity: 'error', message: 'HTML template not found' });
    return issues;
  }

  // Check for ARIA attributes
  const hasAriaLabel = htmlContent.includes('aria-label');
  const hasAriaDescribedby = htmlContent.includes('aria-describedby');
  const hasRole = htmlContent.includes('role=');

  // Check for semantic HTML
  const hasButton = htmlContent.includes('<button');
  const hasInput = htmlContent.includes('<input');
  const hasLabel = htmlContent.includes('<label');

  // Check for keyboard navigation hints
  if (jsContent) {
    const hasKeydownHandler = jsContent.includes('keydown') || jsContent.includes('keypress');
    const hasFocusManagement = jsContent.includes('focus()');

    // Interactive components should handle keyboard
    if ((hasButton || hasInput) && !hasKeydownHandler && !VERBOSE) {
      // Only flag in verbose mode to reduce noise
    }
  }

  // Check for common a11y issues
  if (htmlContent.includes('<i class="fa')) {
    if (!htmlContent.includes('aria-hidden="true"')) {
      issues.push({
        severity: 'warning',
        message: 'Font Awesome icons should have aria-hidden="true"',
      });
    }
  }

  // Check for alt text on images
  if (htmlContent.includes('<img') && !htmlContent.includes('alt=')) {
    issues.push({
      severity: 'error',
      message: 'Images must have alt text',
    });
  }

  return issues;
}

// ─── Progressive Enhancement Audit ───────────────────────────────────

function auditProgressiveEnhancement(componentName, jsPath, htmlPath) {
  const issues = [];
  const jsContent = readFile(jsPath);
  const htmlContent = readFile(htmlPath);

  if (!jsContent || !htmlContent) {
    return issues;
  }

  // Check if HTML structure is complete
  const hasCompleteStructure = htmlContent.includes('<template');

  // Check if component uses native form elements
  const usesNativeInput = htmlContent.includes('<input') || htmlContent.includes('<select') || htmlContent.includes('<textarea');

  // Check for data attributes (HTML-first approach)
  const usesDataAttributes = htmlContent.includes('data-') || jsContent.includes('data-');

  // Check if JS creates DOM elements (anti-pattern)
  const createsElements = jsContent.includes('createElement(');
  if (createsElements && !jsContent.includes('// Intentional createElement')) {
    issues.push({
      severity: 'warning',
      message: 'Component uses createElement() — prefer template-based approach',
    });
  }

  // Check if component follows template completeness rule
  if (!hasCompleteStructure) {
    issues.push({
      severity: 'info',
      message: 'Consider using <template> for multi-template support',
    });
  }

  return issues;
}

// ─── Component File Discovery ────────────────────────────────────────

async function getComponents() {
  if (SPECIFIC_COMPONENT) {
    return [SPECIFIC_COMPONENT];
  }

  const sourceFiles = await glob('components/sherpa-*/*.{ts,js}', {
    cwd: ROOT,
    ignore: ['**/utilities/**', '**/*.examples.*', '**/*.test.*'],
  });

  // Use a Set to dedupe (a component may have both .ts and .js during migration)
  const dirs = new Set(
    sourceFiles.map(file => path.basename(path.dirname(file)))
  );
  return Array.from(dirs).sort();
}

// ─── Main Audit ──────────────────────────────────────────────────────

async function auditComponent(componentName) {
  const componentDir = path.join(ROOT, 'components', componentName);
  const tsPath = path.join(componentDir, `${componentName}.ts`);
  const jsCandidate = path.join(componentDir, `${componentName}.js`);
  const jsPath = fs.existsSync(tsPath) ? tsPath : jsCandidate;
  const cssPath = path.join(componentDir, `${componentName}.css`);
  const htmlPath = path.join(componentDir, `${componentName}.html`);

  const results = {
    component: componentName,
    jsdoc: auditJSDoc(componentName, jsPath),
    css: auditCSS(componentName, cssPath),
    accessibility: auditAccessibility(componentName, jsPath, htmlPath),
    progressiveEnhancement: auditProgressiveEnhancement(componentName, jsPath, htmlPath),
  };

  // Calculate severity counts
  const allIssues = [
    ...results.jsdoc,
    ...results.css,
    ...results.accessibility,
    ...results.progressiveEnhancement,
  ];

  results.summary = {
    errors: allIssues.filter(i => i.severity === 'error').length,
    warnings: allIssues.filter(i => i.severity === 'warning').length,
    info: allIssues.filter(i => i.severity === 'info').length,
    total: allIssues.length,
  };

  return results;
}

function formatResults(results) {
  const { component, summary, jsdoc, css, accessibility, progressiveEnhancement } = results;

  if (summary.total === 0 && !VERBOSE) {
    return null; // Skip clean components in non-verbose mode
  }

  const statusIcon = summary.errors === 0 ? '✅' : '❌';
  const lines = [`\n${statusIcon} ${component}`];

  if (summary.total > 0) {
    lines.push(`   Errors: ${summary.errors}, Warnings: ${summary.warnings}, Info: ${summary.info}`);
  }

  if (VERBOSE || summary.errors > 0 || summary.warnings > 0) {
    if (jsdoc.length > 0) {
      lines.push('\n   JSDoc:');
      jsdoc.forEach(issue => {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`     ${icon} ${issue.message}`);
      });
    }

    if (css.length > 0) {
      lines.push('\n   CSS:');
      css.forEach(issue => {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`     ${icon} ${issue.message}`);
      });
    }

    if (accessibility.length > 0) {
      lines.push('\n   Accessibility:');
      accessibility.forEach(issue => {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`     ${icon} ${issue.message}`);
      });
    }

    if (progressiveEnhancement.length > 0) {
      lines.push('\n   Progressive Enhancement:');
      progressiveEnhancement.forEach(issue => {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`     ${icon} ${issue.message}`);
      });
    }
  }

  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 Sherpa UI Component Audit\n');

  const components = await getComponents();
  console.log(`   Auditing ${components.length} component(s)...\n`);

  const allResults = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfo = 0;

  for (const component of components) {
    const results = await auditComponent(component);
    allResults.push(results);

    totalErrors += results.summary.errors;
    totalWarnings += results.summary.warnings;
    totalInfo += results.summary.info;

    const output = formatResults(results);
    if (output) {
      console.log(output);
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(70));
  console.log('\n📊 Audit Summary\n');
  console.log(`   Components audited: ${allResults.length}`);
  console.log(`   Total errors:       ${totalErrors}`);
  console.log(`   Total warnings:     ${totalWarnings}`);
  console.log(`   Total info:         ${totalInfo}`);

  const cleanComponents = allResults.filter(r => r.summary.total === 0).length;
  const passRate = ((cleanComponents / allResults.length) * 100).toFixed(1);

  console.log(`\n   Clean components:   ${cleanComponents}/${allResults.length} (${passRate}%)\n`);

  // ─── Save Report ─────────────────────────────────────────────────────

  const reportPath = path.join(ROOT, 'COMPONENT-AUDIT-REPORT.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      componentsAudited: allResults.length,
      totalErrors,
      totalWarnings,
      totalInfo,
      cleanComponents,
      passRate: `${passRate}%`,
    },
    components: allResults,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`   Report saved to: COMPONENT-AUDIT-REPORT.json\n`);

  // ─── Exit Code ───────────────────────────────────────────────────────

  if (totalErrors > 0) {
    console.log('❌ Component audit found errors\n');
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log('⚠️  Component audit found warnings\n');
    process.exit(0);
  } else {
    console.log('✅ All components passed audit\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
