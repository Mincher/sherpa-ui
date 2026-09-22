import { chromium } from '@playwright/test';
const b=await chromium.launch(); const p=await b.newPage();
await p.goto('http://localhost:4000/prop.html'); await p.waitForTimeout(600);
const r=await p.evaluate(()=>window.__r());
console.log(JSON.stringify(r));
console.log(r.childW===14 ? 'inherits:false WORKS across the shadow boundary — child got the initial 14, not the parent 40'
                          : 'child inherited the parent value ('+r.childW+')');
await b.close();
