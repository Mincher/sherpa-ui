import { test, expect } from './harness';

/**
 * "Reset all on view" is not offered while the filters already ARE the
 * View's default, nor Reset while nothing is left to clear — the host says so
 * with `data-at-default` and `data-nothing-to-reset` (TODO 231). Both are rows
 * leading the Filters menu (TODO 383).
 * TRAP T-reset-to-default-is-the-views-own
 */
for (const tag of ['sherpa-quick-filter-toolbar', 'sherpa-filter-panel']) {
  test(`${tag}: data-at-default makes Reset all on view inactive, before and after it draws`, async ({ page }) => {
    const r = await page.evaluate(async (name) => {
      const el = document.createElement(name);
      el.setAttribute('data-at-default', '');
      // The panel draws its Filters menu while it is open.
      if (name === 'sherpa-filter-panel') el.setAttribute('open', '');
      document.getElementById('root')!.replaceChildren(el);
      await (el as HTMLElement & { rendered: Promise<void> }).rendered;
      await (el as HTMLElement & { populate(d: unknown): unknown }).populate([]);
      await window.__settled();
      // Filter actions are the Filters menu's rows. TODO 383
      const row = (): Element => el.shadowRoot!.querySelector('.add-btn sherpa-menu, .filters-btn sherpa-menu')!
        .querySelector(':scope > .filter-action[value="reset-default"]')!;
      const atFirst = row().hasAttribute('disabled');
      el.removeAttribute('data-at-default');
      const changed = row().hasAttribute('disabled');
      el.setAttribute('data-at-default', '');
      return { atFirst, changed, again: row().hasAttribute('disabled') };
    }, tag);
    expect(r).toEqual({ atFirst: true, changed: false, again: true });
  });

  test(`${tag}: data-nothing-to-reset makes Reset filters inactive in the Filters menu`, async ({ page }) => {
    const r = await page.evaluate(async (name) => {
      const el = document.createElement(name);
      el.setAttribute('data-nothing-to-reset', '');
      if (name === 'sherpa-filter-panel') el.setAttribute('open', '');
      document.getElementById('root')!.replaceChildren(el);
      await (el as HTMLElement & { rendered: Promise<void> }).rendered;
      await (el as HTMLElement & { populate(d: unknown): unknown }).populate([]);
      await window.__settled();
      // Filter actions are the Filters menu's rows. TODO 383
      const reset = (): Element => el.shadowRoot!.querySelector('.add-btn sherpa-menu, .filters-btn sherpa-menu')!
        .querySelector(':scope > .filter-action[value="reset"]')!;
      const off = reset().hasAttribute('disabled');
      el.removeAttribute('data-nothing-to-reset');
      return { off, on: !reset().hasAttribute('disabled') };
    }, tag);
    expect(r).toEqual({ off: true, on: true });
  });
}
