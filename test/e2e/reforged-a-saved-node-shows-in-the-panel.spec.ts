import { test, expect, parkThePointer, type Page } from './fixture';
import { gotoHarness } from './harness';

/**
 * A SAVED NODE crosses tabs — Will, plan 713 §9.4 (D13: app-wide), M12. The panel's "Custom
 * Nodes" lists the app's PRESETS, read only, and the reader's own, which the page keeper keeps
 * in every tab. A node saved in one tab shows in a second tab's panel at once (its `storage`
 * event), and after a reload. Placing one places a node whose kind is its id.
 * TRAP T-only-a-named-part-crosses-tabs
 */
const SETUP = `async () => {
  const { PageKeeper, bindWorkflow, SessionStore, nodeEntityOf, kindsOf, paletteOf, NODE_KINDS } = await import('/dist/index.js');
  const canvas = document.createElement('sherpa-layout-canvas');
  canvas.style.cssText = 'inline-size: 900px; block-size: 600px';
  const panel = document.createElement('sherpa-node-list');
  const box = document.createElement('sherpa-overlay-panel');
  box.slot = 'panel';
  for (const [a, v] of [['open', ''], ['data-heading', 'Nodes'], ['data-searchable', ''], ['data-padding', 'none']]) box.setAttribute(a, v);
  box.appendChild(panel);
  canvas.appendChild(box);
  const inspector = document.createElement('sherpa-overlay-panel');
  document.getElementById('root').append(canvas, inspector);
  await canvas.rendered;
  const definition = (label) => ({ v: 1, label, category: 'Custom Nodes',
    inputs: [{ name: 'users', label: 'Users', type: 'object' }], outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
    nodes: [{ id: 'c', kind: 'condition', x: 0, y: 0 }],
    connections: [{ from: '#in/users', to: 'c' }, { from: 'c/rows', to: '#out/allowed' }, { from: 'c/true', to: '#out' }] });
  window.definition = definition;
  const keeper = new PageKeeper();
  keeper.entityPresets = [nodeEntityOf('has-role', definition('Has role'))];
  const kinds = { ...NODE_KINDS, ...kindsOf(keeper.nodeLibrary()) };
  // The panel follows the library: mutated in place, which is what the editor holds.
  keeper.shelf.watch((library) => {
    for (const id of Object.keys(kinds)) if (kinds[id].model === 'graph') delete kinds[id];
    Object.assign(kinds, kindsOf(library));
    panel.populate(paletteOf(kinds));
  });
  window.keeper = keeper;
  window.saved = [];
  document.addEventListener('definition-save', (e) => window.saved.push(e.detail.definition));
  window.editor = bindWorkflow(canvas, { v: 3, id: 'g', nodes: [], connections: [] }, { session: new SessionStore(), inspector, panel, kinds });
  await customElements.whenDefined('sherpa-node-list');
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}`;
const setup = (page: Page) => page.evaluate(`(${SETUP})()`);
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
/** The Custom Nodes category: each item's kind id, and whether it is a preset. */
const listed = (page: Page) => page.evaluate(() => {
  const category = [...document.querySelector('sherpa-node-list')!.shadowRoot!.querySelectorAll('.categories > .category')].find((a) => a.querySelector('.category-heading')?.getAttribute('data-heading') === 'Custom Nodes');
  return [...(category?.querySelectorAll('sherpa-list-item') ?? [])].map((i) => `${(i as HTMLElement).dataset['kind']}${i.hasAttribute('data-preset') ? ' (preset)' : ''}`);
});
const save = (page: Page, id: string, label: string) => page.evaluate(([i, l]) => {
  const w = window as unknown as { keeper: { saveNode(id: string, d: unknown): Promise<boolean> }; definition(l: string): unknown };
  return w.keeper.saveNode(i!, w.definition(l!));
}, [id, label]);

test('a saved node shows in a second tab, live and after a reload; a preset is read only; placing one places its use', async ({ context }) => {
  const first = parkThePointer(await context.newPage());
  await gotoHarness(first);
  await first.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('sherpa:')) localStorage.removeItem(key); });
  await setup(first);
  expect(await listed(first)).toEqual(['has-role (preset)']);
  expect(await save(first, 'mine', 'Mine')).toBe(true);
  await settle(first);
  expect(await listed(first)).toEqual(['has-role (preset)', 'mine']);

  // A SECOND TAB: the same localStorage.
  const second = parkThePointer(await context.newPage());
  await gotoHarness(second);
  await setup(second);
  expect(await listed(second)).toEqual(['has-role (preset)', 'mine']);
  // …and what it saves reaches the first, which heard the storage event.
  expect(await save(second, 'also', 'Also')).toBe(true);
  await settle(first);
  await expect.poll(() => listed(first)).toEqual(['has-role (preset)', 'mine', 'also']);

  // A preset is never the reader's: saving over it is refused, and it stays read only.
  expect(await save(second, 'has-role', 'Over it')).toBe(false);
  expect(await listed(second)).toContain('has-role (preset)');

  // A RELOAD sees it too.
  await second.reload();
  await gotoHarness(second);
  await setup(second);
  expect(await listed(second)).toEqual(['has-role (preset)', 'mine', 'also']);

  // Placing one is placing a use: a node whose kind is the saved id.
  await second.locator('sherpa-node-list sherpa-tabs .tab[data-id="custom"]').click();
  await second.locator('sherpa-node-list sherpa-list-item[data-kind="mine"]').click();
  await settle(second);
  const placed = await second.evaluate(() => {
    const w = window as unknown as { editor: { save(): boolean }; saved: { nodes: { kind: string }[] }[] };
    w.editor.save();
    return w.saved.at(-1)!.nodes.map((n) => n.kind);
  });
  expect(placed).toEqual(['mine']);

  // Forgotten, it goes from every tab.
  await second.evaluate(() => (window as unknown as { keeper: { removeNode(id: string): boolean } }).keeper.removeNode('mine'));
  await expect.poll(() => listed(first)).toEqual(['has-role (preset)', 'also']);
});

