import { test, expect } from '@playwright/test';

/**
 * Numeric attribute coercion — SherpaElement.num() / coerceNum().
 *
 * Every case here FAILED before the helper landed, because each component parsed
 * its own numbers and the four idioms in use disagreed:
 *
 *   Number('')         === 0   — an EMPTY attribute read as a real 0, so
 *                                data-max="" made a gauge read 0 instead of 100
 *                                and data-min="" pinned a chart's floor to 0.
 *   Number('' ?? 100)  === 0   — `??` only catches undefined, never ''.
 *   parseInt('0') || 1 === 1   — `||` folded a legitimate 0 in with absent.
 *   Number(null)       === 0   — an absent index read as row 0, so a row that
 *                                had lost its data-index acted on the FIRST one.
 *
 * An EMPTY attribute is the case that matters in practice: template engines emit
 * `data-max=""` freely for an unset value, and every one of these bugs is
 * reachable that way. The rule is one line: anything that is not a finite number
 * — absent, empty, whitespace, unparseable — is ABSENT. A real 0 is a value.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

/** Stamp one element with attributes, wait for it to settle, hand it back. */
async function build(page: import('@playwright/test').Page, tag: string, attrs: Record<string, string>) {
  return page.evaluate(
    async ([t, a]) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const el = document.createElement(t as string) as HTMLElement & { rendered?: Promise<void> };
      for (const [k, v] of Object.entries(a as Record<string, string>)) el.setAttribute(k, v);
      root.appendChild(el);
      await el.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return true;
    },
    [tag, attrs] as const,
  );
}

/* ── The gauge: data-max="" must read 100, not 0 ──────────────────────────── */

test('gauge: an EMPTY data-max falls back to 100, not 0', async ({ page }) => {
  // Half of 0..100 must put the needle straight up (0deg). Before the fix,
  // `Number('' ?? 100)` gave max=0, the fraction collapsed, and the needle
  // pinned hard left at -90deg.
  await build(page, 'sherpa-gauge-chart', { 'data-value': '50', 'data-max': '' });
  const angle = await page.evaluate(() =>
    getComputedStyle(document.querySelector('sherpa-gauge-chart')!).getPropertyValue('--_angle').trim(),
  );
  expect(angle).toBe('0deg');
});

test('gauge: an absent data-max behaves the same as an empty one', async ({ page }) => {
  await build(page, 'sherpa-gauge-chart', { 'data-value': '50' });
  const angle = await page.evaluate(() =>
    getComputedStyle(document.querySelector('sherpa-gauge-chart')!).getPropertyValue('--_angle').trim(),
  );
  expect(angle).toBe('0deg');
});

test('gauge: a REAL data-max is still honoured', async ({ page }) => {
  // 50 of 0..200 is a quarter turn: -90 + 0.25*180 = -45deg.
  await build(page, 'sherpa-gauge-chart', { 'data-value': '50', 'data-max': '200' });
  const angle = await page.evaluate(() =>
    getComputedStyle(document.querySelector('sherpa-gauge-chart')!).getPropertyValue('--_angle').trim(),
  );
  expect(angle).toBe('-45deg');
});

/* ── The charts: data-ticks="" must not mean "no axis" ────────────────────── */

