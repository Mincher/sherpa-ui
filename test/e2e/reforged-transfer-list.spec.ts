import { test, expect } from '@playwright/test';

/**
 * sherpa-transfer-list on the reforged base — a two-pane shuttle. Exercises pane
 * population from populate() (available vs selected split by the selected flag),
 * staging a row via its checkbox, moving it with a button, the transfer-change
 * event, and the add-all control.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-transfer-list'));
});

interface TransferEl extends HTMLElement {
  rendered?: Promise<void>;
  populate?: (d: unknown) => void;
  selected?: string[];
}

const POOL = [
  { value: 'r', label: 'Read' },
  { value: 'w', label: 'Write' },
  { value: 'x', label: 'Execute', selected: true },
];

test('splits items into available and selected panes', async ({ page }) => {
  const r = await page.evaluate(async (pool) => {
    const el = document.createElement('sherpa-transfer-list') as unknown as TransferEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(pool);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = el.shadowRoot!;
    return {
      available: s.querySelectorAll('.source .row').length,
      selected: s.querySelectorAll('.target .row').length,
      selectedValues: el.selected,
    };
  }, POOL);
  expect(r.available).toBe(2); // Read, Write
  expect(r.selected).toBe(1); // Execute (pre-selected)
  expect(r.selectedValues).toEqual(['x']);
});

test('staging a row and clicking add moves it + fires transfer-change', async ({ page }) => {
  const r = await page.evaluate(async (pool) => {
    const el = document.createElement('sherpa-transfer-list') as unknown as TransferEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(pool);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = el.shadowRoot!;

    let detail: unknown = null;
    el.addEventListener('transfer-change', (e) => (detail = (e as CustomEvent).detail));

    // Stage "Read" in the available pane (its list-item fires item-select), then click Add.
    const readRow = Array.from(s.querySelectorAll<HTMLElement>('.source .row')).find(
      (row) => row.dataset['value'] === 'r',
    )!;
    readRow.querySelector('sherpa-list-item')!.dispatchEvent(
      new CustomEvent('item-select', { bubbles: true, composed: true, detail: { selected: true } }),
    );
    (s.querySelector('sherpa-button[data-move="add"]') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return {
      detail,
      selected: el.selected,
      targetCount: s.querySelectorAll('.target .row').length,
    };
  }, POOL);
  expect(r.selected!.sort()).toEqual(['r', 'x']);
  expect(r.targetCount).toBe(2);
  expect((r.detail as { moved: string[]; direction: string }).moved).toEqual(['r']);
  expect((r.detail as { direction: string }).direction).toBe('add');
});

test('add-all moves every available item across', async ({ page }) => {
  const r = await page.evaluate(async (pool) => {
    const el = document.createElement('sherpa-transfer-list') as unknown as TransferEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(pool);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = el.shadowRoot!;
    (s.querySelector('sherpa-button[data-move="add-all"]') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { selected: el.selected!.sort(), available: s.querySelectorAll('.source .row').length };
  }, POOL);
  expect(r.selected).toEqual(['r', 'w', 'x']);
  expect(r.available).toBe(0);
});

test('remove-all empties the selected pane', async ({ page }) => {
  const r = await page.evaluate(async (pool) => {
    const el = document.createElement('sherpa-transfer-list') as unknown as TransferEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(pool);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = el.shadowRoot!;
    (s.querySelector('sherpa-button[data-move="remove-all"]') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { selected: el.selected, empty: s.querySelector('.target')!.hasAttribute('data-empty') };
  }, POOL);
  expect(r.selected).toEqual([]);
  expect(r.empty).toBe(true);
});

test('rows are composed sherpa-list-item + moves are composed sherpa-button', async ({ page }) => {
  const r = await page.evaluate(async (pool) => {
    const el = document.createElement('sherpa-transfer-list') as unknown as TransferEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(pool);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = el.shadowRoot!;
    return {
      listItems: s.querySelectorAll('.row sherpa-list-item').length,
      selectableItems: s.querySelectorAll('.row sherpa-list-item[data-selectable]').length,
      moveButtons: s.querySelectorAll('.moves sherpa-button[data-move]').length,
      rawCheckboxes: s.querySelectorAll('input[type="checkbox"]').length,
      rawMoveButtons: s.querySelectorAll('.moves button').length,
    };
  }, POOL);
  expect(r.listItems).toBe(3);        // every row composes a sherpa-list-item
  expect(r.selectableItems).toBe(3);  // each with a leading selection control
  expect(r.moveButtons).toBe(4);      // add / add-all / remove / remove-all
  expect(r.rawCheckboxes).toBe(0);    // no ad-hoc DOM
  expect(r.rawMoveButtons).toBe(0);
});
