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

/** `populate()` as a PROPERTY, `data` — what React 19, Vue and Svelte can bind
 *  (TODO 211). Set before the element upgrades, it is kept and drawn. */
test('data is populate() as a property, before and after the element upgrades', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const crumbs = [{ label: 'Home' }, { label: 'Records' }];
    type El = HTMLElement & { data: unknown; rendered: Promise<void> };
    const live = document.createElement('sherpa-breadcrumbs') as El;
    document.getElementById('root')!.replaceChildren(live);
    live.data = crumbs;
    // Not yet upgraded: a template's content belongs to an inert document.
    const tpl = document.createElement('template');
    tpl.innerHTML = '<sherpa-breadcrumbs></sherpa-breadcrumbs>';
    const early = tpl.content.firstElementChild as El;
    early.data = crumbs;
    document.getElementById('root')!.append(early);
    await window.__settled();
    const count = (el: El) => el.shadowRoot!.querySelectorAll('[part~="crumb"], .crumb, li, a').length;
    return { live: count(live) > 0, early: count(early) > 0, same: live.data === crumbs && early.data === crumbs };
  });
  expect(r).toEqual({ live: true, early: true, same: true });
});
