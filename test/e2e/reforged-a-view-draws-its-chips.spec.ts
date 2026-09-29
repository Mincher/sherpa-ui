import { test, expect } from '@playwright/test';

/**
 * A VIEW DRAWS ITS CHIPS AS THEY FILTER — TODO 82, on the Records page.
 *
 * The At risk View gives the bar "Tickets > 2" and "Status is not churned".
 * The number chip filtered and showed nothing on its face: its menu is not a
 * `filter` menu, so the chip never asked it for its reading. And the old
 * "is not churned" reading ticked "churned" as Simple's answer too — the
 * opposite of the View. Runs against the EXAMPLES server (:4200).
 * TRAP T-both-answers-are-kept
 */
test('the At risk View shows its number on the chip, and does not tick what it excludes', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records&view=risk');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await expect.poll(() => page.evaluate(() => {
    const bar = document.querySelector('#qft') as HTMLElement & { shadowRoot: ShadowRoot };
    return (bar.shadowRoot.querySelector('.chip[data-id="openTickets"]') as HTMLElement & { valueLabel?: string } | null)
      ?.valueLabel ?? null;
  })).toBe('2');
  const status = await page.evaluate(() => {
    const bar = document.querySelector('#qft') as HTMLElement & { shadowRoot: ShadowRoot };
    const menu = bar.shadowRoot.querySelector('.chip[data-id="status"] sherpa-menu') as HTMLElement & {
      reading: { picked?: string[]; conditions?: unknown[]; mode?: string };
    };
    const { picked, conditions, mode } = menu.reading;
    return { picked, rows: (conditions ?? []).length, mode };
  });
  expect(status).toEqual({ picked: [], rows: 1, mode: 'advanced' });
});
