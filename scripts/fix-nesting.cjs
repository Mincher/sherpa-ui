// fix-css-nesting.cjs
// Converts broken CSS nesting inside :host{} blocks to standalone :host([...]) rules.
// Usage: node scripts/fix-css-nesting.cjs [--dry-run]

const { readFileSync, writeFileSync, readdirSync, statSync } = require('fs');
const { join, extname } = require('path');

const ROOT = join(__dirname, '..');
const COMPONENTS_DIR = join(ROOT, 'components');
const DRY_RUN = process.argv.includes('--dry-run');

let totalFiles = 0;
let modifiedFiles = 0;

// Skip whitespace
function skipWs(src, i) {
  while (i < src.length && /\s/.test(src[i])) i++;
  return i;
}

// Read a block starting at i (must be '{'), returns {inner, end}
function readBlock(src, i) {
  let depth = 1;
  let j = i + 1;
  while (j < src.length && depth > 0) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') depth--;
    j++;
  }
  return { inner: src.slice(i + 1, j - 1), end: j };
}

// Read selector up to '{', returns {selector, braceStart} or null
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
  return null;
}

// Split string by top-level commas
function splitComma(str) {
  const parts = [];
  let current = '';
  let pD = 0, bD = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(' || ch === '[') { if(ch==='(') pD++; else bD++; }
    else if (ch === ')' || ch === ']') { if(ch===')') pD--; else bD--; }
    else if (ch === ',' && pD === 0 && bD === 0) {
      parts.push(current); current = ''; continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

// Convert a single & selector part into a :host() selector + descendant
function ampToHost(hostSelector, part) {
  part = part.trim();
  if (!part.startsWith('&')) return part;

  const after = part.slice(1); // everything after &

  // Determine the host compound vs descendant
  let hostCompound = '';
  let descendant = '';

  if (after === '' || /^[\s>+~]/.test(after)) {
    // Simple descendant, no host compounding
    hostCompound = '';
    descendant = after;
  } else {
    // Parse host compound: everything before first space/combinator at top level
    let j = 0;
    let pD = 0, bD = 0;
    while (j < after.length) {
      const ch = after[j];
      if (ch === '(') pD++;
      else if (ch === ')') pD--;
      else if (ch === '[') bD++;
      else if (ch === ']') bD--;
      else if ((ch === ' ' || ch === '>' || ch === '+' || ch === '~') && pD === 0 && bD === 0) break;
      j++;
    }
    hostCompound = after.slice(0, j);
    descendant = after.slice(j);
  }

  // Get existing host attribute (e.g. :host([data-foo]) -> existingInner = '[data-foo]')
  const existingInnerMatch = hostSelector.match(/^:host\((.+)\)$/s);
  const existingInner = existingInnerMatch ? existingInnerMatch[1] : '';

  let newHost;
  if (hostCompound === '') {
    newHost = hostSelector; // just ':host' or ':host([...])'
  } else if (hostCompound.startsWith('(') && hostCompound.endsWith(')')) {
    // Functional form: &(:not([x])) -> :host(:not([x]))
    const inner = hostCompound.slice(1, -1);
    newHost = existingInner ? ':host(' + existingInner + inner + ')' : ':host' + hostCompound;
  } else {
    // Attribute/pseudo: &[attr] or &:pseudo
    newHost = existingInner
      ? ':host(' + existingInner + hostCompound + ')'
      : ':host(' + hostCompound + ')';
  }

  return newHost + descendant;
}

// Build a standalone rule from nested & selector + block content
function buildRule(hostSelector, nestedSel, blockInner) {
  const parts = splitComma(nestedSel);
  const resolvedParts = parts.map(p => ampToHost(hostSelector, p));
  const fullSelector = resolvedParts.join(',\n');

  const trimmed = blockInner.trim();
  const indented = trimmed.split('\n').map(l => '  ' + l).join('\n');

  return fullSelector + ' {\n' + indented + '\n}';
}

// Parse the inner content of a :host { ... } block
// Returns { directProps (string[]), liftedRules (string[]) }
function parseHostBlock(hostSelector, inner) {
  const directProps = [];
  const liftedRules = [];
  let i = 0;

  while (i < inner.length) {
    i = skipWs(inner, i);
    if (i >= inner.length) break;

    // Comment?
    if (inner.slice(i, i + 2) === '/*') {
      const end = inner.indexOf('*/', i + 2);
      const endPos = end === -1 ? inner.length : end + 2;
      directProps.push(inner.slice(i, endPos));
      i = endPos;
      continue;
    }

    // Nested rule starting with &?
    if (inner[i] === '&') {
      const sel = readSelector(inner, i);
      if (!sel) { i++; continue; }

      const { selector: nestedSel, braceStart } = sel;
      const block = readBlock(inner, braceStart);

      liftedRules.push(buildRule(hostSelector, nestedSel, block.inner));
      i = block.end;
      continue;
    }

    // Direct property/declaration - find end (;) or block ({...})
    const propStart = i;
    let parenD = 0;
    let done = false;

    while (i < inner.length) {
      const ch = inner[i];
      if (ch === '(') parenD++;
      else if (ch === ')') parenD--;
      else if (ch === ';' && parenD === 0) {
        i++;
        done = true;
        break;
      } else if (ch === '{' && parenD === 0) {
        // At-rule block or similar - consume entire block
        const block = readBlock(inner, i);
        i = block.end;
        done = true;
        break;
      } else if (ch === '&' && parenD === 0) {
        // Hit another & without semicolon - stop here
        break;
      }
      i++;
    }

    const propText = inner.slice(propStart, i).trim();
    if (propText) directProps.push(propText);
    if (!done && i < inner.length && inner[i] !== '&') i++;
  }

  return { directProps, liftedRules };
}

// Process a full CSS file
function processCss(src) {
  let result = '';
  let i = 0;

  while (i < src.length) {
    // Comment at top level - pass through
    if (src.slice(i, i + 2) === '/*') {
      const end = src.indexOf('*/', i + 2);
      const endPos = end === -1 ? src.length : end + 2;
      result += src.slice(i, endPos);
      i = endPos;
      continue;
    }

    // Find :host
    if (src.slice(i, i + 5) === ':host') {
      const sel = readSelector(src, i);
      if (!sel) { result += src[i++]; continue; }

      const { selector: hostSelector, braceStart } = sel;

      // Only handle pure :host or :host(...)
      if (!/^:host(\(.*\))?$/.test(hostSelector)) {
        result += src.slice(i, braceStart);
        i = braceStart;
        continue;
      }

      const block = readBlock(src, braceStart);
      const { directProps, liftedRules } = parseHostBlock(hostSelector, block.inner);

      if (!liftedRules.length) {
        // Nothing to lift — emit original block unchanged
        result += src.slice(i, block.end);
      } else {
        // Emit :host { direct props } if any
        const directContent = directProps.join('\n').trim();
        if (directContent) {
          const indented = directContent.split('\n').map(l => '  ' + l).join('\n');
          result += hostSelector + ' {\n' + indented + '\n}';
        }

        // Emit lifted rules
        result += '\n' + liftedRules.join('\n') + '\n';
      }

      i = block.end;
      continue;
    }

    result += src[i++];
  }

  return result;
}

// Walk dir for .css files
function walkCss(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) files.push(...walkCss(full));
    else if (extname(entry) === '.css') files.push(full);
  }
  return files;
}

// Main
const cssFiles = walkCss(COMPONENTS_DIR);

for (const file of cssFiles) {
  const src = readFileSync(file, 'utf8');

  // Only process files with compounding & patterns
  if (!/&\[|&\(:not|&\(:is|&\(:has|&:/.test(src)) continue;

  totalFiles++;

  let fixed;
  try {
    fixed = processCss(src);
  } catch (err) {
    console.error('ERROR processing ' + file.replace(ROOT + '/', '') + ': ' + err.message);
    continue;
  }

  if (fixed === src) continue;

  modifiedFiles++;
  if (DRY_RUN) {
    console.log('[dry-run] Would modify: ' + file.replace(ROOT + '/', ''));
  } else {
    writeFileSync(file, fixed, 'utf8');
    console.log('Fixed: ' + file.replace(ROOT + '/', ''));
  }
}

console.log('\nScanned ' + totalFiles + ' files with & patterns. Modified: ' + modifiedFiles + '.');
