#!/usr/bin/env node
/**
 * Phase 0.4 slot-contract audit — reports every <slot> across components,
 * its name, and whether it declares a data-accepts allowlist. Feeds the
 * generative-UI structural validator (Phase 8).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2] || '.';
const COMP_DIR = join(ROOT, 'components');
const comps = readdirSync(COMP_DIR).filter(d => d.startsWith('sherpa-'));

const rows = [];
for (const c of comps) {
  const html = join(COMP_DIR, c, `${c}.html`);
  if (!existsSync(html)) continue;
  const src = readFileSync(html, 'utf8');
  // match each <slot ...> opening tag
  const slots = src.match(/<slot\b[^>]*>/g) || [];
  if (!slots.length) continue;
  const slotInfo = slots.map(s => {
    const name = (s.match(/name="([^"]+)"/) || [,'(default)'])[1];
    const accepts = (s.match(/data-accepts="([^"]*)"/) || [,null])[1];
    return { name, accepts };
  });
  rows.push({ component: c, slots: slotInfo });
}

let withSlots = rows.length, withAccepts = 0, totalSlots = 0, slotsWithAccepts = 0;
console.log('# Phase 0.4 Slot-Contract Audit\n');
for (const r of rows) {
  const any = r.slots.some(s => s.accepts !== null);
  if (any) withAccepts++;
  console.log(`## ${r.component}${any ? '' : '   ⚠️ no data-accepts'}`);
  for (const s of r.slots) {
    totalSlots++;
    if (s.accepts !== null) slotsWithAccepts++;
    const tag = s.accepts !== null ? `accepts="${s.accepts}"` : '— (open, no allowlist)';
    console.log(`   • slot ${s.name.padEnd(16)} ${tag}`);
  }
  console.log('');
}

console.log('---');
console.log(`Components with slots:        ${withSlots}`);
console.log(`  ...with any data-accepts:  ${withAccepts}`);
console.log(`Total slots:                 ${totalSlots}`);
console.log(`  ...with data-accepts:      ${slotsWithAccepts}  (${Math.round(slotsWithAccepts/totalSlots*100)}%)`);
