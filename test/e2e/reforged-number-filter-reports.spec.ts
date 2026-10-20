import { test, expect, type Bar } from './harness';

/**
 * A NUMBER FILTER REPORTS WHAT IS TYPED — TODO 104 — and its range is an
 * ADVANCED row: Between or Not between, two boxes and a slider under them
 * (Will, TODO 375). There is no Range switch, and Simple is one value.
 *
 * Will, 2026-09-29: "Numerical range filters aren't applied on value changes
 * via input fields or slider handles." The number body lives in the menu's
 * shadow root, and the menu listened on its host, so the chip HELD the value
 * and nothing was sent. Each test watches the EVENT, not the value — the old
 * test read the value, and stayed green through the bug.
 * TRAP T-native-change-stops-at-the-host
 */

type Menu = HTMLElement & { shadowRoot: ShadowRoot; rendered?: Promise<void>; show(t: Element): void; values: string[] };
type Box = HTMLElement & { value: string };
type Slider = HTMLElement & { range: [number, number] };

/** What a browser sends: a native input and change, bubbling. */
const EDIT = `async (el, value) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await window.__settled();
}`;

/* A NUMBER WAITS FOR APPLY — TODO 94. A typed value or a dragged range is a
   DRAFT; Apply sends it once, and Cancel puts back what was applied.
   TRAP T-a-number-waits-for-apply */
test('a toolbar number chip sends a typed number, or a Between row\'s drag, on Apply; Cancel puts back', async ({ page }) => {
  const r = await page.evaluate(async (EDIT) => {
    const edit = eval(EDIT) as (el: Element, v: string) => Promise<void>;
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'spend', label: 'Spend', kind: 'number', min: 0, max: 1000, step: 10, active: true },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const heard: unknown[] = [];
    bar.addEventListener('quick-filter-change', () => {
      const one = bar.readings['spend'] as { picked?: unknown[]; conditions?: unknown[]; mode?: string } | undefined;
      heard.push(one?.mode === 'advanced' ? one.conditions : one?.picked);
    });
    const chip = bar.shadowRoot!.querySelector('.chip[data-id="spend"]') as HTMLElement;
    const menu = chip.querySelector('sherpa-menu') as Menu;
    const sr = menu.shadowRoot;
    const open = async (): Promise<void> => {
      if (!menu.hasAttribute('open')) menu.show(chip);
      await window.__settled();
    };
    const press = async (which: 'apply' | 'cancel'): Promise<void> => {
      sr.querySelector<HTMLElement>(`.${which}`)!.click();
      await window.__settled();
    };

    await open();
    const simple = { switch: !!sr.querySelector('.body-range-switch')?.getClientRects().length, slider: !!sr.querySelector('.body-number-range') };
    await edit(sr.querySelector('.body-number-one')!, '300');
    const drafted = heard.splice(0);
    await press('apply');
    const applied = heard.splice(0);
    await open();
    await edit(sr.querySelector('.body-number-one')!, '700');
    await press('cancel');
    const cancelled = { heard: heard.splice(0), values: menu.values };
    // Advanced: a Between row, its slider dragged.
    await open();
    sr.querySelector('.use-advanced')!.shadowRoot!.querySelector<HTMLElement>('button')!.click();
    await window.__settled();
    const row = sr.querySelector<HTMLElement>('.condition-row')!;
    const op = row.querySelector<Box>('.condition')!;
    op.value = 'between';
    op.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await window.__settled();
    const slider = row.querySelector<Slider>('.condition-slider')!;
    slider.range = [200, 600];
    slider.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail: { start: 200, end: 600 } }));
    await window.__settled();
    const ends = [row.querySelector<Box>('.condition-value')!.value, row.querySelector<Box>('.condition-value-to')!.value];
    const rangeDraft = heard.splice(0);
    await press('apply');
    return { simple, drafted, applied, cancelled, ends, rangeDraft, ranged: heard.splice(0) };
  }, EDIT);

  // No Range switch, and no slider in Simple: one value. TODO 375
  expect(r.simple).toEqual({ switch: false, slider: false });
  expect(r.drafted).toEqual([]);
  // ONE number is a PICK under `=`. TRAP T-one-number-is-a-pick-under-equals
  expect(r.applied.at(-1)).toEqual(['300']);
  expect(r.cancelled).toEqual({ heard: [], values: ['300'] });
  expect(r.ends).toEqual(['200', '600']);
  expect(r.rangeDraft).toEqual([]);
  expect(r.ranged.at(-1)).toEqual([{ op: 'between', picked: ['200', '600'] }]);
});

/* LIVE — Will, TODO 107. Over a source with `applyOn: 'input'`, a number does
   not wait for Apply: a value still being TYPED is reported, and the source
   waits for the typing to stop. TRAP T-coalesce-microtask-not-debounce */
