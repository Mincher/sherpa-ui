import { test, expect, type Bar } from './harness';

/**
 * RESET, AND RESET TO DEFAULT — TODO 109. Reset has its label, and a ▾ beside
 * it, in one group; its menu's "Reset to default" asks for the View's OWN
 * filters, which only the provider knows. Will, 2026-09-29.
 * TRAP T-reset-to-default-is-the-views-own
 */
// Folded away, the ⋮ lists both: "the ⋮ menu lists every folded action".
test('the bar and the panel: Reset is labelled, and its menu asks for the View\'s own filters', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const heard: string[] = [];
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'view' });
    const panel = await window.__mount<HTMLElement>('sherpa-filter-panel', undefined, {});
    await window.__settled();
    for (const el of [bar, panel]) el.addEventListener('view-reset', () => heard.push(el.localName));
    const pick = async (host: HTMLElement): Promise<{ label: string; grouped: boolean }> => {
      const more = host.shadowRoot!.querySelector<HTMLElement>('.reset-more')!;
      more.shadowRoot!.querySelector<HTMLElement>('button')!.click();
      await window.__settled();
      more.querySelector<HTMLElement>('button[value="reset-default"]')!.click();
      await window.__settled();
      const reset = more.previousElementSibling as HTMLElement;
      return { label: reset.textContent!.trim(), grouped: more.parentElement!.classList.contains('sherpa-group') };
    };
    const onBar = await pick(bar);
    const onPanel = await pick(panel);
    return { heard, onBar, onPanel };
  });
  expect(r.onBar).toEqual({ label: 'Reset', grouped: true });
  expect(r.onPanel).toEqual({ label: 'Reset', grouped: true });
  expect(r.heard).toEqual(['sherpa-quick-filter-toolbar', 'sherpa-filter-panel']);
});

/**
 * ON THE RECORDS PAGE: the At risk View, then a Reset and a filter added; Reset
 * to default puts back At risk's own filters — and takes the added one off.
 * Runs against the EXAMPLES server (:4200): the provider is the app's.
 */
test('Reset to default puts back the View\'s own filters, and takes off what the reader added', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records&view=risk');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  const r = await page.evaluate(async () => {
    type Source = {
      query: { applied: unknown }; debugState(): { total: number };
      scope(s: string): string[]; hold(s: string, f: string[]): void;
    };
    const source = (window as unknown as { sherpa: { source: Source } }).sherpa.source;
    const wait = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
    const snap = () => ({ total: source.debugState().total, query: JSON.stringify(source.query.applied) });
    await wait(600);
    const risk = snap();
    const bar = document.querySelector('#qft') as HTMLElement;
    bar.shadowRoot!.querySelector<HTMLElement>('.act[data-act="clear"]')!.shadowRoot!.querySelector<HTMLElement>('button')!.click();
    await wait(600);
    source.hold('data', [...source.scope('data'), 'seats']);
    await wait(300);
    const changed = { ...snap(), holdsSeats: source.scope('data').includes('seats') };
    const more = bar.shadowRoot!.querySelector<HTMLElement>('.reset-more')!;
    more.shadowRoot!.querySelector<HTMLElement>('button')!.click();
    await wait(300);
    more.querySelector<HTMLElement>('button[value="reset-default"]')!.click();
    await wait(900);
    return { risk, changed, back: { ...snap(), holdsSeats: source.scope('data').includes('seats') } };
  });
  expect(r.changed.total).toBeGreaterThan(r.risk.total);
  expect(r.changed.holdsSeats).toBe(true);
  expect(r.back).toEqual({ ...r.risk, holdsSeats: false });
});
