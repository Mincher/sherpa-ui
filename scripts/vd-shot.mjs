/**
 * vd-shot.mjs — visual-diff code-side screenshotter.
 *
 * Serves dist/ + the harness, mounts one component in a headless browser, and
 * writes a tight screenshot of the rendered component to <out>.
 *
 *   node scripts/vd-shot.mjs <component-name> <out.png>
 *
 * The Figma side is exported separately (figma_execute + exportAsync) by the
 * operator; this only handles the CODE render. Pair the two PNGs and compare.
 */
import express from 'express';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [name, out] = process.argv.slice(2);
if (!name || !out) {
  console.error('usage: node scripts/vd-shot.mjs <component> <out.png>');
  process.exit(1);
}

const app = express();
app.use('/dist', express.static(join(ROOT, 'dist')));
app.get('/', (_req, res) => res.sendFile(join(ROOT, 'scripts/vd-harness.html')));
const server = app.listen(0);
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(`http://localhost:${port}/?c=${encodeURIComponent(name)}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__mounted === true, { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(200);
const stage = await page.$('#stage');
await (stage ?? page).screenshot({ path: out });
console.log(`code shot → ${out}`);

await browser.close();
server.close();
