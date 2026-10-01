import { test, expect, type Bar } from './harness';
import type { Page } from '@playwright/test';

/**
 * RESET, AND RESET ALL TO DEFAULT — TODO 109 and 129. Reset has its label, and
 * a ▾ beside it, in one group; its menu's "Reset all to default" asks for the
 * View's OWN filters, which only the provider knows. The ask is CANCELABLE, so
 * an app can ask the reader first — and keep what is on screen under a name.
 * TRAP T-reset-to-default-is-the-views-own
 */
// Folded away, the ⋮ lists both: "the ⋮ menu lists every folded action".
test('the bar and the panel: Reset is labelled, and its menu asks for the View\'s own filters', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const heard: string[] = [];
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'view' });
    const panel = await window.__mount<HTMLElement>('sherpa-filter-panel', undefined, {});
    await window.__settled();
    for (const el of [bar, panel]) {
      el.addEventListener('view-reset', (e) => heard.push(`${el.localName}${e.cancelable ? ', cancelable' : ''}`));
    }
    const pick = async (host: HTMLElement): Promise<{ label: string; row: string; grouped: boolean }> => {
      const more = host.shadowRoot!.querySelector<HTMLElement>('.reset-more')!;
      more.shadowRoot!.querySelector<HTMLElement>('button')!.click();
      await window.__settled();
      const row = more.querySelector<HTMLElement>('button[value="reset-default"]')!;
      row.click();
      await window.__settled();
      const reset = more.previousElementSibling as HTMLElement;
      return { label: reset.textContent!.trim(), row: row.textContent!.trim(),
        grouped: more.parentElement!.classList.contains('sherpa-group') };
    };
    const onBar = await pick(bar);
    const onPanel = await pick(panel);
    return { heard, onBar, onPanel };
  });
  expect(r.onBar).toEqual({ label: 'Reset', row: 'Reset all to default', grouped: true });
  expect(r.onPanel).toEqual({ label: 'Reset', row: 'Reset all to default', grouped: true });
  // A host that asks the reader first can take it over.
  expect(r.heard).toEqual(['sherpa-quick-filter-toolbar, cancelable', 'sherpa-filter-panel, cancelable']);
});