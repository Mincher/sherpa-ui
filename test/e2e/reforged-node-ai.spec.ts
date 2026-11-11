import { test, expect, type Page } from './harness';

/**
 * AI NODES on the canvas — Will, plan 926. The Nodes panel's AI section: Provider, Model, Prompt, Runbook, Skill. A Model
 * lists the joined Provider's models, from the app's catalog. Expects, a Prompt's Type picker, sets its sockets: True/false
 * forks, the rest give an Answer. A Runbook's predefined runbook opens on a double click: its steps, read only, with
 * nothing to copy; Escape goes back. Real pointer and keys.
 */
const RUNBOOK = {
  v: 1, label: 'Patch review', category: 'Logic', preset: true,
  inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [{ name: 'late', label: 'Late', type: 'object' }],
  nodes: [{ id: 'state', kind: 'field', x: 0, y: 0, values: { field: 'status' } }],
  connections: [{ from: '#in/rows', to: 'state' }, { from: 'state/field', to: '#out/late' }],
};

test.beforeEach(async ({ page }) => {
  await page.evaluate(async (runbook) => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-app-header id="trail"><sherpa-breadcrumbs slot="breadcrumbs"></sherpa-breadcrumbs></sherpa-app-header>
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 640px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar><sherpa-overlay-panel data-side="start" open data-heading="Nodes" data-padding="none"><sherpa-node-list></sherpa-node-list></sherpa-overlay-panel></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-list');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js' as string);
    const { registerAiCatalog } = await import('/dist/data.js' as string);
    const w = window as unknown as Record<string, unknown>;
    w['undoCatalog'] = registerAiCatalog({
      providers: { anthropic: { label: 'Anthropic', models: { opus: 'Claude Opus 5.5', sonnet: 'Claude Sonnet 5.5' } } },
      runbooks: { 'patch-review': { label: 'Patch review', help: 'Check patches before they deploy', graph: 'patch-review' } },
      skills: { summarise: { label: 'Summarise tickets' } },
    });
    const canvas = document.getElementById('cv')!;
    w['ed'] = bindWorkflow(canvas as never, {
      v: 3, id: 'ai',
      nodes: [
        { id: 'p', kind: 'provider', x: 420, y: 0, values: { provider: 'anthropic' } },
        { id: 'm', kind: 'model', x: 420, y: 220, values: { model: 'opus' } },
        { id: 'q', kind: 'prompt', x: 780, y: 0, values: { type: 'text', prompt: 'Is it late?' } },
        { id: 'r', kind: 'runbook', x: 780, y: 360, values: { type: 'boolean', runbook: 'patch-review' } },
      ],
      connections: [{ from: 'p/provider', to: 'm/provider' }, { from: 'm/model', to: 'q/model' }, { from: 'm/model', to: 'r/model' }],
    } as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-list') as never,
      toolbar: canvas.querySelector('sherpa-node-toolbar') as never, header: document.getElementById('trail') as never,
      library: { v: 1, nodes: { 'patch-review': runbook } } as never,
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
  expect(await items.evaluateAll((els) => els.map((el) => el.getAttribute('data-kind')))).toEqual(['provider', 'model', 'prompt', 'runbook', 'skill']);
  // A runbook's steps are reached through its Runbook node: never a Custom Node of the panel.
  expect(await page.locator('sherpa-node-list sherpa-list-item[data-kind="patch-review"]').count()).toBe(0);
});

test('a Model lists the joined Provider\'s models; Expects sets the sockets: True/false forks, Text gives an Answer', async ({ page }) => {
  const models = await node(page, 'Model').locator('sherpa-input-text[name="model"]').evaluate((el) => [...el.shadowRoot!.querySelectorAll('select option')].map((o) => o.textContent));
  expect(models).toEqual(['Claude Opus 5.5', 'Claude Sonnet 5.5']);
  // Text: an Answer row; no fork.
  expect(await rows(page, 'Prompt')).toContain('Answer');
  await expect(node(page, 'Prompt')).not.toHaveAttribute('data-branches');
  // Picked True/false: it forks, as a Condition does, and the Answer goes.
  await node(page, 'Prompt').locator('sherpa-input-text[name="type"] select').selectOption('boolean');
  await settle(page);
  await expect(node(page, 'Prompt')).toHaveAttribute('data-branches', '');
  expect(await rows(page, 'Prompt')).not.toContain('Answer');
  // No warning: a model is joined, and its row says it by its words.
  await expect(node(page, 'Prompt')).not.toHaveAttribute('data-warning');
  await expect(node(page, 'Prompt').locator('sherpa-node-row[data-socket-name="Model"]')).toHaveAttribute('data-label', 'Model: Claude Opus 5.5');
});

test('a Runbook\'s predefined runbook opens on a double click: its steps, read only, nothing to copy; a crumb goes back', async ({ page }) => {
  await node(page, 'Runbook').locator('.header[role="button"]').dblclick({ position: { x: 40, y: 12 } });
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as { ed: { path(): string[] } }).ed.path())).toEqual(['r']);
  await expect(page.locator('#cv > sherpa-node[data-heading="Field"]')).toHaveAttribute('data-locked', '');
  await expect(page.locator('#inspector')).toHaveAttribute('data-heading', 'Patch review');
  await expect(page.locator('#inspector')).toContainText('read only');
  expect(await page.locator('#inspector sherpa-button[data-label="Copy to my nodes"]').count()).toBe(0);
  // Back, by Escape.
  await page.keyboard.press('Escape');
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as { ed: { path(): string[] } }).ed.path())).toEqual([]);
  await expect(node(page, 'Runbook')).toHaveCount(1);
});
