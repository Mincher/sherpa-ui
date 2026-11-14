import { test, expect } from './harness';

/**
 * Rows need rows (Will, TODO 924): a Math Count into a Condition's header leaves it a test of ONE value, and its Pass and
 * Fail still show: they send its Data, else the Count (plan 971 §9). A Field's column in, and both show. It has no True
 * (plan 971 §9). One a connection leaves stays, and what it feeds says why it cannot use it.
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

/** The Condition's Pass and Fail rows, and its Properties box: shown or not; and whether it has a True row. */
const shown = (page: import('@playwright/test').Page) => page.locator('#cv > sherpa-node[data-heading="Condition"]').evaluate((el) => {
  const row = (name: string) => [...el.querySelectorAll<HTMLElement>('sherpa-node-row')].find((r) => r.getAttribute('data-socket-name') === name);
  const box = row('Pass')?.parentElement as HTMLElement | undefined;
  const on = (e: Element | null | undefined) => !!e && (e as HTMLElement).checkVisibility();
  return { pass: on(row('Pass')), fail: on(row('Fail')), true: !!row('True'), box: on(box) };
});

test('a Math Count into a Condition\'s header is one test: its Pass and Fail show, and it has no True (plan 971 §9)', async ({ page }) => {
  await bind(page, [{ from: 'm/result', to: 'c' }]);
  expect(await shown(page)).toEqual({ pass: true, fail: true, true: false, box: true });
});

test('a Field\'s column in, and they show', async ({ page }) => {
  await bind(page, [{ from: 'f/field', to: 'c' }]);
  expect(await shown(page)).toEqual({ pass: true, fail: true, true: false, box: true });
});

test('one a connection leaves stays; what it feeds says why it cannot use it', async ({ page }) => {
  await bind(page, [{ from: 'm/result', to: 'c' }, { from: 'c/pass', to: 'sorted' }]);
  expect(await shown(page)).toEqual({ pass: true, fail: true, true: false, box: true });
  // A test of one value's Pass sends the Count, a number: an Organise takes rows (plan 971 §9).
  await expect(page.locator('#cv > sherpa-node[data-heading="Organise"]')).toHaveAttribute('data-warning', /Organise takes rows; it was given a number/);
});
