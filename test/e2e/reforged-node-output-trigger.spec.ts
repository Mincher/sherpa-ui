import { test, expect, type Page } from './harness';

/**
 * THE WAY OUT AND THE WAY IN — Will, plan 949. An Output Trigger of an app's Run Coworker type picks a Coworker from the
 * shelf, as a dropdown; one that would start a loop across the shelf warns, and says it is blocked. The Start's line to each
 * Source is drawn, never kept, and no click lands on it.
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.id = 'cv';
    el.style.cssText = 'inline-size: 1100px; block-size: 640px';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { OUTPUT_TRIGGER, registerNodeTypes } = await import('/dist/data.js');
    const w = window as never as Record<string, unknown>;
    w['undoTypes'] = registerNodeTypes(OUTPUT_TRIGGER, {
      coworker: { label: 'Run Coworker', icon: 'person', help: 'Run a Coworker', would: 'Would run the Coworker', rows: [{ name: 'coworker', label: 'Coworker', control: 'entity', of: 'coworker' }] },
    });
    // Ana runs this graph again: a loop. Bo runs nothing.
    const shelf = [
      { type: 'coworker', id: 'ana', label: 'Ana', graph: { nodes: [{ id: 'o', kind: OUTPUT_TRIGGER, x: 0, y: 0, values: { type: 'coworker', coworker: 'w' } }] } },
      { type: 'coworker', id: 'bo', label: 'Bo', graph: { nodes: [] } },
    ];
    const flow = {
      v: 3, id: 'w', label: 'Patching',
      nodes: [
        { id: 't', kind: 'trigger', x: 0, y: 300, values: { type: 'schedule' } },
        { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
        { id: 'run', kind: OUTPUT_TRIGGER, x: 600, y: 0, values: { type: 'coworker', coworker: 'ana' } },
      ],
      connections: [{ from: 't', to: '#start' }, { from: 's/rows', to: 'run' }],
    };
    w['editor'] = bindWorkflow(el as never, flow as never, { session: new SessionStore(), stores: ['users'], entities: () => shelf } as never);
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});
test.afterEach(async ({ page }) => page.evaluate(() => (window as never as { undoTypes?: () => void }).undoTypes?.()));

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const card = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`);

test('an Output Trigger picks a Coworker from the shelf; one that starts a loop warns, blocked; a pick that does not, does not', async ({ page }) => {
  const run = card(page, 'Output Trigger');
  await expect(run).toHaveAttribute('data-category', 'output');
  const pick = run.locator('sherpa-input-text[name="coworker"]');
  expect(await pick.evaluate((f) => [...f.shadowRoot!.querySelectorAll('option')].map((o) => o.textContent))).toEqual(['Ana', 'Bo']);
  await expect(run).toHaveAttribute('data-warning', 'Blocked: it would start a loop, Patching › Ana › Patching');
  await pick.locator('select').selectOption('bo');
  await settle(page);
  await expect(run).not.toHaveAttribute('data-warning');
});

test('the Start\'s line to each Source is drawn, from its output to the Source\'s header, and never kept', async ({ page }) => {
  const line = page.locator('#cv svg.graph-connectors path[data-start="s"]');
  await expect(line).toHaveCount(1);
  expect(await line.getAttribute('data-type')).toBe('boolean');
  await expect(card(page, 'Source')).toHaveAttribute('data-input-socket', 'boolean');
  await expect(card(page, 'Start')).toHaveAttribute('data-output-socket', 'boolean');
  // No hit line: no click picks it.
  expect(await page.locator('#cv svg.graph-connectors .graph-hit[data-from="#start"]').count()).toBe(0);
  const kept = await page.evaluate(() => (window as never as { editor: { workflow(): { connections: { from: string; to: string }[] } } }).editor.workflow().connections);
  expect(kept.some((c) => c.from === '#start')).toBe(false);
});
