import { test, expect, type Bar } from './harness';

/**
 * A DIVIDER NEEDS A NEIGHBOUR ON BOTH SIDES. Will, 2026-09-26: "There are
 * dividers in the filter toolbar. Those should hide if there isn't an element
 * either side of them." CSS only — `.bar:has()` over what the chip run shows.
 * TRAP T-a-divider-needs-a-neighbour-on-both-sides
 */
type Toolbar = Bar & { organise(d: unknown): void; populate(d: unknown): void };
const TIER = [{ id: 'tier', label: 'Tier', options: [{ value: 'a', label: 'A' }] }];

test('the View divider needs a chip after it; the action divider, an action before it', async ({ page }) => {
  const r = await page.evaluate(async (TIER) => {
    const el = await window.__mount<Toolbar>('sherpa-quick-filter-toolbar', undefined,
      { 'data-type': 'view', style: 'inline-size: 1400px' });
    const sr = el.shadowRoot!;
    const shown = (sel: string, pseudo?: string) =>
      getComputedStyle(sr.querySelector(sel)!, pseudo).display !== 'none';
    const snap = () => ({ view: shown('.view-zone', '::after'), actions: shown('.act-divider') });
    const view = document.createElement('span');
    view.slot = 'view';
    view.textContent = 'View';
    el.append(view);
    await window.__settled();
    const alone = snap();
    el.populate(TIER);
    await window.__settled();
    const withChip = snap();
    // The chip drawn by a PANEL instead: nothing after the View zone.
    sr.querySelector<HTMLElement>('.chips > .chip')!.setAttribute('data-panelled', '');
    await window.__settled();
    const panelled = snap();
    // PANEL MODE takes every action before the action divider.
    el.setAttribute('data-panel-mode', '');
    await window.__settled();
    return { alone, withChip, panelled, panelMode: snap() };
  }, TIER);

  expect(r.alone).toEqual({ view: false, actions: true });
  expect(r.withChip).toEqual({ view: true, actions: true });
  expect(r.panelled.view).toBe(false);
  expect(r.panelMode.actions).toBe(false);
});

test('the Organise divider needs a chip after it', async ({ page }) => {
  const r = await page.evaluate(async (TIER) => {
    const el = await window.__mount<Toolbar>('sherpa-quick-filter-toolbar', undefined,
      { 'data-type': 'data', style: 'inline-size: 1400px' });
    const sr = el.shadowRoot!;
    const shown = () => getComputedStyle(sr.querySelector('.organise-zone')!, '::after').display !== 'none';
    el.organise({ group: [{ field: 'plan', label: 'Plan' }] });
    await window.__settled();
    const alone = shown();
    el.populate(TIER);
    await window.__settled();
    return { alone, withChip: shown() };
  }, TIER);

  expect(r).toEqual({ alone: false, withChip: true });
});
