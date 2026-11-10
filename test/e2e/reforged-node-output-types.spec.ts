import { test, expect, type Page } from './harness';

/**
 * An Output of many types, as the node draws it (plan 891, step 4): its Type list has a section per family, each type its
 * line on hover; its header wears its type's icon. A message row shows its first lines, each value by its node's heading
 * and label, in purple, and the Details panel edits it in a multi-line field. The Nodes panel's Notify places an Output of
 * type Notification.
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.style.cssText = 'inline-size: 1000px; block-size: 640px';
    const box = document.createElement('sherpa-overlay-panel');
    box.slot = 'panel';
    for (const [a, v] of [['open', ''], ['data-side', 'start'], ['data-heading', 'Nodes'], ['data-searchable', ''], ['data-padding', 'none']] as const) box.setAttribute(a, v);
    box.appendChild(document.createElement('sherpa-node-list'));
    el.appendChild(box);
    document.getElementById('root')!.appendChild(el);
    const inspector = document.createElement('sherpa-overlay-panel');
    inspector.id = 'inspector';
    document.getElementById('root')!.appendChild(inspector);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = {
      v: 2, id: 'g',
      nodes: [
        { id: 's', kind: 'source', heading: 'Customers', x: 340, y: 40, values: { store: 'customers' } },
        { id: 'o', kind: 'output', x: 700, y: 40, values: { type: 'notification', message: 'Hi {s.name}' } },
      ],
      routes: [{ from: 's/rows', to: 'o' }],
    };
    (window as never as { editor: unknown }).editor = bindWorkflow(el as never, flow as never, {
      session: new SessionStore(), inspector: inspector as never, panel: el.querySelector('sherpa-node-list') as never,
      fieldsOf: { customers: { name: { label: 'Name' } } }, stores: ['customers'],
    } as never);
    (window as never as { saved: unknown[] }).saved = [];
    document.addEventListener('definition-save', (e) => (window as never as { saved: unknown[] }).saved.push((e as CustomEvent).detail.definition));
    await customElements.whenDefined('sherpa-node-list');
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const output = 'sherpa-layout-canvas > sherpa-node[data-category="output"]';

test('its Type list has a section per family, each type its line on hover; its header wears the type\'s icon', async ({ page }) => {
  const r = await page.evaluate((sel) => {
    const node = document.querySelector(sel)!;
    const select = node.querySelector('sherpa-node-row sherpa-input-text')!.shadowRoot!.querySelector('select')!;
    return {
      icon: node.getAttribute('data-icon'),
      groups: [...select.querySelectorAll('optgroup')].map((g) => [g.label, [...g.querySelectorAll('option')].map((o) => o.textContent)]),
      picked: select.value,
      title: select.querySelector<HTMLOptionElement>('option[value="toast"]')!.title,
    };
  }, output);
  expect(r.icon).toBe('notifications');
  expect(r.groups).toEqual([
    ['Notification', ['Notification']],
    ['Content', ['On a view', 'Generated file']],
    ['Response', ['Toast', 'Alert', 'API response']],
    ['Run result', ['Run result']],
  ]);
  expect(r.picked).toBe('notification');
  expect(r.title).toBe('Show a short message on the screen');
});

test('a message row shows its first lines, each value by its node and label, in purple; the Details panel edits it', async ({ page }) => {
  const r = await page.evaluate((sel) => {
    const row = document.querySelector(sel)!.querySelector('sherpa-node-row[data-message]')!;
    const parts = [...row.shadowRoot!.querySelectorAll('.message .part')];
    return {
      said: row.getAttribute('data-message'), field: !!row.querySelector('sherpa-input-text'),
      parts: parts.map((p) => [p.textContent, p.hasAttribute('data-value')]),
      ink: getComputedStyle(parts[1]!).color, plain: getComputedStyle(parts[0]!).color,
      shown: getComputedStyle(row.shadowRoot!.querySelector('.message')!).display !== 'none',
    };
  }, output);
  expect(r.said).toBe('Hi {Customers › Name}');
  expect(r.field).toBe(false);
  expect(r.parts).toEqual([['Hi ', false], ['Customers › Name', true]]);
  expect(r.ink).toBe('rgb(131, 0, 182)');
  expect(r.plain).not.toBe(r.ink);
  expect(r.shown).toBe(true);
  // Picked, its Details panel edits the message in a multi-line field.
  const head = (await page.locator(output).boundingBox())!;
  await page.mouse.click(head.x + head.width / 2, head.y + 10);
  await settle(page);
  const field = page.locator('#inspector sherpa-input-text[name="message"]');
  await expect(field).toHaveAttribute('data-multiline', '');
  expect(await field.evaluate((f) => (f as HTMLElement & { value: string }).value)).toBe('Hi {s.name}');
});

test('the Nodes panel\'s Notify places an Output of type Notification', async ({ page }) => {
  const items = page.locator('sherpa-node-list sherpa-list-item[data-kind="output"]');
  await expect(items).toHaveCount(2);
  const notify = page.locator('sherpa-node-list sherpa-list-item[data-kind="output"][data-label="Notify"]');
  await expect(notify).toHaveAttribute('data-icon', 'notifications');
  await notify.click();
  await settle(page);
  const added = await page.evaluate(() => {
    const w = window as never as { editor: { save(): boolean }; saved: { nodes: { id: string; kind: string; values?: Record<string, unknown> }[] }[] };
    w.editor.save();
    return w.saved.at(-1)!.nodes.filter((n) => n.kind === 'output' && n.id !== 'o').map((n) => n.values?.['type']);
  });
  expect(added).toEqual(['notification']);
});