test('over a LIVE source, a number chip reports its value as it is typed, with no Apply', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'spend', label: 'Spend', kind: 'number', min: 0, max: 1000, step: 10, active: true },
    ], { style: 'inline-size: 1200px', 'data-apply-on': 'input' });
    await window.__settled();
    const heard: unknown[] = [];
    bar.addEventListener('quick-filter-change', () => heard.push((bar.readings['spend'] as { picked?: unknown[] })?.picked));
    const chip = bar.shadowRoot!.querySelector('.chip[data-id="spend"]') as HTMLElement;
    const menu = chip.querySelector('sherpa-menu') as Menu;
    menu.show(chip);
    await window.__settled();
    const one = menu.shadowRoot.querySelector<Box>('.body-number-one')!;
    one.value = '400';
    // Still typing: an `input`, and no `change`.
    one.dispatchEvent(new Event('input', { bubbles: true }));
    await window.__settled();
    return { commits: menu.hasAttribute('data-commit'), live: menu.dataset['applyOn'], heard };
  });
  expect(r.commits).toBe(false);
  expect(r.live).toBe('input');
  expect(r.heard.at(-1)).toEqual(['400']);
});

test('a binder tells a control over a live source so; never one over a remote source', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource, bindSource } = await import('/dist/data.js');
    const said = (store: unknown) => {
      const bar = document.createElement('sherpa-quick-filter-toolbar');
      document.getElementById('root')!.replaceChildren(bar);
      const source = new DataSource({ store: store as never, applyOn: 'input' });
      bindSource(source, bar as never, { scope: 'view' });
      return bar.getAttribute('data-apply-on');
    };
    const rows = [{ id: 1, spend: 10 }];
    return {
      local: said(new ArrayStore(rows, { key: 'id' })),
      remote: said(Object.assign(new ArrayStore(rows, { key: 'id' }), { remote: true })),
    };
  });
  expect(r).toEqual({ local: 'input', remote: null });
});

test('a panel number field reports a typed number, and a Between row\'s ends', async ({ page }) => {
  const r = await page.evaluate(async (EDIT) => {
    const edit = eval(EDIT) as (el: Element, v: string) => Promise<void>;
    const panel = await window.__mount<HTMLElement & {
      show(): void;
      readings: Record<string, Record<string, { picked?: string[]; conditions?: unknown[]; mode?: string }>>;
    }>('sherpa-filter-panel', [{ scope: 'data', label: 'Data', filters: [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 100 },
    ] }]);
    panel.show();
    await window.__settled();
    const frames = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const heard: unknown[] = [];
    panel.addEventListener('quick-filter-change', () => {
      const one = panel.readings['data']?.['seats'];
      heard.push(one?.mode === 'advanced' ? one.conditions : one?.picked);
    });
    const menu = panel.shadowRoot!.querySelector('.field[data-field="seats"] sherpa-menu') as Menu;
    await menu.rendered;
    await edit(menu.shadowRoot.querySelector('.body-number-one')!, '40');
    await frames();
    const typed = heard.splice(0);
    // The field's own f(x), then a Between row's two boxes.
    panel.shadowRoot!.querySelector('.field[data-field="seats"] .field-advanced')!.shadowRoot!.querySelector<HTMLElement>('.caret')!.click();
    await window.__settled();
    await frames();
    const row = menu.shadowRoot.querySelector<HTMLElement>('.condition-row')!;
    const op = row.querySelector<Box>('.condition')!;
    op.value = 'between';
    op.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await window.__settled();
    await edit(row.querySelector('.condition-value')!, '10');
    await edit(row.querySelector('.condition-value-to')!, '30');
    await frames();
    return { typed, ranged: heard.splice(0) };
  }, EDIT);

  expect(r.typed.at(-1)).toEqual(['40']);
  expect(r.ranged.at(-1)).toEqual([{ op: 'between', picked: ['10', '30'] }]);
});

