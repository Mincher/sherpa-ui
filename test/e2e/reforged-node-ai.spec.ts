import { test, expect, type Page } from './harness';

/**
 * AI NODES on the canvas — Will, plans 926, 951. The Nodes panel's AI section: Model, Prompt, Runbook, Skill. A Model picks a
 * provider and lists its models, from the app's catalog. One joined to the Start is the graph's primary: an AI node with no
 * Model of its own uses it, and says so; the Graph details tab lists the models, the primary first. Expects, a Prompt's Type picker, sets its sockets: True/false
 * gives a True property, 1 or 0, and no fork (plan 944); the rest give an Answer. A Runbook node is its own instructions;
 * the app's runbooks are Runbooks nodes (plan 936 D1 B): a preset one opens on a double click, its steps read only, with
 * Copy to my nodes; Escape goes back. Real pointer and keys.
 */
const RUNBOOK = {
  v: 1, label: 'Patch review', category: 'Runbooks', preset: true,
  inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [{ name: 'late', label: 'Late', type: 'object' }],
  nodes: [{ id: 'state', kind: 'field', x: 0, y: 0, values: { field: 'status' } }],
  connections: [{ from: '#in/rows', to: 'state' }, { from: 'state/field', to: '#out/late' }],
};

test.beforeEach(async ({ page }) => {
  await page.evaluate(async (runbook) => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 640px"><sherpa-stack id="trail" slot="trail" data-direction="inline" data-gap="sm"><sherpa-button data-action="back" data-type="icon" data-look="transparent" data-icon-start="arrow-left" aria-label="Back" data-tip="Back (Esc)"></sherpa-button><sherpa-breadcrumbs></sherpa-breadcrumbs></sherpa-stack><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar><sherpa-overlay-panel data-side="start" open data-heading="Nodes" data-padding="none"><sherpa-node-list></sherpa-node-list></sherpa-overlay-panel></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-list');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js' as string);
    const { registerAiCatalog, useOf } = await import('/dist/data.js' as string);
    const w = window as unknown as Record<string, unknown>;
    w['undoCatalog'] = registerAiCatalog({
      providers: { anthropic: { label: 'Anthropic', models: { opus: 'Claude Opus 5.5', sonnet: 'Claude Sonnet 5.5' } } },
      skills: { summarise: { label: 'Summarise tickets' } },
    });
    const canvas = document.getElementById('cv')!;
    const library = { v: 1, nodes: { 'patch-review': runbook } };
    w['ed'] = bindWorkflow(canvas as never, {
      v: 3, id: 'ai',
      nodes: [
        { id: '#start', kind: '#start', x: 60, y: 0 },
        { id: 'main', kind: 'model', heading: 'Main model', x: 60, y: 220, values: { provider: 'anthropic', model: 'sonnet' } },
        { id: 'm', kind: 'model', x: 420, y: 220, values: { provider: 'anthropic', model: 'opus' } },
        { id: 's', kind: 'skill', x: 420, y: 480, values: { type: 'text', skill: 'summarise' } },
        { id: 'q', kind: 'prompt', x: 780, y: 0, values: { type: 'text', prompt: 'Is it late?' } },
        { id: 'r', kind: 'runbook', x: 780, y: 360, values: { type: 'boolean', instructions: 'Check the patches' } },
        useOf(library as never, 'patch-review', { id: 'pr', x: 1140, y: 360 }),
      ],
      connections: [{ from: 'main/model', to: '#start/model' }, { from: 'm/model', to: 'q/model' }, { from: 'm/model', to: 'r/model' }],
    } as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-list') as never,
      toolbar: canvas.querySelector('sherpa-node-toolbar') as never,
      library: library as never,
    });
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, RUNBOOK);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => (window as unknown as { undoCatalog?: () => void }).undoCatalog?.());
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const node = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`);
const rows = (page: Page, heading: string) => node(page, heading).evaluate((el) => [...el.querySelectorAll('sherpa-node-row')].flatMap((r) => r.getAttribute('data-socket-name') ?? []));

test('the panel lists the AI nodes under AI, in its ink', async ({ page }) => {
  const items = page.locator('sherpa-node-list sherpa-list-item[data-category="ai"]');
  expect(await items.evaluateAll((els) => els.map((el) => el.getAttribute('data-kind')))).toEqual(['model', 'prompt', 'runbook', 'skill']);
  // The app's runbook is a Runbooks node, a preset: on the Preset tab, in Runbooks' ink (plan 936).
  await expect(page.locator('sherpa-node-list sherpa-list-item[data-kind="patch-review"]')).toHaveAttribute('data-category', 'runbooks');
});

test('a Model lists its own Provider\'s models; Expects sets the sockets: True/false gives a True, Text gives an Answer', async ({ page }) => {
  const models = await node(page, 'Model').locator('sherpa-input-text[name="model"]').evaluate((el) => [...el.shadowRoot!.querySelectorAll('select option')].map((o) => o.textContent));
  expect(models).toEqual(['Claude Opus 5.5', 'Claude Sonnet 5.5']);
  // Text: an Answer row, and no True.
  expect(await rows(page, 'Prompt')).toContain('Answer');
  expect(await rows(page, 'Prompt')).not.toContain('True');
  // Picked True/false: a True property, a value, as a Condition has; no fork, and the Answer goes (plan 944).
  await node(page, 'Prompt').locator('sherpa-input-text[name="type"] select').selectOption('boolean');
  await settle(page);
  const yes = node(page, 'Prompt').locator('sherpa-node-row[data-socket-name="True"]');
  await expect(yes).toHaveAttribute('data-property', '');
  await expect(yes).toHaveAttribute('data-output-socket', 'value');
  await expect(node(page, 'Prompt')).not.toHaveAttribute('data-output-socket');
  expect(await rows(page, 'Prompt')).not.toContain('Answer');
  // No warning: a model is joined, and its row says it by its words.
  await expect(node(page, 'Prompt')).not.toHaveAttribute('data-warning');
  await expect(node(page, 'Prompt').locator('sherpa-node-row[data-socket-name="Model"]')).toHaveAttribute('data-label', 'Model: Claude Opus 5.5');
});

test('a preset Runbooks node opens on a double click: its steps, read only, with Copy to my nodes; a crumb goes back', async ({ page }) => {
  await node(page, 'Patch review').locator('.header[role="button"]').dblclick({ position: { x: 40, y: 12 } });
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as { ed: { path(): string[] } }).ed.path())).toEqual(['pr']);
  await expect(page.locator('#cv > sherpa-node[data-heading="Field"]')).toHaveAttribute('data-locked', '');
  await expect(page.locator('#inspector')).toContainText('read only');
  expect(await page.locator('#inspector sherpa-button[data-label="Copy to my nodes"]').count()).toBe(1);
  // Back, by Escape.
  await page.keyboard.press('Escape');
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as { ed: { path(): string[] } }).ed.path())).toEqual([]);
  // The AI Runbook is its instructions: a double click opens nothing.
  await node(page, 'Runbook').locator('.header[role="button"]').dblclick({ position: { x: 40, y: 12 } });
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as { ed: { path(): string[] } }).ed.path())).toEqual([]);
});

test('one model for the graph: an AI node with none of its own uses the Start\'s; Graph details lists them, the primary first, alone with nothing picked and last with a node (951)', async ({ page }) => {
  // The Skill has no Model of its own: it uses the one joined to the Start, and says so.
  const model = node(page, 'Skill').locator('sherpa-node-row[data-socket-name="Model"]');
  await expect(model).toHaveAttribute('data-label', 'Model: Claude Sonnet 5.5');
  await expect(node(page, 'Skill')).not.toHaveAttribute('data-warning');
  await expect(node(page, 'Start').locator('sherpa-node-row[data-socket-name="Model"]')).toHaveCount(1);
  // Nothing picked: Graph details is the only tab.
  const tabs = () => page.locator('#inspector sherpa-tabs.content-tabs').evaluate((el) => [...el.children].map((c) => (c as HTMLElement).dataset['tab']));
  expect(await tabs()).toEqual(['graph']);
  await expect(page.locator('#inspector')).toHaveAttribute('data-heading', 'Graph details');
  const listed = () => page.locator('#inspector .graph-models').evaluate((el) => [...(el.shadowRoot ?? el).querySelectorAll('dt, dd')].map((n) => n.textContent?.trim()));
  await expect.poll(listed).toEqual(['Claude Sonnet 5.5', 'Anthropic · Primary · 1 AI node', 'Claude Opus 5.5', 'Anthropic · 2 AI nodes']);
  // A node picked: its own tabs first, Graph details last.
  await node(page, 'Prompt').locator('.header[role="button"]').click({ position: { x: 40, y: 12 } });
  await settle(page);
  expect((await tabs()).at(0)).toBe('details');
  expect((await tabs()).at(-1)).toBe('graph');
  // The Prompt's own Model cut: it uses the primary too, and the Graph details tab says so.
  await page.locator('#inspector sherpa-button[data-label^="Cut connection from"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  await page.locator('#inspector sherpa-tabs.content-tabs').evaluate((el) => (el.shadowRoot!.querySelectorAll('.tab')[el.children.length - 1] as HTMLElement).click());
  await settle(page);
  await expect.poll(listed).toEqual(['Claude Sonnet 5.5', 'Anthropic · Primary · 2 AI nodes', 'Claude Opus 5.5', 'Anthropic · 1 AI node']);
});
