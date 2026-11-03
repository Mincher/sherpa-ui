import { test, expect } from './harness';

/**
 * THE VIEW WAITS FOR ONE APPLY — TODO 406. A bar over a scope that waits draws
 * ONE Apply, left of its `actions` slot with a divider between. Its menus have
 * no Apply, only Discard: a pick is held, the rows stay, and the bar's Apply
 * sends it. Discard puts back that field's answer as last applied.
 * TRAP T-apply-and-discard-wait-for-a-change
 */

test('a pick waits; the bar\'s one Apply sends it; a menu\'s Discard puts back the applied answer', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource, bindSource } = await import('/dist/data.js');
    type Bar = HTMLElement & { rendered?: Promise<void>; populate(d: unknown): void; shadowRoot: ShadowRoot };
    const src = new DataSource({ store: new ArrayStore([
      { id: 1, region: 'EU' }, { id: 2, region: 'US' }, { id: 3, region: 'EU' },
    ], { key: 'id' }) });
    src.query.ask({ scope: 'view', hold: ['region'] });
    src.query.wait('view');
    await src.load();
    const bar = document.createElement('sherpa-quick-filter-toolbar') as Bar;
    bar.style.inlineSize = '1200px';
    document.getElementById('root')!.appendChild(bar);
    await bar.rendered;
    bar.populate([{ id: 'region', label: 'Region', options: [{ value: 'EU', label: 'EU' }, { value: 'US', label: 'US' }] }]);
    bindSource(src, bar, { scope: 'view', steerOnly: true });
    const toggle = document.createElement('button');
    toggle.slot = 'actions';
    toggle.textContent = 'Panel';
    bar.append(toggle);
    const settle = () => new Promise((res) => setTimeout(res, 120));
    await settle();
    const apply = bar.shadowRoot.querySelector('.apply-all') as HTMLElement;
    const divider = bar.shadowRoot.querySelector('.apply-divider') as HTMLElement;
    const menu = bar.shadowRoot.querySelector('.chip[data-id="region"] sherpa-menu') as HTMLElement & { shadowRoot: ShadowRoot };
    const x = (el: Element) => Math.round(el.getBoundingClientRect().left);
    const shown = (el: Element) => getComputedStyle(el).display !== 'none';
    const start = {
      waits: bar.hasAttribute('data-waits'), applyShown: shown(apply), off: apply.hasAttribute('disabled'),
      order: x(apply) < x(divider) && x(divider) < x(toggle),
      menuApply: shown(menu.shadowRoot.querySelector('.apply')!), menuDiscard: shown(menu.shadowRoot.querySelector('.discard')!),
    };
    const tick = async (value: string) => {
      const input = menu.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
      input.click();
      await settle();
    };
    await tick('EU');
    const picked = { rows: src.total, on: !apply.hasAttribute('disabled'), pending: menu.hasAttribute('data-pending') };
    (apply.shadowRoot!.querySelector('button') as HTMLElement).click();
    await settle();
    const applied = { rows: src.total, off: apply.hasAttribute('disabled') };
    await tick('US');
    const again = { rows: src.total, pending: menu.hasAttribute('data-pending') };
    (menu.shadowRoot.querySelector('.discard') as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot.querySelector('button')!.click();
    await settle();
    const discarded = {
      rows: src.total, pending: src.query.pending('region'),
      ticked: [...menu.querySelectorAll<HTMLInputElement>('.menu-row input')].filter((i) => i.checked && !i.closest('.qf-all')).map((i) => i.value),
    };
    return { start, picked, applied, again, discarded };
  });
  expect(r.start).toEqual({ waits: true, applyShown: true, off: true, order: true, menuApply: false, menuDiscard: true });
  expect(r.picked).toEqual({ rows: 3, on: true, pending: true });
  expect(r.applied).toEqual({ rows: 2, off: true });
  expect(r.again).toEqual({ rows: 2, pending: true });
  expect(r.discarded).toEqual({ rows: 2, pending: false, ticked: ['EU'] });
});
