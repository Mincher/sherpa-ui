import { test, expect, type Bar } from './harness';

/**
 * A NUMBER FILTER REPORTS WHAT IS TYPED OR DRAGGED — TODO 104.
 *
 * Will, 2026-09-29: "Numerical range filters aren't applied on value changes
 * via input fields or slider handles." The number body lives in the menu's
 * shadow root, and the menu listened on its host, so the chip HELD the value
 * and nothing was sent. Each test watches the EVENT, not the value — the old
 * test read the value, and stayed green through the bug.
 * TRAP T-native-change-stops-at-the-host
 */

type Slider = HTMLElement & { shadowRoot: ShadowRoot; rendered?: Promise<void> };
type Menu = HTMLElement & { shadowRoot: ShadowRoot; rendered?: Promise<void> };

/* A NUMBER WAITS FOR APPLY — TODO 94. A drag or a typed value is a DRAFT;
   Apply sends it once, and Cancel puts back what was applied.
   TRAP T-a-number-waits-for-apply */
test('a toolbar number chip sends a drag or a typed number on Apply, and Cancel puts back', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'spend', label: 'Spend', kind: 'number', min: 0, max: 1000, step: 10, range: true, active: true },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const heard: unknown[] = [];
    bar.addEventListener('quick-filter-change', () => {
      const one = bar.readings['spend'];
      heard.push(one?.picked?.length ? one.picked : one?.text);
    });
    const chip = bar.shadowRoot!.querySelector('.chip[data-id="spend"]') as HTMLElement;
    const menu = chip.querySelector('sherpa-menu') as Menu & { show(t: Element): void };
    const slider = menu.shadowRoot.querySelector('.body-number-range') as Slider;
    await slider.rendered;
    const sr = slider.shadowRoot;
    const open = async (): Promise<void> => {
      if (!menu.hasAttribute('open')) menu.show(chip);
      await window.__settled();
    };
    const press = async (which: 'apply' | 'cancel'): Promise<void> => {
      menu.shadowRoot.querySelector<HTMLElement>(`.${which}`)!.click();
      await window.__settled();
    };
    // What a browser sends: a native change bubbles, and is NOT composed.
    const edit = async (el: HTMLInputElement, value: string): Promise<void> => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await window.__settled();
    };

    await open();
    await edit(sr.querySelector<HTMLInputElement>('.range')!, '300');
    const drafted = heard.splice(0);
    await press('apply');
    const applied = heard.splice(0);
    await open();
    await edit(sr.querySelector<HTMLInputElement>('.value-end')!, '700');
    await press('cancel');
    const cancelled = { heard: heard.splice(0), values: (menu as unknown as { values: string[] }).values };
    await open();
    const sw = menu.shadowRoot.querySelector('.body-range-switch') as HTMLElement & { shadowRoot: ShadowRoot };
    sw.shadowRoot.querySelector<HTMLElement>('.input')!.click();
    await window.__settled();
    await edit(menu.shadowRoot.querySelector<HTMLInputElement>('.body-number-one')!, '250');
    const typedDraft = heard.splice(0);
    await press('apply');
    return { drafted, applied, cancelled, typedDraft, typed: heard.splice(0) };
  });

  expect(r.drafted).toEqual([]);
  expect(r.applied.at(-1)).toEqual(['300', '1000']);
  expect(r.cancelled).toEqual({ heard: [], values: ['300', '1000'] });
  expect(r.typedDraft).toEqual([]);
  // ONE number is a PICK under `=`. TRAP T-one-number-is-a-pick-under-equals
  expect(r.typed.at(-1)).toEqual(['250']);
});

test('a panel number field reports a dragged handle and a typed number', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const panel = await window.__mount<HTMLElement & {
      show(): void;
      readings: Record<string, Record<string, { picked?: string[]; text?: string }>>;
    }>('sherpa-filter-panel', [{ scope: 'data', label: 'Data', filters: [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 100, range: true },
    ] }], { 'data-min-width': '0' });
    panel.show();
    await window.__settled();
    const heard: unknown[] = [];
    panel.addEventListener('quick-filter-change', () => {
      const one = panel.readings['data']?.['seats'];
      heard.push(one?.picked?.length ? one.picked : one?.text);
    });
    const menu = panel.shadowRoot!.querySelector('.field[data-field="seats"] sherpa-menu') as Menu;
    await menu.rendered;
    const slider = menu.shadowRoot.querySelector('.body-number-range') as Slider;
    await slider.rendered;
    const edit = async (el: HTMLInputElement, value: string): Promise<void> => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await window.__settled();
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    };

    await edit(slider.shadowRoot.querySelector<HTMLInputElement>('.range')!, '30');
    const dragged = heard.splice(0);
    menu.toggleAttribute('data-range', false);
    await edit(menu.shadowRoot.querySelector<HTMLInputElement>('.body-number-one')!, '40');
    return { dragged, typed: heard.splice(0) };
  });

  expect(r.dragged.at(-1)).toEqual(['30', '100']);
  expect(r.typed.at(-1)).toEqual(['40']);
});

