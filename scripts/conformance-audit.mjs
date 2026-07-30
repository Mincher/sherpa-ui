#!/usr/bin/env node
/**
 * Phase 0.1 conformance sweep — audits every sherpa-* component against the
 * mechanically-detectable CLAUDE.md golden rules. Emits a matrix + findings.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2] || '.';
const COMP_DIR = join(ROOT, 'components');
const comps = readdirSync(COMP_DIR).filter(d => d.startsWith('sherpa-'));

// Rule definitions: id, label, which file, regex, and a filter for false-positives.
const RULES = [
  { id: 'js-hidden',    file: 'ts',  label: 'JS toggles .hidden',
    re: /\.hidden\s*=/g },
  { id: 'js-display',   file: 'ts',  label: 'JS sets style.display/visibility',
    re: /\.style\.(display|visibility)\s*=/g },
  { id: 'js-classlist', file: 'ts',  label: 'classList for visual state',
    re: /\.classList\.(add|remove|toggle)\(/g },
  { id: 'createElement',file: 'ts',  label: 'createElement (structural)',
    re: /\.createElement\(/g,
    // SVG/namespace + document fragments are often legit; flag for review, not auto-fail
    note: 'review: SVG/namespaced or fragment builders may be legitimate' },
  { id: 'innerHTML',    file: 'ts',  label: 'structural innerHTML assignment',
    re: /\.innerHTML\s*=/g,
    note: 'review: highlight output / SVG string may be legitimate' },
  { id: 'core-token',   file: 'css', label: '--core-* used directly',
    re: /var\(\s*--core-/g },
  { id: 'opacity-disabled', file: 'css', label: 'opacity for disabled',
    re: /:host\(\[disabled\][^)]*\)[^{]*\{[^}]*opacity/gs },
  { id: 'host-chained', file: 'css', label: ':host:not chained form',
    re: /:host:(not|is|where|has)\(/g },
  { id: 'light-dark',   file: 'css', label: 'light-dark() in component CSS',
    re: /light-dark\(/g },
  { id: 'focus-fn',     file: 'css', label: 'outline: --focus-ring() (silent-fail)',
    re: /outline:\s*--focus-ring\(/g },
];

// Event bubbles check (special: parse CustomEvent options)
function eventFindings(ts) {
  const out = [];
  const re = /new CustomEvent\(([^;]*?)\)/gs;
  let m;
  while ((m = re.exec(ts))) {
    const block = m[1];
    // only care when an options object is present
    if (/\{/.test(block) && !/bubbles\s*:\s*true/.test(block)) {
      out.push(block.replace(/\s+/g, ' ').slice(0, 70));
    }
  }
  return out;
}

const matrix = [];
const findings = [];

for (const c of comps) {
  const dir = join(COMP_DIR, c);
  const tsPath = join(dir, `${c}.ts`);
  const cssPath = join(dir, `${c}.css`);
  const ts = existsSync(tsPath) ? readFileSync(tsPath, 'utf8') : '';
  const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
  const row = { component: c };
  for (const r of RULES) {
    const src = r.file === 'ts' ? ts : css;
    const matches = src.match(r.re) || [];
    row[r.id] = matches.length;
    if (matches.length) findings.push({ component: c, rule: r.id, count: matches.length, note: r.note });
  }
  const ev = eventFindings(ts);
  row['event-nobubble'] = ev.length;
  if (ev.length) findings.push({ component: c, rule: 'event-nobubble', count: ev.length, samples: ev });
  matrix.push(row);
}

// Totals
const totals = {};
for (const r of [...RULES.map(r => r.id), 'event-nobubble']) {
  totals[r] = matrix.reduce((s, row) => s + (row[r] || 0), 0);
}

console.log('# Phase 0.1 Conformance Sweep\n');
console.log(`Components audited: ${comps.length}\n`);
console.log('## Rule totals (occurrences across all components)\n');
for (const r of RULES) console.log(`- ${totals[r.id] === 0 ? '✅' : '⚠️ '} ${r.id.padEnd(18)} ${totals[r.id]}  — ${r.label}`);
console.log(`- ${totals['event-nobubble'] === 0 ? '✅' : '⚠️ '} event-nobubble     ${totals['event-nobubble']}  — CustomEvent missing bubbles:true`);

console.log('\n## Components with findings (non-zero only)\n');
const flagged = matrix.filter(row => Object.keys(totals).some(k => row[k] > 0));
for (const row of flagged) {
  const hits = Object.keys(totals).filter(k => row[k] > 0).map(k => `${k}:${row[k]}`).join('  ');
  console.log(`- ${row.component.padEnd(26)} ${hits}`);
}
console.log(`\nClean components: ${comps.length - flagged.length}/${comps.length}`);

console.log('\n## Detailed findings (for triage)\n');
for (const f of findings) {
  const extra = f.samples ? ` e.g. "${f.samples[0]}"` : (f.note ? ` (${f.note})` : '');
  console.log(`- ${f.component} · ${f.rule} ×${f.count}${extra}`);
}
