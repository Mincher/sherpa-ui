import { test, expect } from './harness';

/** sherpa-chart-legend — rows from populate(); swatch colour by categorical index; click event. */


test('renders a row per item with label + value and categorical swatches', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { label: 'Revenue', value: '48k', colorIndex: 1 },
      { label: 'Cost', value: '12k', colorIndex: 5 },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const rows = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.item'));
    return {
      count: rows.length,
      firstLabel: rows[0]!.querySelector('.label')!.textContent,
      firstValue: rows[0]!.querySelector('.value')!.textContent,
      // Figma Legend Item swatch: a SOLID 1px ring in the series' BORDER token,
      // with a 60% tint of the series HUE as the fill.
      hue1: getComputedStyle(rows[0]!.querySelector('.swatch')!).getPropertyValue('--_hue').trim(),
      hue5: getComputedStyle(rows[1]!.querySelector('.swatch')!).getPropertyValue('--_hue').trim(),
      ring1: getComputedStyle(rows[0]!.querySelector('.swatch')!).borderTopColor,
      ring5: getComputedStyle(rows[1]!.querySelector('.swatch')!).borderTopColor,
      fill1: getComputedStyle(rows[0]!.querySelector('.swatch')!).backgroundColor,
    };
  });
  expect(r.count).toBe(2);
  expect(r.firstLabel).toBe('Revenue');
  expect(r.firstValue).toBe('48k');
  // colorIndex picks the series by POSITION. The RELATIONSHIPS are asserted, not
  // the hexes — the palette is a design decision and has changed twice.
  expect(r.hue1).not.toBe(r.hue5);
  // TRANSLUCENT, whatever syntax the token arrives in. It was `color-mix(… 50%)`
  // while the series were composed in CSS; Theme bakes the alpha into the hex
  // now, so the computed value is `rgba(…, .502)`. Asserting the SYNTAX made the
  // test a mirror of the token file rather than a check on the result.
  expect(r.hue1).toMatch(/(\b50%|0?\.5\d*\s*\)|\/\s*0?\.5)/);
  // Both must RESOLVE: an undefined custom property paints nothing, with no error.
  expect(r.ring1).not.toBe('rgb(0, 0, 0)');
  expect(r.ring5).not.toBe('rgb(0, 0, 0)');
  // Each series is outlined in its OWN sequence's border — colour 5 of the ramp
  // its fill comes from — so two different series have two different rings. They
  // briefly all shared one: the projector read the `border` leaf's PRIMARY mode
  // only, so every mark was outlined in purple whatever its fill.
  expect(r.ring1).not.toBe(r.ring5);
  // …and the ring is SOLID, where the fill is translucent.
  expect(r.ring1).not.toMatch(/\/ 0\./);
  // The TOKEN's 50%, not a component tint — the swatch adds none of its own.
  expect(r.fill1).toContain('0.5');
});

test('clicking an entry fires legend-item-click and toggles aria-pressed', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ label: 'A' }, { label: 'B' }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const detail: Array<{ index: number; active: boolean }> = [];
    el.addEventListener('legend-item-click', (e) =>
      detail.push((e as CustomEvent).detail as { index: number; active: boolean }),
    );

    // The entry IS the button now — the rebuilt Figma legend is a grid of
    // three-track entries, not an <li> wrapping a row.
    const entryB = el.shadowRoot!.querySelectorAll<HTMLElement>('.item')[1]!;
    const before = entryB.getAttribute('aria-pressed');
    entryB.click();
    // `.item` transitions colour over 100ms, so reading it in the same task
    // catches the START of the animation, not the target. Wait for the
    // transition rather than sleeping an arbitrary amount.
    await new Promise<void>((resolve) => {
      const done = (): void => resolve();
      entryB.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 300);
    });
    const off = {
      pressed: entryB.getAttribute('aria-pressed'),
      // Dimmed via the inactive content ink, never opacity.
      colour: getComputedStyle(entryB).color,
      swatchBg: getComputedStyle(entryB.querySelector('.swatch')!).backgroundColor,
    };
    entryB.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { before, off, backOn: entryB.getAttribute('aria-pressed'), detail };
  });

  // aria-pressed is BOTH the accessible state and the CSS hook, so they cannot
  // disagree — it replaced a data-current attribute that duplicated it.
  expect(r.before).toBe('true');
  expect(r.off.pressed).toBe('false');
  expect(r.backOn).toBe('true');

  // Toggled off dims the ink and empties the swatch, rather than using opacity.
  expect(r.off.colour).toBe('rgb(179, 179, 195)');
  expect(r.off.swatchBg).toBe('rgba(0, 0, 0, 0)');

  // The event carries the index AND the new state, which is what the page needs
  // to call the chart's setSeriesHidden / setSliceHidden.
  //
  // `indices` joined it when the legend gained its six-row cap: past six entries
  // the tail rolls into one "Other" row, so a single row can stand for SEVERAL
  // series and an index alone cannot describe what to hide. For an uncapped row it
  // is just [index].
  expect(r.detail).toEqual([
    { index: 1, indices: [1], label: 'B', active: false },
    { index: 1, indices: [1], label: 'B', active: true },
  ]);
});

