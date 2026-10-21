import { test, expect, type Bar } from './harness';

/**
 * A NUMBER SWITCHES TO ADVANCED — TODO 90. Will: "Any filter should be able
 * to be toggled to 'Advanced' … We'll need different conditional options for
 * numeric, and date, field types." A number that opts in gets condition rows
 * with the NUMBER questions, every value typed; its Simple body is carried
 * into them, and kept for when it switches back.
 * TRAP T-a-number-has-advanced-rows
 */
type Menu = HTMLElement & {
  shadowRoot: ShadowRoot; rendered?: Promise<void>; mode: string;
  conditions: { op: string; join?: string; text?: string; picked?: unknown[] }[];
  reading: Record<string, unknown>; show(t: Element): void;
};

test('a toolbar number chip goes Advanced: number questions, its body carried over, and both answers kept', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = await window.__mount<Bar & { setChipReading(id: string, r: unknown): void }>('sherpa-quick-filter-toolbar', [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 500, advanced: true, active: true },
      // Every number offers Advanced now, unless it says not (TODO 375).
      { id: 'spend', label: 'Spend', kind: 'number', min: 0, max: 1000, advanced: false },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const chip = (id: string) => bar.shadowRoot!.querySelector<HTMLElement & { reading: Record<string, unknown> | null }>(`.chip[data-id="${id}"]`)!;
    const menu = (id: string) => chip(id).querySelector('sherpa-menu') as Menu;
    const sr = menu('seats').shadowRoot;
    const shown = (sel: string) => { const n = sr.querySelector<HTMLElement>(sel); return !!n && n.getClientRects().length > 0; };
    // Simple: ONE value, from elsewhere (a number has no Simple range, TODO 375).
    bar.setChipReading('seats', { picked: ['20'] });
    await window.__settled();
    menu('seats').show(chip('seats'));
    await window.__settled();
    const simple = { type: menu('seats').dataset['type'], fx: shown('.use-advanced'), body: shown('.body-number'), rows: shown('.condition-rows') };

    // f(x): the value comes over as an Equals row.
    sr.querySelector<HTMLElement>('.use-advanced')!.shadowRoot!.querySelector<HTMLElement>('button')!.click();
    await window.__settled();
    const ops = [...sr.querySelectorAll<HTMLElement & { value: string }>('.condition-row .condition')].map((c) => c.value);
    const advanced = {
      mode: menu('seats').mode, body: shown('.body-number'), rows: shown('.condition-rows'),
      conditions: menu('seats').conditions, ops,
      // Every row is TYPED: a number has no list to pick from.
      typed: [...sr.querySelectorAll<HTMLElement>('.condition-row')].map((row) => row.dataset['takes']),
    };
    // The chip's whole reading: the rows in force, the body kept.
    const reading = chip('seats').reading;
    // Back to Simple: the value is still there.
    sr.querySelector<HTMLElement>('.use-advanced')!.shadowRoot!.querySelector<HTMLElement>('button')!.click();
    await window.__settled();
    const back = { mode: menu('seats').mode, body: shown('.body-number'), picked: (menu('seats').reading as { picked?: unknown[] }).picked };
    return {
      simple, advanced, reading, back,
      // A number that says advanced:false is as it was.
      plain: { type: menu('spend').dataset['type'] ?? null, advanced: menu('spend').hasAttribute('data-advanced') },
    };
  });

  expect(r.simple).toEqual({ type: 'filter', fx: true, body: true, rows: false });
  expect(r.advanced).toMatchObject({
    mode: 'advanced', body: false, rows: true,
    conditions: [{ op: 'eq', picked: ['20'] }],
    typed: ['text'],
  });
  expect(r.advanced.ops).toEqual(['eq']);
  expect(r.reading).toMatchObject({ mode: 'advanced', picked: ['20'], conditions: [{ op: 'eq', picked: ['20'] }] });
  expect(r.back).toEqual({ mode: 'simple', body: true, picked: ['20'] });
  expect(r.plain).toEqual({ type: null, advanced: false });
});

test('a bound source filters by a number\'s Advanced rows, `=` included', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource, bindSource } = await import('/dist/data.js') as unknown as {
      ArrayStore: new (rows: unknown[], o?: unknown) => unknown;
      DataSource: new (o: { store: unknown }) => {
        declareField(f: string, facts: unknown): void;
        load(): Promise<unknown>; debugState(): { total: number };
      };
      bindSource(source: unknown, el: Element, o?: unknown): () => void;
    };
    const source = new DataSource({ store: new ArrayStore([
      { id: 1, seats: 5 }, { id: 2, seats: 50 }, { id: 3, seats: 120 }, { id: 4, seats: 300 },
    ], { key: 'id' }) });
    source.declareField('seats', { type: 'number' });
    const bar = await window.__mount<Bar & { setChipReading(id: string, r: unknown): void; report(): void }>('sherpa-quick-filter-toolbar', [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 500, advanced: true },
    ], { style: 'inline-size: 1200px' });
    bindSource(source, bar, { steerOnly: true, scope: 'view' });
    await source.load();
    const total = async (reading: unknown): Promise<number> => {
      bar.setChipReading('seats', reading);
      bar.report();
      await window.__settled();
      await source.load();
      return source.debugState().total;
    };
    return {
      // Under 10 OR over 200.
      either: await total({ mode: 'advanced', conditions: [{ op: 'lt', text: '10' }, { op: 'gt', join: 'or', text: '200' }] }),
      // Exactly 50: a number's `=` is its one pick.
      equals: await total({ mode: 'advanced', conditions: [{ op: 'eq', picked: ['50'] }] }),
      // Between 40 and 150: 50 and 120. TODO 375
      between: await total({ mode: 'advanced', conditions: [{ op: 'between', picked: ['40', '150'] }] }),
      // Simple again: the body's one value.
      simple: await total({ mode: 'simple', picked: ['120'], conditions: [{ op: 'eq', picked: ['50'] }] }),
    };
  });
  expect(r).toEqual({ either: 2, equals: 1, between: 2, simple: 1 });
});

