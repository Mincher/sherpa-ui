import { test, expect } from './harness';

/**
 * In the filter panel (a portrait section) an Organise chip's NAME half says its FIELD, where the bar says its
 * category: "Region", not "Group". Nothing picked, it is the category. Read from the chip's text.
 * TRAP T-an-organise-chip-names-its-field-in-the-panel
 */
test('a portrait Organise chip names its field; a landscape one keeps the category', async ({ page }) => {
  const r = await page.evaluate(async () => {
    type Bar = HTMLElement & { organise(o: unknown): void; populate(f: unknown[]): Promise<void> };
    const make = async (portrait: boolean): Promise<Bar> => {
      const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [], portrait ? { 'data-orientation': 'portrait', 'data-scope': 'data' } : {});
      el.organise({ group: [{ field: 'region', label: 'Region' }, { field: 'plan', label: 'Plan' }], sort: [{ field: 'name', label: 'Name' }] });
      await window.__settled();
      return el;
    };
    const names = (el: HTMLElement): Record<string, string> => Object.fromEntries([...el.shadowRoot!.querySelectorAll<HTMLElement>('.organise-chip')]
      .map((c) => [c.dataset['id']!, (c.shadowRoot!.querySelector('.label')!.textContent ?? '').trim()]));
    const out: Record<string, Record<string, string>> = {};
    for (const portrait of [true, false]) {
      const el = await make(portrait);
      const key = portrait ? 'portrait' : 'landscape';
      out[key + ' unset'] = names(el);
      el.setAttribute('data-group-field', 'region');
      el.setAttribute('data-sort-field', 'name');
      await window.__settled();
      out[key + ' set'] = names(el);
    }
    return out;
  });
  expect(r['portrait unset']).toEqual({ group: 'Group', sort: 'Sort' });
  expect(r['portrait set']).toEqual({ group: 'Region', sort: 'Name' });
  expect(r['landscape unset']).toEqual({ group: 'Group', sort: 'Sort' });
  expect(r['landscape set']).toEqual({ group: 'Group', sort: 'Sort' });
});
