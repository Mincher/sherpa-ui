import { test, expect, type Page } from './harness';

/**
 * A ROUTE HAS AN OUTPUT PER ROUTE — plan 991 D6 A (Will, 2026-11-14): on the canvas, a Route draws its Routes, one
 * dropdown of ticks of its field's values, then a row per value picked, each with its own output socket, then Otherwise.
 * TRAP T-a-route-unfolds-its-picks
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.id = 'cv';
    el.style.cssText = 'inline-size: 1100px; block-size: 640px';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = {
      v: 3, id: 'route',
      nodes: [
        { id: 's', kind: 'source', x: 20, y: 20, values: { store: 'customers' } },
        { id: 'f', kind: 'field', x: 380, y: 20, values: { field: 'risk' } },
        { id: 'r', kind: 'route', x: 740, y: 20, values: { routes: ['High', 'Medium'] } },
      ],
      connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'r' }],
    };
    (window as unknown as Record<string, unknown>)['ed'] = bindWorkflow(el as never, flow as never, {
      session: new SessionStore(), stores: ['customers'],
      fieldsOf: { customers: { risk: { label: 'Risk', values: ['High', 'Medium', 'Low'] } } },
    } as never);
    await window.__settled();
  });
});

const rows = (page: Page) => page.locator('#cv > sherpa-node[data-heading="Route"] sherpa-node-row').evaluateAll((els) =>
  els.map((e) => [e.getAttribute('data-label') ?? e.querySelector('[data-label]')?.getAttribute('data-label') ?? '', e.getAttribute('data-output-socket')]));

test('a Route draws its Routes, a row with an output socket per value picked, then Otherwise', async ({ page }) => {
  const drawn = (await rows(page)).filter(([label]) => label !== 'Parameters');
  expect(drawn.filter(([, socket]) => socket === 'object').map(([label]) => label)).toEqual(['High', 'Medium', 'Otherwise']);
  // Its Routes pick the field's values: one dropdown of ticks.
  expect(await page.locator('#cv > sherpa-node[data-heading="Route"] sherpa-input-text').count()).toBeGreaterThan(0);
});

test('the outputs are the values picked: Low alone, one output and Otherwise', async ({ page }) => {
  // The graph drawn again with Low picked alone.
  await page.evaluate(async () => {
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const el = document.getElementById('cv') as HTMLElement;
    const flow = {
      v: 3, id: 'route2',
      nodes: [
        { id: 's', kind: 'source', x: 20, y: 20, values: { store: 'customers' } },
        { id: 'f', kind: 'field', x: 380, y: 20, values: { field: 'risk' } },
        { id: 'r', kind: 'route', x: 740, y: 20, values: { routes: ['Low'] } },
      ],
      connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'r' }],
    };
    bindWorkflow(el as never, flow as never, { session: new SessionStore(), stores: ['customers'] } as never);
    await window.__settled();
  });
  const drawn = await rows(page);
  expect(drawn.filter(([, socket]) => socket === 'object').map(([label]) => label)).toEqual(['Low', 'Otherwise']);
});
