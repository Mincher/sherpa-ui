import { test, expect } from './harness';

/** A panel's drag grip stands at the TOP left, beside the title row: also when a search row makes the header tall. TODO 864 */
test('the grip sits beside the first row, not centred on a tall header', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-panel') as HTMLElement & { rendered?: Promise<void>; show(): void };
    el.setAttribute('data-heading', 'Nodes');
    el.setAttribute('data-floatable', '');
    el.setAttribute('data-mode', 'floating');
    el.setAttribute('data-searchable', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.show();
    await window.__settled();
    const sr = el.shadowRoot!;
    // It shows only with the keys' focus (TODO 931).
    (sr.querySelector('.grip') as HTMLElement).focus({ focusVisible: true } as FocusOptions);
    const header = sr.querySelector('.header')!.getBoundingClientRect();
    const grip = sr.querySelector('.grip')!.getBoundingClientRect();
    const title = sr.querySelector('.header')!.shadowRoot!.querySelector('.title')!.getBoundingClientRect();
    return { gripTop: grip.top - header.top, gripMid: grip.top + grip.height / 2, titleMid: title.top + title.height / 2, headerH: header.height };
  });
  // The header is tall (title row and search row); the grip is with the title, not in the middle of both.
  expect(r.headerH).toBeGreaterThan(60);
  expect(Math.abs(r.gripMid - r.titleMid)).toBeLessThanOrEqual(4);
});
