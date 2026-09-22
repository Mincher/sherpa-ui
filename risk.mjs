import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:4000/risk.html');
await p.waitForTimeout(2200);
const out = await p.evaluate(async () => {
  const el=document.getElementById('a'); await el.__settled?.();
  const sr=el.shadowRoot;
  const rows=[];
  for (const sel of ['.caret','.caret-glyph','.caret-icon','.caret-funnel']) {
    const n=sr.querySelector(sel); if(!n) { rows.push({sel,missing:true}); continue; }
    const r=n.getBoundingClientRect();
    rows.push({ sel, box:`${r.width.toFixed(1)}x${r.height.toFixed(1)}`,
      declared:getComputedStyle(n).getPropertyValue('--_icon-size').trim(),
      display:getComputedStyle(n).display, hasSvg:!!n.querySelector('svg') });
  }
  return rows;
});
for(const r of out) console.log(r.missing?`${r.sel} MISSING`:`${r.sel.padEnd(14)} ${r.box.padEnd(11)} --_icon-size=${r.declared.padEnd(6)} display=${r.display.padEnd(11)} svg=${r.hasSvg}`);
await b.close();
