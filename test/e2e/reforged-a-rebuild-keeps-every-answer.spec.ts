import { test, expect, type Bar } from './harness';

/**
 * A REBUILD KEEPS EVERY ANSWER — not only the ticks.
 *
 * The bar rebuilds its whole chip run when a filter is added or taken away,
 * and it carried each chip's on/off and ticks across. Not its op, its typing
 * or its condition ROWS: adding "Plan" wiped "Owner contains Da or is Ravi" on
 * the chip beside it. And the bar read straight after the rebuild — before
 * any menu had drawn — said the rows were gone. An Add sends `filter-add`
 * alone now (366 step 21); the bar it reads keeps them.
 * TRAP T-a-rebuild-keeps-every-answer
 */
test('adding a filter keeps another chip\'s Advanced rows, and says so at once', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const opts = [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }];
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', select: 'multiple', advanced: true, active: true, options: opts },
    ], { style: 'inline-size: 1200px' });
    bar.available([{ id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }] }]);
    await window.__settled();
    const rows = [{ op: 'contains', text: 'Da' }, { join: 'or', op: 'eq', picked: ['Ravi'] }];
    bar.setChipReading('owner', { conditions: rows });
    await window.__settled();

    // What the bar reads when it says the Add.
    const heard: unknown[] = [];
    bar.addEventListener('filter-add', () => heard.push(bar.readings.owner?.conditions));
    bar.addFilters(['plan']);
    const atOnce = bar.readings.owner?.conditions;
    await window.__settled();
    await new Promise((res) => setTimeout(res, 150));
    const chip = bar.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="owner"]')!;
    return {
      atOnce, heard, after: bar.readings.owner?.conditions,
      condition: chip.getAttribute('data-condition'), on: chip.hasAttribute('data-current'),
    };
  });

  const rows = [{ op: 'contains', text: 'Da' }, { op: 'eq', join: 'or', picked: ['Ravi'] }];
  expect(r.atOnce).toEqual(rows);
  expect(r.heard).toEqual([rows]);
  expect(r.after).toEqual(rows);
  expect(r.condition).toBe('advanced');
  expect(r.on).toBe(true);
});
