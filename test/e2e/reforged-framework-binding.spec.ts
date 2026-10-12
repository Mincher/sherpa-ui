import { test, expect } from './harness';

/**
 * `data-x="false"` is OFF on a declared boolean prop: React, Vue, Angular and
 * Svelte all write `data-x={false}` as the string, and a boolean is read by
 * presence (TODO 211). TRAP T-false-is-off
 */
test('a declared boolean set to "false" is removed — before the first render and after', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const Menu = customElements.get('sherpa-menu') as unknown as { props: Record<string, { type: string }> };
    const early = document.createElement('sherpa-menu');
    early.setAttribute('data-inline', 'false');
    const beforeRender = early.hasAttribute('data-inline');
    document.getElementById('root')!.replaceChildren(early);
    await (early as HTMLElement & { rendered: Promise<void> }).rendered;
    early.setAttribute('data-inline', 'false');
    const afterRender = early.hasAttribute('data-inline');
    early.setAttribute('data-inline', '');
    const on = early.hasAttribute('data-inline');
    // A string prop keeps "false" as its value.
    early.setAttribute('data-heading', 'false');
    return { boolean: Menu.props['data-inline']?.type, beforeRender, afterRender, on, heading: early.getAttribute('data-heading') };
  });
  expect(r).toEqual({ boolean: 'boolean', beforeRender: false, afterRender: false, on: true, heading: 'false' });
});

/** React and Vue keep `key` for themselves, so the grid's row key has a second name. TODO 211 */
test('a grid\'s rowKey is its key', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const grid = document.createElement('sherpa-data-grid') as HTMLElement & { key: string | null; rowKey: string | null };
    document.getElementById('root')!.replaceChildren(grid);
    grid.rowKey = 'email';
    const viaKey = grid.key;
    grid.key = 'id';
    return { viaKey, viaRowKey: grid.rowKey };
  });
  expect(r).toEqual({ viaKey: 'email', viaRowKey: 'id' });
});
