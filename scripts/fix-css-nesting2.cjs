#!/usr/bin/env node
/**
 * fix-css-nesting2.js
 *
 * Fixes broken CSS nesting anti-patterns in Sherpa component shadow DOM stylesheets.
 *
 * Problem:
 *   CSS nesting "&[attr]" or "&(:not(...))" inside ":host {}" desugars to ":host[attr]"
 *   (chained form), which does NOT work in shadow DOM.
 *   The correct form is ":host([attr])" (functional form).
 *
 * What this script does:
 *   - Parses each CSS file's ":host { ... }" block(s)
 *   - Lifts all nested "& ..." rules out as standalone top-level rules
 *   - Converts "&" to the right ":host(...)" form based on what follows "&"
 *   - Leaves "& .child { ... }" simple descendant rules as ":host .child { ... }"
 *   - Direct properties (display, color, etc.) stay inside ":host { ... }"
 *
 * Usage:
 *   node scripts/fix-css-nesting2.js [--dry-run]
 */

const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs');
const { join, extname } = require('path');

const ROOT = join(__dirname, '..');
const COMPONENTS_DIR = join(ROOT, 'components');
const DRY_RUN = process.argv.includes('--dry-run');

let totalFiles = 0;
let modifiedFiles = 0;

// ---------------------------------------------------------------------------
// Tokenizer helpers
// ---------------------------------------------------------------------------

/** Read past whitespace; return new index */
function skipWs(src, i) {
  while (i < src.length && /\s/.test(src[i])) i++;
  return i;
}

/** Read a comment "/* ... */"; return { content, end } */
function readComment(src, i) {
  if (src.slice(i, i + 2) !== '/*') return null;
  const end = src.indexOf('*/', i + 2);
  if (end === -1) return { content: src.slice(i), end: src.length };
  return { content: src.slice(i, end + 2), end: end + 2 };
}

/**
 * Read a balanced block "{ ... }" starting at index "i" (which must be "{").
 * Returns "{ inner, end }" where inner is the content between the braces, end is after "}".
 */
function readBlock(src, i) {
  if (src[i] !== '{') throw new Error('Expected { at ' + i + ', got ' + src[i]);
  let depth = 1;
  let j = i + 1;
  while (j < src.length && depth > 0) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') depth--;
    j++;
  }
  return { inner: src.slice(i + 1, j - 1), end: j };
}

/**
 * Read past a selector (everything up to the next "{" at depth 0).
 * Returns "{ selector, braceStart }".
 */
function readSelector(src, i) {
  let j = i;
  let parenDepth = 0;
  while (j < src.length) {
    const ch = src[j];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth--;
    else if (ch === '{' && parenDepth === 0) {
      return { selector: src.slice(i, j).trim(), braceStart: j };
    }
    j++;
  }
  return null; // no block found
}

// ---------------------------------------------------------------------------
// Core transformer
// ---------------------------------------------------------------------------

/**
 * Given the inner content of a ":host { ... }" block and the host's own selector
 * (e.g. ':host' or ':host([data-foo])'), extract:
 *  - directProps: raw CSS property text that stays in the :host block
 *  - liftedRules: standalone rules to emit after the :host block
 */
function parseHostBlock(hostSelector, inner) {
  const directProps = [];
  const liftedRules = [];

  let i = 0;

  while (i < inner.length) {
    i = skipWs(inner, i);
    if (i >= inner.length) break;

    // Comment?
    const comment = readComment(inner, i);
    if (comment) {
      directProps.push(comment.content);
      i = comment.end;
      continue;
    }

    // Nested rule starting with "&"?
    if (inner[i] === '&') {
      // Read the selector for this nested rule (up to "{")
      const sel = readSelector(inner, i);
      if (!sel) { i++; continue; }

      const { selector: nestedSel, braceStart } = sel;
      const block = readBlock(inner, braceStart);

      // Transform to standalone rule
      const rule = buildStandaloneRule(hostSelector, nestedSel, block.inner);
      liftedRules.push(rule);

      i = block.end;
      continue;
    }

    // Otherwise: a property declaration, @rule, or plain rule (ends with ; or is a block)
    // Find the end of this declaration
    const propStart = i;
    let parenD = 0;
    let foundEnd = false;

    while (i < inner.length) {
      const ch = inner[i];
      if (ch === '(') parenD++;
      else if (ch === ')') parenD--;
      else if (ch === ';' && parenD === 0) {
        i++;
        foundEnd = true;
        break;
      } else if (ch === '{' && parenD === 0) {
        // A block (e.g. @container, @media) — read whole thing
        const block = readBlock(inner, i);
        i = block.end;
        foundEnd = true;
        break;
      } else if (ch === '&') {
        // Hit another & without finding a semicolon — edge case
        break;
      }
      i++;
    }

    const propText = inner.slice(propStart, i).trim();
    if (propText) directProps.push(propText);
    if (!foundEnd && i < inner.length && inner[i] !== '&') i++;
  }

  return { directProps, liftedRules };
}

