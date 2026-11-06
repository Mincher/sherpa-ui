import { test, expect } from './harness';

/**
 * "Reset to view defaults" is not offered while the filters already ARE the
 * View's default, nor Reset while nothing is left to clear — the host says so
 * with `data-at-default` and `data-nothing-to-reset` (TODO 231). Both are rows
 * leading the Edit menu (TODOs 383, 454), on the bar and on its column.
 * TRAP T-reset-to-default-is-the-views-own
 */
const mount = (kind: string, attr: string): string => `
  const el = document.createElement('sherpa-quick-filter-toolbar');
  el.setAttribute('${attr}', '');
  // "Reset to view defaults" is the View's bar's, or a column's. TODO 524
  if ('${kind}' === 'bar') el.setAttribute('data-type', 'view');
  if ('${kind}' === 'column') {
    el.setAttribute('data-orientation', 'portrait');
    el.setAttribute('data-column', '');
    el.setAttribute('open', '');
  }
  document.getElementById('root').replaceChildren(el);
  await el.rendered;
  if ('${kind}' === 'column') el.drawScopes([]);
  else await el.populate([]);
  await window.__settled();
`;

for (const kind of ['bar', 'column']) {
  test(`${kind}: data-at-default makes Reset to view defaults inactive, before and after it draws`, async ({ page }) => {
    const r = await page.evaluate(`(async () => {
      ${mount(kind, 'data-at-default')}
      const row = () => window.__moreRow(el, 'reset-default');
      const atFirst = (await row()).hasAttribute('disabled');
      el.removeAttribute('data-at-default');
      const changed = (await row()).hasAttribute('disabled');
      el.setAttribute('data-at-default', '');
      return { atFirst, changed, again: (await row()).hasAttribute('disabled') };
    })()`);
    expect(r).toEqual({ atFirst: true, changed: false, again: true });
  });

  test(`${kind}: data-nothing-to-reset makes Reset filters inactive`, async ({ page }) => {
    const r = await page.evaluate(`(async () => {
      ${mount(kind, 'data-nothing-to-reset')}
      const reset = () => window.__moreRow(el, 'reset');
      const off = (await reset()).hasAttribute('disabled');
      el.removeAttribute('data-nothing-to-reset');
      return { off, on: !(await reset()).hasAttribute('disabled') };
    })()`);
    expect(r).toEqual({ off: true, on: true });
  });

  // Nor is a Save: the filters ARE the View's own. Will, TODO 382
  test(`${kind}: data-at-default makes Save filters inactive`, async ({ page }) => {
    const r = await page.evaluate(`(async () => {
      ${mount(kind, 'data-at-default')}
      el.toggleAttribute('data-saveable', true);
      await window.__settled();
      const row = async () => (await window.__savedRow(el, 'filters-save')).hasAttribute('disabled');
      const off = await row();
      el.removeAttribute('data-at-default');
      await window.__settled();
      return { off, on: !(await row()) };
    })()`);
    expect(r).toEqual({ off: true, on: true });
  });
}
