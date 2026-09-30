import { test, expect } from '@playwright/test';

/**
 * sherpa-metric on the reforged base — a KPI tile. Proves the label/value/delta
 * text render (from populate() and from data-* attributes), the trend colouring
 * of the delta (success for up, critical for down) driven purely by data-trend,
 * and the embedded sparkline being fed + revealed only when values are supplied.
 */

const HARNESS = '/test/reforged/harness.html';

type MetricEl = HTMLElement & {
  rendered?: Promise<void>;
  populate?: (d: unknown) => void;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() =>
    Promise.all([
      customElements.whenDefined('sherpa-metric'),
      customElements.whenDefined('sherpa-sparkline'),
    ]),
  );
});

test('populate() renders label, value, delta and derives an up trend', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-metric') as MetricEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.populate!({ name: 'Revenue', value: '$1.2M', deltaPercent: 12.5 });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const text = (sel: string) => el.shadowRoot!.querySelector(sel)!.textContent;
    // The name is its composed HEADER's title (Figma's Metric, TODO 9b).
    const title = () => el.shadowRoot!.querySelector('.head')!.shadowRoot!.querySelector('.title')!.textContent;
    return {
      label: title(),
      value: text('.value'),
      delta: text('.delta'),
      trend: el.getAttribute('data-trend'),
      deltaColor: getComputedStyle(el.shadowRoot!.querySelector('.trend')!).color,
    };
  });
  expect(r.label).toBe('Revenue');
  expect(r.value).toBe('$1.2M');
  expect(r.delta).toBe('+12.5%'); // derived from deltaPercent
  expect(r.trend).toBe('up');
  expect(r.deltaColor).toBe('rgb(0, 173, 98)'); // theme-content-success-1 #00AD62 (readable up-trend ink)
});

test('a down trend colours the delta critical', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-metric') as MetricEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ name: 'Churn', value: '3.1%', deltaPercent: -4 });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      trend: el.getAttribute('data-trend'),
      delta: el.shadowRoot!.querySelector('.delta')!.textContent,
      color: getComputedStyle(el.shadowRoot!.querySelector('.trend')!).color,
      upArrow: getComputedStyle(el.shadowRoot!.querySelector('.arrow-up')!).display,
      downArrow: getComputedStyle(el.shadowRoot!.querySelector('.arrow-down')!).display,
    };
  });
  expect(r.trend).toBe('down');
  expect(r.delta).toBe('-4%');
  expect(r.color).toBe('rgb(183, 34, 0)'); // theme-content-critical-1 #B72200 (readable down-trend ink)
  expect(r.upArrow).toBe('none');
  expect(r.downArrow).not.toBe('none'); // down arrow revealed
});

test('attribute-only usage renders text without populate()', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-metric') as MetricEl;
    el.setAttribute('data-label', 'Users');
    el.setAttribute('data-value', '48,201');
    el.setAttribute('data-delta', '+2.0%');
    el.setAttribute('data-trend', 'up');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const text = (sel: string) => el.shadowRoot!.querySelector(sel)!.textContent;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const label = el.shadowRoot!.querySelector('.head')!.shadowRoot!.querySelector('.title')!.textContent;
    return { label, value: text('.value'), delta: text('.delta') };
  });
  expect(r.label).toBe('Users');
  expect(r.value).toBe('48,201');
  expect(r.delta).toBe('+2.0%');
});

test('values feed and reveal the embedded sparkline', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-metric') as MetricEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.populate!({ name: 'Sessions', value: '9,340', deltaPercent: 6, values: [4, 6, 5, 9] });

    // The embedded sparkline bootstraps asynchronously; wait for its first render
    // (and a tick for the deferred populate) before reading its geometry bridge.
    const spark = el.shadowRoot!.querySelector('sherpa-sparkline') as HTMLElement & {
      rendered?: Promise<void>;
    };
    await spark.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return {
      hasValuesAttr: el.hasAttribute('data-has-values'),
      sparkVisible: getComputedStyle(el.shadowRoot!.querySelector('.spark')!).display !== 'none',
      // the sparkline received the series → its geometry bridge is populated
      sparkV0: spark.style.getPropertyValue('--_v0').trim(),
      sparkV3: spark.style.getPropertyValue('--_v3').trim(),
    };
  });
  expect(r.hasValuesAttr).toBe(true);
  expect(r.sparkVisible).toBe(true);
  expect(r.sparkV0).toBe('4');
  expect(r.sparkV3).toBe('9');
});

