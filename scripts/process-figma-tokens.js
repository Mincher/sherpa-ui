#!/usr/bin/env node

/**
 * Figma Tokens 2.0 to CSS Processor
 * 
 * This script processes Figma Variable tokens from JSON files and generates
 * modular CSS files organized by token type, preserving the full alias chain:
 * 
 * CSS File Hierarchy (mirrors Figma):
 * - core-tokens.css     - Primitive values (raw colors, sizes, scales)
 * - alias-tokens.css    - Semantic aliases referencing core tokens via var()
 * - color-tokens.css    - Theme tokens using light-dark() with var() references
 * Status-aware components now rely on semantically named tokens defined in alias-tokens.css.
 *   (sizing, spacing, and border aliases now live in alias-tokens.css)
 * 
 * Token Hierarchy in Figma:
 * 1. Primitives - Raw core values (scales, base colors)
 * 2. Alias - Semantic definitions referencing primitives
 * 3. Themes (Light/Dark) - Theme overrides referencing alias (and sometimes primitives)
 * 4. Status - Status-specific tokens referencing theme tokens
 * 
 * Usage: node scripts/process-figma-tokens.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  inputDir: path.join(__dirname, '../figma-tokens/tokens 2.0'),
  outputDir: path.join(__dirname, '../css/styles'),
  files: {
    primitives: 'Primatives/Value.tokens.json',
    alias: 'Alias/Value.tokens.json',
    themes: {
      light: 'Apex 2.0/Light.tokens.json',
      dark: 'Apex 2.0/Dark.tokens.json'
    },
  }
};

// Token type categories for classification
const TOKEN_CATEGORIES = {
  color: ['color', 'surface', 'text', 'icon', 'control', 'fill', 'bg', 'background', 'foreground'],
  text: ['typeface', 'typography', 'font', 'line-height', 'letter-spacing', 'paragraph-spacing', 'weight'],
  spacing: ['space', 'gap', 'padding', 'margin', 'inset'],
  sizing: ['scale', 'size', 'width', 'height', 'min', 'max'],
  border: ['border', 'radius', 'rounding', 'stroke'],
  shadow: ['shadow', 'blur', 'offset', 'spread', 'opacity', 'effect']
};

// ============================================================================
// Utility Functions
// ============================================================================

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function writeFile(filePath, content) {
  ensureDirectoryExists(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Generated: ${filePath}`);
}

/**
 * Convert a color value from Figma format to CSS
 */
function colorToCss(colorValue) {
  if (!colorValue) return null;
  
  // If it's already a hex string
  if (typeof colorValue === 'string') {
    if (colorValue.startsWith('#')) return colorValue;
    return colorValue;
  }
  
  // If it's an object with components
  if (colorValue.components) {
    const [r, g, b] = colorValue.components.map(c => Math.round(c * 255));
    const alpha = colorValue.alpha !== undefined ? colorValue.alpha : 1;
    
    if (alpha < 1) {
      return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
    }
    return colorValue.hex || `rgb(${r}, ${g}, ${b})`;
  }
  
  return null;
}

/**
 * Convert a path like "color/text/default" to CSS variable name "color-text-default"
 */
function pathToVarName(pathStr) {
  return pathStr
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[()><]/g, '')  // Remove parentheses and angle brackets
    .replace(/-+/g, '-')     // Collapse multiple dashes into one
    .replace(/^-|-$/g, '')   // Remove leading/trailing dashes
    .toLowerCase();
}

/**
 * Determine the appropriate prefix based on the alias target set name
 * @param {string} targetSetName - The targetVariableSetName from aliasData
 * @returns {string} - The CSS variable prefix
 */
function getPrefixForTargetSet(targetSetName) {
  const name = (targetSetName || '').toLowerCase();
  
  // Only primitives use sherpa-core prefix
  // All other tokens (alias, theme, etc.) reference via sherpa-core or sherpa
  if (name === 'primatives' || name === 'primitives') {
    return 'sherpa-core';
  }
  // Alias tokens are referenced as sherpa- (semantic layer)
  return 'sherpa';
}

