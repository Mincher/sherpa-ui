import { test, expect, type Page } from './harness';

/**
 * THE TRIGGER — Will, plan 941 (D1 B, D2 B). The Nodes panel lists Triggers first, its one item the Trigger. A Trigger is a
 * Start node: no input socket, a Start node's shape, its own ink. Its Type list, "Listens for", has six types, each its line
 * on hover. The app's catalog lists what can be heard; none registered, a row is typed text. Simulate says what it would
 * hear, and runs what it feeds.
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.id = 'cv';
    el.style.cssText = 'inline-size: 1000px; block-size: 640px';
    el.innerHTML = '<sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>';
    const box = document.createElement('sherpa-overlay-panel');
    box.slot = 'panel';
    for (const [a, v] of [['open', ''], ['data-side', 'start'], ['data-heading', 'Nodes'], ['data-searchable', ''], ['data-padding', 'none']] as const) box.setAttribute(a, v);
    box.appendChild(document.createElement('sherpa-node-list'));
    el.appendChild(box);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { registerTriggerCatalog } = await import('/dist/data.js');
    (window as never as { undoCatalog: () => void }).undoCatalog = registerTriggerCatalog({ tasks: { patch: { label: 'Patch run' } } });
    const flow = {
      v: 3, byHand: true as const, id: 'g',
      nodes: [
        { id: 't', kind: 'trigger', x: 340, y: 40, values: { type: 'status', task: 'patch', status: 'failed' } },
        { id: 'u', kind: 'trigger', x: 340, y: 360, values: { type: 'ui' } },
        { id: 'o', kind: 'result', x: 700, y: 40 },
      ],
      connections: [{ from: 't/status', to: 'o' }],
    };
    (window as never as { editor: unknown }).editor = bindWorkflow(el as never, flow as never, {
      session: new SessionStore(), panel: el.querySelector('sherpa-node-list') as never, toolbar: el.querySelector('sherpa-node-toolbar') as never,
    } as never);
    await customElements.whenDefined('sherpa-node-list');
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});
test.afterEach(async ({ page }) => page.evaluate(() => (window as never as { undoCatalog?: () => void }).undoCatalog?.()));

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const field = (page: Page, node: string, name: string) => page.locator(`#cv > sherpa-node[data-heading="Trigger"]`).nth(node === 't' ? 0 : 1).locator(`sherpa-input-text[name="${name}"]`);

test('the panel lists Triggers first; a Trigger has no input socket, a Start node\'s shape and its own ink', async ({ page }) => {
  const first = await page.locator('sherpa-node-list').evaluate((list) => {
    const root = list.shadowRoot!;
    const heading = root.querySelector('[data-category]');
    return heading?.getAttribute('data-category');
  });
  expect(first).toBe('triggers');
  const look = await page.locator('#cv > sherpa-node[data-heading="Trigger"]').first().evaluate((n) => {
    const root = n.shadowRoot!.querySelector('.root') as HTMLElement;
    const s = getComputedStyle(root);
    return { input: n.getAttribute('data-input-socket'), category: n.getAttribute('data-category'), icon: n.getAttribute('data-icon'), corners: [s.borderTopLeftRadius, s.borderTopRightRadius] };
  });
  expect(look).toEqual({ input: null, category: 'triggers', icon: 'clipboard-w-tick', corners: ['16px', '4px'] });
});

test('its Type list, Listens for, has six types; a catalog row picks from the app\'s list, or is typed text with none', async ({ page }) => {
  const types = await field(page, 't', 'type').evaluate((f) => [...f.shadowRoot!.querySelectorAll('option')].map((o) => o.textContent));
  expect(types).toEqual(['User action', 'UI event', 'Task schedule', 'Task status', 'AI message', 'API response']);
  // The Task row picks from the catalog; the UI event's Event row has no list registered, so it is typed.
  expect(await field(page, 't', 'task').evaluate((f) => f.getAttribute('data-type'))).toBe('select');
  expect(await field(page, 't', 'task').evaluate((f) => [...f.shadowRoot!.querySelectorAll('option')].map((o) => o.textContent))).toEqual(['Patch run']);
  expect(await field(page, 'u', 'event').evaluate((f) => f.getAttribute('data-type'))).toBeNull();
});

test('Simulate: the Trigger says what it would hear; what it feeds runs', async ({ page }) => {
  await page.locator('#cv sherpa-node-toolbar sherpa-button.play').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await expect.poll(() => page.locator('#cv > sherpa-node[data-heading="Trigger"]').first().getAttribute('data-caption')).toMatch(/^Would start when the task changes/);
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-category="output"]').getAttribute('data-step')).toBe('done');
});

/** A card's header socket's middle on the screen. */
const headerSocket = (page: Page, heading: string, side: 'input' | 'output', n = 0) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`).nth(n).evaluate((el, s) => {
  const b = (el as HTMLElement & { socketRect(side: string): DOMRect }).socketRect(s);
  return [b.left + b.width / 2, b.top + b.height / 2] as [number, number];
}, side);

test('the Start (949): always there, kept and moved as any node (955), its Triggers joined by a drag from their header', async ({ page }) => {
  const start = page.locator('#cv > sherpa-node[data-heading="Start"]');
  await expect(start).toHaveCount(1);
  expect(await start.evaluate((n) => [n.getAttribute('data-category'), n.hasAttribute('data-input-socket'), n.hasAttribute('data-output-socket'), n.hasAttribute('data-locked')])).toEqual(['triggers', true, true, false]);
  // Not joined, each Trigger warns.
  await expect(page.locator('#cv > sherpa-node[data-heading="Trigger"][data-warning="Connect it to the Start"]')).toHaveCount(2);
  for (const n of [0, 1]) {
    const [from, to] = [await headerSocket(page, 'Trigger', 'output', n), await headerSocket(page, 'Start', 'input')];
    await page.mouse.move(from[0], from[1]);
    await page.mouse.down();
    await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
    await page.mouse.move(to[0], to[1], { steps: 4 });
    await page.mouse.up();
    await settle(page);
  }
  await expect(page.locator('#cv > sherpa-node[data-heading="Trigger"][data-warning]')).toHaveCount(0);
  const kept = await page.evaluate(() => (window as never as { editor: { workflow(): { nodes: { id: string }[]; connections: { from: string; to: string }[] } } }).editor.workflow());
  expect([kept.nodes.map((n) => n.id), kept.connections.filter((c) => c.to === '#start').map((c) => c.from)]).toEqual([['t', 'u', 'o', '#start'], ['t', 'u']]);
  // Simulate: the Start says what would start it.
  await page.evaluate(() => (window as never as { editor: { simulate(): Promise<void> } }).editor.simulate());
  await settle(page);
  const said = await page.evaluate(() => (window as never as { editor: { simulation(): { result: { nodes: Record<string, { would?: string }> } } } }).editor.simulation().result.nodes['#start']?.would);
  expect(said).toBe('Would start when one of its 2 Triggers fires');
});
