import { test, expect } from './harness';

/**
 * A LONG LIST in the filter panel — Will, TODO 89. Sixteen values or fewer
 * draw as a run of chips; more is ONE chip with its values in its menu. Its
 * picks are its menu's, and its Advanced switch is in that menu.
 * TRAP T-only-group-and-sort-stay-one-chip
 */

const OWNERS = Array.from({ length: 20 }, (_, i) => ({ value: `owner-${i + 1}`, label: `Owner ${i + 1}` }));

test('more than 16 values is one chip; its menu holds them, and a pick reports them', async ({ page }) => {
  const r = await page.evaluate(async (owners) => {
    const panel = await window.__mount<HTMLElement & { populate(s: unknown): Promise<void>; show(): void }>('sherpa-filter-panel');
    await panel.populate([{ scope: 'data', label: 'Records', filters: [
      { id: 'owner', label: 'Owner', select: 'multiple', advanced: true,
        options: owners.map((o, i) => ({ ...o, selected: i === 2 })) },
      { id: 'tier', label: 'Tier', select: 'multiple', advanced: true,
        options: owners.slice(0, 16).map((o) => ({ ...o, value: `tier-${o.value}` })) },
    ] }]);
    panel.show();
    await window.__settled();
    const sr = panel.shadowRoot!;
    const field = (id: string) => sr.querySelector<HTMLElement>(`.field[data-field="${id}"]`)!;
    const chip = field('owner').querySelector<HTMLElement>('.value')!;
    const menu = chip.querySelector<HTMLElement & { values: string[] }>('sherpa-menu')!;
    const drawn = {
      ownerChips: field('owner').querySelectorAll('.value').length,
      tierChips: field('tier').querySelectorAll('.value').length,
      rows: menu.querySelectorAll('.menu-row:not(.qf-all)').length,
      picked: menu.values,
      on: chip.hasAttribute('data-current'),
      // The switch is the menu's; the header has none. A run keeps its own.
      ownerSwitch: !!field('owner').querySelector('.field-advanced'),
      tierSwitch: !!field('tier').querySelector('.field-advanced'),
      menuSwitch: menu.hasAttribute('data-advanced'),
    };
    const heard: unknown[] = [];
    panel.addEventListener('quick-filter-change', (e) => heard.push((e as CustomEvent).detail.readings.data.owner.picked));
    menu.values = ['owner-3', 'owner-7'];
    menu.dispatchEvent(new CustomEvent('menu-change', { bubbles: true, composed: true, detail: { values: menu.values } }));
    await window.__settled();
    return { drawn, heard };
  }, OWNERS);
  expect(r.drawn).toEqual({
    ownerChips: 1, tierChips: 16, rows: 20, picked: ['owner-3'], on: true,
    ownerSwitch: false, tierSwitch: true, menuSwitch: true,
  });
  expect(r.heard.at(-1)).toEqual(['owner-3', 'owner-7']);
});
