import { test, expect, type Page } from './harness';

/**
 * A STATE OUTLIVES A COLLECTION — WebKit collected an element's `internals.states` when nothing held it and handed back a
 * new, empty set, while the element still matched the old `:state()`s; `toggleState`, writing only a change, then never
 * cleared one. A panel opened from its tab kept `:state(minimised)`, its body `display: none` (sherpa-demos-67,
 * 2026-11-14). SherpaElement holds the set. Every engine: a page of garbage between the tab and the opening.
 * TRAP T-webkit-drops-an-unheld-state-set
 */
const garbage = (page: Page) => page.evaluate(async () => {
  for (let round = 0; round < 20; round++) {
    let junk: unknown[] | null = [];
    for (let k = 0; k < 200000; k++) junk.push({ k, s: `x${k}` });
    junk = null;
    await new Promise((done) => setTimeout(done, 10));
  }
});

test('a panel opened from its tab after a collection is no tab: no :state(minimised), its body shown', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<sherpa-overlay-panel id="p" data-heading="Inspector" data-mode="tab" open><p>Body</p></sherpa-overlay-panel>';
    await customElements.whenDefined('sherpa-overlay-panel');
    await window.__settled();
  });
  const panel = page.locator('#p');
  expect(await panel.evaluate((p) => p.matches(':state(minimised)'))).toBe(true);
  await garbage(page);
  await panel.evaluate(async (p) => { p.setAttribute('data-mode', 'overlay'); await window.__settled(); });
  expect(await panel.evaluate((p) => [p.matches(':state(minimised)'), getComputedStyle(p.shadowRoot!.querySelector('.root')!).display])).toEqual([false, 'flex']);
});