for (const tag of ['sherpa-barchart', 'sherpa-line-chart'] as const) {
  test(`${tag}: an EMPTY data-ticks draws the DEFAULT axis, not an empty one`, async ({ page }) => {
    const ticks = await page.evaluate(async (t) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const el = document.createElement(t) as HTMLElement & {
        rendered?: Promise<void>;
        populate: (d: unknown) => void;
      };
      el.setAttribute('data-ticks', '');
      root.appendChild(el);
      await el.rendered;
      el.populate(
        t === 'sherpa-barchart'
          ? [{ label: 'a', value: 10 }, { label: 'b', value: 20 }]
          // The line chart takes { labels, series }, NOT a bare array — a bare
          // array renders nothing at all, which would pass this test for the
          // wrong reason.
          : { labels: ['a', 'b', 'c'], series: [{ label: 's', values: [10, 20, 30] }] },
      );
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return el.shadowRoot!.querySelectorAll('.y-axis > *').length;
    }, tag);
    // Before the fix `Number('')` was 0, so the axis rendered zero ticks and the
    // chart silently lost its scale.
    expect(ticks).toBeGreaterThan(0);
  });

  test(`${tag}: data-ticks="0" DOES mean no ticks — a real 0 is a value`, async ({ page }) => {
    const ticks = await page.evaluate(async (t) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const el = document.createElement(t) as HTMLElement & {
        rendered?: Promise<void>;
        populate: (d: unknown) => void;
      };
      el.setAttribute('data-ticks', '0');
      root.appendChild(el);
      await el.rendered;
      el.populate(
        t === 'sherpa-barchart'
          ? [{ label: 'a', value: 10 }, { label: 'b', value: 20 }]
          // The line chart takes { labels, series }, NOT a bare array — a bare
          // array renders nothing at all, which would pass this test for the
          // wrong reason.
          : { labels: ['a', 'b', 'c'], series: [{ label: 's', values: [10, 20, 30] }] },
      );
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return el.shadowRoot!.querySelectorAll('.y-axis > *').length;
    }, tag);
    expect(ticks).toBe(0);
  });
}

/* ── Pagination: a page size of 0 is not a page ───────────────────────────── */

test('pagination: data-page-size="0" falls back — a page of 0 rows is a divide-by-zero', async ({ page }) => {
  await build(page, 'sherpa-pagination', { 'data-page-size': '0' });
  const size = await page.evaluate(
    () => (document.querySelector('sherpa-pagination') as HTMLElement & { pageSize: number }).pageSize,
  );
  // Before the fix parseInt('0') was 0 and `!Number.isNaN(0)` let it through.
  expect(size).toBeGreaterThan(0);
});

test('pagination: an EMPTY data-page-size falls back to the default', async ({ page }) => {
  await build(page, 'sherpa-pagination', { 'data-page-size': '' });
  const size = await page.evaluate(
    () => (document.querySelector('sherpa-pagination') as HTMLElement & { pageSize: number }).pageSize,
  );
  expect(size).toBe(25);
});

test('pagination: a REAL data-page-size is honoured', async ({ page }) => {
  await build(page, 'sherpa-pagination', { 'data-page-size': '50' });
  const size = await page.evaluate(
    () => (document.querySelector('sherpa-pagination') as HTMLElement & { pageSize: number }).pageSize,
  );
  expect(size).toBe(50);
});

test('pagination: page clamps into 1..totalPages rather than trusting the attribute', async ({ page }) => {
  await build(page, 'sherpa-pagination', { 'data-page': '99', 'data-total-pages': '5' });
  const read = await page.evaluate(() => {
    const el = document.querySelector('sherpa-pagination') as HTMLElement & { page: number; totalPages: number };
    return { page: el.page, total: el.totalPages };
  });
  expect(read).toEqual({ page: 5, total: 5 });
});

/* ── The slider: a bound that is not a number is an author error ──────────── */

test('slider: an EMPTY max falls back to 100', async ({ page }) => {
  await build(page, 'sherpa-slider', { min: '0', max: '', value: '50' });
  const pct = await page.evaluate(() =>
    getComputedStyle(document.querySelector('sherpa-slider')!).getPropertyValue('--_pct').trim(),
  );
  expect(pct).toBe('50%');
});

test('slider: min="0" is a REAL zero, not an absence', async ({ page }) => {
  // The old parseFloat path read this correctly too; the point is that the
  // stricter num() has not broken it.
  await build(page, 'sherpa-slider', { min: '0', max: '200', value: '50' });
  const pct = await page.evaluate(() =>
    getComputedStyle(document.querySelector('sherpa-slider')!).getPropertyValue('--_pct').trim(),
  );
  expect(pct).toBe('25%');
});

/* ── The step tracker: a real 0 must select the FIRST step ────────────────── */

test('step tracker: data-current-step="0" marks the first step active', async ({ page }) => {
  const states = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-progress-step-tracker') as HTMLElement & {
      rendered?: Promise<void>;
      populate: (d: unknown) => void;
    };
    el.setAttribute('data-current-step', '0');
    root.appendChild(el);
    await el.rendered;
    el.populate([{ label: 'One' }, { label: 'Two' }, { label: 'Three' }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return [...el.shadowRoot!.querySelectorAll('.step')].map((s) => (s as HTMLElement).dataset['state']);
  });
  expect(states).toEqual(['active', 'todo', 'todo']);
});

