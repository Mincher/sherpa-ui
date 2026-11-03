import { test, expect } from './harness';

/**
 * SOLO A FILTER — Will, TODO 690. Where the app allows it, a chip's menu offers
 * "Solo this filter": every other filter in its scope goes off, its value kept, and
 * the chip shows its Solo state; its body, or "Remove soloing", ends it, and only
 * what it switched off comes back. Across every scope, the View's go off too.
 * TRAP T-a-solo-is-a-draft-of-one-tab
 */
const PAGE = `{
  v: 1, id: 'plans',
  source: {
    store: 'plans', fields: { plan: { label: 'Plan', advanced: true }, owner: { label: 'Owner' }, tier: { label: 'Tier' } },
    scopes: { view: { label: 'View', holds: ['tier'] }, data: { label: 'Rows', holds: ['plan', 'owner'] } },
  },
}`;
const SETUP = `
  const { ArrayStore } = await import('/dist/index.js');
  const root = document.getElementById('root');
  const provider = document.createElement('sherpa-provider');
  provider.innerHTML = '<sherpa-quick-filter-toolbar data-scope="data"></sherpa-quick-filter-toolbar>';
  root.replaceChildren(provider);
  const bar = provider.querySelector('sherpa-quick-filter-toolbar');
  const rows = [
    { id: 1, plan: 'Pro', owner: 'Ada', tier: 'gold' }, { id: 2, plan: 'Pro', owner: 'Bo', tier: 'gold' },
    { id: 3, plan: 'Free', owner: 'Ada', tier: 'silver' },
  ];
  const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
  const source = await provider.open(${PAGE}, { stores: { plans: new ArrayStore(rows, { key: 'id' }) }, views: {} });
  source.query.ask({ scope: 'view', field: 'tier', reading: { picked: ['gold'] } });
  source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
  source.query.ask({ scope: 'data', field: 'owner', reading: { picked: ['Ada'] } });
  source.query.ask({ commit: true });
  await source.load();
  await settle();
  const chip = (id) => bar.shadowRoot.querySelector('.chips > .chip[data-id="' + id + '"]');
  const shown = (el) => !!el && getComputedStyle(el).display !== 'none';
  const row = (id, value) => chip(id).querySelector(':scope > sherpa-menu > [value="' + value + '"]');
  const pick = async (id, value) => { row(id, value).click(); await settle(); };
  const state = () => ({
    owner: chip('owner').hasAttribute('data-current'), plan: chip('plan').hasAttribute('data-current'),
    solo: chip('plan').hasAttribute('data-solo'), mark: shown(chip('plan').shadowRoot.querySelector('.solo-mark')),
    tierOff: !!source.query.reading('view', 'tier')?.suspended, ids: source.rows.map((r) => r.id),
  });
`;

test('Solo this filter: the others in its scope go off, kept; its body brings back only those', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const off = { solo: shown(row('plan', 'solo')), unsolo: shown(row('plan', 'unsolo')) };
    provider.allowSolo = true;
    await settle();
    const on = { solo: shown(row('plan', 'solo')), unsolo: shown(row('plan', 'unsolo')) };
    const before = state();
    await pick('plan', 'solo');
    const soloed = state();
    const menu = { solo: shown(row('plan', 'solo')), unsolo: shown(row('plan', 'unsolo')) };
    const kept = source.query.reading('data', 'owner')?.picked;
    chip('plan').shadowRoot.querySelector('.body').click();
    await settle();
    return { off, on, before, soloed, menu, kept, after: state() };
  })()`) as Record<string, unknown>;
  expect(r['off']).toEqual({ solo: false, unsolo: false });
  expect(r['on']).toEqual({ solo: true, unsolo: false });
  expect(r['before']).toEqual({ owner: true, plan: true, solo: false, mark: false, tierOff: false, ids: [1] });
  expect(r['soloed']).toEqual({ owner: false, plan: true, solo: true, mark: true, tierOff: false, ids: [1, 2] });
  expect(r['menu']).toEqual({ solo: false, unsolo: true });
  expect(r['kept']).toEqual(['Ada']);
  expect(r['after']).toEqual({ owner: true, plan: true, solo: false, mark: false, tierOff: false, ids: [1] });
});

test('across every scope, a solo switches the View\'s filters off too, and Remove soloing brings them back', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.allowSolo = true;
    provider.soloAcrossScopes = true;
    await settle();
    await pick('owner', 'solo');
    const soloed = state();
    await pick('owner', 'unsolo');
    return { soloed, after: state() };
  })()`) as Record<string, unknown>;
  expect(r['soloed']).toMatchObject({ plan: false, tierOff: true, ids: [1, 3] });
  expect(r['after']).toMatchObject({ plan: true, tierOff: false, ids: [1] });
});