test('a bound source filters the ROWS by a typed number, and by a dragged range', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource } = await import('/dist/data.js') as unknown as {
      ArrayStore: new (rows: unknown[]) => unknown;
      DataSource: new (o: { store: unknown }) => {
        declareField(f: string, o: Record<string, unknown>): void;
        bind(el: HTMLElement, o?: Record<string, unknown>): void;
        load(): Promise<unknown>;
        debugState(): { total: number };
      };
    };
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 100, range: false, active: true },
    ], { style: 'inline-size: 1200px' });
    const rows = [5, 10, 10, 20, 40, 80].map((seats, id) => ({ id, seats }));
    const source = new DataSource({ store: new ArrayStore(rows) });
    source.declareField('seats', { label: 'Seats', type: 'number' });
    // STEER ONLY: the bar keeps the chips it was given.
    source.bind(bar, { steerOnly: true });
    await source.load();
    const total = (): number => source.debugState().total;
    const menu = bar.shadowRoot!.querySelector('.chip[data-id="seats"] sherpa-menu') as Menu;
    const edit = async (el: HTMLInputElement, value: string): Promise<void> => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await window.__settled();
      await source.load();
    };

    // A number waits for Apply. TRAP T-a-number-waits-for-apply
    const chip = bar.shadowRoot!.querySelector('.chip[data-id="seats"]') as HTMLElement;
    const apply = async (): Promise<void> => {
      menu.shadowRoot.querySelector<HTMLElement>('.apply')!.click();
      await window.__settled();
      await source.load();
    };
    (menu as unknown as { show(t: Element): void }).show(chip);
    await window.__settled();
    const all = total();
    await edit(menu.shadowRoot.querySelector<HTMLInputElement>('.body-number-one')!, '10');
    const draft = total();
    await apply();
    const typed = total();
    (menu as unknown as { show(t: Element): void }).show(chip);
    await window.__settled();
    menu.toggleAttribute('data-range', true);
    const slider = menu.shadowRoot.querySelector('.body-number-range') as Slider;
    await slider.rendered;
    await edit(slider.shadowRoot.querySelector<HTMLInputElement>('.range')!, '20');
    await apply();
    return { all, draft, typed, dragged: total() };
  });

  expect(r).toEqual({ all: 6, draft: 6, typed: 2, dragged: 3 });
});

/* THE RANGE SWITCH IS A CHANGE — TODO 131, 132. Will, 2026-09-30: switching to
   Range "doesn't fire an update event to start using the range parameters",
   and switching back "does not retain any original simple values".
   TRAP T-range-switch-swaps-not-rebuilds */
