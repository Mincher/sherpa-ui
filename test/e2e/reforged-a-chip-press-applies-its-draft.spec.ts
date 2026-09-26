import { test, expect, type Bar } from './harness';

/**
 * A CHIP PRESS APPLIES ITS MENU'S OPEN DRAFT. Will, 2026-09-25: "values added
 * to Conditional Filter input rows aren't applied when clicking Apply (or
 * activating the chip in the toolbar)."
 *
 * A committing menu holds its rows and ticks as a DRAFT, and closing it any
 * other way than Apply throws the draft away. The chip's own body was one of
 * those ways: a reader typed a condition, pressed the chip to turn it on, and
 * the press only shut the menu — with nothing applied.
 * TRAP T-a-chip-press-applies-its-menus-draft
 */
const OWNER = {
  id: 'owner', label: 'Owner', select: 'multiple', custom: true, commit: true,
  options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }],
};

test('typed rows, then a press on the chip: the condition is applied', async ({ page }) => {
  const r = await page.evaluate(async (OWNER) => {
    const bar = await window.__mount<Bar & { clauses: Record<string, unknown> }>(
      'sherpa-quick-filter-toolbar', [OWNER], { style: 'inline-size: 900px' });
    await window.__settled();
    const heard: unknown[] = [];
    bar.addEventListener('quick-filter-change', () => heard.push(bar.clauses));
    const chip = bar.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="owner"]')!;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & {
      show(t: HTMLElement): void; shadowRoot: ShadowRoot; conditions: unknown; open: boolean;
    };
    const wait = (ms = 150) => new Promise((res) => setTimeout(res, ms));
    chip.shadowRoot!.querySelector<HTMLElement>('.caret')!.click();
    await wait();
    menu.shadowRoot.querySelector('.use-condition')!.shadowRoot!.querySelector('button')!.click();
    await wait();
    const row = menu.shadowRoot.querySelector('.condition-row')!;
    const set = (sel: string, value: string, type: string) => {
      const field = row.querySelector(sel) as HTMLElement & { value: string };
      field.value = value;
      field.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
    };
    set('.condition', 'contains', 'change');
    await wait();
    set('.condition-value', 'Da', 'input');
    await wait();
    const before = { on: chip.hasAttribute('data-current'), heard: heard.length };

    // THE PRESS — on the chip's body, with the menu still open.
    chip.shadowRoot!.querySelector<HTMLElement>('.body')!.click();
    await wait(300);
    return {
      before,
      on: chip.hasAttribute('data-current'),
      condition: chip.getAttribute('data-condition'),
      rows: menu.conditions,
      open: menu.open,
      clauses: bar.clauses,
    };
  }, OWNER);

  expect(r.before).toEqual({ on: false, heard: 0 });
  expect(r.on).toBe(true);
  expect(r.condition).toBe('custom');
  expect(r.rows).toEqual([{ op: 'contains', text: 'Da' }]);
  expect(r.open).toBe(false);
  expect(r.clauses).toEqual({ owner: ['owner', 'contains', 'Da'] });
});

test('ticks, then a press on the chip: the ticks are applied', async ({ page }) => {
  const r = await page.evaluate(async (OWNER) => {
    const bar = await window.__mount<Bar & { pickedValues: Record<string, string[]> }>(
      'sherpa-quick-filter-toolbar', [OWNER], { style: 'inline-size: 900px' });
    await window.__settled();
    const chip = bar.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="owner"]')!;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & { open: boolean };
    const wait = (ms = 150) => new Promise((res) => setTimeout(res, ms));
    chip.shadowRoot!.querySelector<HTMLElement>('.caret')!.click();
    await wait();
    const box = [...menu.querySelectorAll<HTMLInputElement>('input')].find((i) => i.value === 'Ravi')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    chip.shadowRoot!.querySelector<HTMLElement>('.body')!.click();
    await wait(300);
    return { on: chip.hasAttribute('data-current'), picked: bar.pickedValues['owner'], open: menu.open };
  }, OWNER);

  expect(r).toEqual({ on: true, picked: ['Ravi'], open: false });
});

test('with nothing drafted, a press on an open empty chip still just shuts it', async ({ page }) => {
  const r = await page.evaluate(async (OWNER) => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [OWNER], { style: 'inline-size: 900px' });
    await window.__settled();
    const chip = bar.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="owner"]')!;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & { open: boolean };
    const wait = (ms = 150) => new Promise((res) => setTimeout(res, ms));
    chip.shadowRoot!.querySelector<HTMLElement>('.caret')!.click();
    await wait();
    const opened = menu.open;
    chip.shadowRoot!.querySelector<HTMLElement>('.body')!.click();
    await wait(300);
    return { opened, open: menu.open, on: chip.hasAttribute('data-current') };
  }, OWNER);

  expect(r).toEqual({ opened: true, open: false, on: false });
});

/**
 * A STEERED condition keeps its text. `conditions =` built row one with the
 * text already in its box, so the write to `data-value` was skipped — and the
 * next re-sync put the empty attribute back over it. TRAP T-row-one-is-data-op
 */
test('a steered condition keeps its typed text through a re-sync', async ({ page }) => {
  const r = await page.evaluate(async (OWNER) => {
    const bar = await window.__mount<Bar & { setChipReading(id: string, r: unknown): void }>(
      'sherpa-quick-filter-toolbar', [OWNER], { style: 'inline-size: 900px' });
    await window.__settled();
    // Rows DRAWN first, as in a page that has used the chip: the rebuilt row
    // then holds its text at once, which is what skipped the write.
    bar.setChipReading('owner', { conditions: [{ op: 'contains', text: 'Zz' }] });
    await window.__settled();
    bar.setChipReading('owner', { conditions: [{ op: 'contains', text: 'Ai' }] });
    await window.__settled();
    const menu = bar.shadowRoot!.querySelector('.chip[data-id="owner"] sherpa-menu') as HTMLElement & {
      conditions: unknown; conditionValue: string;
    };
    // ANY watched attribute re-syncs row one from `data-op` and `data-value`.
    menu.setAttribute('data-heading', 'Owner, again');
    await window.__settled();
    return { rows: menu.conditions, text: menu.conditionValue, attr: menu.dataset['value'] };
  }, OWNER);

  expect(r).toEqual({ rows: [{ op: 'contains', text: 'Ai' }], text: 'Ai', attr: 'Ai' });
});