test('no values → the sparkline region stays hidden', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-metric') as MetricEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ name: 'Flat', value: '7' });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      hasValuesAttr: el.hasAttribute('data-has-values'),
      sparkHidden: getComputedStyle(el.shadowRoot!.querySelector('.spark')!).display === 'none',
    };
  });
  expect(r.hasValuesAttr).toBe(false);
  expect(r.sparkHidden).toBe(true);
});

test('status is derived from the trend, and the card stays white with no border', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const build = async (data: unknown): Promise<Record<string, unknown>> => {
      const el = document.createElement('sherpa-metric') as HTMLElement & {
        rendered?: Promise<void>; populate(d: unknown): void;
      };
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;
      el.populate(data);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const row = el.shadowRoot!.querySelector('.row')!;
      const rs = getComputedStyle(row);
      return {
        trend: el.getAttribute('data-trend'),
        status: el.getAttribute('data-status'),
        // The HOST carries the surface; the card is fill-none over it.
        bg: getComputedStyle(el).backgroundColor,
        borderWidth: rs.borderTopWidth,
        deltaColour: getComputedStyle(el.shadowRoot!.querySelector('.delta')!).color,
      };
    };
    return {
      up: await build({ name: 'A', value: '1', deltaPercent: 3.1, values: [1, 2, 3] }),
      down: await build({ name: 'B', value: '2', deltaPercent: -12.5, values: [3, 2, 1] }),
      flat: await build({ name: 'C', value: '3', deltaPercent: 0, values: [2, 2, 2] }),
      none: await build({ name: 'D', value: '4', values: [1, 2, 3] }),
    };
  });

  // Will's rule: status IS the trend. Success if positive, critical if negative,
  // and NO status for a flat trend or a raw data point with no trend at all —
  // "default" means the attribute is absent, since the --_status-* cascade only
  // emits for a named status.
  expect(r.up['trend']).toBe('up');
  expect(r.up['status']).toBe('success');
  expect(r.down['trend']).toBe('down');
  expect(r.down['status']).toBe('critical');
  expect(r.flat['trend']).toBe('flat');
  expect(r.flat['status']).toBeNull();
  expect(r.none['status']).toBeNull();

  // The HOST binds Style::style-surface/base, which is WHITE in every status mode
  // — the status shows in the INK and the shadow, not the surface. And Figma's
  // card is STROKE NONE, so there is no border on any of them.
  for (const [name, got] of Object.entries(r)) {
    expect(got['bg'], `${name} background`).toBe('rgb(255, 255, 255)');
    expect(got['borderWidth'], `${name} border`).toBe('0px');
  }

  // …but the delta ink DOES follow the status.
  expect(r.up['deltaColour']).not.toBe(r.down['deltaColour']);
});

test('a [data-status] ancestor does NOT recolour the label or the value', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const read = async (status: string | null) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const box = document.createElement('div');
      if (status) box.setAttribute('data-status', status);
      const el = document.createElement('sherpa-metric') as HTMLElement & {
        rendered?: Promise<void>;
        populate(d: unknown): void;
      };
      box.appendChild(el);
      root.appendChild(box);
      await el.rendered;
      el.populate({ label: 'Active endpoints', value: '1,284', deltaPercent: 3.1 });
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const sr = el.shadowRoot!;
      return {
        label: getComputedStyle(sr.querySelector('.head')!.shadowRoot!.querySelector('.title')!).color,
        value: getComputedStyle(sr.querySelector('.value')!).color,
      };
    };
    return { none: await read(null), success: await read('success'), critical: await read('critical') };
  });

  // Read from the Figma node (Metric 61:263): the label binds content/body/+1 and
  // the value binds content/body/BASE — plain Theme tokens with no status in them.
  // Only the DELTA binds style-content/base, which follows the status cascade.
  //
  // Reading --_status-text first turned the whole reading green or red, which said
  // "this number is a success" when the status belongs to the CHANGE: 1,284
  // endpoints is neither good nor bad, and +3.1% is the part carrying a verdict.
  expect(r.none.value).toBe('rgb(12, 11, 17)');
  expect(r.none.label).toBe('rgb(53, 53, 61)');
  expect(r.success).toEqual(r.none);
  expect(r.critical).toEqual(r.none);
});

