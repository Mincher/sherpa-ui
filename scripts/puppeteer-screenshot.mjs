// Take a screenshot of each MCP demo page so we can visually verify.
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';

const ROUTES = [
  ['overview',    '#/mcp-demo/overview'],
  ['solar-farm',  '#/mcp-demo/solar-farm'],
  ['support-desk','#/mcp-demo/support-desk'],
  ['orders',      '#/mcp-demo/orders'],
];

mkdirSync('/tmp/sherpa-shots', { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const [name, route] of ROUTES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1600, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:8765/index.html${route}`, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2500));
  const path = `/tmp/sherpa-shots/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`[${name}] saved ${path}`);
  await page.close();
}

await browser.close();