test('in the panel, a number field\'s f(x) carries its number into the rows, and back', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const panel = await window.__mount<HTMLElement & { readings: Record<string, Record<string, Record<string, unknown>>>;
      setFieldReading(id: string, r: unknown, scope?: string): void }>('sherpa-filter-panel', [{
      scope: 'data', label: 'Customer records',
      filters: [{ id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 500, advanced: true }],
    }], { open: true, style: 'inline-size: 480px' });
    await window.__settled();
    const sr = panel.shadowRoot!;
    const field = sr.querySelector<HTMLElement>('.field[data-field="seats"]')!;
    const menu = field.querySelector('sherpa-menu') as Menu;
    panel.setFieldReading('seats', { picked: ['37'], range: false }, 'data');
    await window.__settled();
    const heard: unknown[] = [];
    panel.addEventListener('quick-filter-change', () => heard.push(panel.readings['data']?.['seats']));
    const fx = () => field.querySelector<HTMLElement>('.field-advanced')!.shadowRoot!.querySelector<HTMLElement>('.caret')!.click();
    fx();
    await window.__settled();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const advanced = { mode: menu.mode, field: field.hasAttribute('data-advanced'), conditions: menu.conditions };
    fx();
    await window.__settled();
    return { advanced, back: { mode: menu.mode, picked: (menu.reading as { picked?: unknown[] }).picked }, heard: heard.length > 0 };
  });

  expect(r.advanced).toEqual({ mode: 'advanced', field: true, conditions: [{ op: 'eq', picked: ['37'] }] });
  expect(r.back).toEqual({ mode: 'simple', picked: ['37'] });
  expect(r.heard).toBe(true);
});

/**
 * A NUMBER's range is an Advanced row — TODO 375. Will: "| Condition select |
 * Start value input | End value input |" with the "Range Slider" under them,
 * the row's full width. The slider moves both boxes, and the boxes move it; one
 * end alone is no answer.
 */
test('Between and Not between: two boxes on the row, and a slider under it that moves them', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'seats', label: 'Seats', kind: 'number', min: 0, max: 500, active: true },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const chip = bar.shadowRoot!.querySelector<HTMLElement & { reading: unknown }>('.chip[data-id="seats"]')!;
    const menu = chip.querySelector('sherpa-menu') as Menu;
    const sr = menu.shadowRoot;
    // Every number offers Advanced, and its rows ask Between and Not between.
    const offers = { advanced: menu.hasAttribute('data-advanced'), ops: menu.dataset['conditions'] };
    (chip as unknown as { reading: unknown }).reading = { conditions: [{ op: 'between', picked: ['20', '80'] }], mode: 'advanced' };
    await window.__settled();
    menu.show(chip);
    await window.__settled();
    const row = sr.querySelector<HTMLElement>('.condition-row')!;
    const box = (s: string) => row.querySelector<HTMLElement & { value: string }>(s)!;
    const slider = row.querySelector<HTMLElement & { range: [number, number] }>('.condition-slider')!;
    const place = (n: Element) => { const b = n.getBoundingClientRect(); return { top: Math.round(b.top), left: Math.round(b.left), width: Math.round(b.width) }; };
    const drawn = { takes: row.dataset['takes'], from: box('.condition-value').value, to: box('.condition-value-to').value,
      slider: slider.range, min: slider.getAttribute('min'), max: slider.getAttribute('max') };
    const layout = { row: place(row), op: place(box('.condition')), from: place(box('.condition-value')), to: place(box('.condition-value-to')), slider: place(slider) };
    // The slider moves both boxes.
    slider.range = [100, 300];
    slider.dispatchEvent(new CustomEvent('input', { bubbles: true, composed: true, detail: { start: 100, end: 300 } }));
    await window.__settled();
    const slid = { from: box('.condition-value').value, to: box('.condition-value-to').value, rows: menu.conditions };
    // One end alone is no answer.
    box('.condition-value-to').value = '';
    box('.condition-value-to').dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await window.__settled();
    return { offers, drawn, layout, slid, half: menu.conditions };
  });
  expect(r.offers).toEqual({ advanced: true, ops: 'eq,ne,gt,gte,lt,lte,between,notbetween' });
  expect(r.drawn).toEqual({ takes: 'range', from: '20', to: '80', slider: [20, 80], min: '0', max: '500' });
  // One line: condition, From, To; the slider under it, the row's full width.
  expect(r.layout.op.top).toBe(r.layout.from.top);
  expect(r.layout.to.top).toBe(r.layout.from.top);
  expect(r.layout.to.left).toBeGreaterThan(r.layout.from.left);
  expect(r.layout.slider.top).toBeGreaterThan(r.layout.from.top);
  expect(r.layout.slider.width).toBe(r.layout.row.width);
  expect(r.slid).toEqual({ from: '100', to: '300', rows: [{ op: 'between', picked: ['100', '300'] }] });
  expect(r.half).toEqual([{ op: 'between' }]);
});
