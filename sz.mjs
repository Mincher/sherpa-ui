import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:4000/sz.html');
await p.waitForTimeout(2400);
const out = await p.evaluate(async () => {
  const res=[];
  const walk = (host, label, depth=0) => {
    const sr = host.shadowRoot; if(!sr) return;
    for (const box of sr.querySelectorAll('.sherpa-icon-box')) {
      const r = box.getBoundingClientRect();
      if (r.width === 0) continue;
      res.push({ who: label, cls:[...box.classList].filter(c=>c!=='sherpa-icon-box').join(' ')||'(icon)',
        w:+r.width.toFixed(1), h:+r.height.toFixed(1),
        declared: getComputedStyle(box).getPropertyValue('--_icon-size').trim() });
    }
    if (depth<2) for (const child of sr.querySelectorAll('*'))
      if (child.shadowRoot) walk(child, label+' › '+child.tagName.toLowerCase(), depth+1);
  };
  for (const id of ['es','esl','qf','ah','ni','it']) {
    const el=document.getElementById(id); await el.__settled?.();
    walk(el, el.tagName.toLowerCase()+(el.dataset.size?`[${el.dataset.size}]`:''));
  }
  return res;
});
console.log('who                                          class            box        --_icon-size');
for(const r of out) console.log(`${r.who.padEnd(44)} ${r.cls.padEnd(16)} ${(r.w+'x'+r.h).padEnd(10)} ${r.declared}`);
await b.close();
