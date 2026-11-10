import { test, expect, type Page } from './harness';

/**
 * Collapsed nodes — Will, 2026-11-10. A double click on a header collapses the node, and again expands it: its rows keep
 * their sockets, and lose their labels and fields; a socket's tip names its row and says its value. The toolbar's Collapse all
 * does every node; Hide unconnected, on while a node is collapsed, hides the sockets no route joins, till a hover, or while
 * a line is dragged.
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js' as string);
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas, { v: 2, id: 'g', nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
      { id: 'sort', kind: 'sort', x: 330, y: 0, values: { direction: 'asc' } },
      { id: 'end', kind: 'output', x: 660, y: 0 },
    ], routes: [{ from: 'start/rows', to: 'sort' }, { from: 'sort/rows', to: 'end' }] }, {
      session: new SessionStore(), inspector: document.getElementById('inspector'),
      toolbar: canvas.querySelector('sherpa-node-toolbar'), stores: ['users'],
      fieldsOf: { users: { status: { label: 'Status', values: ['active'] } } },
    });
    await window.__settled();
    canvas.zoomTo(0.6);
    canvas.panTo(120, 60);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const node = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`);
const header = (page: Page, heading: string) => node(page, heading).locator('.header[role="button"]');
const press = async (page: Page, name: string) => {
  await page.locator(`sherpa-node-toolbar sherpa-button.${name}`).evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
};
/** How a node's rows read: each row's field shown, each socket's visibility, and its tip's lines. */
const rows = (page: Page, heading: string) => node(page, heading).evaluate((el) => [...el.querySelectorAll('sherpa-node-row')].map((row) => {
  const field = row.firstElementChild as HTMLElement | null;
  const out = row.shadowRoot!.querySelector('.socket-out')!;
  return {
    name: row.getAttribute('data-socket-name'), value: row.getAttribute('data-socket-value'),
    field: field ? getComputedStyle(field).display : null, shown: getComputedStyle(row).display,
    out: row.hasAttribute('data-output-socket') ? getComputedStyle(out).visibility : null,
  };
}));

test('a double click on a header collapses the node to its sockets, and again expands it', async ({ page }) => {
  const tall = (await node(page, 'Sort').boundingBox())!.height;
  await header(page, 'Sort').dblclick();
  await settle(page);
  await expect(node(page, 'Sort')).toHaveAttribute('data-collapsed', '');
  const shut = await rows(page, 'Sort');
  // The Direction pick is gone; Results keeps its socket; the tip names each row and says its value.
  expect(shut.find((r) => r.name === 'Direction')).toMatchObject({ field: 'none', value: 'Ascending' });
  expect(shut.find((r) => r.out)).toMatchObject({ out: 'visible' });
  expect((await node(page, 'Sort').boundingBox())!.height).toBeLessThan(tall);
  await header(page, 'Sort').dblclick();
  await settle(page);
  await expect(node(page, 'Sort')).not.toHaveAttribute('data-collapsed');
});

test('Collapse all, then Hide unconnected: an unrouted socket hides, and a hover or a dragged line shows it', async ({ page }) => {
  const tool = (name: string) => page.locator(`sherpa-node-toolbar sherpa-button.${name}`);
  await expect(tool('hide')).toHaveAttribute('disabled', '');
  await press(page, 'collapse');
  await expect(page.locator('#cv > sherpa-node[data-collapsed]')).toHaveCount(3);
  await expect(tool('collapse')).toHaveAttribute('aria-pressed', 'true');
  await expect(tool('hide')).not.toHaveAttribute('disabled');
  await press(page, 'hide');
  await page.mouse.move(5, 5);
  // The Source's Results is routed and shows; the Sort's header output is not routed, and hides.
  const headerOut = () => node(page, 'Sort').evaluate((el) => getComputedStyle(el.shadowRoot!.querySelector('.header .socket-out')!).visibility);
  expect(await headerOut()).toBe('hidden');
  await header(page, 'Sort').hover();
  expect(await headerOut()).toBe('visible');
  // A line dragged from the Source's output: every node shows its sockets till it lets go.
  const out = await node(page, 'Source').evaluate((el) => {
    const r = [...el.querySelectorAll('sherpa-node-row')].find((x) => x.hasAttribute('data-output-socket'))!.shadowRoot!.querySelector('.socket-out')!.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(out.x, out.y);
  await page.mouse.down();
  await page.mouse.move(out.x + 40, out.y + 200, { steps: 4 });
  await expect(page.locator('#cv > sherpa-node[data-reveal]')).toHaveCount(3);
  expect(await headerOut()).toBe('visible');
  await page.mouse.up();
  await expect(page.locator('#cv > sherpa-node[data-reveal]')).toHaveCount(0);
  await press(page, 'collapse');
  await expect(page.locator('#cv > sherpa-node[data-collapsed]')).toHaveCount(0);
});