/**
 * Get alias reference from a token's aliasData
 * @param {Object} token - The token object
 * @returns {Object|null} - { ref: CSS var() string, targetSet: name } or null
 */
function getAliasReference(token) {
  const aliasData = token.$extensions?.['com.figma.aliasData'];
  if (!aliasData?.targetVariableName) return null;
  
  const targetPath = aliasData.targetVariableName;
  const targetSet = aliasData.targetVariableSetName || '';
  const prefix = getPrefixForTargetSet(targetSet);
  
  return {
    ref: `var(--${prefix}-${pathToVarName(targetPath)})`,
    targetSet: targetSet
  };
}

/**
 * Convert a token value to CSS value with appropriate unit
 * @param {Object} token - The token object
 * @param {string} path - The token path
 * @param {Object} options - Options for conversion
 * @param {boolean} options.resolveAliases - Whether to resolve alias references (default: false)
 */
function tokenToCssValue(token, path = '', options = {}) {
  const { resolveAliases = false } = options;
  const type = token.$type;
  const value = token.$value;
  
  if (value === undefined || value === null) return null;
  
  // Check for alias reference first (if resolveAliases is enabled)
  if (resolveAliases) {
    const aliasInfo = getAliasReference(token);
    if (aliasInfo) return aliasInfo.ref;
  }
  
  // Handle reference values (aliases) in the value itself
  if (typeof value === 'string' && value.startsWith('{')) {
    const refPath = value.slice(1, -1);
    return `var(--sherpa-${pathToVarName(refPath)})`;
  }
  
  switch (type) {
    case 'color':
      return colorToCss(value);
    
    case 'number':
      // Determine unit based on scope or context
      const scopes = token.$extensions?.['com.figma.scopes'] || [];
      
      if (scopes.includes('FONT_SIZE') || scopes.includes('LINE_HEIGHT') || 
          scopes.includes('PARAGRAPH_SPACING') || scopes.includes('LETTER_SPACING')) {
        return `${value}px`;
      }
      if (scopes.includes('CORNER_RADIUS')) {
        return value === 999 ? '9999px' : `${value}px`;
      }
      if (scopes.includes('STROKE_FLOAT') || scopes.includes('GAP') || 
          scopes.includes('WIDTH_HEIGHT') || scopes.includes('EFFECT_FLOAT')) {
        return `${value}px`;
      }
      // Check path for context
      if (path.includes('space') || path.includes('gap') || path.includes('size') || 
          path.includes('scale') || path.includes('radius') || path.includes('stroke') ||
          path.includes('width') || path.includes('height') || path.includes('offset') ||
          path.includes('blur') || path.includes('spread')) {
        return `${value}px`;
      }
      // Default: return number as-is
      return value;
    
    case 'string':
      // Wrap font names in quotes if they contain spaces
      if (value.includes(' ') && (path.includes('font') || path.includes('typeface'))) {
        return `"${value}"`;
      }
      return value;
    
    default:
      if (typeof value === 'object' && value.components) {
        return colorToCss(value);
      }
      return value;
  }
}

/**
 * Determine the category of a token based on its path
 */
function categorizeToken(path) {
  const lowerPath = path.toLowerCase();
  
  // Check each category
  for (const [category, keywords] of Object.entries(TOKEN_CATEGORIES)) {
    for (const keyword of keywords) {
      if (lowerPath.startsWith(keyword) || lowerPath.includes(`/${keyword}`) || lowerPath.includes(`-${keyword}`)) {
        // Special case: border colors should be in color category
        if (category === 'border' && (
            lowerPath.includes('color') || 
            lowerPath.includes('/container') || lowerPath.includes('-container') ||
            lowerPath.includes('/control') || lowerPath.includes('-control') ||
            lowerPath.includes('/context') || lowerPath.includes('-context')
        )) {
          return 'color';
        }
        return category;
      }
    }
  }
  
  return 'other';
}