/**
 * `label` is the word — and `name` still works.
 *
 * Surveyed across the 22 components with a `renderData`: `label` appears in 7
 * of the 13 named shapes, `value` in 4, `description` in 3. Two components
 * deviated, and both TRANSLATED their own vocabulary in the single line where
 * the two spellings met — this one wrote `data.name` into `dataset['label']`.
 *
 * A component's two doors, its attributes and its populate payload, should not
 * use two words for one idea.
 */
test('populate takes label, and the old `name` still works', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const read = async (payload: unknown) => {
      const el = document.createElement('sherpa-metric') as HTMLElement & {
        rendered?: Promise<void>; populate(d: unknown): void;
      };
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;
      el.populate(payload);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return {
        attr: el.dataset['label'] ?? null,
        text: (el.shadowRoot?.querySelector('.head')?.shadowRoot?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      };
    };

    return {
      byLabel: await read({ label: 'Open alerts', value: '37' }),
      byName: await read({ name: 'Open alerts', value: '37' }),
      // BOTH given: `label` wins, because it is the word.
      both: await read({ label: 'Wins', name: 'Loses', value: '1' }),
    };
  });

  expect(r.byLabel.attr).toBe('Open alerts');
  expect(r.byLabel.text).toContain('Open alerts');
  expect(r.byName.attr, 'the old spelling is still honoured').toBe('Open alerts');
  expect(r.both.attr).toBe('Wins');
});

/**
 * A TOTAL SAYS SO IN ITS LABEL.
 *
 * A tile takes a series, so it can show the LAST reading (a current state) or
 * the SUM (things that accumulate). Two tiles reading "Alerts 1,284" and
 * "Alerts 37" are indistinguishable, so a total prefixes its own label.
 *
 * TRAP T-a-total-says-so-in-its-label
 */
test('show: last | total picks the number, and a total names itself', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const one = async (data: unknown) => {
      const el = document.createElement('sherpa-metric') as HTMLElement & {
        rendered?: Promise<void>; populate?: (d: unknown) => void;
      };
      document.getElementById('root')!.append(el);
      await customElements.whenDefined('sherpa-metric');
      await el.rendered;
      el.populate!(data);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return { label: el.dataset['label'], value: el.dataset['value'] };
    };

    const values = [10, 20, 30, 40];
    return {
      // No `show`: the LAST reading, which is what a current-state tile means.
      fallback: await one({ label: 'Alerts', values }),
      last: await one({ label: 'Alerts', values, show: 'last' }),
      total: await one({ label: 'Alerts', values, show: 'total' }),
      // A label that already says Total is not doubled.
      already: await one({ label: 'Total spend', values, show: 'total' }),
      // An explicit value is the CALLER's — deriving over it would disagree.
      explicit: await one({ label: 'Alerts', value: '999', values, show: 'total' }),
      // A total runs large, so it is grouped.
      grouped: await one({ label: 'Spend', values: [1000, 2500, 900], show: 'total' }),
    };
  });

  expect(r.fallback).toEqual({ label: 'Alerts', value: '40' });
  expect(r.last).toEqual({ label: 'Alerts', value: '40' });
  expect(r.total).toEqual({ label: 'Total alerts', value: '100' });
  expect(r.already).toEqual({ label: 'Total spend', value: '100' });
  expect(r.explicit).toEqual({ label: 'Total alerts', value: '999' });
  expect(r.grouped).toEqual({ label: 'Total spend', value: '4,400' });
});

/**
 * IT CONDENSES BY WRAPPING.
 *
 * The card wraps and clips, and the sparkline carries a 120px floor. Below its
 * own content width the sparkline drops to a second line and is cut off,
 * leaving value and trend — no breakpoint is named anywhere.
 *
 * TRAP T-a-metric-condenses-by-wrapping
 */
