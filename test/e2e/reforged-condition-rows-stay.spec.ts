import { test, expect, type Page } from '@playwright/test';

/**
 * A CONDITION ROW THE READER HAS NOT ANSWERED YET STAYS. Every report goes to
 * the source, which draws the field's answer back onto every bar — answered
 * rows only. The menu rebuilt its rows from that, so a new blank row vanished:
 * at once in a chip's menu, and in the panel once its condition changed.
 * TODO 101. TRAP T-an-unanswered-row-survives-a-redraw
 *
 * Runs against the EXAMPLES server (:4200): the round trip is the app's.
 */
const APP = 'http://localhost:4200/?context=records';

async function ready(page: Page): Promise<void> {
  await page.goto(APP);
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
}

/** Switch a menu to its rows, answer row one with its first value, add a row. */
const ADVANCE = `
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rows = () => menu.shadowRoot.querySelectorAll('.condition-rows .condition-row');
  const pick = rows()[0].querySelector('.condition-pick').shadowRoot.querySelector('.control');
  pick.value = pick.options[1].value;
  pick.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(400);
  const add = menu.shadowRoot.querySelector('.add-condition');
  (add.shadowRoot.querySelector('button') ?? add).click();
  await wait(400);
`;

test('a chip menu: Add condition adds a row, and it stays', async ({ page }) => {
  await ready(page);
  const r = await page.evaluate(`(async () => {
    const chip = document.querySelector('#qft').shadowRoot.querySelector('.chip[data-id="owner"]');
    const menu = chip.querySelector('sherpa-menu');
    chip.shadowRoot.querySelector('.body').click();
    await new Promise((r) => setTimeout(r, 300));
    const sw = menu.shadowRoot.querySelector('.use-advanced');
    sw.shadowRoot.querySelector('button').click();
    await new Promise((r) => setTimeout(r, 400));
    ${ADVANCE}
    return { rows: rows().length, answered: menu.conditions.filter((c) => (c.picked ?? []).length).length };
  })()`) as { rows: number; answered: number };
  expect(r).toEqual({ rows: 2, answered: 1 });
});

test('the panel: a new row keeps its place when its condition changes', async ({ page }) => {
  await ready(page);
  const r = await page.evaluate(`(async () => {
    document.querySelector('sherpa-provider').filterMode = 'panel';
    await new Promise((r) => setTimeout(r, 800));
    const panel = document.querySelector('#filter-panel');
    const field = [...panel.shadowRoot.querySelectorAll('[data-scope="data"] .field')]
      .find((f) => (f.querySelector('.field-title')?.textContent ?? '').trim().toLowerCase() === 'owner');
    const sw = field.querySelector('.field-advanced');
    sw.shadowRoot.querySelector('button').click();
    await new Promise((r) => setTimeout(r, 600));
    const menu = field.querySelector('sherpa-menu');
    ${ADVANCE}
    const op = rows()[1].querySelector('.condition').shadowRoot.querySelector('.control');
    op.value = 'contains';
    op.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(600);
    return { rows: rows().length, second: menu.conditions[1]?.op ?? null };
  })()`) as { rows: number; second: string | null };
  expect(r).toEqual({ rows: 2, second: 'contains' });
});