test('a legend caps at six rows, rolling the tail into an Other total', async ({ page }) => {
  // Past six rows a legend stops being a key — nobody matches the eleventh shade
  // of purple to its label, and beside a chart it outgrows the chart.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;

    const read = () => ({
      rows: el.shadowRoot!.querySelectorAll('.item').length,
      labels: Array.from(el.shadowRoot!.querySelectorAll('.label')).map((l) => l.textContent),
      values: Array.from(el.shadowRoot!.querySelectorAll('.value')).map((v) => v.textContent),
    });

    // EXACTLY six: nothing is rolled up, because "Other" would name one category.
    el.populate(Array.from({ length: 6 }, (_, i) => ({ label: `C${i}`, value: i + 1 })));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const exact = read();

    // NINE: five named + Other = 6 + 7 + 8 + 9 = 30.
    el.populate(Array.from({ length: 9 }, (_, i) => ({ label: `C${i}`, value: i + 1 })));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const capped = read();

    let detail: { index: number; indices: number[] } | null = null;
    el.addEventListener('legend-item-click', (e) => {
      detail = (e as CustomEvent).detail;
    });
    el.shadowRoot!.querySelectorAll<HTMLElement>('.item')[5]!.click();

    // No numeric values at all → an "Other" row with NO value, rather than a
    // meaningless 0.
    el.populate(Array.from({ length: 9 }, (_, i) => ({ label: `C${i}` })));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const noValues = read();

    return { exact, capped, detail, noValues };
  });

  // Six is not capped — the roll-up must BUY something.
  expect(r.exact.rows).toBe(6);
  expect(r.exact.labels).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'C5']);

  // Nine becomes five named plus a total, and the numbers still add to the whole.
  expect(r.capped.rows).toBe(6);
  expect(r.capped.labels).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'Other']);
  expect(r.capped.values).toEqual(['1', '2', '3', '4', '5', '30']);

  // The Other row stands for EVERY rolled-up series, so toggling it hides them all.
  expect(r.detail?.index).toBe(5);
  expect(r.detail?.indices).toEqual([5, 6, 7, 8]);

  // Nothing to sum → no value, not a zero.
  expect(r.noValues.labels).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'Other']);
  expect(r.noValues.values).toEqual(['', '', '', '', '', '']);
});

