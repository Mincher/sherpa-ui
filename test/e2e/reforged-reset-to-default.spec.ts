import { test, expect, type Bar } from './harness';

/**
 * RESET, AND RESET ALL TO DEFAULT — TODO 109, 129 and 383. Both lead the ONE
 * Filters menu, Reset filters first; "Reset all on view" asks for the
 * View's OWN filters, which only the provider knows. The ask is CANCELABLE, so
 * an app can ask the reader first — and keep what is on screen under a name.
 * TRAP T-reset-to-default-is-the-views-own
 */
test('the bar and the panel: the Filters menu leads with Reset, and Reset all on view asks for the View\'s own filters', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const heard: string[] = [];
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [], { 'data-type': 'view' });
    const panel = await window.__mount<HTMLElement>('sherpa-filter-panel', [], { open: true, keep: true });
    await window.__settled();
    for (const el of [bar, panel]) {
      el.addEventListener('view-reset', (e) => heard.push(`${el.localName}${e.cancelable ? ', cancelable' : ''}`));
    }
    // Filter actions are the Filters menu's rows. TODO 383
    const pick = async (host: HTMLElement): Promise<{ lead: string[][]; old: number; open: boolean }> => {
      const btn = host.shadowRoot!.querySelector<HTMLElement>('.add-btn, .filters-btn')!;
      btn.shadowRoot!.querySelector<HTMLElement>('button')!.click();
      await window.__settled();
      const menu = btn.querySelector('sherpa-menu') as HTMLElement & { open: boolean };
      const lead = [...menu.children].slice(0, 2)
        .map((n) => [(n as HTMLButtonElement).value, (n.textContent ?? '').trim()]);
      menu.querySelector<HTMLElement>(':scope > .filter-action[value="reset-default"]')!.click();
      await window.__settled();
      // The old Reset button and its ▾ are gone, not hidden.
      const old = host.shadowRoot!.querySelectorAll('.reset-group, .reset-all, .reset-more, [data-act="clear"]').length;
      return { lead, old, open: menu.open };
    };
    const onBar = await pick(bar);
    const onPanel = await pick(panel);
    return { heard, onBar, onPanel };
  });
  const lead = [['reset', 'Reset filters'], ['reset-default', 'Reset all on view']];
  // A row picked shuts the menu.
  expect(r.onBar).toEqual({ lead, old: 0, open: false });
  expect(r.onPanel).toEqual({ lead, old: 0, open: false });
  // A host that asks the reader first can take it over.
  expect(r.heard).toEqual(['sherpa-quick-filter-toolbar, cancelable', 'sherpa-filter-panel, cancelable']);
});