/* ── The core rule, exercised directly ────────────────────────────────────── */

test('coerceNum: absent, empty and unparseable all mean ABSENT; a real 0 survives', async ({ page }) => {
  const got = await page.evaluate(async () => {
    const { coerceNum } = (await import('/dist/core/sherpa-element.js')) as unknown as {
      coerceNum: (raw: string | null | undefined, fb: number, o?: { min?: number; max?: number; int?: boolean }) => number;
    };
    return {
      absent: coerceNum(null, 100),
      undef: coerceNum(undefined, 100),
      empty: coerceNum('', 100),
      blank: coerceNum('   ', 100),
      junk: coerceNum('abc', 100),
      infinity: coerceNum('Infinity', 100),
      notANumber: coerceNum('NaN', 100),
      realZero: coerceNum('0', 1),
      negative: coerceNum('-3', 0),
      float: coerceNum('3.7', 0),
      truncated: coerceNum('3.7', 0, { int: true }),
      towardZero: coerceNum('-3.7', 0, { int: true }),
      clampedHigh: coerceNum('500', 1, { max: 100 }),
      clampedLow: coerceNum('-5', 1, { min: 0 }),
      // A FALLBACK is returned as given — its own bounds must not move it, or a
      // caller's chosen default would silently become something else.
      fallbackUnclamped: coerceNum('', 25, { min: 1, max: 10 }),
    };
  });
  expect(got).toEqual({
    absent: 100,
    undef: 100,
    empty: 100,
    blank: 100,
    junk: 100,
    infinity: 100,
    notANumber: 100,
    realZero: 0,
    negative: -3,
    float: 3.7,
    truncated: 3,
    towardZero: -3,
    clampedHigh: 100,
    clampedLow: 0,
    fallbackUnclamped: 25,
  });
});

/* ── Declared props: the guards that keep real behaviour ──────────────────── */

test('props: a FILLED slot inside the target wins over the attribute', async ({ page }) => {
  // sherpa-toast's .heading contains a <slot>. Writing the attribute text into it
  // would destroy whatever the consumer slotted, so skipWhen guards it.
  const text = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-toast') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-heading', 'from the attribute');
    el.textContent = 'from the slot';
    root.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return el.shadowRoot!.querySelector('.heading')!.textContent;
  });
  // The slot's assigned node is what shows; the attribute must not have overwritten it.
  expect(text).not.toContain('from the attribute');
});

test('props: an EMPTY slot is NOT a guard — the attribute still writes', async ({ page }) => {
  // The mirror case, and the reason the guard tests assignedNodes() rather than
  // just the presence of a <slot>: a slot in the template is the NORMAL state, so
  // treating it as a guard would stop data-heading working at all.
  const text = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-toast') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-heading', 'from the attribute');
    root.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return el.shadowRoot!.querySelector('.heading')!.textContent;
  });
  expect(text).toBe('from the attribute');
});

test('props: fallbackAttr is used when the primary attribute is absent', async ({ page }) => {
  // data-message is toast's legacy alias for data-heading.
  const got = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const read = async (attr: string, value: string) => {
      const el = document.createElement('sherpa-toast') as HTMLElement & { rendered?: Promise<void> };
      el.setAttribute(attr, value);
      root.appendChild(el);
      await el.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return el.shadowRoot!.querySelector('.heading')!.textContent;
    };
    return { alias: await read('data-message', 'legacy'), primary: await read('data-heading', 'current') };
  });
  expect(got).toEqual({ alias: 'legacy', primary: 'current' });
});

test('props: a declared prop re-syncs when the attribute changes', async ({ page }) => {
  const got = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-section-header') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-heading', 'first');
    root.appendChild(el);
    await el.rendered;
    const before = el.shadowRoot!.querySelector('.title')!.textContent;
    el.setAttribute('data-heading', 'second');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { before, after: el.shadowRoot!.querySelector('.title')!.textContent };
  });
  expect(got).toEqual({ before: 'first', after: 'second' });
});

