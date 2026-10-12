import { test, expect } from './harness';

/**
 * "Reset all to default" is not offered while the filters already ARE the
 * View's default, nor Reset while nothing is left to clear — the host says so
 * with `data-at-default` and `data-nothing-to-reset` (TODO 231).
 * TRAP T-reset-to-default-is-the-views-own
 */
for (const tag of ['sherpa-quick-filter-toolbar', 'sherpa-filter-panel']) {
  test(`${tag}: data-at-default makes Reset all to default inactive, before and after it draws`, async ({ page }) => {
    const r = await page.evaluate(async (name) => {
      const el = document.createElement(name);
      el.setAttribute('data-at-default', '');
      document.getElementById('root')!.replaceChildren(el);
      await (el as HTMLElement & { rendered: Promise<void> }).rendered;
      const more = el.shadowRoot!.querySelector('.reset-more')!;
      const atFirst = more.hasAttribute('disabled');
      el.removeAttribute('data-at-default');
      const changed = more.hasAttribute('disabled');
      el.setAttribute('data-at-default', '');
      return { atFirst, changed, again: more.hasAttribute('disabled') };
    }, tag);
    expect(r).toEqual({ atFirst: true, changed: false, again: true });
  });

  test(`${tag}: data-nothing-to-reset makes Reset inactive, here and in the ⋮`, async ({ page }) => {
    const r = await page.evaluate(async (name) => {
      const el = document.createElement(name);
      el.setAttribute('data-nothing-to-reset', '');
      document.getElementById('root')!.replaceChildren(el);
      await (el as HTMLElement & { rendered: Promise<void> }).rendered;
      const reset = el.shadowRoot!.querySelector('.reset-all, .act[data-act="clear"]')!;
      const off = reset.hasAttribute('disabled');
      el.removeAttribute('data-nothing-to-reset');
      return { off, on: !reset.hasAttribute('disabled') };
    }, tag);
    expect(r).toEqual({ off: true, on: true });
  });
}
