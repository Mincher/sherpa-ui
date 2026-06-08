/**
 * css-parser.js — Lightweight regex-based CSS parser for Token Studio.
 *
 * Extracts selector blocks and their custom-property declarations from
 * Sherpa CSS files (generated tokens + component CSS). Handles:
 *   - @layer wrappers (tracked but not required to match)
 *   - @media / @container blocks (tracked for annotation)
 *   - @property blocks (skipped — metadata only, no values)
 *   - Multi-line var() values
 *   - :host, :where(:root), :root selectors
 */

/**
 * Parse a CSS string into a structured list of selector blocks.
 *
 * @param {string} css  — raw CSS content
 * @param {string} file — relative filename (for metadata only)
 * @returns {{ file: string, selectors: Array<SelectorBlock> }}
 *
 * @typedef {{ name: string, value: string }} CSSProperty
 * @typedef {{ selector: string, layer: string|null, media: string|null, properties: CSSProperty[] }} SelectorBlock
 */
export function parseCSS(css, file) {
  // Normalise line endings and collapse leading whitespace per line
  // to simplify multi-line value joining.
  const lines = css.replace(/\r\n/g, '\n').split('\n');

  const selectors = [];
  const stack = []; // { type: 'layer'|'media'|'selector', name: string }
  let currentLayer = null;
  let currentMedia = null;
  let currentSelector = null;
  let currentProps = [];
  let depth = 0; // brace depth
  let pendingValue = null; // accumulates multi-line values

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line || line.startsWith('/*')) continue;

    // ── @property blocks — skip entirely ──────────────────────────────
    if (/^@property\s/.test(line)) {
      // Consume until matching closing brace
      let d = 0;
      while (i < lines.length) {
        const ch = lines[i];
        for (const c of ch) { if (c === '{') d++; else if (c === '}') d--; }
        i++;
        if (d === 0) break;
      }
      i--; // the for loop will increment
      continue;
    }

    // ── @keyframes — skip entirely ────────────────────────────────────
    if (/^@keyframes\s/.test(line)) {
      let d = 0;
      while (i < lines.length) {
        const ch = lines[i];
        for (const c of ch) { if (c === '{') d++; else if (c === '}') d--; }
        i++;
        if (d === 0) break;
      }
      i--;
      continue;
    }

    // ── @layer ────────────────────────────────────────────────────────
    const layerMatch = line.match(/^@layer\s+([\w.]+)\s*\{?/);
    if (layerMatch) {
      stack.push({ type: 'layer', name: layerMatch[1] });
      currentLayer = layerMatch[1];
      if (line.includes('{')) depth++;
      continue;
    }

    // ── @media / @container ───────────────────────────────────────────
    const atMatch = line.match(/^(@(?:media|container)\s+[^{]+)\s*\{/);
    if (atMatch) {
      stack.push({ type: 'media', name: atMatch[1].trim() });
      currentMedia = atMatch[1].trim();
      depth++;
      continue;
    }

    // ── Opening brace → selector block ────────────────────────────────
    if (line.endsWith('{') && !line.startsWith('@')) {
      const selector = line.slice(0, -1).trim();
      stack.push({ type: 'selector', name: selector });
      currentSelector = selector;
      currentProps = [];
      depth++;
      continue;
    }

    // ── Closing brace ─────────────────────────────────────────────────
    if (line === '}') {
      const top = stack.pop();
      depth = Math.max(0, depth - 1);

      if (top?.type === 'selector') {
        if (currentProps.length) {
          selectors.push({
            selector: top.name,
            layer: currentLayer,
            media: currentMedia,
            properties: currentProps,
          });
        }
        currentProps = [];
        currentSelector = null;
        // Restore selector context to the next selector on the stack (if nested)
        const parentSel = [...stack].reverse().find(s => s.type === 'selector');
        currentSelector = parentSel?.name ?? null;
      } else if (top?.type === 'layer') {
        currentLayer = [...stack].reverse().find(s => s.type === 'layer')?.name ?? null;
      } else if (top?.type === 'media') {
        currentMedia = [...stack].reverse().find(s => s.type === 'media')?.name ?? null;
      }
      continue;
    }

    // ── Property declaration ───────────────────────────────────────────
    // We're inside a selector block if the stack top is a selector.
    const inSelector = stack.length > 0 && stack[stack.length - 1].type === 'selector';
    if (!inSelector) continue;

    // Start of a property line
    const propStart = line.match(/^(--?[\w-]+)\s*:\s*(.*)/);
    if (propStart) {
      const name = propStart[1];
      let value = propStart[2];

      // Multi-line: if the value has unbalanced parens, keep reading
      let parenDepth = (value.match(/\(/g) || []).length - (value.match(/\)/g) || []).length;
      while (parenDepth > 0 && i + 1 < lines.length) {
        i++;
        const cont = lines[i].trim();
        value += ' ' + cont;
        parenDepth += (cont.match(/\(/g) || []).length - (cont.match(/\)/g) || []).length;
      }

      // Strip trailing semicolon and whitespace
      value = value.replace(/;\s*$/, '').trim();

      if (name && value) {
        currentProps.push({ name, value });
      }
    }
  }

  return { file, selectors };
}