/**
 * Recursively flatten a nested token object into CSS variables
 * @param {Object} obj - The token object to flatten
 * @param {string} prefix - The current path prefix
 * @param {Object} result - The result object to populate
 * @param {Object} options - Options for flattening
 * @param {boolean} options.resolveAliases - Whether to resolve alias references
 * @param {string} options.varPrefix - The prefix for the generated variable names
 */
function flattenTokens(obj, prefix = '', result = {}, options = {}) {
  const { varPrefix = 'sherpa' } = options;
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip extensions and properties metadata
    if (key === '$extensions' || key === 'properties') continue;
    
    const newPrefix = prefix ? `${prefix}-${key}` : key;
    
    // Check if this is a token (has $type and $value)
    if (value && typeof value === 'object' && '$type' in value && '$value' in value) {
      const cssValue = tokenToCssValue(value, newPrefix, options);
      if (cssValue !== null) {
        const varName = `${varPrefix}-${pathToVarName(newPrefix)}`;
        const aliasData = value.$extensions?.['com.figma.aliasData'];
        result[varName] = {
          value: cssValue,
          type: value.$type,
          path: newPrefix,
          category: categorizeToken(newPrefix),
          hasAliasRef: options.resolveAliases && !!aliasData,
          aliasTarget: aliasData?.targetVariableName || null,
          aliasTargetSet: aliasData?.targetVariableSetName || null
        };
      }
    } else if (value && typeof value === 'object') {
      // Recurse into nested objects
      flattenTokens(value, newPrefix, result, options);
    }
  }
  
  return result;
}

/**
 * Generate CSS custom properties from tokens filtered by category
 */
function generateCssProperties(tokens, selector = ':root', categories = null) {
  const filtered = categories 
    ? Object.entries(tokens).filter(([_, t]) => categories.includes(t.category))
    : Object.entries(tokens);
  
  const lines = filtered
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, token]) => `  --${name}: ${token.value};`);
  
  if (lines.length === 0) return '';
  
  return `${selector} {\n${lines.join('\n')}\n}`;
}

/**
 * Generate light-dark() themed CSS properties
 */
function generateThemedCssProperties(lightTokens, darkTokens, selector = ':root') {
  const allKeys = new Set([...Object.keys(lightTokens), ...Object.keys(darkTokens)]);
  const lines = [];
  const sharedLines = [];
  
  for (const key of [...allKeys].sort()) {
    const lightToken = lightTokens[key];
    const darkToken = darkTokens[key];
    
    if (lightToken && darkToken) {
      if (lightToken.value === darkToken.value) {
        // Same value in both themes - no need for light-dark()
        sharedLines.push(`  --${key}: ${lightToken.value};`);
      } else {
        // Different values - use light-dark()
        lines.push(`  --${key}: light-dark(${lightToken.value}, ${darkToken.value});`);
      }
    } else if (lightToken) {
      sharedLines.push(`  --${key}: ${lightToken.value};`);
    } else if (darkToken) {
      sharedLines.push(`  --${key}: ${darkToken.value};`);
    }
  }
  
  // Combine shared and themed
  const allLines = [...sharedLines, ...lines];
  
  if (allLines.length === 0) return '';
  
  return `${selector} {\n${allLines.join('\n')}\n}`;
}

/**
 * Filter tokens by category
 */
function filterByCategory(tokens, categories) {
  const result = {};
  for (const [key, token] of Object.entries(tokens)) {
    if (categories.includes(token.category)) {
      result[key] = token;
    }
  }
  return result;
}

/**
 * Generate file header
 */
function generateHeader(title) {
  return `/**
 * ${title}
 * Auto-generated from Figma Variables (Tokens 2.0)
 * Do not edit manually - regenerate using: node scripts/process-figma-tokens.js
 */

`;
}

// ============================================================================
// CSS File Generators
// ============================================================================

/**
 * Generate core-tokens.css from primitives (raw values only)
 */
