import { test, expect } from './harness';

/**
 * A panel that is a tab already shows no Minimise in its header, nor the divider before it — Will, 2026-11-10. Peeked
 * open by a hover, its header has nothing there to minimise; open for good, Minimise is back.
 */
test('a tab peeked open has no Minimise and no divider before it; opened, Minimise is back', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px">
        <sherpa-overlay-panel id="p" data-side="start" open data-heading="Nodes" data-minimisable data-floatable></sherpa-overlay-panel>
      </sherpa-layout-canvas>`);
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    await window.__settled();
  });
  const read = () => page.locator('#p').evaluate((p) => {
    const sr = p.shadowRoot!;
    const shows = (sel: string) => { const el = sr.querySelector(sel); return !!el && getComputedStyle(el).display !== 'none'; };
    return { minimise: shows('.minimise'), modes: shows('.modes'), divider: shows('.after-docks') };
  });
  expect(await read()).toEqual({ minimise: true, modes: true, divider: true });
  await page.locator('#p').evaluate((p) => (p as HTMLElement & { minimise(): void }).minimise());
  await page.evaluate(() => window.__settled());
  await page.locator('#p').locator('.tab').hover();
  await page.evaluate(() => window.__settled());
  expect(await read()).toEqual({ minimise: false, modes: false, divider: false });
  await page.locator('#p').evaluate((p) => (p as HTMLElement & { minimise(on: boolean): void }).minimise(false));
  await page.evaluate(() => window.__settled());
  expect(await read()).toEqual({ minimise: true, modes: true, divider: true });
});
