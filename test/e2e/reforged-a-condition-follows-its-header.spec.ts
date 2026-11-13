import { test, expect, type Page } from './harness';

/**
 * A CONDITION FOLLOWS WHAT JOINS ITS HEADER (Will, 2026-11-13: "It's almost like input rows don't update to reflect what is
 * connected to the input socket in the node header"): a Field joined to a Condition's header makes its Value B a pick of
 * that Field's values at once, with no reload; cut, Value B is typed again. Real pointer.
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.id = 'cv';
    el.style.cssText = 'inline-size: 1100px; block-size: 640px';
    document.getElementById('root')!.appendChild(el);
    const panel = document.createElement('sherpa-overlay-panel');
    panel.id = 'inspector';
    document.getElementById('root')!.appendChild(panel);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = {
      v: 3, id: 'g',
      nodes: [
        { id: 's', kind: 'source', x: 20, y: 20, values: { store: 'users' } },
        { id: 'f', kind: 'field', x: 300, y: 20, values: { field: 'status' } },
        { id: 'c', kind: 'condition', x: 640, y: 20, heading: 'Test', values: { type: 'eq' } },
      ],
      connections: [{ from: 's/rows', to: 'f' }],
    };
    const w = window as unknown as Record<string, unknown>;
    w['ed'] = bindWorkflow(el as never, flow as never, {
      session: new SessionStore(), inspector: panel as never, stores: ['users'],
      fieldsOf: { users: { status: { label: 'Status', values: ['active', 'trial', 'churned'] } } },
    });
    (el as unknown as { zoomTo(z: number): void }).zoomTo(1);
    (el as unknown as { panTo(x: number, y: number): void }).panTo(0, 0);
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const TEST = '#cv > sherpa-node[data-heading="Test"]';
/** Value B's control, as drawn (labelled Values for a list): its tag, and the values it offers. */
const valueB = (page: Page, label = 'Value B') => page.evaluate(([sel, name]) => {
  const row = document.querySelector(`${sel} sherpa-node-row[data-socket-name="${name}"]`);
  const field = row?.firstElementChild as (HTMLElement & { choices?: { value: string }[] }) | null;
  const options = [...(field?.shadowRoot?.querySelectorAll('option') ?? [])].map((o) => (o as HTMLOptionElement).value).filter(Boolean);
  return { tag: field?.tagName.toLowerCase() ?? null, type: field?.getAttribute('data-type') ?? null, options };
}, [TEST, label]);
const drag = async (page: Page, from: [number, number], to: [number, number]) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 8 });
  await page.mouse.up();
  await settle(page);
};

test('a Field joined to a Condition\'s header makes Value B a pick of its values at once; cut, typed again', async ({ page }) => {
  const before = await valueB(page);
  const from = await page.evaluate(() => {
    const r = (document.querySelector('#cv > sherpa-node[data-heading="Field"] sherpa-node-row[data-socket-name="Field"]') as HTMLElement & { socketRect(s: string): DOMRect }).socketRect('output');
    return [r.left + r.width / 2, r.top + r.height / 2] as [number, number];
  });
  const to = await page.evaluate((sel) => {
    const r = (document.querySelector(sel) as HTMLElement & { socketRect(s: string): DOMRect }).socketRect('input');
    return [r.left + r.width / 2, r.top + r.height / 2] as [number, number];
  }, TEST);
  await drag(page, from, to);
  const joined = await page.evaluate(() => (window as unknown as { ed: { workflow(): { connections: { from: string; to: string }[] } } }).ed.workflow().connections);
  expect(joined).toContainEqual({ from: 'f/field', to: 'c' });
  const after = await valueB(page);
  expect(after, JSON.stringify({ before, after })).not.toEqual(before);
  expect(after).toEqual({ tag: 'sherpa-input-text', type: 'select', options: ['active', 'trial', 'churned'] });
  // Its Operation changed to Is one of: its Values pick from the same values, in ONE dropdown of ticks, at once.
  await page.evaluate((sel) => {
    const op = document.querySelector(`${sel} sherpa-node-row[data-socket-name="Check"]`)?.firstElementChild as HTMLElement & { value: string };
    op.value = 'in';
    op.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }, TEST);
  await settle(page);
  const list = await valueB(page, 'Values');
  expect({ tag: list.tag, type: list.type }).toEqual({ tag: 'sherpa-input-text', type: 'select' });
  expect(await page.locator(`${TEST} sherpa-node-row[data-socket-name="Values"] > sherpa-input-text`).getAttribute('multiple')).toBe('');
});
