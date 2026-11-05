import { test, expect, type Page } from './harness';

/**
 * TWO nodes picked: the details panel shows a tab each, and a tall node's tab SCROLLS, as one node's panel does.
 * Its buttons are reached by scrolling, never laid under its fields or clipped past the panel. TODO 767
 */
type Canvas = HTMLElement & { rendered: Promise<void> };

test.beforeEach(async ({ page }) => {
  // Short enough that the Condition's rows, its Cut route and its Remove do not fit.
  await page.setViewportSize({ width: 1200, height: 560 });
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.id = 'cv';
    el.style.cssText = 'inline-size: 1200px; block-size: 540px';
    document.getElementById('root')!.appendChild(el);
    const panel = document.createElement('sherpa-overlay-panel');
    panel.id = 'inspector';
    document.getElementById('root')!.appendChild(panel);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = { v: 2, id: 'tabs', nodes: [
      { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'value', kind: 'value', x: 0, y: 240, values: { value: 'active' } },
      { id: 'f', kind: 'field', x: 320, y: 0, values: { field: 'status' } },
      { id: 'c', kind: 'condition', x: 640, y: 0, heading: 'Check', values: { type: 'eq' } },
    ], routes: [{ from: 'start/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'value/value', to: 'c/b' }] };
    bindWorkflow(el as never, flow as never, {
      session: new SessionStore(), inspector: panel as never, fields: { status: { label: 'Status' } }, stores: ['customers'],
    } as never);
    await window.__settled();
  });
  await settle(page);
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const header = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);

/** The shown tab's run against the panel's body, and each button's centre hit or not, the RUN scrolled to it. */
const read = (page: Page) => page.evaluate(() => {
  const panel = document.getElementById('inspector')!;
  const body = panel.shadowRoot!.querySelector<HTMLElement>('.body')!;
  const stack = panel.querySelector('sherpa-tabs [data-current] sherpa-stack')!;
  const run = stack.shadowRoot!.querySelector<HTMLElement>('.run')!;
  const box = run.getBoundingClientRect();
  const kids = [...stack.children].map((k) => k.getBoundingClientRect());
  const buttons = [...stack.querySelectorAll<HTMLElement>(':scope > sherpa-button')].map((b) => {
    run.scrollTop += b.getBoundingClientRect().top - box.top - box.height / 2;
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { label: b.dataset['label'], hit: !!hit && (hit === b || b.contains(hit)) };
  });
  return {
    scrolls: run.scrollHeight > run.clientHeight + 1 && getComputedStyle(run).overflowY === 'auto',
    inside: box.bottom <= body.getBoundingClientRect().bottom + 1,
    overlaps: kids.slice(1).filter((k, i) => k.top < kids[i]!.bottom - 1).length,
    buttons,
    // The panel never scrolls: its slotted child owns the scroll.
    panelScrolled: body.scrollTop,
  };
});

test('two picked: the tall node\'s tab scrolls in the panel, and every button in it is reached, not covered', async ({ page }) => {
  await header(page, 'Store').click();
  await settle(page);
  await header(page, 'Check').focus();
  await page.keyboard.press('Space');
  await settle(page);
  const tabs = page.locator('#inspector sherpa-tabs');
  expect(await tabs.evaluate((el) => [...el.shadowRoot!.querySelectorAll('.tab .label')].map((t) => t.textContent))).toEqual(['Store', 'Check']);
  await tabs.evaluate((el) => (el.shadowRoot!.querySelectorAll('.tab')[1] as HTMLElement).click());
  await settle(page);
  const r = await read(page);
  expect(r.scrolls).toBe(true);
  expect(r.inside).toBe(true);
  expect(r.overlaps).toBe(0);
  expect(r.buttons.map((b) => b.label)).toEqual(expect.arrayContaining(['Cut route from Value › Value', 'Remove node']));
  expect(r.buttons.filter((b) => !b.hit)).toEqual([]);
  expect(r.panelScrolled).toBe(0);
  // A button reached by the scroll does its work: the cut route is gone.
  await page.locator('#inspector sherpa-tabs [data-current] sherpa-button[data-label^="Cut route"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  await expect(page.locator('#cv svg.graph-routes path[data-to="c/b"]')).toHaveCount(0);
});