test('entries share three grid tracks, so labels and values align', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // Deliberately RAGGED label lengths — with one flex row per entry the values
    // would each sit wherever their own label ended.
    el.populate!([
      { label: 'A', value: '1.5K' },
      { label: 'A much longer category name', value: '22' },
      { label: 'Mid length', value: '333' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const legend = getComputedStyle(sr.querySelector('.legend')!);
    const entries = Array.from(sr.querySelectorAll<HTMLElement>('.item'));
    const cells = (sel: string): number[] =>
      entries.map((e) => Math.round(e.querySelector(sel)!.getBoundingClientRect().left));
    return {
      display: legend.display,
      columnGap: legend.columnGap,
      rowGap: legend.rowGap,
      padding: legend.paddingTop,
      // Figma: content/size/xs 10 on line-height/xs 16.
      fontSize: getComputedStyle(entries[0]!).fontSize,
      lineHeight: getComputedStyle(entries[0]!).lineHeight,
      swatchLefts: cells('.swatch'),
      labelLefts: cells('.label'),
      valueRights: entries.map((e) =>
        Math.round(e.querySelector('.value')!.getBoundingClientRect().right),
      ),
      swatchBox: (() => {
        const b = entries[0]!.querySelector('.swatch')!.getBoundingClientRect();
        return `${Math.round(b.width)}x${Math.round(b.height)}`;
      })(),
    };
  });

  expect(r.display).toBe('grid');
  // Figma: column gap space/xs 8, row gap space/2xs 4, padding space/xs 8.
  expect(r.columnGap).toBe('8px');
  expect(r.rowGap).toBe('4px');
  expect(r.padding).toBe('8px');
  // content/size/SMALL 12, read from the Figma node's own bound variable
  // (Chart Legend 1099:37879 — every Category and value text binds
  // content/size/small). It was size/xs 10 here.
  expect(r.fontSize).toBe('12px');
  expect(r.lineHeight).toBe('16px');
  // Figma "Legend Swatch": 12×12.
  expect(r.swatchBox).toBe('12x12');

  // THE POINT OF THE GRID: one shared set of tracks, so every column lines up
  // despite the ragged labels.
  expect(new Set(r.swatchLefts).size).toBe(1);
  expect(new Set(r.labelLefts).size).toBe(1);
  expect(new Set(r.valueRights).size).toBe(1);
});

test('the Other row carries a breakdown menu that commits on Apply', async ({ page }) => {
  // The roll-up row needs a SECOND control, so it cannot reuse the entry
  // prototype — that is a <button>, and a menu button nested inside a button is
  // invalid HTML. The row is a wrapper holding two siblings.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    // Nine categories → five named + Other covering indices 5..8.
    el.populate(Array.from({ length: 9 }, (_, i) => ({ label: `C${i}`, value: i + 1 })));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const rollup = sr.querySelector<HTMLElement>('.rollup')!;
    const toggle = rollup.querySelector<HTMLElement>('.rollup-toggle')!;
    const button = rollup.querySelector<HTMLElement>('.rollup-menu-btn')!;
    const menu = rollup.querySelector<HTMLElement & { toggle?: (t?: HTMLElement) => void }>(
      '.rollup-menu',
    )!;

    const structure = {
      // The toggle is a real button; the menu control is its SIBLING, not a child.
      toggleTag: toggle.tagName,
      buttonIsSibling: button.parentElement === rollup,
      buttonNotInToggle: !toggle.contains(button),
      size: button.getAttribute('data-size'),
      // The menu DEFERS: rows are a draft until Apply, so several can be ticked
      // without it closing after each click.
      commits: menu.hasAttribute('data-commit'),
      // One CHECKBOX row per folded category, each valued by its SOURCE index.
      rows: Array.from(menu.querySelectorAll<HTMLInputElement>('input')).map((i) => ({
        type: i.type,
        value: i.value,
        checked: i.checked,
      })),
      labels: Array.from(menu.querySelectorAll('.rollup-row-label')).map((l) => l.textContent),
    };

    // Untick two, and confirm the menu is STILL open — the whole point of the
    // committing footer.
    const boxes = Array.from(menu.querySelectorAll<HTMLInputElement>('input'));
    menu.toggle?.(button);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const openedBy = button.getAttribute('aria-expanded');
    for (const b of [boxes[0]!, boxes[2]!]) {
      b.checked = false;
      b.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const stillOpen = menu.shadowRoot!.querySelector('.menu')!.matches(':popover-open');

    let detail: { active: number[]; hidden: number[] } | null = null;
    el.addEventListener('legend-breakdown-change', (e) => {
      detail = (e as CustomEvent).detail;
    });
    (menu.shadowRoot!.querySelector('.apply') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return { structure, openedBy, stillOpen, detail };
  });

  expect(r.structure.toggleTag).toBe('BUTTON');
  expect(r.structure.buttonIsSibling).toBe(true);
  expect(r.structure.buttonNotInToggle).toBe(true);
  expect(r.structure.size).toBe('xs');
  expect(r.structure.commits).toBe(true);

  // Three folded categories, all on to begin with, valued by SOURCE index so a
  // chart can be told which series to hide without a second lookup.
  expect(r.structure.labels).toEqual(['C5', 'C6', 'C7', 'C8']);
  expect(r.structure.rows).toEqual([
    { type: 'checkbox', value: '5', checked: true },
    { type: 'checkbox', value: '6', checked: true },
    { type: 'checkbox', value: '7', checked: true },
    { type: 'checkbox', value: '8', checked: true },
  ]);

  expect(r.openedBy).toBe('true');
  // Ticking does NOT close it — that is what data-commit buys.
  expect(r.stillOpen).toBe(true);

  // Apply reports BOTH lists, so a chart applies the edit in one pass.
  expect(r.detail?.active).toEqual([6, 8]);
  expect(r.detail?.hidden).toEqual([5, 7]);
});

