#!/usr/bin/env node
/**
 * One-shot migration: docs/examples.js  →  components/<tag>/<tag>.examples.html
 *
 * Each EXAMPLES[tag] entry becomes one <template> block in the per-component
 * file. Examples that need a setup() callback are flagged with data-setup="…"
 * and left for hand-conversion into a sibling <tag>.examples.js.
 *
 * Run:  node scripts/migrate-examples-to-html.js
 */
import { EXAMPLES } from '../docs/examples.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'components');

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// Re-indent example HTML so it sits two spaces inside its <template>.
function indent(html) {
  const lines = html.replace(/\r\n?/g, '\n').split('\n');
  // Strip common leading whitespace.
  const nonEmpty = lines.filter(l => l.trim().length);
  const minIndent = nonEmpty.length
    ? Math.min(...nonEmpty.map(l => /^[ \t]*/.exec(l)[0].length))
    : 0;
  return lines.map(l => '  ' + l.slice(minIndent)).join('\n');
}

const setupFlags = [];

for (const [tag, examples] of Object.entries(EXAMPLES)) {
  const dir = path.join(ROOT, tag);
  let exists;
  try { exists = (await fs.stat(dir)).isDirectory(); } catch { exists = false; }
  if (!exists) {
    console.warn(`! Skipping ${tag} — directory not found.`);
    continue;
  }

  const blocks = examples.map((ex, i) => {
    const attrs = [
      `data-label="${escapeAttr(ex.label || 'Example')}"`,
    ];
    if (ex.description) attrs.push(`data-description="${escapeAttr(ex.description)}"`);
    if (ex.layout && ex.layout !== 'row') attrs.push(`data-layout="${escapeAttr(ex.layout)}"`);
    if (ex.preview === false) attrs.push(`data-preview="false"`);

    let setupKey = null;
    if (typeof ex.setup === 'function') {
      setupKey = `${tag.replace(/^sherpa-/, '')}-${i}`;
      attrs.push(`data-setup="${escapeAttr(setupKey)}"`);
      setupFlags.push({ tag, key: setupKey, fn: ex.setup.toString() });
    }

    return `<template ${attrs.join(' ')}>\n${indent(ex.html)}\n</template>`;
  });

  const out = `<!--
  ${tag} — Live examples.
  Each <template> renders one example block in the docs site (docs/router.js).
  Attributes:
    data-label       (required) example heading
    data-description (optional) one-line summary
    data-layout      (optional) row (default) | col | block
    data-preview     (optional) "false" → hide live preview, show code only
    data-setup       (optional) name of an exported setup fn from ${tag}.examples.js
-->
${blocks.join('\n\n')}\n`;

  await fs.writeFile(path.join(dir, `${tag}.examples.html`), out, 'utf8');
  console.log(`✓ ${tag}  (${examples.length} examples${examples.some(e => e.setup) ? ', has setup' : ''})`);
}

if (setupFlags.length) {
  console.log('\nComponents needing hand-written .examples.js for setup keys:');
  for (const f of setupFlags) console.log(`  ${f.tag} :: ${f.key}`);
}
