import { test, expect } from './harness';

/**
 * A DATE PICKS DAYS — Will, 2026-10-22: a calendar menu is a range only when
 * its field's definition says `range: true`; in the View scope too.
 * TRAP T-a-date-picks-days-unless-it-says-range
 */
test('a date menu picks days; a field that says range picks two ends', async ({ page }) => {
  const types = await page.evaluate(async () => {
    const { ArrayStore, openSource, bindSource } = await import('/dist/index.js') as unknown as {
      ArrayStore: new (r: unknown[], o: object) => unknown;
      openSource(d: object, s: unknown): Promise<{ describe(s: string): { filters: unknown[] }; load(): Promise<void> }>;
      bindSource(s: unknown, el: Element, o: object): void;
    };
    const src = await openSource({
      store: 'rows',
      fields: { made: { label: 'Made', type: 'date' }, due: { label: 'Due', type: 'date', range: true } },
      scopes: { view: { label: 'View', holds: ['made', 'due'] } },
    }, new ArrayStore([{ id: 1, made: '2026-01-05', due: '2026-02-01' }], { key: 'id' }));
    const bar = await window.__mount('sherpa-quick-filter-toolbar', src.describe('view').filters, { style: 'inline-size: 900px' });
    bindSource(src, bar, { steerOnly: true, scope: 'view' });
    await src.load();
    await window.__settled();
    const calendarOf = async (id: string) => {
      const chip = bar.shadowRoot!.querySelector<HTMLElement>(`.chip[data-id="${id}"]`)!;
      const menu = chip.querySelector('sherpa-menu') as HTMLElement & { show(t: Element): void; hide(): void };
      menu.show(chip);
      await window.__settled();
      const type = menu.querySelector('sherpa-calendar')?.getAttribute('data-type') ?? 'single';
      menu.hide();
      return type;
    };
    return { made: await calendarOf('made'), due: await calendarOf('due') };
  });
  expect(types).toEqual({ made: 'single', due: 'range' });
});
