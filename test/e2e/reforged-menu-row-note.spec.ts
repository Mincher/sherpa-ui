import { test, expect } from './harness';

/**
 * A MENU ROW CAN SAY WHERE A FILTER LIVES.
 *
 * The view's Add menu offers every field any component has, and adding one
 * that a component holds MOVES it. The row says so before the reader ticks:
 * "Status  in Customer records". The row is LIGHT DOM, so the note is a
 * `data-note` drawn by `::slotted(...)::after` — the one part of a slotted row
 * the menu's sheet can reach — and read out through `aria-description`,
 * because generated content is not reliably.
 * TRAP T-up-is-open-down-is-closed
 */
test('a row with a note draws it muted, and says it to assistive tech', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const menu = await window.__mount('sherpa-menu', undefined, { 'data-select': 'multiple' });
    (menu as unknown as { items(i: unknown[]): void }).items([
      { value: 'status', label: 'Status', note: 'in Customer records' },
      { value: 'plan', label: 'Plan' },
    ]);
    await window.__settled();
    const rows = [...menu.querySelectorAll('.menu-row:not(.qf-all)')] as HTMLElement[];
    const after = (el: HTMLElement) => getComputedStyle(el, '::after');
    return rows.map((row) => ({
      note: row.dataset['note'] ?? null,
      content: after(row).content,
      colour: after(row).color,
      size: after(row).fontSize,
      aria: row.querySelector('input')?.getAttribute('aria-description') ?? null,
    }));
  });
  expect(r[0]!.content).toBe('"in Customer records"');
  // Style's SECONDARY content, at the small body size — muted, not a label.
  expect(r[0]!.colour).toBe('rgb(53, 53, 61)');
  expect(r[0]!.size).toBe('12px');
  expect(r[0]!.aria).toBe('in Customer records');
  // A row with NO note draws nothing extra.
  expect(r[1]!.note).toBeNull();
  expect(r[1]!.content).toBe('none');
});