test('props: `all` writes EVERY matching node, not just the first', async ({ page }) => {
  // sherpa-list-item repeats .title — once inside the <button>, once in the static
  // content span — so a first-match-only write would leave one of them blank.
  const titles = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-list-item') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-label', 'repeated');
    root.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return [...el.shadowRoot!.querySelectorAll('.title')].map((n) => n.textContent);
  });
  expect(titles.length).toBeGreaterThan(1);
  expect(titles.every((t) => t === 'repeated')).toBe(true);
});

/* ── Declared props: icon rendering ───────────────────────────────────────── */

/**
 * Font Awesome draws its glyph from a ::before on a CLASS. So an FA value has to
 * become classes, and a raw character has to become text. Getting that backwards
 * is SILENT — the class list simply prints as the literal string
 * "fa-solid fa-tag", which is what chip, tag, list-item and container-header all
 * did before `as: 'icon'`.
 */
for (const [tag, sel] of [
  ['sherpa-chip', '.glyph'],
  ['sherpa-tag', '.glyph'],
  ['sherpa-list-item', '.icon'],
  ['sherpa-container-header', '.icon'],
] as const) {
  test(`${tag}: an FA class list becomes CLASSES, never literal text`, async ({ page }) => {
    const got = await page.evaluate(
      async ([t, s]) => {
        const root = document.getElementById('root')!;
        root.innerHTML = '';
        const el = document.createElement(t) as HTMLElement & { rendered?: Promise<void> };
        el.setAttribute('data-icon', 'fa-solid fa-tag');
        root.appendChild(el);
        await el.rendered;
        await (window as unknown as { __settled: () => Promise<void> }).__settled();
        const icon = el.shadowRoot!.querySelector(s)!;
        return { text: icon.textContent, classes: [...icon.classList] };
      },
      [tag, sel] as const,
    );
    // The bug: the class list printed as text.
    expect(got.text).toBe('');
    expect(got.classes).toContain('fa-solid');
    expect(got.classes).toContain('fa-tag');
  });

  test(`${tag}: a RAW glyph character still renders as text`, async ({ page }) => {
    const got = await page.evaluate(
      async ([t, s]) => {
        const root = document.getElementById('root')!;
        root.innerHTML = '';
        const el = document.createElement(t) as HTMLElement & { rendered?: Promise<void> };
        el.setAttribute('data-icon', '+');
        root.appendChild(el);
        await el.rendered;
        await (window as unknown as { __settled: () => Promise<void> }).__settled();
        const icon = el.shadowRoot!.querySelector(s)!;
        return { text: icon.textContent, hasFa: [...icon.classList].some((c) => c.startsWith('fa-')) };
      },
      [tag, sel] as const,
    );
    expect(got).toEqual({ text: '+', hasFa: false });
  });
}

test('icon: swapping the value does not accumulate two icons', async ({ page }) => {
  const classes = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-icon', 'fa-solid fa-tag');
    root.appendChild(el);
    await el.rendered;
    el.setAttribute('data-icon', 'fa-solid fa-star');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return [...el.shadowRoot!.querySelector('.glyph')!.classList];
  });
  expect(classes).toContain('fa-star');
  // The old glyph must be GONE — two fa-* name classes would stack two ::before rules.
  expect(classes).not.toContain('fa-tag');
  // The structural class the template gave it must survive.
  expect(classes).toContain('glyph');
});

test('icon: the glyph actually RENDERS — a Pro-only icon would be zero-width', async ({ page }) => {
  // FA PRO icons fail SILENTLY on the free CDN: content resolves to `none` and the
  // element has zero width, with no warning. Probing a real shadow root is the only
  // way to catch it — a working glyph reports "" for content, so `none` is the test.
  const probe = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-tag') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-icon', 'fa-solid fa-tag');
    root.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    await document.fonts.ready;
    const glyph = el.shadowRoot!.querySelector('.glyph')!;
    return {
      content: getComputedStyle(glyph, '::before').content,
      width: glyph.getBoundingClientRect().width,
    };
  });
  expect(probe.content).not.toBe('none');
  expect(probe.width).toBeGreaterThan(0);
});