test('label and value carry two inks, and BOTH grey when the entry is off', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ label: 'Disk', value: 42 }, { label: 'CPU', value: 31 }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const item = el.shadowRoot!.querySelector('.item') as HTMLElement;
    const grab = () => ({
      label: getComputedStyle(item.querySelector('.label')!).color,
      value: getComputedStyle(item.querySelector('.value')!).color,
    });
    const on = grab();
    item.click();
    // The row fades its colour over 100ms, so a shorter wait samples the middle
    // of the transition and reads an in-between grey.
    await new Promise((res) => setTimeout(res, 250));
    return { on, off: grab() };
  });

  // TWO INKS while on. Read from the Figma node's bindings (Chart Legend
  // 1099:37879): the Category text binds content/body/+1 (#35353D) and the value
  // text binds content/body/base (#0C0B11), so the number reads as the fact and
  // the name as its caption.
  expect(r.on.label).toBe('rgb(53, 53, 61)');
  expect(r.on.value).toBe('rgb(12, 11, 17)');
  expect(r.on.label).not.toBe(r.on.value);

  // OFF greys BOTH. The value's own darker ink beat the row's dimmed colour, so a
  // switched-off entry kept a fully dark number beside a greyed-out name and read
  // as still active.
  expect(r.off.label).toBe('rgb(179, 179, 195)');
  expect(r.off.value).toBe('rgb(179, 179, 195)');
});

/**
 * The off-set is the legend's PUBLIC state, and it survives a re-populate.
 *
 * A source pushes new rows on every filter change. Before this the render
 * wrote no aria-pressed at all, so each push silently cleared every toggle —
 * and nothing outside could set them, so a chip over the same field had no way
 * to push back.
 *
 * TRAP T-a-legend-remembers-its-off-set-by-label
 */
test('the off-set is kept BY LABEL, and survives a re-populate', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>; populate?: (d: unknown) => void; off: string[];
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const settle = (window as unknown as { __settled: () => Promise<void> }).__settled;

    el.populate!([
      { label: 'active', value: 24, colorIndex: 1 },
      { label: 'trial', value: 25, colorIndex: 2 },
      { label: 'churned', value: 25, colorIndex: 3 },
    ]);
    await settle();

    const rows = () => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.item'));
    const pressed = () => rows().map((x) => x.getAttribute('aria-pressed'));

    rows()[2]!.click();                       // churned off
    await settle();
    const afterClick = { off: [...el.off], pressed: pressed() };

    /* A FILTER re-populate: `active` is gone and every index shifts. An
       index-keyed off-set would now dim the wrong row. */
    el.populate!([
      { label: 'trial', value: 25, colorIndex: 2 },
      { label: 'churned', value: 0, colorIndex: 3 },
    ]);
    await settle();
    const afterRepopulate = { off: [...el.off], pressed: pressed(),
      labels: rows().map((x) => x.querySelector('.label')!.textContent) };

    // Set from OUTSIDE — the door a chip over the same field needs.
    el.off = ['trial'];
    await settle();
    const afterSet = { off: [...el.off], pressed: pressed() };

    return { afterClick, afterRepopulate, afterSet };
  });

  expect(r.afterClick).toEqual({ off: ['churned'], pressed: ['true', 'true', 'false'] });

  // churned is still the OFF one, though it is now index 1 rather than 2.
  expect(r.afterRepopulate.labels).toEqual(['trial', 'churned']);
  expect(r.afterRepopulate).toMatchObject({
    off: ['churned'], pressed: ['true', 'false'],
  });

  expect(r.afterSet).toEqual({ off: ['trial'], pressed: ['false', 'true'] });
});

