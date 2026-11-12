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
      v: 3, id: 'g',
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