function generateCoreTokens(primitiveTokens) {
  let css = generateHeader('Core Tokens (Primitives)');
  css += `/* Raw design values - colors, sizes, scales */\n`;
  css += `/* These are referenced by alias tokens via var() */\n\n`;
  css += generateCssProperties(primitiveTokens);
  
  return css;
}

/**
 * Generate alias-tokens.css with var() references to core tokens
 */
function generateAliasTokens(aliasTokens) {
  let css = generateHeader('Alias Tokens (Semantic)');
  css += `/* Semantic tokens referencing core primitives */\n`;
  css += `/* These are referenced by theme tokens via var() */\n\n`;
  css += generateCssProperties(aliasTokens);
  
  return css;
}

/**
 * Generate color-tokens.css with light-dark() for themed values
 */
function generateColorTokens(lightTokens, darkTokens) {
  const lightColors = filterByCategory(lightTokens, ['color']);
  const darkColors = filterByCategory(darkTokens, ['color']);
  
  let css = generateHeader('Color Tokens (Themed)');
  css += `/* Enable automatic light/dark switching */\n`;
  css += `:root {\n  color-scheme: light dark;\n}\n\n`;
  css += `/* Force light mode */\n`;
  css += `[data-theme="light"] {\n  color-scheme: light;\n}\n\n`;
  css += `/* Force dark mode */\n`;
  css += `[data-theme="dark"] {\n  color-scheme: dark;\n}\n\n`;
  css += `/* Color tokens using light-dark() for automatic theme switching */\n`;
  css += `/* These reference alias and core tokens via var() */\n`;
  css += generateThemedCssProperties(lightColors, darkColors);
  
  return css;
}

/**
 * Generate text-tokens.css - semantic typography tokens only
 * Primitives are in core-tokens.css
 */
function generateTextTokens(aliasTokens) {
  let css = generateHeader('Text/Typography Tokens');
  
  // Only semantic text tokens (font contexts, scales)
  const aliasTextTokens = filterByCategory(aliasTokens, ['text']);
  if (Object.keys(aliasTextTokens).length > 0) {
    css += `/* Semantic typography tokens */\n`;
    css += `/* Reference core typeface tokens via var() */\n`;
    css += generateCssProperties(aliasTextTokens);
  }
  
  return css;
}

/**
 * Generate shadow-tokens.css with light-dark() for themed values
 * Primitives are in core-tokens.css
 */
function generateShadowTokens(aliasTokens, lightTokens, darkTokens) {
  let css = generateHeader('Shadow/Effect Tokens');
  
  // Semantic shadow tokens from alias
  const aliasShadowTokens = filterByCategory(aliasTokens, ['shadow']);
  if (Object.keys(aliasShadowTokens).length > 0) {
    css += `/* Semantic shadow tokens */\n`;
    css += generateCssProperties(aliasShadowTokens);
    css += '\n\n';
  }
  
  // Get themed shadow colors
  const lightShadows = filterByCategory(lightTokens, ['shadow']);
  const darkShadows = filterByCategory(darkTokens, ['shadow']);
  
  if (Object.keys(lightShadows).length > 0 || Object.keys(darkShadows).length > 0) {
    css += `/* Themed shadow tokens */\n`;
    css += generateThemedCssProperties(lightShadows, darkShadows);
  }
  
  return css;
}

/**
 * Generate index.css that imports all modular CSS files
 */
function generateIndexCss() {
  return `/**
 * Apex Design Tokens (Tokens 2.0)
 * Auto-generated index file
 * Do not edit manually - regenerate using: node scripts/process-figma-tokens.js
 */

/* Core primitive values (raw colors, sizes, scales) */
@import "core-tokens.css";

/* Semantic alias tokens (reference core tokens) */
@import "alias-tokens.css";

/* Non-themed tokens (additional sizing, spacing, and border aliases live in alias-tokens.css) */
@import "text-tokens.css";
@import "shadow-tokens.css";

/* Themed tokens (uses CSS light-dark() function) */
@import "color-tokens.css";

/* Utility classes */
@import "motion-styles.css";
`;
}

