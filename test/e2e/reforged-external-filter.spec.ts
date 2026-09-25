import { test, expect, type Bar } from './harness';

/**
 * AN EXTERNAL FILTER — applied somewhere else, and only SHOWN on the bar.
 *
 * A grid column's "Contains: ana" is the case. The host applies it; the bar
 * draws a chip, reports whether it is on, and says when it is removed. It was
 * called a "custom" filter, and "custom" now means a Custom Condition Filter —
 * Will, 2026-09-25: "External filter". The old door still works.
 * TRAP T-external-chips-are-reported-separately
 * TRAP T-a-renamed-attribute-keeps-its-old-name
 */
test('an external filter is added, reported, switched off, and heard by its old name', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar',
      [{ id: 'plan', label: 'Plan', options: [{ value: 'pro', label: 'Pro' }] }]);
    const heard: Array<Record<string, boolean> | undefined> = [];
    bar.addEventListener('quick-filter-change',
      (e) => heard.push((e as CustomEvent).detail.external));
    const chip = (id: string) =>
      bar.shadowRoot!.querySelector<HTMLElement & { current: boolean }>(`.chip[data-id="${id}"]`);

    bar.addExternalFilter({ id: 'col:name', label: 'Name', value: 'Contains: ana' });
    await window.__settled();
    const added = {
      marked: chip('col:name')?.hasAttribute('data-external') ?? false,
      value: chip('col:name')?.shadowRoot?.querySelector('.caret-label')?.textContent ?? null,
      read: bar.externalFilters,
    };

    // Its body is a TOGGLE: off says "stop applying this".
    chip('col:name')!.shadowRoot!.querySelector<HTMLElement>('.body')!.click();
    await window.__settled();
    const off = bar.externalFilters;

    // THE OLD NAME is still a door, and the event reports both chips.
    bar.addCustomFilter({ id: 'col:email', label: 'Email', value: 'Contains: z' });
    await window.__settled();
    const old = chip('col:email')?.hasAttribute('data-external') ?? false;
    const lastHeard = heard.at(-1) ?? null;

    // …and so is the old def key, through populate.
    bar.populate([{ id: 'col:city', label: 'City', customValue: 'Starts with: Lo' }]);
    await window.__settled();
    const oldKey = chip('col:city')?.hasAttribute('data-external') ?? false;

    return { added, off, old, oldKey, lastHeard };
  });

  expect(r.added).toEqual({ marked: true, value: 'Contains: ana', read: { 'col:name': true } });
  expect(r.off).toEqual({ 'col:name': false });
  expect(r.old).toBe(true);
  expect(r.oldKey).toBe(true);
  // The change event reports them under `external`.
  expect(r.lastHeard).toEqual({ 'col:name': false, 'col:email': true });
});
