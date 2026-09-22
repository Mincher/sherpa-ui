import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:4000/sz.html');
await p.waitForTimeout(2400);
const out = await p.evaluate(async () => {
  const el=document.getElementById('it'); await el.__settled?.();
  const i=el.shadowRoot.querySelector('.icon-start');
  const r=i.getBoundingClientRect();
  const path=i.querySelector('path');
  const ink=path?.getBoundingClientRect();
  return { cls:[...i.classList], hasSvg:!!i.querySelector('svg'),
    box:`${r.width.toFixed(1)}x${r.height.toFixed(1)}`,
    ink: ink?`${ink.width.toFixed(2)}x${ink.height.toFixed(2)}`:'NONE' };
});
console.log(JSON.stringify(out,null,1));
await b.close();