test('the sparkline condenses away, and the tile keeps its height', async ({ page }) => {
  const rows = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const out: { w: number; tileH: number; sparkVisible: boolean; valueH: number }[] = [];
    for (const w of [440, 320, 280, 240, 160, 120]) {
      root.innerHTML = '<div style="width:' + w + 'px"><sherpa-metric></sherpa-metric></div>';
      const el = root.querySelector('sherpa-metric') as HTMLElement & {
        rendered?: Promise<void>; populate?: (d: unknown) => void;
      };
      await el.rendered;
      // A value far longer than any tile, to prove it ellipses rather than wraps.
      el.populate?.({
        label: 'Total spend', value: '$1,284,000,000',
        deltaPercent: 12.5, values: [3, 5, 4, 8, 6, 9, 7, 11],
      });
      await new Promise((r) => setTimeout(r, 120));
      const sr = el.shadowRoot!;
      const card = sr.querySelector('.row')!.getBoundingClientRect();
      const spark = sr.querySelector('.spark')!.getBoundingClientRect();
      out.push({
        w,
        tileH: Math.round(el.getBoundingClientRect().height),
        // Still on the first line, so inside the clip.
        sparkVisible: spark.top < card.bottom - 1 && spark.width > 0,
        valueH: Math.round(sr.querySelector('.value')!.getBoundingClientRect().height),
      });
    }
    return out;
  });

  /* 304px is the arithmetic, not a guess: 16 host padding + 160 figures + 8 gap
     + the sparkline's own 120 floor. Above it the sparkline is drawn. */
  const shown = rows.filter((r) => r.sparkVisible).map((r) => r.w);
  expect(shown, 'drawn above 304, wrapped away below').toEqual([440, 320]);

  // ONE height and ONE value line at every width — the wrap costs nothing.
  expect(new Set(rows.map((r) => r.tileH)).size, JSON.stringify(rows)).toBe(1);
  expect(new Set(rows.map((r) => r.valueH)).size, 'the value never wraps').toBe(1);
});

/**
 * Figma binds BOTH a fill and a stroke on the Metric frame — `style-surface/base`
 * over `style-border/base`, 0.5px INSIDE, per-corner rounding. Only the fill was
 * coded, so every tile floated with no edge.
 */
test('the tile draws its Figma fill AND its border', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-metric') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-label', 'Endpoints');
    el.setAttribute('data-value', '1,284');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const cs = getComputedStyle(el);
    return {
      background: cs.backgroundColor,
      borderStyle: cs.borderTopStyle,
      borderColor: cs.borderTopColor,
      // All four corners rounded, as Figma binds each one.
      radii: [cs.borderTopLeftRadius, cs.borderTopRightRadius,
              cs.borderBottomRightRadius, cs.borderBottomLeftRadius],
      // Every edge carries a width — none is zeroed by default.
      widths: [cs.borderTopWidth, cs.borderRightWidth,
               cs.borderBottomWidth, cs.borderLeftWidth],
    };
  });

  expect(r.background).toBe('rgb(255, 255, 255)');
  expect(r.borderStyle).toBe('solid');
  // style-border/base.
  expect(r.borderColor).toBe('rgb(179, 179, 195)');
  expect(r.radii).toEqual(['4px', '4px', '4px', '4px']);
  /* NOT asserted as 0.5px: getComputedStyle returns the USED value and every
     engine rounds a sub-pixel border up to one device pixel.
     TRAP T-a-sub-pixel-border-reads-back-as-1px */
  for (const w of r.widths) expect(parseFloat(w)).toBeGreaterThan(0);
});

/**
 * A tile's TREND is derived from its series, so it must follow the data layer —
 * a filter that moves the value moves the trend, the delta and the status with
 * it. Reported as broken; measured here end to end against a real DataSource.
 * TRAP T-a-delta-is-derived-not-declared
 */