test('a bound source filters the ROWS by a typed number, and by Between and Not between', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource, bindSource } = await import('/dist/data.js') as unknown as {
      ArrayStore: new (rows: unknown[]) => unknown;
      DataSource: new (o: { store: unknown }) => {
        declareField(f: string, o: Record<string, unknown>): void;
        load(): Promise<unknown>;
        debugState(): { total: number };
      };
      bindSource(source: unknown, el: HTMLElement, o?: Record<string, unknown>): void;
    };
    type Steer = Bar & { setChipReading(id: string, r: unknown): void; report(): void };
    const bar = await window.__mount<Steer>('sherpa-quick-filter-toolbar', [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 100, active: true },
    ], { style: 'inline-size: 1200px' });
    const rows = [5, 10, 10, 20, 40, 80].map((seats, id) => ({ id, seats }));
    const source = new DataSource({ store: new ArrayStore(rows) });
    source.declareField('seats', { label: 'Seats', type: 'number' });
    // STEER ONLY: the bar keeps the chips it was given.
    bindSource(source, bar, { steerOnly: true });
    await source.load();
    const total = (): number => source.debugState().total;
    const menu = bar.shadowRoot!.querySelector('.chip[data-id="seats"] sherpa-menu') as Menu;
    const chip = bar.shadowRoot!.querySelector('.chip[data-id="seats"]') as HTMLElement;
    const apply = async (): Promise<void> => {
      menu.shadowRoot.querySelector<HTMLElement>('.apply')!.click();
      await window.__settled();
      await source.load();
    };
    menu.show(chip);
    await window.__settled();
    const all = total();
    const one = menu.shadowRoot.querySelector<Box>('.body-number-one')!;
    one.value = '10';
    one.dispatchEvent(new Event('change', { bubbles: true }));
    await window.__settled();
    await source.load();
    // A number waits for Apply. TRAP T-a-number-waits-for-apply
    const draft = total();
    await apply();
    const typed = total();
    const answer = async (op: string): Promise<number> => {
      bar.setChipReading('seats', { conditions: [{ op, picked: ['20', '40'] }], mode: 'advanced' });
      bar.report();
      await window.__settled();
      await source.load();
      return total();
    };
    return { all, draft, typed, between: await answer('between'), outside: await answer('notbetween') };
  });

  // Between 20 and 40: 20 and 40. Not between: 5, 10, 10 and 80.
  expect(r).toEqual({ all: 6, draft: 6, typed: 2, between: 2, outside: 4 });
});

/**
 * A NUMBER IS RESET, NOT CLEARED — TODO 134. Will, 2026-09-30: "Numeric filter
 * menus have a 'Clear' button but this isn't appropriate. It should be a reset
 * button that resets inputs and slider handles to their original values."
 * Clear had reached slotted children only, so it did nothing to a number.
 * Every number is a filter menu now (TODO 375), and keeps the word.
 * TRAP T-a-number-is-reset-not-cleared
 */
test('a number menu has Reset: its value goes, and the chip goes off', async ({ page }) => {
  const r = await page.evaluate(async () => {
    type Steer = Bar & { setChipReading(id: string, r: unknown): void };
    const bar = await window.__mount<Steer>('sherpa-quick-filter-toolbar', [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 500, active: true },
      { id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }] },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const chip = (id: string): HTMLElement => bar.shadowRoot!.querySelector(`.chip[data-id="${id}"]`)!;
    const menu = chip('seats').querySelector('sherpa-menu') as Menu & { reading: { picked?: unknown[] } };
    // A template that has no such button shows none.
    const shown = (m: Element, sel: string): boolean => {
      const el = m.shadowRoot!.querySelector(sel);
      return !!el && getComputedStyle(el).display !== 'none';
    };
    const body = () => ({
      one: (menu.shadowRoot.querySelector('.body-number-one') as Box).value, reading: menu.reading,
      on: chip('seats').hasAttribute('data-current'), value: chip('seats').shadowRoot!.querySelector('.caret-label')!.textContent,
    });
    bar.setChipReading('seats', { picked: ['12'] });
    await window.__settled();
    const before = body();
    const heard: unknown[] = [];
    bar.addEventListener('quick-filter-change', () => heard.push((bar.readings['seats'] as { picked?: unknown[] })?.picked ?? null));
    chip('seats').shadowRoot!.querySelector<HTMLElement>('.caret')!.click();
    await window.__settled();
    const buttons = { reset: shown(menu, '.reset'), clear: shown(menu, '.clear'),
      label: menu.shadowRoot.querySelector('.reset')!.textContent!.trim() };
    menu.shadowRoot.querySelector('.reset')!.shadowRoot!.querySelector<HTMLElement>('button')!.click();
    await window.__settled();
    const list = chip('plan').querySelector('sherpa-menu')!;
    return { before, buttons, after: body(), heard,
      list: { reset: shown(list, '.reset'), clear: shown(list, '.clear') } };
  });

  expect(r.before).toMatchObject({ one: '12', on: true, value: '12' });
  expect(r.buttons).toEqual({ reset: true, clear: false, label: 'Reset' });
  expect(r.after).toMatchObject({ one: '', on: false, value: '' });
  expect(r.after.reading.picked).toEqual([]);
  // The filter went with it, at once — as Clear's does.
  expect(r.heard.length).toBeGreaterThan(0);
  expect(r.heard.at(-1) ?? []).toEqual([]);
  // A list still has Clear.
  expect(r.list).toEqual({ reset: false, clear: true });
});
