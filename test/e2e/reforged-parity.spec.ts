import { test, expect } from './harness';

/**
 * PARITY — anything a person can do by clicking, a caller can do by calling.
 *
 * Not a nicety: it is what makes a view definition possible at all. A saved
 * view can only restore what a component exposes, so **a component's state is
 * savable exactly as far as its API reaches**. Every getter without a setter is
 * a choice a reader can make and never get back.
 *
 * Found by sweeping every component for a getter with no setter (P3), and
 * judging each one — some are derived data and correctly read-only.
 */


test('transfer-list: what was moved across can be put back', async ({ page }) => {
  // `selected` was a GETTER ONLY, so a saved view could record what a reader
  // transferred and never restore it.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-transfer-list') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      selected: string[];
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C' },
    ]);
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    el.selected = ['a', 'c'];
    await settle();
    const restored = el.selected;

    // REPLACES rather than adds — a restore says "this is what is selected".
    // A value matching nothing is ignored: a saved view outlives the list it
    // was made from.
    el.selected = ['b', 'deleted'];
    await settle();
    const replaced = el.selected;

    el.selected = [];
    await settle();
    return { restored, replaced, cleared: el.selected };
  });

  expect(r.restored).toEqual(['a', 'c']);
  expect(r.replaced).toEqual(['b']);
  expect(r.cleared).toEqual([]);
});

test('charts: a hidden series can be restored, not just read', async ({ page }) => {
  // Clicking a legend swatch to hide a series is real view state — what this
  // reader wants to look at — and belongs in a saved view beside the filter.
  const r = await page.evaluate(async () => {
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    const mk = async (tag: string) => {
      const el = document.createElement(tag) as HTMLElement & {
        rendered?: Promise<void>;
        populate(d: unknown): void;
        hiddenBars?: number[];
        hiddenSeries?: number[];
      };
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;
      return el;
    };

    const bar = await mk('sherpa-barchart');
    bar.populate([{ label: 'a', value: 1 }, { label: 'b', value: 2 }, { label: 'c', value: 3 }]);
    await settle();
    bar.hiddenBars = [0, 2];
    await settle();
    const bars = {
      read: bar.hiddenBars,
      // …and it actually took effect, not merely recorded.
      visible: Array.from(bar.shadowRoot!.querySelectorAll('.bar'))
        .filter((x) => getComputedStyle(x).display !== 'none').length,
    };

    const line = await mk('sherpa-line-chart');
    line.populate({ labels: ['x', 'y'], series: [[1, 2], [3, 4], [5, 6]] });
    await settle();
    line.hiddenSeries = [1];
    await settle();

    // An empty array shows everything again.
    bar.hiddenBars = [];
    await settle();

    return { bars, lineRead: line.hiddenSeries, barCleared: bar.hiddenBars };
  });

  expect(r.bars.read).toEqual([0, 2]);
  expect(r.bars.visible).toBe(1);
  expect(r.lineRead).toEqual([1]);
  expect(r.barCleared).toEqual([]);
});

test('one chart datum: the SAME array feeds a chart and its legend', async ({ page }) => {
  // BarDatum, DonutSlice and LegendItem were three names for the same three
  // fields, so crossing between them cost a `.map()` that copied a shape to
  // itself. Sharing one array also lets the source's skip-if-unchanged guard
  // hold — it compares by IDENTITY, and a rebuilt array never matches.
  const r = await page.evaluate(async () => {
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    const data = [
      { label: 'Disk', value: 42, colorIndex: 1 },
      { label: 'CPU', value: 31, colorIndex: 2 },
      { label: 'Memory', value: 28, colorIndex: 3 },
    ];

    const mk = async (tag: string) => {
      const el = document.createElement(tag) as HTMLElement & {
        rendered?: Promise<void>; populate(d: unknown): void;
      };
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return el;
    };
    document.getElementById('root')!.replaceChildren();

    const bar = await mk('sherpa-barchart');
    const donut = await mk('sherpa-donut-chart');
    const legend = await mk('sherpa-chart-legend');

    // THE SAME ARRAY — no adapter, no copy, no per-component shape.
    bar.populate(data);
    donut.populate(data);
    legend.populate(data);
    await settle();

    const labels = (el: HTMLElement) =>
      Array.from(el.shadowRoot!.querySelectorAll('.legend-label, .label'))
        .map((x) => x.textContent?.trim())
        .filter(Boolean);

    return {
      bars: bar.shadowRoot!.querySelectorAll('.bar').length,
      slices: donut.shadowRoot!.querySelectorAll('path, .slice').length,
      legendLabels: labels(legend).slice(0, 3),
    };
  });

  expect(r.bars).toBe(3);
  expect(r.slices).toBeGreaterThan(0);
  // The legend names the same categories, with nothing reshaping them.
  expect(r.legendLabels).toEqual(['Disk', 'CPU', 'Memory']);
});

test('every stateful component exposes BOTH halves of its state', async ({ page }) => {
  // The sweep itself, as a standing guard. A getter with no setter is only a
  // problem when it holds a CHOICE — derived data (an unread count, rendered
  // code) is correctly read-only, and File objects cannot come back from JSON.
  const missing = await page.evaluate(async () => {
    const pairs: Array<[string, string]> = [
      ['sherpa-tabs', 'currentId'],
      ['sherpa-accordion', 'open'],
      ['sherpa-nav', 'state'],
      ['sherpa-nav', 'pinned'],
      ['sherpa-select-group', 'value'],
      ['sherpa-transfer-list', 'selected'],
      ['sherpa-barchart', 'hiddenBars'],
      ['sherpa-line-chart', 'hiddenSeries'],
      ['sherpa-input-text', 'value'],
    ];

    const out: string[] = [];
    for (const [tag, prop] of pairs) {
      await customElements.whenDefined(tag);
      const ctor = customElements.get(tag)!;
      // Walk the prototype chain — a base class may define it.
      let proto: object | null = ctor.prototype;
      let descriptor: PropertyDescriptor | undefined;
      while (proto && !descriptor) {
        descriptor = Object.getOwnPropertyDescriptor(proto, prop);
        proto = Object.getPrototypeOf(proto);
      }
      if (!descriptor?.get) out.push(`${tag}.${prop} — no getter`);
      else if (!descriptor.set) out.push(`${tag}.${prop} — READ ONLY`);
    }
    return out;
  });

  expect(missing).toEqual([]);
});