test('in the panel, a section\'s ⋮ offers Solo, and its chip shows the Solo state', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.allowSolo = true;
    const column = document.createElement('sherpa-quick-filter-toolbar');
    column.setAttribute('data-orientation', 'portrait');
    column.setAttribute('data-scope', 'view data');
    column.setAttribute('open', '');
    provider.append(column);
    await settle();
    await new Promise((r) => setTimeout(r, 300));
    await settle();
    const section = column.shadowRoot.querySelector('.sections > * > [data-scope="data"]');
    const field = (id) => section.shadowRoot.querySelector('.chips > .chip[data-id="' + id + '"]');
    const more = (id, value) => field(id).querySelector(':scope > .field-more sherpa-menu > [value="' + value + '"]');
    const offered = { solo: shown(more('owner', 'solo')), unsolo: shown(more('owner', 'unsolo')) };
    more('owner', 'solo').click();
    await settle();
    await settle();
    return { offered, solo: field('owner').hasAttribute('data-solo'), plan: !!source.query.reading('data', 'plan')?.suspended,
      after: { solo: shown(more('owner', 'solo')), unsolo: shown(more('owner', 'unsolo')) } };
  })()`) as Record<string, unknown>;
  expect(r).toEqual({ offered: { solo: true, unsolo: false }, solo: true, plan: true, after: { solo: false, unsolo: true } });
});

test('with soloing allowed, a FOLDED advanced-only filter still opens its own menu: its Solo rows are not its answer', async ({ page }) => {
  const r = await page.evaluate(async () => {
    type Bar = HTMLElement & { populate(d: unknown): void };
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'style': 'max-inline-size: 260px', 'data-allow-solo': '' });
    el.populate([
      { id: 'status', label: 'Status', select: 'multiple', options: [{ value: 'a', label: 'a' }, { value: 'b', label: 'b' }] },
      { id: 'email', label: 'Email', advanced: 'only', op: 'contains' },
    ]);
    await window.__settled();
    for (let i = 0; i < 20 && !el.getAttribute('data-folded'); i++) await new Promise((res) => setTimeout(res, 80));
    const sr = el.shadowRoot!;
    const overflow = sr.querySelector<HTMLElement>('.add-btn')!;
    const menu = sr.querySelector('.chip[data-id="email"] sherpa-menu') as HTMLElement;
    const solo = !!menu.querySelector(':scope > [value="solo"]');
    (overflow.querySelector('sherpa-menu') as HTMLElement & { show(t: HTMLElement): void }).show(overflow);
    await window.__settled();
    overflow.querySelector<HTMLElement>('.menu-row[data-drill][data-value="email"] .menu-row-drill')!.click();
    await window.__settled();
    for (let f = 0; f < 60 && !menu.hasAttribute('open'); f++) await new Promise((res) => requestAnimationFrame(res));
    return { solo, opened: menu.hasAttribute('open'), lists: overflow.querySelector('sherpa-menu')!.querySelectorAll('.menu-row[data-drill]').length > 0 };
  });
  expect(r).toEqual({ solo: true, opened: true, lists: true });
});

test('in the menu header: Solo is an icon toggle before Advanced, pressed while soloed, and its menu stays open', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.allowSolo = true;
    provider.soloInHeader = true;
    await settle();
    const menu = chip('plan').querySelector(':scope > sherpa-menu');
    menu.show(chip('plan'));
    await settle();
    const toggle = menu.shadowRoot.querySelector('.solo-toggle');
    const advanced = menu.shadowRoot.querySelector('.use-condition');
    const at = { rows: !!row('plan', 'solo'), shown: shown(toggle),
      advanced: shown(advanced), before: toggle.getBoundingClientRect().right <= advanced.getBoundingClientRect().left + 0.5 };
    toggle.shadowRoot.querySelector('button').click();
    await settle();
    at.soloed = state();
    at.pressed = toggle.getAttribute('aria-pressed');
    at.open = menu.hasAttribute('open');
    toggle.shadowRoot.querySelector('button').click();
    await settle();
    at.after = state();
    at.unpressed = toggle.getAttribute('aria-pressed');
    return at;
  })()`) as Record<string, unknown>;
  expect(r).toMatchObject({ rows: false, shown: true, advanced: true, before: true, pressed: 'true', open: true, unpressed: 'false' });
  expect(r['soloed']).toMatchObject({ owner: false, solo: true });
  expect(r['after']).toMatchObject({ owner: true, solo: false });
});
