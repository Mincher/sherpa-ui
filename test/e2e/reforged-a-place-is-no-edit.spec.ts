import { test, expect, type Page } from './harness';

/**
 * A PLACE IS NO EDIT — TODO 1001 (Will, 2026-11-14: "Node position edits, unfurls, swimlane toggles don't count as edits
 * requiring a save. They apply and save automatically."). A node moved by the real pointer: the kept graph takes its
 * place at once (`places-change`, the definition with it), and the tab keeps no draft for it. Undo moves it back, and
 * that saves itself too. TRAP T-a-place-is-no-edit
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 640px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    const canvas = document.getElementById('cv') as HTMLElement & { rendered: Promise<void> };
    await canvas.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const w = window as unknown as Record<string, unknown>;
    w['placed'] = [];
    canvas.addEventListener('places-change', (e) => (w['placed'] as unknown[]).push((e as CustomEvent).detail));
    w['sess'] = new SessionStore();
    w['ed'] = bindWorkflow(canvas as never, {
      v: 3, id: 'places',
      nodes: [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'f', kind: 'field', x: 400, y: 0, values: { field: 'name' } }],
      connections: [{ from: 's/rows', to: 'f' }],
    } as never, { session: w['sess'] as never, toolbar: canvas.querySelector('sherpa-node-toolbar') as never, stores: ['users'] } as never);
    await window.__settled();
  });
  await settle(page);
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
/** Each `places-change`: where the Field stood in the definition it carried. */
const said = (page: Page) => page.evaluate(() => ((window as unknown as { placed: { definition: { nodes: { id: string; x: number }[] } }[] }).placed)
  .map((d) => Math.round(d.definition.nodes.find((n) => n.id === 'f')!.x)));
/** The tab's draft of the graph, as a reload would find it. */
const tabDraft = (page: Page) => page.evaluate(async () => {
  const { draftOf } = await import('/dist/core/browser/graph-drafts.js');
  return draftOf((window as unknown as { sess: never }).sess, 'places') ?? null;
});

test('a node moved saves its place at once, with no tab draft; Undo moves it back, and saves that too', async ({ page }) => {
  const head = (await page.locator('#cv > sherpa-node[data-heading="Field"] .header[role="button"]').boundingBox())!;
  await page.mouse.move(head.x + 40, head.y + 10);
  await page.mouse.down();
  await page.mouse.move(head.x + 120, head.y + 70, { steps: 6 });
  await page.mouse.move(head.x + 200, head.y + 130, { steps: 6 });
  await page.mouse.up();
  await settle(page);
  const [moved] = await said(page);
  expect(moved).toBeGreaterThan(400);
  expect(await said(page)).toHaveLength(1);
  expect(await tabDraft(page)).toBeNull();
  // Undo: one step back, where it stood, kept at once too.
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await settle(page);
  expect(await said(page)).toEqual([moved, 400]);
  expect(await tabDraft(page)).toBeNull();
});
