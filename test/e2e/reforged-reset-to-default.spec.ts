import { test, expect, type Bar } from './harness';

/**
 * RESET, AND RESET ALL TO DEFAULT — TODO 109, 129, 383 and 454. Both lead the
 * ⋮ menu (it moved there 11-06), Reset filters first; "Reset to view defaults" asks for the
 * View's OWN filters, which only the provider knows. The ask is CANCELABLE, so
 * an app can ask the reader first — and keep what is on screen under a name.
 * TRAP T-reset-to-default-is-the-views-own
 */
test('the bar\'s and the column\'s ⋮ menus lead with Reset, and Reset to view defaults asks for the View\'s own filters', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const heard: string[] = [];
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [], { 'data-type': 'view' });
    const column = await window.__mount<HTMLElement & { drawScopes(s: unknown): void }>('sherpa-quick-filter-toolbar', undefined,
      { 'data-orientation': 'portrait', 'data-column': true, open: true, keep: true });
    column.drawScopes([]);
    await window.__settled();
    for (const [name, el] of [['bar', bar], ['column', column]] as const) {
      el.addEventListener('view-reset', (e) => heard.push(`${name}${e.cancelable ? ', cancelable' : ''}`));
    }
    // Each is its ⋮ menu's rows. Will, TODO 454, 11-06
    const pick = async (host: HTMLElement): Promise<{ lead: string[][]; old: number; open: boolean }> => {
      await window.__moreRow(host, 'reset');
      const menu = host.shadowRoot!.querySelector('.more-menu') as HTMLElement & { open: boolean };
      const lead = [...menu.children].slice(0, 2)
        .map((n) => [(n as HTMLButtonElement).value, (n.textContent ?? '').trim()]);
      menu.querySelector<HTMLElement>(':scope > [value="reset-default"]')!.click();
      await window.__settled();
      // The old Reset button and its ▾ are gone, not hidden.
      const old = host.shadowRoot!.querySelectorAll('.reset-group, .reset-all, .reset-more, [data-act="clear"]').length;
      return { lead, old, open: menu.open };
    };
    const onBar = await pick(bar);
    const onColumn = await pick(column);
    return { heard, onBar, onColumn };
  });
  const lead = [['reset', 'Reset filters'], ['reset-default', 'Reset to view defaults']];
  // A row picked shuts the menu.
  expect(r.onBar).toEqual({ lead, old: 0, open: false });
  expect(r.onColumn).toEqual({ lead, old: 0, open: false });
  // A host that asks the reader first can take it over.
  expect(r.heard).toEqual(['bar, cancelable', 'column, cancelable']);
});
