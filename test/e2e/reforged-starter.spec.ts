import { test, expect } from './fixture';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * THE STARTER BOOTS ON ITS OWN: one folder, no build — the outlet loads the
 * Context app.json names, every component asks, and the grid draws its seed.
 * TODO 222. TRAP T-a-starter-is-one-folder
 */
const ROOT = join(import.meta.dirname, '../..');
const TYPES: Record<string, string> = { js: 'text/javascript', css: 'text/css', json: 'application/json', html: 'text/html' };

test('the starter boots: its Context loads, its metrics count the seed, and its grid draws it', async ({ page }) => {
  // The starter imports sherpa-ui from ./node_modules — here, this repo's own build.
  await page.route('**/starter/node_modules/sherpa-ui/**', (route) => {
    const file = join(ROOT, new URL(route.request().url()).pathname.replace(/^.*\/starter\/node_modules\/sherpa-ui\//, ''));
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ body: readFileSync(file), contentType: TYPES[file.split('.').pop() ?? ''] ?? 'text/plain' });
  });
  const said: string[] = [];
  page.on('pageerror', (e) => said.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') said.push(m.text()); });
  // Served from its own folder, as an app is: the trailing slash keeps every path relative to it.
  await page.goto('/starter/');
  await page.waitForFunction(() =>
    (document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelectorAll('.row, [role="row"]').length ?? 0) > 1);
  // A tile's own filter lands after its first count: wait for the counts to settle.
  await expect.poll(() => page.evaluate(() =>
    [...document.querySelectorAll('#context-root sherpa-metric')].map((m) => (m as HTMLElement).dataset['value']))).toEqual(['6', '2', '279']);
  const r = await page.evaluate(() => ({
    heading: document.querySelector('sherpa-app-header')!.getAttribute('data-heading'),
    views: (document.querySelector('sherpa-outlet') as HTMLElement & { viewsOf(c: string): Record<string, unknown> }).viewsOf('records'),
  }));
  expect(r.heading).toBe('Records');
  expect(Object.keys(r.views)).toEqual(['all', 'active']);
  expect(said).toEqual([]);
});
