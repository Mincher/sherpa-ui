import { test, expect } from './harness';

/**
 * THE PROVIDER AND THE FILTER PANEL (new) — sherpa-ui 847 P2. The provider's panel mode opens and shuts the overlay
 * panel a filter panel sits in; its mode button goes in that panel's header AFTER the panel's own buttons; a close,
 * by the reader or by width, is the panel's `panel-close` and the mode follows it.
 * TRAP T-the-provider-owns-the-panel-mode
 */
const SETUP = `
  const { ArrayStore } = await import('/dist/index.js');
  const root = document.getElementById('root');
  const provider = document.createElement('sherpa-provider');
  provider.innerHTML = '<sherpa-overlay-panel id="p" data-heading="Filters" data-floatable data-dismissible>'
    + '<sherpa-filter-panel id="fp" data-scope="view data"></sherpa-filter-panel></sherpa-overlay-panel>'
    + '<sherpa-quick-filter-toolbar id="bar" data-scope="data"></sherpa-quick-filter-toolbar>';
  root.replaceChildren(provider);
  const panel = provider.querySelector('#p');
  const content = provider.querySelector('#fp');
  const bar = provider.querySelector('#bar');
  const rows = [{ id: 1, plan: 'Pro', tier: 'gold' }, { id: 2, plan: 'Free', tier: 'gold' }];
  const PAGE = { v: 1, id: 'plans', source: { store: 'plans', fields: { plan: { label: 'Plan' }, tier: { label: 'Tier', start: 'all' } },
    scopes: { view: { label: 'View', holds: ['tier'] }, data: { label: 'Rows', holds: ['plan'] } } } };
  const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
  await provider.open(PAGE, { stores: { plans: new ArrayStore(rows, { key: 'id' }) }, views: {} });
  await settle();
`;

test('panel mode opens the panel the content sits in and steps the bar back; shut, the bar returns, and the reader\'s close is kept', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const state = () => ({ open: panel.hasAttribute('open'), barBack: bar.hasAttribute('data-panel-mode') });
    const start = state();
    provider.settings.set('filterMode', 'panel');
    await settle();
    const opened = state();
    panel.hide();
    await settle();
    return { start, opened, closed: state(), mode: provider.settings.get('filterMode') };
  })()`) as Record<string, any>;
  expect(r['start']).toEqual({ open: false, barBack: false });
  expect(r['opened']).toEqual({ open: true, barBack: true });
  expect(r['closed']).toEqual({ open: false, barBack: false });
  expect(r['mode']).toBe('toolbars');
});

test('a close for width is not a choice: the mode stays, and the panel comes back with room', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.settings.set('filterMode', 'panel');
    await settle();
    content.hide('width');
    await settle();
    return { open: panel.hasAttribute('open'), mode: provider.settings.get('filterMode') };
  })()`) as Record<string, any>;
  expect(r).toEqual({ open: false, mode: 'panel' });
});

test('the mode button sits in the panel header, after the panel\'s own buttons, and not in the content', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.settings.set('filterMode', 'panel');
    await settle();
    const btn = panel.querySelector(':scope > [data-filter-mode]');
    const float = panel.shadowRoot.querySelector('.float').getBoundingClientRect().left;
    return { slot: btn?.slot ?? null, inContent: !!content.querySelector('[data-filter-mode]'), after: btn ? btn.getBoundingClientRect().left > float : false };
  })()`) as Record<string, any>;
  expect(r).toEqual({ slot: 'actions-end', inContent: false, after: true });
});
