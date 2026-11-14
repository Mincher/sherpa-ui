import { test, expect, type Page } from './harness';

/**
 * A CATEGORY FEEDS A FORK — plan 992 O6 A (Will, 2026-11-14: Classify is a Prompt answer type, Category; a Fork sends the
 * rows on by it). On the canvas, a Prompt that Expects a Category draws its Categories and an Answer that sends a column;
 * the Fork on it draws an output per Way picked from them, then Otherwise.
 * TRAP T-a-category-is-a-column-the-model-makes
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.id = 'cv';
    el.style.cssText = 'inline-size: 1200px; block-size: 700px';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = {
      v: 3, id: 'classify',
      nodes: [
        { id: 's', kind: 'source', x: 20, y: 20, values: { store: 'tickets' } },
        { id: 'q', kind: 'prompt', x: 380, y: 20, values: { type: 'category', prompt: 'What does it ask for?', categories: ['Patch', 'Access', 'Hardware'] } },
        { id: 'f', kind: 'fork', x: 760, y: 20, values: { ways: ['Patch', 'Access'] } },
      ],
      connections: [{ from: 's/rows', to: 'q' }, { from: 'q/answer', to: 'f' }],
    };
    bindWorkflow(el as never, flow as never, { session: new SessionStore(), stores: ['tickets'], fieldsOf: { tickets: { subject: { label: 'Subject' } } } } as never);
    await window.__settled();
  });
});

const rowsOf = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] sherpa-node-row`).evaluateAll((els) => els.filter((e) => e.checkVisibility()).map((e) => [
  e.getAttribute('data-socket-name') ?? e.getAttribute('data-label') ?? e.querySelector('[data-label]')?.getAttribute('data-label') ?? '', e.getAttribute('data-output-socket'),
]));

test('a Prompt that Expects a Category draws its Categories and an Answer; the Fork on it, an output per Way, then Otherwise', async ({ page }) => {
  const prompt = await rowsOf(page, 'Prompt');
  expect(prompt.map(([label]) => label)).toContain('Categories');
  expect(prompt.find(([label]) => label === 'Answer')).toEqual(['Answer', 'object']);
  expect((await rowsOf(page, 'Fork')).filter(([, socket]) => socket === 'object').map(([label]) => label)).toEqual(['Patch', 'Access', 'Otherwise']);
  await expect(page.locator('#cv svg.graph-connectors path[data-from="q/answer"][data-to="f"]')).toHaveCount(1);
  expect(await page.locator('#cv > sherpa-node[data-heading="Fork"]').getAttribute('data-warning')).toBeNull();
});
