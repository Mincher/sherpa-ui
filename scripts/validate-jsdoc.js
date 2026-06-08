#!/usr/bin/env node
/**
 * validate-jsdoc.js
 *
 * Validates that all Sherpa UI components have complete and properly
 * formatted JSDoc documentation according to COMPONENT-API-STANDARD.md.
 *
 * Usage:
 *   node scripts/validate-jsdoc.js
 *   npm run validate:jsdoc
 *
 * Exit codes:
 *   0 - All components have complete documentation
 *   1 - Some components have missing or malformed documentation
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { jsdocLines } from './jsdoc-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const componentsDir = join(__dirname, '..', 'components');

// Required JSDoc tags per COMPONENT-API-STANDARD.md
const REQUIRED_TAGS = ['element', 'category'];
const OPTIONAL_TAGS = ['attr', 'slot', 'fires', 'method', 'prop', 'csspart', 'cssprop'];

/**
 * Check if a directory is a component directory (starts with sherpa-)
 */
function isComponentDir(path) {
  const name = path.split('/').pop();
  return name.startsWith('sherpa-') && statSync(path).isDirectory();
}

/**
 * Extract JSDoc block from component JS file
 */
function extractJSDoc(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const match = content.match(/\/\*\*[\s\S]*?\*\//);
    return match ? match[0] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Split a JSDoc block into an array of cleaned lines
 * (Same parsing approach as mcp-server/lib/schema-parser.js)
 */
/**
 * Parse JSDoc tags from cleaned lines
 */
function parseJSDocTags(lines) {
  const tags = {};

  for (const line of lines) {
    // Check if line starts with @ tag
    if (line.startsWith('@')) {
      const match = line.match(/^@(\w+)(?:\s+(.*))?$/);
      if (match) {
        const [, tagName, tagValue] = match;
        if (!tags[tagName]) tags[tagName] = [];
        tags[tagName].push(tagValue?.trim() || '');
      }
    }
  }

  return tags;
}

/**
 * Validate a component's JSDoc documentation
 */
function validateComponent(componentName, componentPath) {
  const tsFile = join(componentPath, `${componentName}.ts`);
  const jsFile = join(componentPath, `${componentName}.js`);
  const sourceFile = existsSync(tsFile) ? tsFile : jsFile;
  const jsdoc = extractJSDoc(sourceFile);

  if (!jsdoc) {
    return {
      component: componentName,
      valid: false,
      errors: ['No JSDoc block found'],
      warnings: [],
      tags: {}
    };
  }

  const lines = jsdocLines(jsdoc);
  const tags = parseJSDocTags(lines);
  const errors = [];
  const warnings = [];

  // Check required tags
  for (const requiredTag of REQUIRED_TAGS) {
    if (!tags[requiredTag] || tags[requiredTag].length === 0) {
      errors.push(`Missing required tag: ${requiredTag}`);
    }
  }

  // Validate @element matches component name
  if (tags.element && tags.element[0]) {
    const elementName = tags.element[0].split(/\s+/)[0];
    if (elementName !== componentName) {
      errors.push(`@element "${elementName}" doesn't match component name "${componentName}"`);
    }
  }

  // Validate @category is from known categories
  const VALID_CATEGORIES = [
    'shell', 'nav', 'container', 'overlay', 'content',
    'control', 'input', 'display', 'feedback', 'media', 'data', 'utility', 'ai'
  ];
  if (tags.category && tags.category[0]) {
    const category = tags.category[0].split(/\s+/)[0];
    if (!VALID_CATEGORIES.includes(category)) {
      warnings.push(`@category "${category}" is not in the standard list`);
    }
  }

  // Check for recommended tags
  if (!tags.attr || tags.attr.length === 0) {
    warnings.push('No @attr tags documented (component may have attributes)');
  }

  if (!tags.slot || tags.slot.length === 0) {
    warnings.push('No @slot tags documented (component may have slots)');
  }

  // Validate @attr format: {type} name — description
  if (tags.attr) {
    tags.attr.forEach((attr, idx) => {
      if (!attr.match(/\{[\w|]+\}\s+[\w-]+\s+—/)) {
        warnings.push(`@attr #${idx + 1} doesn't follow format: {type} name — description`);
      }
    });
  }

  // Validate @fires format
  if (tags.fires) {
    tags.fires.forEach((event, idx) => {
      if (!event.match(/[\w-]+\s+—/)) {
        warnings.push(`@fires #${idx + 1} doesn't follow format: event-name — description`);
      }
    });
  }

  return {
    component: componentName,
    valid: errors.length === 0,
    errors,
    warnings,
    tags
  };
}

/**
 * Get all component directories
 */
function getComponentDirs() {
  return readdirSync(componentsDir)
    .map(name => join(componentsDir, name))
    .filter(isComponentDir)
    .map(path => ({
      name: path.split('/').pop(),
      path
    }));
}

// Main execution
console.log('📝 Sherpa UI JSDoc Completeness Validator\n');
console.log('=' .repeat(70));

const components = getComponentDirs();
const results = components.map(({ name, path }) => validateComponent(name, path));

// Separate valid and invalid components
const valid = results.filter(r => r.valid);
const invalid = results.filter(r => !r.valid);
const withWarnings = results.filter(r => r.warnings.length > 0);

// Display results
console.log(`\n📊 Validation Summary\n`);
console.log(`Total components:     ${results.length}`);
console.log(`✅ Valid:              ${valid.length} (${((valid.length / results.length) * 100).toFixed(1)}%)`);
console.log(`❌ Invalid:            ${invalid.length} (${((invalid.length / results.length) * 100).toFixed(1)}%)`);
console.log(`⚠️  With warnings:     ${withWarnings.length} (${((withWarnings.length / results.length) * 100).toFixed(1)}%)`);

// Show invalid components
if (invalid.length > 0) {
  console.log('\n' + '='.repeat(70));
  console.log('❌ Components with Errors\n');

  invalid.forEach(({ component, errors }) => {
    console.log(`\n${component}:`);
    errors.forEach(error => console.log(`  • ${error}`));
  });
}

// Show warnings (limit to first 10 to avoid overwhelming output)
if (withWarnings.length > 0) {
  console.log('\n' + '='.repeat(70));
  console.log('⚠️  Components with Warnings (showing first 10)\n');

  withWarnings.slice(0, 10).forEach(({ component, warnings }) => {
    console.log(`\n${component}:`);
    warnings.forEach(warning => console.log(`  • ${warning}`));
  });

  if (withWarnings.length > 10) {
    console.log(`\n... and ${withWarnings.length - 10} more components with warnings`);
  }
}

// Show tag statistics
console.log('\n' + '='.repeat(70));
console.log('📈 Documentation Coverage\n');

const tagCoverage = {};
[...REQUIRED_TAGS, ...OPTIONAL_TAGS].forEach(tagName => {
  const count = results.filter(r => r.tags[tagName] && r.tags[tagName].length > 0).length;
  const percentage = ((count / results.length) * 100).toFixed(1);
  tagCoverage[tagName] = { count, percentage };
});

Object.entries(tagCoverage).forEach(([tagName, { count, percentage }]) => {
  const bar = '█'.repeat(Math.floor(percentage / 5));
  const isRequired = REQUIRED_TAGS.includes(tagName);
  const label = isRequired ? `@${tagName} (required)` : `@${tagName}`;
  console.log(`${label.padEnd(20)} ${bar.padEnd(20)} ${count}/${results.length} (${percentage}%)`);
});

// Final status
console.log('\n' + '='.repeat(70));
if (invalid.length === 0) {
  console.log('✅ All components have valid JSDoc documentation!\n');
  process.exit(0);
} else {
  console.log(`❌ ${invalid.length} component(s) have incomplete documentation.\n`);
  console.log('Fix the errors above and run this validator again.');
  console.log('See docs/COMPONENT-API-STANDARD.md for JSDoc format requirements.\n');
  process.exit(1);
}
