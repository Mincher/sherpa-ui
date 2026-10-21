import { test, expect } from './harness';

/**
 * AN OPEN MENU KEEPS ITS DRAFT — 366 step 22. A bound bar is drawn again when
 * another field comes into its scope; a chip whose menu is open with a draft
 * is not painted or emptied by that draw, so the reader's ticks, waiting for
 * Apply, stay. TRAP T-a-stale-draw-keeps-the-bars-own-change
 */
test('a remote bar drawn again while a menu is open keeps that menu\'s draft', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource, bindSource, spoofRemote } = await import('/dist/index.js');
    const rows = [
      { id: 1, plan: 'Pro', status: 'active', region: 'EMEA' },
      { id: 2, plan: 'Free', status: 'trial', region: 'AMER' },
    ];
    const source = new DataSource({ store: spoofRemote(new ArrayStore(rows, { key: 'id' }), { delay: 0 }) });
    source.declareValues('plan', ['Pro', 'Free']);
    source.declareValues('status', ['active', 'trial']);
    source.declareValues('region', ['EMEA', 'AMER']);
    source.query.offer('data', ['plan', 'status', 'region']);
    await source.query.setQuery({ v: 1, scopes: { data: { holds: ['plan', 'status'], readings: {} } } });
    // As the provider draws a bar: its scope's filters.
    const scope = source.describe('data') as { filters: unknown[] };
    type Bar = HTMLElement & { drawScope(...a: unknown[]): Promise<void> };
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', scope.filters, { style: 'inline-size: 900px' });
    let draws = 0;
    const draw = bar.drawScope.bind(bar);
    bar.drawScope = (...a: unknown[]) => { draws++; return draw(...a); };
    bindSource(source, bar, { steerOnly: true, scope: 'data' });
    await source.load();
    await window.__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));

    // Plan's menu open, Pro ticked and not applied.
    const chip = bar.shadowRoot!.querySelector('.chip[data-id="plan"]') as HTMLElement & { toggleMenu(): void };
    chip.toggleMenu();
    await window.__settled();
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & { dirty: boolean };
    const pro = [...menu.querySelectorAll<HTMLInputElement>('input')].find((i) => i.value === 'Pro')!;
    pro.checked = true;
    pro.dispatchEvent(new Event('change', { bubbles: true }));
    await window.__settled();
    const before = { dirty: menu.dirty, open: chip.hasAttribute('data-open') };

    // Region comes into the scope, answered: the bar is drawn again.
    const was = draws;
    source.query.setReading('data', 'region', { picked: ['EMEA'] });
    await window.__settled();
    for (let i = 0; i < 4; i++) await new Promise((res) => requestAnimationFrame(res));
    return {
      before, drawn: draws > was,
      after: { dirty: menu.dirty, open: chip.hasAttribute('data-open'), ticked: pro.checked },
    };
  });

  expect(r.before).toEqual({ dirty: true, open: true });
  expect(r.drawn).toBe(true);
  expect(r.after).toEqual({ dirty: true, open: true, ticked: true });
});
