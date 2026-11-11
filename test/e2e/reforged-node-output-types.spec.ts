import { test, expect, type Page } from './harness';

/**
 * An Output of many types, as the node draws it (plan 891, step 4): its Type list has a section per family, each type its
 * line on hover; its header wears its type's icon. A message row shows its first lines, each value by its node's heading
 * and label, in purple, and the Details panel edits it in the Markdown editor (plan 892), its values purple chips. The
 * Nodes panel's Notify places an Output of type Notification.
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

test('a message row shows its first lines, each value by its node and label, in purple; the Details panel edits it as Markdown', async ({ page }) => {
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
  // Picked, its Details panel edits the message in the Markdown editor: its value a chip of its node and label.
  const head = (await page.locator(output).boundingBox())!;
  await page.mouse.click(head.x + head.width / 2, head.y + 10);
  await settle(page);
  const field = page.locator('#inspector sherpa-markdown-editor[name="message"]');
  await expect(field).toHaveCount(1);
  expect(await field.evaluate((f) => (f as HTMLElement & { value: string }).value)).toBe('Hi {s.name}');
  expect(await field.evaluate((f) => f.shadowRoot!.querySelector('.value')?.textContent)).toBe('Customers › Name');
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

/** Pick the Output, so the inspector shows it, open. */
async function pickOutput(page: Page): Promise<void> {
  const head = (await page.locator(output).boundingBox())!;
  await page.mouse.click(head.x + head.width / 2, head.y + 10);
  await settle(page);
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false));
  await settle(page);
}

/** In WebKit the inspector's dialog is open, yet computes `display: none`, whatever node is picked: TODO 890. */
const inspectorHidden = ({ browserName }: { browserName: string }): boolean => browserName === 'webkit';

test('Insert value lists the values from before it, by node; a pick puts the value at the message\'s caret', async ({ page, browserName }) => {
  test.fixme(inspectorHidden({ browserName }), 'TODO 890: in WebKit the inspector is open but not drawn');
  await pickOutput(page);
  // One for each message field: Title's and Message's.
  await expect(page.locator('#inspector sherpa-button.insert-value')).toHaveCount(2);
  const insert = page.locator('#inspector sherpa-button.insert-value[aria-label="Insert value in Message"]');
  await insert.click();
  const values = await insert.locator('sherpa-menu button[value]').evaluateAll((els) => els.map((e) => (e as HTMLButtonElement).value));
  expect(values).toEqual(['{s.count}', '{s.name}']);
  await insert.locator('sherpa-menu button[value="{s.name}"]').click();
  await settle(page);
  await expect(page.locator(`${output} sherpa-node-row[data-message]`)).toHaveAttribute('data-message', 'Hi {Customers › Name} {Customers › Name}');
  // At the caret: after "Hi", a value goes before the one there.
  const message = page.locator('#inspector sherpa-markdown-editor[name="message"]');
  await message.locator('.content').click();
  await page.keyboard.press(await page.evaluate(() => (/mac/i.test(navigator.platform) ? 'Meta+ArrowLeft' : 'Home')));
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');
  await page.locator('#inspector sherpa-button.insert-value[aria-label="Insert value in Message"]').click();
  await page.locator('#inspector sherpa-button.insert-value[aria-label="Insert value in Message"] sherpa-menu button[value="{s.count}"]').click();
  await settle(page);
  await expect(page.locator(`${output} sherpa-node-row[data-message]`)).toHaveAttribute('data-message', 'Hi {Customers › Count} {Customers › Name} {Customers › Name}');
});

test('Send a test asks the host, with the node, its type and its values; Sherpa sends nothing', async ({ page, browserName }) => {
  test.fixme(inspectorHidden({ browserName }), 'TODO 890: in WebKit the inspector is open but not drawn');
  await pickOutput(page);
  await page.evaluate(() => document.addEventListener('output-test', (e) => { (window as never as { asked: unknown }).asked = (e as CustomEvent).detail; }));
  await page.locator('#inspector sherpa-button.send-test').click();
  const asked = await page.evaluate(() => (window as never as { asked: unknown }).asked);
  expect(asked).toEqual({ node: 'o', type: 'notification', values: { type: 'notification', message: 'Hi {s.name}' } });
});

test('the Output tab: the Preview of each message as it reads, and where each property is routed', async ({ page }) => {
  await pickOutput(page);
  const r = await page.evaluate(() => {
    const tab = document.querySelector('#inspector [data-tab="output"]')!;
    const previews = [...tab.querySelectorAll<HTMLElement & { value: string }>('sherpa-markdown-editor.output-message')];
    const list = tab.querySelector('sherpa-key-value-list')!;
    const keys = [...list.shadowRoot!.querySelectorAll('.key')].map((k) => k.textContent);
    const values = [...list.shadowRoot!.querySelectorAll('.value')].map((v) => v.textContent);
    return {
      previews: previews.map((p) => [p.dataset['label'], p.value, p.hasAttribute('readonly')]),
      chip: previews[1]?.shadowRoot!.querySelector('.value')?.textContent,
      properties: keys.map((k, i) => [k, values[i]]),
    };
  });
  const tabs = await page.locator('#inspector sherpa-tabs').first().evaluate((t) => [...t.querySelectorAll(':scope > [data-tab]')].map((p) => (p as HTMLElement).dataset['tab']));
  expect(tabs.slice(0, 2)).toEqual(['details', 'output']);
  // Not simulated: each message as written, read only, its value by its node and label; the panel says how to see them put in.
  expect(r.previews).toEqual([['Title', '', true], ['Message', 'Hi {s.name}', true]]);
  expect(r.chip).toBe('Customers › Name');
  expect(r.properties).toEqual([['Sent', 'Not used'], ['Delivered', 'Not used'], ['Message ID', 'Not used']]);
  await expect(page.locator('#inspector [data-tab="output"] .output-note')).toHaveText('Press Simulate to see the values put in.');
});