/**
 * Convert a nested "& ..." selector + block into a standalone ":host(...)" rule string.
 *
 * @param {string} hostSelector - e.g. ':host' or ':host([data-foo])'
 * @param {string} nestedSel - e.g. '&[data-active] .label' or '& .child' or '&[a],\n  &[b]'
 * @param {string} blockInner - inner CSS of the nested block
 */
function buildStandaloneRule(hostSelector, nestedSel, blockInner) {
  // The nested selector may be multi-part (comma-separated), and each part starts with &
  // Split at top-level commas
  const parts = splitTopLevelComma(nestedSel);

  const resolvedParts = parts.map(part => {
    part = part.trim();
    if (!part.startsWith('&')) return part; // unexpected, keep as-is

    const afterAmpersand = part.slice(1); // everything after &

    // Determine host compound vs descendant
    // afterAmpersand examples:
    //   '[data-active] .label'   → hostCompound='[data-active]', descendant=' .label'
    //   '(:not([x])) .child'     → hostCompound='(:not([x]))', descendant=' .child'
    //   ':focus-visible .child'  → hostCompound=':focus-visible', descendant=' .child'
    //   '[a][b]:focus'           → hostCompound='[a][b]:focus', descendant=''
    //   ' .child'                → hostCompound='', descendant=' .child'
    //   ''                       → hostCompound='', descendant=''

    let hostCompound = '';
    let descendant = '';

    if (afterAmpersand === '' || /^[\s>+~]/.test(afterAmpersand)) {
      // Simple descendant or no addition
      hostCompound = '';
      descendant = afterAmpersand;
    } else {
      // Parse the host compound (no spaces/combinators at top level)
      let j = 0;
      let pD = 0, bD = 0;
      while (j < afterAmpersand.length) {
        const ch = afterAmpersand[j];
        if (ch === '(') pD++;
        else if (ch === ')') pD--;
        else if (ch === '[') bD++;
        else if (ch === ']') bD--;
        else if ((ch === ' ' || ch === '>' || ch === '+' || ch === '~') && pD === 0 && bD === 0) {
          break;
        }
        j++;
      }
      hostCompound = afterAmpersand.slice(0, j);
      descendant = afterAmpersand.slice(j);
    }

    // Build the new :host(...) selector
    // Get the host's existing attribute part (if any)
    // e.g. ':host([data-foo])' → existingInner = '[data-foo]'
    const existingInnerMatch = hostSelector.match(/^:host\((.+)\)$/s);
    const existingInner = existingInnerMatch ? existingInnerMatch[1] : '';

    let newHost;
    if (hostCompound === '') {
      // Simple descendant — no compounding needed
      newHost = hostSelector; // e.g. ':host'
    } else if (hostCompound.startsWith('(') && hostCompound.endsWith(')')) {
      // Functional form: &(:not([x])) → :host(:not([x]))
      if (existingInner) {
        // Merge: :host([foo]) + &(:not([x])) → :host([foo]:not([x]))
        const innerContent = hostCompound.slice(1, -1);
        newHost = ":host(${existingInner}${innerContent})";
      } else {
        newHost = ":host${hostCompound}";
      }
    } else {
      // Attribute/pseudo: &[attr] or &:pseudo
      if (existingInner) {
        newHost = ":host(${existingInner}${hostCompound})";
      } else {
        newHost = ":host(${hostCompound})";
      }
    }

    return "${newHost}${descendant}";
  });

  const fullSelector = resolvedParts.join(',\n');

  // Check if blockInner itself has nested & rules — if so, recurse
  let resolvedInner = blockInner;
  if (/^\s*&/m.test(blockInner)) {
    // Use the resolved host selector (first part, just the :host(...) without descendant)
    const firstHostPart = resolvedParts[0].replace(/\s.*$/, '').trim();
    const { directProps, liftedRules } = parseHostBlock(firstHostPart, blockInner);
    // Flatten: the inner direct props become the body; lifted rules become additional top-level rules
    // We'll just inline them after this rule (handled by caller)
    // For now: join direct props + lifted rules inline
    const parts2 = [];
    if (directProps.length) parts2.push(directProps.join('\n'));
    parts2.push(...liftedRules);
    resolvedInner = parts2.join('\n');
  }

  // Indent the inner content
  const indented = resolvedInner
    .split('\n')
    .map(line => line ? "  ${line}" : line)
    .join('\n')
    .trim();

  return "${fullSelector} {\n  ${indented}\n}";
}