for (const host of ['toolbar', 'panel'] as const) {
  test(`${host}: the Range switch is reported, and each shape keeps what it held`, async ({ page }) => {
    const r = await page.evaluate(async (where) => {
      const { ArrayStore, DataSource } = await import('/dist/data.js') as unknown as {
        ArrayStore: new (rows: unknown[]) => unknown;
        DataSource: new (o: { store: unknown }) => {
          declareField(f: string, o: Record<string, unknown>): void;
          hold(scope: string, fields: string[]): void;
          bind(el: HTMLElement, o?: Record<string, unknown>): void;
          load(): Promise<unknown>;
          debugState(): { total: number };
        };
      };
      const def = { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 100, range: false, active: true };
      const el = where === 'toolbar'
        ? await window.__mount<HTMLElement>('sherpa-quick-filter-toolbar', [def], { style: 'inline-size: 1200px' })
        : await window.__mount<HTMLElement & { show(): void }>('sherpa-filter-panel',
          [{ scope: 'data', label: 'Data', filters: [def] }], { 'data-min-width': '0' });
      (el as unknown as { show?: () => void }).show?.();
      await window.__settled();
      const rows = [5, 10, 10, 20, 40, 80].map((seats, id) => ({ id, seats }));
      const source = new DataSource({ store: new ArrayStore(rows) });
      source.declareField('seats', { label: 'Seats', type: 'number' });
      if (where === 'panel') source.hold('data', ['seats']);
      source.bind(el, where === 'toolbar' ? { steerOnly: true } : { steerOnly: true, scope: ['data'] });
      await source.load();
      const total = (): number => source.debugState().total;
      // FRESH each time: a panel rebuilds a field when its answer changes.
      const menu = (): Menu & { show(t: Element): void } => el.shadowRoot!.querySelector(where === 'toolbar'
        ? '.chip[data-id="seats"] sherpa-menu' : '.field[data-field="seats"] sherpa-menu')!;
      // A PANEL field's menu is inline, and reports at once: there is no chip to open.
      const chip = where === 'toolbar' ? el.shadowRoot!.querySelector('.chip[data-id="seats"]') : null;
      const settle = async (): Promise<void> => {
        await window.__settled();
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        await source.load();
        await window.__settled();
      };
      /** Make the change take effect: a toolbar chip's menu waits for Apply. */
      const act = async (change: () => void): Promise<void> => {
        if (chip && !menu().hasAttribute('open')) { menu().show(chip); await window.__settled(); }
        change();
        await window.__settled();
        if (chip) menu().shadowRoot.querySelector<HTMLElement>('.apply')!.click();
        await settle();
      };
      const type = (field: HTMLElement, value: string): void => {
        const control = field.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
        control.value = value;
        control.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const one = (): HTMLElement & { value: string } => menu().shadowRoot.querySelector('.body-number-one')!;
      const slider = (): Slider => menu().shadowRoot.querySelector('.body-number-range') as Slider;
      const flip = (): void => (menu().shadowRoot.querySelector('.body-range-switch') as Slider)
        .shadowRoot.querySelector<HTMLElement>('.input')!.click();

      const all = total();
      await act(() => type(one(), '10'));
      const typed = total();
      // To RANGE: the one value no longer applies, with nothing else moved.
      await act(flip);
      const toRange = { total: total(), range: menu().hasAttribute('data-range') };
      await act(() => type(slider().shadowRoot.querySelector('.value-start')!, '20'));
      const ranged = total();
      // Back to SIMPLE: the 10 typed before is still there, and applies again.
      await act(flip);
      const back = { total: total(), range: menu().hasAttribute('data-range'), field: one().value };
      // …and to Range once more: the 20 is still there too.
      await act(flip);
      return { all, typed, toRange, ranged, back, again: total() };
    }, host);

    expect(r.all).toBe(6);
    expect(r.typed).toBe(2);
    expect(r.toRange).toEqual({ total: 6, range: true });
    expect(r.ranged).toBe(3);
    expect(r.back).toEqual({ total: 2, range: false, field: '10' });
    expect(r.again).toBe(3);
  });
}

/**
 * A NUMBER IS RESET, NOT CLEARED — TODO 134. Will, 2026-09-30: "Numeric filter
 * menus have a 'Clear' button but this isn't appropriate. It should be a reset
 * button that resets inputs and slider handles to their original values."
 * Clear had reached slotted children only, so it did nothing to a number.
 * TRAP T-a-number-is-reset-not-cleared
 */
test('a number menu has Reset: its field and its handles go back, both shapes, and the chip goes off', async ({ page }) => {
  const r = await page.evaluate(async () => {
    type Steer = Bar & { setChipReading(id: string, r: unknown): void };
    const bar = await window.__mount<Steer>('sherpa-quick-filter-toolbar', [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 500, active: true },
      { id: 'plan', label: 'Plan', options: [{ value: 'Pro', label: 'Pro' }] },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const chip = (id: string): HTMLElement => bar.shadowRoot!.querySelector(`.chip[data-id="${id}"]`)!;
    const menu = chip('seats').querySelector('sherpa-menu') as Menu & { reading: { picked?: unknown[]; kept?: unknown } };
    // A template that has no such button shows none.
    const shown = (m: Element, sel: string): boolean => {
      const el = m.shadowRoot!.querySelector(sel);
      return !!el && getComputedStyle(el).display !== 'none';
    };
    const body = () => {
      const slider = menu.shadowRoot.querySelector('.body-number-range') as HTMLElement & { range: [number, number] };
      const one = menu.shadowRoot.querySelector('.body-number-one') as HTMLElement & { value: string };
      return { ends: slider.range, touched: slider.hasAttribute('data-touched'), one: one.value, reading: menu.reading,
        on: chip('seats').hasAttribute('data-current'), value: chip('seats').shadowRoot!.querySelector('.caret-label')!.textContent };
    };
    // Both shapes hold something: two ends in force, and a single value kept.
    bar.setChipReading('seats', { picked: ['37', '120'], range: true, kept: { picked: ['12'] } });
    await window.__settled();
    const before = body();
    const heard: unknown[] = [];
    bar.addEventListener('quick-filter-change', () => heard.push(bar.readings['seats']?.picked ?? null));
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

  expect(r.before).toMatchObject({ ends: [37, 120], touched: true, one: '12', on: true, value: '37 to 120' });
  expect(r.buttons).toEqual({ reset: true, clear: false, label: 'Reset' });
  // Where they started: the handles on the bounds, the field empty, nothing kept.
  expect(r.after).toMatchObject({ ends: [0, 500], touched: false, one: '', on: false, value: '' });
  expect(r.after.reading.picked).toEqual([]);
  expect(r.after.reading.kept).toBeUndefined();
  // The filter went with it, at once — as Clear's does.
  expect(r.heard.length).toBeGreaterThan(0);
  expect(r.heard.at(-1) ?? []).toEqual([]);
  // A list still has Clear.
  expect(r.list).toEqual({ reset: false, clear: true });
});