/**
 * "Other" is a value of nothing. A roll-up row must record the categories it
 * FOLDED, or a caller filtering on the off-set dims the row and narrows
 * nothing — which is exactly what happened on the dashboard.
 * TRAP T-a-legend-remembers-its-off-set-by-label
 */
test('a ROLL-UP row records the real labels it folded, not "Other"', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>; populate?: (d: unknown) => void; off: string[];
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const settle = (window as unknown as { __settled: () => Promise<void> }).__settled;

    // Seven rows: the legend caps at six and folds the tail into "Other".
    el.populate!(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((label, i) => ({
      label, value: i, colorIndex: i + 1,
    })));
    await settle();

    const other = el.shadowRoot!.querySelector<HTMLElement>('.rollup-toggle');
    const label = other?.querySelector('.label')?.textContent;
    other?.click();
    await settle();
    return { label, off: [...el.off].sort() };
  });

  expect(r.label).toBe('Other');
  // NOT ['Other'] — those names are what a filter can act on.
  expect(r.off).toEqual(['f', 'g']);
});

/**
 * OFF IS A STATE, NOT A DELETE — the twin of a filter chip, which keeps its
 * value when switched off.
 *
 * A bound legend writes a filter, so the next push omits the rows it excluded
 * and `countBy` drops that category entirely. The row vanished, and a row that
 * is gone cannot be switched back on.
 * TRAP T-a-suspended-legend-row-keeps-its-place
 */
test('a SUSPENDED row stays, at the value it last held', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>; populate?: (d: unknown) => void; off: string[];
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const settle = (window as unknown as { __settled: () => Promise<void> }).__settled;
    const read = () => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.item')).map(
      (x) => `${x.querySelector('.label')!.textContent}=${x.querySelector('.value')!.textContent}` +
             `[${x.getAttribute('aria-pressed')}]`);

    el.populate!([
      { label: 'active', value: 24, colorIndex: 1 },
      { label: 'trial', value: 25, colorIndex: 2 },
      { label: 'churned', value: 25, colorIndex: 3 },
    ]);
    await settle();
    const start = read();

    // Switch `churned` off, then push what the SOURCE would now send: the
    // category is filtered out, so it is simply absent.
    el.shadowRoot!.querySelectorAll<HTMLElement>('.item')[2]!.click();
    await settle();
    el.populate!([
      { label: 'active', value: 24, colorIndex: 1 },
      { label: 'trial', value: 25, colorIndex: 2 },
    ]);
    await settle();
    const suspended = read();

    // Back ON, and the source sends it again.
    el.shadowRoot!.querySelectorAll<HTMLElement>('.item')[2]!.click();
    await settle();
    el.populate!([
      { label: 'active', value: 24, colorIndex: 1 },
      { label: 'trial', value: 25, colorIndex: 2 },
      { label: 'churned', value: 25, colorIndex: 3 },
    ]);
    await settle();
    return { start, suspended, resumed: read(), off: [...el.off] };
  });

  expect(r.start).toEqual(['active=24[true]', 'trial=25[true]', 'churned=25[true]']);
  // STILL THERE, still 25, and in its own place — not appended at the end.
  expect(r.suspended).toEqual(['active=24[true]', 'trial=25[true]', 'churned=25[false]']);
  expect(r.resumed).toEqual(['active=24[true]', 'trial=25[true]', 'churned=25[true]']);
  expect(r.off).toEqual([]);
});