test('the trend, delta and status all follow a filter', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource, seriesBy, deltaPercent } = await import(
      '/dist/data.js'
    ) as typeof import('../../src/data.js');

    /* Two regions with OPPOSITE shapes over twelve months: EMEA climbs 1..12,
       AMER falls 12..1. Together they are flat, so each filter must flip the
       trend rather than merely rescale it. */
    const rows: Record<string, unknown>[] = [];
    for (let m = 1; m <= 12; m++) {
      const mm = `2024-${String(m).padStart(2, '0')}`;
      for (let i = 0; i < m; i++) rows.push({ id: `e${mm}${i}`, created: `${mm}-01`, region: 'EMEA' });
      for (let i = 0; i < 13 - m; i++) rows.push({ id: `a${mm}${i}`, created: `${mm}-01`, region: 'AMER' });
    }

    const src = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
    await src.ready;
    src.declareValues('region', ['EMEA', 'AMER']);

    const el = document.createElement('sherpa-metric') as HTMLElement & {
      rendered?: Promise<void>;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;

    const MONTHS = Array.from({ length: 12 }, (_, i) => `2024-${String(i + 1).padStart(2, '0')}`);
    src.bind(el, {
      readonly: true,
      // A summary counts ALL the rows, never the page.
      rows: 'all',
      as: (rs: Record<string, unknown>[]) => {
        const withMonth = rs.map((x) => ({ ...x, month: String(x['created']).slice(0, 7) }));
        const values = seriesBy(withMonth, 'month', MONTHS, 'series', { kind: 'count' }).values;
        return { label: 'Rows', value: rs.length, values,
                 deltaPercent: deltaPercent(values) ?? undefined };
      },
    });

    const settle = (): Promise<void> => new Promise((res) => { setTimeout(res, 250); });
    await settle();
    const snap = (): Record<string, string | undefined> => ({
      value: el.shadowRoot!.querySelector('.value')?.textContent?.trim(),
      trend: el.dataset['trend'],
      delta: el.dataset['delta'],
      status: el.dataset['status'],
    });

    const all = snap();
    src.select('region', ['EMEA']);
    await settle();
    const emea = snap();
    src.select('region', ['AMER']);
    await settle();
    const amer = snap();
    return { all, emea, amer };
  });

  // Both shapes together cancel out.
  expect(r.all.value).toBe('156');
  expect(r.all.trend).toBe('flat');

  // The RISING half: same row count, opposite trend.
  expect(r.emea.value).toBe('78');
  expect(r.emea.trend).toBe('up');
  expect(r.emea.status).toBe('success');
  expect(r.emea.delta?.startsWith('+')).toBe(true);

  // The FALLING half — and this is the point: the value is identical, so only a
  // trend that followed the DATA could tell the two apart.
  expect(r.amer.value).toBe('78');
  expect(r.amer.trend).toBe('down');
  expect(r.amer.status).toBe('critical');
  expect(r.amer.delta?.startsWith('-')).toBe(true);
});

/* TODO 9b: Figma's Metric (61:263) composes the Data Viz Header — its name,
   an optional icon, and no rule under it. It still fits one layout row. */
test('a metric\'s name is its composed Data Viz Header, with no rule, in one layout row', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-metric') as MetricEl;
    el.setAttribute('data-label', 'Seats');
    el.setAttribute('data-icon', 'users');
    el.setAttribute('data-value', '12,308');
    el.setAttribute('data-delta', '+2%');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const head = el.shadowRoot!.querySelector<HTMLElement>('.head')!;
    const before = { tag: head.localName, heading: head.dataset['heading'], icon: head.dataset['icon'],
      rule: getComputedStyle(head).boxShadow };
    el.removeAttribute('data-icon');
    el.setAttribute('data-label', 'Seats sold');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const tile = el.getBoundingClientRect();
    const trend = el.shadowRoot!.querySelector('.trend')!.getBoundingClientRect();
    return { before, after: { heading: head.dataset['heading'], icon: head.dataset['icon'] ?? null },
      fits: trend.bottom <= tile.bottom };
  });
  expect(r.before).toEqual({ tag: 'sherpa-data-viz-header', heading: 'Seats', icon: 'users', rule: 'none' });
  expect(r.after).toEqual({ heading: 'Seats sold', icon: null });
  expect(r.fits).toBe(true);
});
