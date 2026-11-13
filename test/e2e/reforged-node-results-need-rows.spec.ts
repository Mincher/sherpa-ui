import { test, expect } from './harness';

/**
 * Results need rows (Will, TODO 924): a Math Count into a Condition's header leaves it one test, so its Results hide;
 * its True shows, 1 or 0 (plan 944). A Field's column in, and both show. One a connection still leaves stays.
 */
const bind = (page: import('@playwright/test').Page, connections: { from: string; to: string }[]) => page.evaluate(async (wires) => {
  document.getElementById('root')!.insertAdjacentHTML('beforeend', '<sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 600px"></sherpa-layout-canvas>');
  const canvas = document.getElementById('cv') as HTMLElement & { rendered: Promise<void> };
  await canvas.rendered;
  const { bindWorkflow, SessionStore } = await import('/dist/app.js' as string);
  bindWorkflow(canvas, { v: 3, id: 'g', nodes: [
    { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'f', kind: 'field', x: 360, y: 0, values: { field: 'status' } },
    // Counting is a Math type (plan 944).
    { id: 'm', kind: 'math', x: 360, y: 300, values: { type: 'count' } },
    { id: 'c', kind: 'condition', x: 720, y: 0, values: { type: 'eq', b: '0' } }, { id: 'sorted', kind: 'organise', x: 1080, y: 0 },
  ], connections: [{ from: 's/rows', to: 'f' }, { from: 's/rows', to: 'm/rows' }, ...wires] }, { session: new SessionStore(), stores: ['users'], fieldsOf: { users: { status: { label: 'Status' } } } });
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}, connections);

/** The Condition's Results and True rows, and its Properties box: shown or not. */
const shown = (page: import('@playwright/test').Page) => page.locator('#cv > sherpa-node[data-heading="Condition"]').evaluate((el) => {
  const row = (name: string) => [...el.querySelectorAll<HTMLElement>('sherpa-node-row')].find((r) => r.getAttribute('data-socket-name') === name);
  const box = row('True')?.parentElement as HTMLElement | undefined;
  const on = (e: Element | null | undefined) => !!e && (e as HTMLElement).checkVisibility();
  return { results: on(row('Results')), true: on(row('True')), box: on(box) };
});

test('a Math Count into a Condition\'s header hides its Results; its True shows (plan 944)', async ({ page }) => {
  await bind(page, [{ from: 'm/result', to: 'c' }]);
  expect(await shown(page)).toEqual({ results: false, true: true, box: true });
});

test('a Field\'s column in, and they show', async ({ page }) => {
  await bind(page, [{ from: 'f/field', to: 'c' }]);
  expect(await shown(page)).toEqual({ results: true, true: true, box: true });
});

test('one a connection still leaves stays, with a warning on its node; the rest of the box hides it not', async ({ page }) => {
  await bind(page, [{ from: 'm/result', to: 'c' }, { from: 'c/rows', to: 'sorted' }]);
  expect(await shown(page)).toEqual({ results: true, true: true, box: true });
  await expect(page.locator('#cv > sherpa-node[data-heading="Condition"]')).toHaveAttribute('data-warning', /Results has no rows/);
});
