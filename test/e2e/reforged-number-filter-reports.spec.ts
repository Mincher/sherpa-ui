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
