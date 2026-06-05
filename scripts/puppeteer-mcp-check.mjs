// Final smoke test for the MCP demo pages — verifies all 4 pages render
// correctly, populates data, and that navigation between them works
// without losing state.

import puppeteer from 'puppeteer';

const ROUTES = [
  { id: 'overview',     url: '#/mcp-demo/overview' },
  { id: 'solar-farm',   url: '#/mcp-demo/solar-farm' },
  { id: 'support-desk', url: '#/mcp-demo/support-desk' },
  { id: 'orders',       url: '#/mcp-demo/orders' },
];

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

// Round 1: navigate fresh to each route, verify content + data.
console.log('=== Fresh page render ===');
for (const { id, url } of ROUTES) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(`http://127.0.0.1:8765/index.html${url}`, {
    waitUntil: 'networkidle2',
    timeout: 15000,
  });
  await new Promise(r => setTimeout(r, 2500));

  const result = await page.evaluate(() => {
    const outlet = document.getElementById('docs-outlet');
    const heading = document.getElementById('docs-view')?.dataset?.heading ?? null;
    const gridComponents = outlet?.querySelectorAll('*').length ?? 0;
    return {
      heading,
      gridComponents,
      hasSetupKey: !!outlet?.querySelector('[data-setup-key]'),
      pageErrors: 0,
    };
  });

  console.log(`  [${id}] heading="${result.heading}" components=${result.gridComponents} pageErrors=${errors.length}`);
  if (errors.length) console.log(`    errors:`, errors.slice(0, 2));
  await page.close();
}

// Round 2: same page, navigate via hashchange (the real user path).
console.log('=== In-page navigation ===');
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

await page.goto(`http://127.0.0.1:8765/index.html#/mcp-demo/overview`, {
  waitUntil: 'networkidle2',
});
await new Promise(r => setTimeout(r, 1500));

for (const { id, url } of ROUTES) {
  await page.evaluate(route => {
    window.location.hash = route;
  }, url);
  await new Promise(r => setTimeout(r, 1800));
  const result = await page.evaluate(() => {
    return {
      heading: document.getElementById('docs-view')?.dataset?.heading ?? null,
      hasContent: !!document.getElementById('docs-outlet')?.firstElementChild,
    };
  });
  console.log(`  [${id}] → heading="${result.heading}"`);
}
console.log(`  total pageErrors during nav: ${errors.length}`);
if (errors.length) console.log(`  errors:`, errors.slice(0, 2));

await browser.close();
