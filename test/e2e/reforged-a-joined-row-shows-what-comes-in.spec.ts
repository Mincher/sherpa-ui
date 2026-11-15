import { test, expect } from './harness';

/**
 * A JOINED ROW SHOWS WHAT COMES IN, READ ONLY — Will, TODO 990. A Notification's Message joined to a Math's Result: before
 * a run it shows nothing and is read only, its own words kept; after Simulate, what came in. TRAP T-a-joined-row-shows-what-comes-in 
 */
test('a joined Message shows nothing before a run, read only; after Simulate, what came in', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', '<sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px"></sherpa-layout-canvas>');
    const canvas = document.getElementById('cv') as HTMLElement & { rendered: Promise<void> };
    await canvas.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { ArrayStore } = await import('/dist/data.js');
    const store = new ArrayStore([{ id: 1, status: 'active' }, { id: 2, status: 'trial' }, { id: 3, status: 'trial' }]);
    const nodes = [
      { id: 's', kind: 'source', x: 0, y: 0, heading: 's', values: { store: 'users' } },
      { id: 'm', kind: 'math', x: 360, y: 0, heading: 'm', values: { type: 'count' } },
      { id: 'n', kind: 'notify', x: 720, y: 0, heading: 'n', values: { type: 'notification', message: 'My own words' } },
    ];
    const connections = [{ from: 's/rows', to: 'm/rows' }, { from: 'm/result', to: 'n/message' }, { from: 's/rows', to: 'n' }];
    const ed = bindWorkflow(canvas as never, { v: 3, id: 'w', nodes, connections } as never, { session: new SessionStore(), stores: ['users'], storeOf: () => store });
    (window as never as { ed: unknown }).ed = ed;
    await window.__settled();
  });
  const area = page.locator('#cv > sherpa-node[data-heading="n"] sherpa-input-text[name="message"]');
  const said = () => area.evaluate((field: HTMLElement & { value?: string }) => ({ value: field.value ?? null, readonly: field.hasAttribute('readonly') || field.hasAttribute('disabled') }));
  const before = await said();
  expect(before.value ?? '').not.toContain('My own words');
  expect(before.readonly).toBe(true);
  await page.evaluate(async () => {
    const ed = (window as never as { ed: { fetch(): Promise<void>; simulate(): Promise<void> } }).ed;
    await ed.fetch();
    await ed.simulate();
    await window.__settled();
  });
  const after = await said();
  expect(after.value).toContain('3');
  expect(after.readonly).toBe(true);
});