// ============================================================================
// Main Processing Function
// ============================================================================

function main() {
  console.log('Processing Figma Tokens 2.0...\n');
  
  // Read all token files
  const primitives = readJsonFile(path.join(CONFIG.inputDir, CONFIG.files.primitives));
  const alias = readJsonFile(path.join(CONFIG.inputDir, CONFIG.files.alias));
  const lightTheme = readJsonFile(path.join(CONFIG.inputDir, CONFIG.files.themes.light));
  const darkTheme = readJsonFile(path.join(CONFIG.inputDir, CONFIG.files.themes.dark));
  
  
  // Flatten all tokens with appropriate options
  console.log('Flattening token structures...');
  
  // Primitives: literal values, no aliases, use 'sherpa-core' prefix
  const primitiveTokens = primitives ? flattenTokens(primitives, '', {}, { 
    varPrefix: 'sherpa-core',
    resolveAliases: false 
  }) : {};
  
  // Alias: resolve to var() references pointing to core tokens
  // Use 'sherpa' prefix so components use --sherpa-* tokens
  const aliasTokens = alias ? flattenTokens(alias, '', {}, { 
    varPrefix: 'sherpa',
    resolveAliases: true
  }) : {};
  
  // Theme tokens: resolve to var() references (can point to alias or core)
  const lightTokens = lightTheme ? flattenTokens(lightTheme, '', {}, { 
    varPrefix: 'sherpa',
    resolveAliases: true
  }) : {};
  
  const darkTokens = darkTheme ? flattenTokens(darkTheme, '', {}, { 
    varPrefix: 'sherpa',
    resolveAliases: true
  }) : {};
  
  // Log token counts
  console.log(`\nToken counts:`);
  console.log(`  Core (Primitives): ${Object.keys(primitiveTokens).length}`);
  console.log(`  Alias: ${Object.keys(aliasTokens).length}`);
  console.log(`  Light theme: ${Object.keys(lightTokens).length}`);
  console.log(`  Dark theme: ${Object.keys(darkTokens).length}`);
  
  // Generate modular CSS files
  console.log('\nGenerating CSS files...');
  
  // Core tokens (primitives with literal values)
  writeFile(
    path.join(CONFIG.outputDir, 'core-tokens.css'),
    generateCoreTokens(primitiveTokens)
  );
  
  // Alias tokens (semantic with var() references to core)
  writeFile(
    path.join(CONFIG.outputDir, 'alias-tokens.css'),
    generateAliasTokens(aliasTokens)
  );
  
  // Color tokens (themed with light-dark() and var() references)
  writeFile(
    path.join(CONFIG.outputDir, 'color-tokens.css'),
    generateColorTokens(lightTokens, darkTokens)
  );
  
  // Text/typography tokens
  writeFile(
    path.join(CONFIG.outputDir, 'text-tokens.css'),
    generateTextTokens(aliasTokens)
  );
  
  // Shadow tokens
  writeFile(
    path.join(CONFIG.outputDir, 'shadow-tokens.css'),
    generateShadowTokens(aliasTokens, lightTokens, darkTokens)
  );
  
  // Index file
  writeFile(
    path.join(CONFIG.outputDir, 'index.css'),
    generateIndexCss()
  );
  
  console.log('\n✓ Token processing complete!');
  console.log(`\nGenerated files in: ${CONFIG.outputDir}`);
  console.log('\nToken hierarchy:');
  console.log('  core-tokens.css    → Raw values (--sherpa-core-*) - internal only');
  console.log('  All other files    → var(--sherpa-core-*) references (--sherpa-*) - for components');
  console.log('\nComponents should only use --sherpa-* tokens, never --sherpa-core-*');
  console.log('\nTo use these tokens, import in your main CSS:');
  console.log('  @import "css/styles/index.css";');
}

// Run the script
main();