/**
 * Split a string by top-level commas (not inside parens or brackets).
 */
function splitTopLevelComma(str) {
  const parts = [];
  let current = '';
  let pD = 0, bD = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') pD++;
    else if (ch === ')') pD--;
    else if (ch === '[') bD++;
    else if (ch === ']') bD--;
    else if (ch === ',' && pD === 0 && bD === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

// ---------------------------------------------------------------------------
// File-level transformer
// ---------------------------------------------------------------------------

/**
 * Process a full CSS file string, fixing all :host { & ... } patterns.
 */
function processCss(src) {
  let result = '';
  let i = 0;

  while (i < src.length) {
    // Check for a comment
    const comment = readComment(src, i);
    if (comment) {
      result += comment.content;
      i = comment.end;
      continue;
    }

    // Look for ":host" keyword
    if (src.slice(i, i + 5) === ':host') {
      // Read the full selector for this :host rule
      const sel = readSelector(src, i);
      if (!sel) {
        result += src[i++];
        continue;
      }

      const { selector: hostSelector, braceStart } = sel;

      // Only process if it's a :host selector (could be :host-context etc.)
      if (!hostSelector.match(/^:host(\(.*\))?$/s)) {
        result += src.slice(i, braceStart);
        i = braceStart;
        continue;
      }

      const block = readBlock(src, braceStart);

      // Parse the host block
      const { directProps, liftedRules } = parseHostBlock(hostSelector, block.inner);

      // Reconstruct: :host { direct props } \n lifted rules
      const directContent = directProps.map(p => "  ${p.replace(/\n/g, '\n  ')}").join('\n');

      if (directContent.trim()) {
        result += "${hostSelector} {\n${directContent}\n}";
      }
      // Always emit a newline between original block end and lifted rules
      if (liftedRules.length) {
        result += '\n' + liftedRules.join('\n') + '\n';
      }

      i = block.end;
      continue;
    }

    result += src[i++];
  }

  return result;
}

// ---------------------------------------------------------------------------
// Walk directory
// ---------------------------------------------------------------------------

function walkCss(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walkCss(full));
    else if (extname(entry) === '.css') files.push(full);
  }
  return files;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const cssFiles = walkCss(COMPONENTS_DIR);

for (const file of cssFiles) {
  const src = readFileSync(file, 'utf8');

  // Quick pre-filter: only process files that have nested & rules that compound on host
  if (!/&\[|&\(:not|&\(:is|&\(:has|&:/.test(src)) continue;

  totalFiles++;

  let fixed;
  try {
    fixed = processCss(src);
  } catch (err) {
    console.error("ERROR processing ${file}: ${err.message}");
    continue;
  }

  if (fixed === src) {
    continue;
  }

  modifiedFiles++;
  if (DRY_RUN) {
    console.log("[dry-run] Would modify: ${file.replace(ROOT + '/', '')}");
  } else {
    writeFileSync(file, fixed, 'utf8');
    console.log("Fixed: ${file.replace(ROOT + '/', '')}");
  }
}

console.log("\nScanned ${totalFiles} files with & nesting patterns. Modified: ${modifiedFiles}.");
