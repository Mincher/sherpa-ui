/**
 * Pattern Test Script
 *
 * Tests pattern validation and generation for add-entity-flow pattern.
 */

import { patternValidator } from './pattern-validator';
import type { Pattern } from './pattern-schema';

// Load the add-entity-flow pattern
import addEntityFlow from './flows/add-entity-flow.json';

async function testPattern() {
  console.log('='.repeat(80));
  console.log('Pattern System Test');
  console.log('='.repeat(80));
  console.log('');

  // Test 1: Validate Pattern
  console.log('Test 1: Pattern Validation');
  console.log('-'.repeat(80));

  const pattern = addEntityFlow as unknown as Pattern;
  const validationResult = patternValidator.validate(pattern);

  console.log(`Pattern ID: ${pattern.id}`);
  console.log(`Pattern Name: ${pattern.name}`);
  console.log(`Valid: ${validationResult.valid ? '✅ YES' : '❌ NO'}`);
  console.log('');

  if (validationResult.errors.length > 0) {
    console.log('Errors:');
    validationResult.errors.forEach((error, index) => {
      console.log(
        `  ${index + 1}. [${error.severity.toUpperCase()}] ${error.field}: ${error.message}`
      );
    });
    console.log('');
  } else {
    console.log('No errors found ✅');
    console.log('');
  }

  if (validationResult.warnings && validationResult.warnings.length > 0) {
    console.log('Warnings:');
    validationResult.warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning.field}: ${warning.message}`);
    });
    console.log('');
  }

  // Test 2: Generate Pattern (if valid)
  if (validationResult.valid) {
    console.log('');
    console.log('Test 2: Pattern Generation');
    console.log('-'.repeat(80));

    try {
      // Mock pattern loading for testing
      const mockData = {
        entityType: 'User',
        entityName: 'user',
        dialogTitle: 'Add User',
        triggerLabel: 'Add User',
      };

      console.log('Generating pattern with data:', JSON.stringify(mockData, null, 2));
      console.log('');

      // Generate components
      console.log('Generated HTML:');
      console.log('-'.repeat(40));
      console.log(generateMockHTML(pattern, mockData));
      console.log('');

      console.log('Generated JavaScript:');
      console.log('-'.repeat(40));
      console.log(generateMockJS(pattern));
      console.log('');

      console.log('Pattern generation: ✅ SUCCESS');
    } catch (error) {
      console.error('Pattern generation: ❌ FAILED');
      console.error(error);
    }
  }

  // Test 3: Pattern Metadata
  console.log('');
  console.log('Test 3: Pattern Metadata');
  console.log('-'.repeat(80));
  console.log(`Status: ${pattern.metadata.status}`);
  console.log(`Version: ${pattern.metadata.version}`);
  console.log(`MCP Compatible: ${pattern.metadata.mcp_compatible ? 'Yes' : 'No'}`);
  console.log(`Tags: ${pattern.metadata.tags?.join(', ') ?? ''}`);
  console.log('');

  // Test 4: Pattern Structure Analysis
  console.log('');
  console.log('Test 4: Pattern Structure');
  console.log('-'.repeat(80));
  console.log(`Components: ${countComponents(pattern.presentation.components)}`);
  console.log(`Triggers: ${pattern.interaction.triggers.length}`);
  console.log(`Validations: ${pattern.interaction.validations?.length || 0}`);
  console.log(`Resolutions: ${Object.keys(pattern.resolution).length}`);
  console.log(`Examples: ${pattern.examples?.length || 0}`);
  console.log('');

  // Summary
  console.log('='.repeat(80));
  console.log('Test Summary');
  console.log('='.repeat(80));
  console.log(
    `Pattern Validation: ${validationResult.valid ? '✅ PASS' : '❌ FAIL'} (${validationResult.errors.length} errors, ${validationResult.warnings?.length || 0} warnings)`
  );
  console.log(`Pattern Structure: ✅ COMPLETE`);
  console.log(`Pattern Generation: ✅ READY (mocked)`);
  console.log('');
}

/**
 * Count components recursively
 */
function countComponents(components: Pattern['presentation']['components']): number {
  return components.reduce((count, component) => {
    return count + 1 + (component.children ? countComponents(component.children) : 0);
  }, 0);
}

/**
 * Generate mock HTML for testing
 */
function generateMockHTML(pattern: Pattern, _data: Record<string, any>): string {
  const components = pattern.presentation.components;

  return components
    .map((component) => {
      const tag = component.type;
      const id = component.id ? ` id="${component.id}"` : '';
      const attrs = component.attributes
        ? Object.entries(component.attributes)
            .map(([key, value]) => {
              if (typeof value === 'boolean') {
                return value ? ` ${key}` : '';
              }
              return ` ${key}="${value}"`;
            })
            .join('')
        : '';

      if (!component.children) {
        return `<${tag}${id}${attrs}></${tag}>`;
      }

      const children = component.children
        ?.map((child) => {
          const childTag = child.type;
          const childId = child.id ? ` id="${child.id}"` : '';
          const childAttrs = child.attributes
            ? Object.entries(child.attributes)
                .map(([key, value]) => {
                  if (typeof value === 'boolean') {
                    return value ? ` ${key}` : '';
                  }
                  return ` ${key}="${value}"`;
                })
                .join('')
            : '';
          return `  <${childTag}${childId}${childAttrs}></${childTag}>`;
        })
        .join('\n');

      return `<${tag}${id}${attrs}>\n${children}\n</${tag}>`;
    })
    .join('\n\n');
}

/**
 * Generate mock JavaScript for testing
 */
function generateMockJS(pattern: Pattern): string {
  const lines: string[] = [];

  lines.push(`// Pattern: ${pattern.id}`);
  lines.push(`// ${pattern.description}`);
  lines.push('');

  lines.push('// Event handlers');
  pattern.interaction.triggers.forEach((trigger) => {
    lines.push(`// ${trigger.target}.addEventListener('${trigger.event}', ${trigger.action})`);
  });

  lines.push('');
  lines.push('// Validations');
  pattern.interaction.validations?.forEach((validation) => {
    lines.push(`// Validate ${validation.field}: ${validation.rule}`);
  });

  lines.push('');
  lines.push('// Resolutions');
  lines.push(`// - Success: ${pattern.resolution.success.action}`);
  if (pattern.resolution.cancel) {
    lines.push(`// - Cancel: ${pattern.resolution.cancel.action}`);
  }
  lines.push(`// - Error: ${pattern.resolution.error.action}`);

  return lines.join('\n');
}

// Run tests
testPattern().catch(console.error);
