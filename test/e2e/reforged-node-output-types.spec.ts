import { test, expect, type Page } from './harness';

/**
 * An Output, a node per family (plan 917): a family of one type has no Type row; one of several lists its types, each its
 * line on hover; its header wears its type's icon. A message row is a text area in the node, a title one line (Will,
 * 2026-11-11), and the Details panel edits it in the Markdown editor (plan 892), its values purple chips. The Nodes panel
 * lists a node per family, no Notify.
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
      v: 3, id: 'g',
      nodes: [
        { id: 's', kind: 'source', heading: 'Customers', x: 340, y: 40, values: { store: 'customers' } },
        { id: 'o', kind: 'notify', x: 700, y: 40, values: { type: 'notification', message: 'Hi {{value:s.name}}' } },
      ],
      connections: [{ from: 's/rows', to: 'o' }],
    };
    (window as never as { editor: unknown }).editor = bindWorkflow(el as never, flow as never, {
      session: new SessionStore(), inspector: inspector as never, panel: el.querySelector('sherpa-node-list') as never,
      // Two fields, so a pick at the caret shows where it went: a Source has no Count to name (plan 944).
      fieldsOf: { customers: { name: { label: 'Name' }, email: { label: 'Email' } } }, stores: ['customers'],
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

test('a family of one type has no Type row; its header wears its icon', async ({ page }) => {
  const r = await page.evaluate((sel) => {
    const node = document.querySelector(sel)!;
    return { icon: node.getAttribute('data-icon'), heading: node.getAttribute('data-heading'), type: !!node.querySelector('sherpa-input-text[name="type"]') };
  }, output);
  expect(r).toEqual({ icon: 'notifications', heading: 'Notification', type: false });
});

test('a message row is a text area in the node, a title one line; typed there, it changes; the Details panel edits it as Markdown', async ({ page }) => {
  // In the node (Will, 2026-11-11): the Message a text area, the Title one line, each its raw text.
  const node = (name: string) => page.locator(`${output} sherpa-input-text[name="${name}"]`);
  await expect(node('message')).toHaveAttribute('data-multiline', '');
  await expect(node('title')).not.toHaveAttribute('data-multiline');
  expect(await node('message').evaluate((f) => (f as HTMLElement & { value: string }).value)).toBe('Hi {{value:s.name}}');
  // Typed in the node, the message changes.
  await node('message').locator('textarea').fill('Hi {{value:s.name}}, thanks');
  await node('message').locator('textarea').blur();
  await settle(page);
  expect(await page.evaluate(() => (window as never as { editor: { workflow(): { nodes: { kind: string; values?: Record<string, unknown> }[] } } }).editor.workflow().nodes.find((n) => n.kind === 'notify')?.values?.['message'])).toBe('Hi {{value:s.name}}, thanks');
  // Picked, its Details panel edits the message in the Markdown editor: its value a chip of its node and label.
  const head = (await page.locator(output).boundingBox())!;
  await page.mouse.click(head.x + head.width / 2, head.y + 10);
  await settle(page);
  const field = page.locator('#inspector sherpa-markdown-editor[name="message"]');
  await expect(field).toHaveCount(1);
  expect(await field.evaluate((f) => (f as HTMLElement & { value: string }).value)).toBe('Hi {{value:s.name}}, thanks');
  expect(await field.evaluate((f) => f.shadowRoot!.querySelector('.value')?.textContent)).toBe('Customers › Name');
  // Its Title is one line, with no toolbar; its Message is many (TODO 913).
  await expect(page.locator('#inspector sherpa-markdown-editor[name="title"]')).toHaveAttribute('data-single-line', '');
  await expect(field).not.toHaveAttribute('data-single-line');
});

test('the Nodes panel lists a node per family, no Notify; Response places one, its Type list its three, each its line on hover', async ({ page }) => {
  const items = page.locator('sherpa-node-list sherpa-list-item[data-kind]');
  const output = await items.evaluateAll((els) => els.filter((e) => ['notify', 'content', 'response', 'result', 'request'].includes(e.getAttribute('data-kind')!)).map((e) => [e.getAttribute('data-kind'), e.getAttribute('data-label')]));
  expect(output).toEqual([['notify', 'Notification'], ['content', 'Content'], ['response', 'Response'], ['result', 'Run result']]);
  await page.locator('sherpa-node-list sherpa-list-item[data-kind="response"]').click();
  await settle(page);
  const select = page.locator('sherpa-layout-canvas > sherpa-node[data-heading="Response"] sherpa-input-text[name="type"]');
  const r = await select.evaluate((f) => {
    const el = f.shadowRoot!.querySelector('select')!;
    return { options: [...el.querySelectorAll('option')].map((o) => o.textContent), groups: el.querySelectorAll('optgroup').length, title: el.querySelector<HTMLOptionElement>('option[value="toast"]')!.title };
  });
  expect(r).toEqual({ options: ['Toast', 'Alert', 'API response'], groups: 0, title: 'Show a short message on the screen' });
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
  // The Source's fields alone: it has no Count (plan 944).
  expect(values).toEqual(['{{value:s.name}}', '{{value:s.email}}']);
  await insert.locator('sherpa-menu button[value="{{value:s.name}}"]').click();
  await settle(page);
  const inNode = () => page.locator(`${output} sherpa-input-text[name="message"]`).evaluate((f) => (f as HTMLElement & { value: string }).value);
  expect(await inNode()).toBe('Hi {{value:s.name}} {{value:s.name}}');
  // At the caret: after "Hi", a value goes before the one there.
  const message = page.locator('#inspector sherpa-markdown-editor[name="message"]');
  await message.locator('.content').click();
  await page.keyboard.press(await page.evaluate(() => (/mac/i.test(navigator.platform) ? 'Meta+ArrowLeft' : 'Home')));
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');
  await page.locator('#inspector sherpa-button.insert-value[aria-label="Insert value in Message"]').click();
  await page.locator('#inspector sherpa-button.insert-value[aria-label="Insert value in Message"] sherpa-menu button[value="{{value:s.email}}"]').click();
  await settle(page);
  expect(await inNode()).toBe('Hi {{value:s.email}} {{value:s.name}} {{value:s.name}}');
});

test('Send a test asks the host, with the node, its type and its values; Sherpa sends nothing', async ({ page, browserName }) => {
  test.fixme(inspectorHidden({ browserName }), 'TODO 890: in WebKit the inspector is open but not drawn');
  await pickOutput(page);
  await page.evaluate(() => document.addEventListener('output-test', (e) => { (window as never as { asked: unknown }).asked = (e as CustomEvent).detail; }));
  await page.locator('#inspector sherpa-button.send-test').click();
  const asked = await page.evaluate(() => (window as never as { asked: unknown }).asked);
  expect(asked).toEqual({ node: 'o', kind: 'notify', type: 'notification', values: { type: 'notification', message: 'Hi {{value:s.name}}' } });
});

test('the Output tab: the Preview of each message as it reads, and where each property is connected', async ({ page }) => {
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
  expect(r.previews).toEqual([['Title', '', true], ['Message', 'Hi {{value:s.name}}', true]]);
  expect(r.chip).toBe('Customers › Name');
  expect(r.properties).toEqual([['Sent', 'Not used'], ['Delivered', 'Not used'], ['Message ID', 'Not used']]);
  await expect(page.locator('#inspector [data-tab="output"] .output-note')).toHaveText('Press Simulate to see the values put in.');
});
