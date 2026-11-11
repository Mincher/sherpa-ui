import { test, expect, type Page } from './harness';

/**
 * FETCH and SIMULATE wait for a PATH from a Source to an Output — Will, TODO 836 (plan-836 P1). With none, both are
 * inactive and their tip says which part is missing; a route drawn with the pointer from the Source's Rows to the Output
 * turns them on; Undo turns them off again. A press says `toolbar-select` and does nothing more yet. A preset graph reads
 * only, so it can fetch and simulate. Real pointer and keys; tips are read from the buttons. TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 */
type Ed = { workflow(): { routes: unknown[] }; undo(): boolean };
type Node = [string, string, number, number, Record<string, unknown>?];

async function start(page: Page, nodes: Node[], routes: { from: string; to: string }[] = [], readOnly = false): Promise<void> {
  await page.evaluate(async ([ns, rs, ro]) => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = { v: 2 as const, id: 'p', nodes: ns.map(([id, kind, x, y, values]) => ({ id, kind, x, y, heading: id, ...(values ? { values } : {}) })), routes: rs };
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'], readOnly: ro,
    });
    (window as never as { heard: string[] }).heard = [];
    canvas.querySelector('sherpa-node-toolbar')!.addEventListener('toolbar-select', (e) => (window as never as { heard: string[] }).heard.push((e as CustomEvent<{ action: string }>).detail.action));
    await window.__settled();
    canvas.zoomTo(0.6);
    canvas.panTo(40, 40);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, [nodes, routes, readOnly] as const);
}
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const tool = (page: Page, name: string) => page.locator(`sherpa-node-toolbar sherpa-button.${name}`);
const tip = (page: Page, name: string) => tool(page, name).getAttribute('data-tip');
const heard = (page: Page) => page.evaluate(() => (window as never as { heard: string[] }).heard);

const SOURCE: Node = ['Source', 'source', 0, 0, { store: 'users' }];
const OUTPUT: Node = ['Output', 'output', 600, 0];
const NO_PATH = 'Join a Source to an Output';

/** The Source's Rows socket (it is drawn on its Results row), then the Output's input, in screen px. */
const sockets = (page: Page) => page.evaluate(() => {
  const mid = (r: DOMRect) => [r.left + r.width / 2, r.top + r.height / 2] as [number, number];
  const row = document.querySelector('#cv > sherpa-node[data-heading="Source"] sherpa-node-row[data-output-socket]') as HTMLElement & { socketRect(side: string): DOMRect };
  const out = document.querySelector('#cv > sherpa-node[data-heading="Output"]') as HTMLElement & { socketRect(side: string): DOMRect };
  return { from: mid(row.socketRect('output')), to: mid(out.socketRect('input')) };
});

test('with no path both tools are inactive and say which part is missing: no Source, no Output, or no path', async ({ page }) => {
  await start(page, [OUTPUT]);
  for (const name of ['fetch', 'play']) {
    await expect(tool(page, name)).toHaveAttribute('disabled', '');
    expect(await tip(page, name)).toBe('Add a Source first');
  }
  await page.evaluate(() => document.getElementById('root')!.replaceChildren());
  await start(page, [SOURCE]);
  expect(await tip(page, 'fetch')).toBe('Add an Output first');
  await page.evaluate(() => document.getElementById('root')!.replaceChildren());
  await start(page, [SOURCE, OUTPUT]);
  for (const name of ['fetch', 'play']) {
    await expect(tool(page, name)).toHaveAttribute('disabled', '');
    expect(await tip(page, name)).toBe(NO_PATH);
  }
  // A press on an inactive tool says nothing.
  await tool(page, 'fetch').click({ force: true });
  expect(await heard(page)).toEqual([]);
});

test('a route drawn by the pointer from the Source to the Output turns both on, with their own tips; Undo turns them off', async ({ page }) => {
  await start(page, [SOURCE, OUTPUT]);
  const { from, to } = await sockets(page);
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  expect(await page.evaluate(() => (window as never as { ed: Ed }).ed.workflow().routes.length)).toBe(1);
  for (const name of ['fetch', 'play']) {
    await expect(tool(page, name)).not.toHaveAttribute('disabled', '');
    expect(await tip(page, name)).not.toBe(NO_PATH);
  }
  expect(await tip(page, 'fetch')).toBe('Fetch data');
  expect(await tip(page, 'play')).toBe('Simulate');
  await page.evaluate(() => (window as never as { ed: Ed }).ed.undo());
  await settle(page);
  await expect(tool(page, 'fetch')).toHaveAttribute('disabled', '');
  expect(await tip(page, 'fetch')).toBe(NO_PATH);
});

test('with a path, a press and Enter on the focused tool say fetch and simulate', async ({ page }) => {
  await start(page, [SOURCE, OUTPUT], [{ from: 'Source/rows', to: 'Output' }]);
  await expect(tool(page, 'fetch')).not.toHaveAttribute('disabled', '');
  await tool(page, 'fetch').click();
  await tool(page, 'play').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).focus());
  await page.keyboard.press('Enter');
  expect(await heard(page)).toEqual(['fetch', 'play']);
});

test('a preset graph reads only, so it can fetch and simulate', async ({ page }) => {
  await start(page, [SOURCE, OUTPUT], [{ from: 'Source/rows', to: 'Output' }], true);
  for (const name of ['fetch', 'play']) await expect(tool(page, name)).not.toHaveAttribute('disabled', '');
});
