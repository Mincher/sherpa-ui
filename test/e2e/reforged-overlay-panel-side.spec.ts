import { test, expect } from './harness';

/**
 * A START panel overlaid out of its area stays on the START edge, and `data-side` keeps it so across a reload
 * (Will, 858). Read from the box. TRAP T-an-overlaid-panel-keeps-its-side
 */
const left = (page: import('@playwright/test').Page, attrs: string) => page.evaluate(async (a) => {
  const root = document.getElementById('root')!;
  root.innerHTML = '<sherpa-app-shell></sherpa-app-shell><sherpa-overlay-panel id="p" data-heading="P" data-poppable ' + a + '><p>body</p></sherpa-overlay-panel>';
  const panel = document.getElementById('p') as HTMLElement & { show(): void };
  await window.__settled();
  panel.show();
  await window.__settled();
  const r = panel.shadowRoot!.querySelector('.root')!.getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(r.right), dock: (panel as unknown as { dockState: string }).dockState, side: panel.getAttribute('data-side') };
}, attrs);

test('a start panel overlaid stays on the start edge; one told its side by data-side alone is there too', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const fixed = await left(page, 'data-fixed="start"');
  expect(fixed.side).toBe('start');
  await page.evaluate(() => (document.getElementById('p')!.shadowRoot!.querySelector('.pop')!.shadowRoot!.querySelector('button') as HTMLElement).click());
  await page.evaluate(() => window.__settled());
  const over = await page.evaluate(() => { const r = document.getElementById('p')!.shadowRoot!.querySelector('.root')!.getBoundingClientRect(); return { left: Math.round(r.left), dock: (document.getElementById('p') as unknown as { dockState: string }).dockState }; });
  expect(over).toEqual({ left: 0, dock: 'overlay' });
  // After a reload the page has only the kept side: no data-fixed.
  const kept = await left(page, 'data-side="start"');
  expect(kept.dock).toBe('overlay');
  expect(kept.left).toBe(0);
  // The end side is the right edge, as it was.
  const end = await left(page, 'data-side="end"');
  expect(end.right).toBe(1400);
});
