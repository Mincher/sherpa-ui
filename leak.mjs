import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:4000/leak.html');
await p.waitForTimeout(2400);
const out = await p.evaluate(async () => {
  const es=document.getElementById('es'); await es.__settled?.();
  const btn=es.querySelector('sherpa-button'); await btn.__settled?.();
  const icon=btn.shadowRoot.querySelector('.icon-start');
  const r=icon.getBoundingClientRect();
  return { w:+r.width.toFixed(1), h:+r.height.toFixed(1),
    declared:getComputedStyle(icon).getPropertyValue('--_icon-size').trim(),
    hostDeclared:getComputedStyle(es).getPropertyValue('--_icon-size').trim() };
});
console.log('empty-state :host --_icon-size =', out.hostDeclared);
console.log('NESTED button icon             =', out.w+'x'+out.h, ' its --_icon-size =', out.declared);
console.log(out.w===14 ? 'OK — the button kept its own size' : 'LEAK — the host size won');
await b.close();
