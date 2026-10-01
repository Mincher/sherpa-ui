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
  // 50% however it is written — the minifier makes a colour-mix `#rrggbb80`.
  expect(r.hue1).toMatch(/(\b50%|0?\.5\d*\s*\)|\/\s*0?\.5|#[0-9a-f]{6}80\b)/i);
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

  // The event carries the index AND the new state.
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
  // The label COUNTS what it folded — four of nine, here.
  expect(r.capped.labels).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'Other (4)']);
  expect(r.capped.values).toEqual(['1', '2', '3', '4', '5', '30']);

  // The Other row stands for EVERY rolled-up series, so toggling it hides them all.
  expect(r.detail?.index).toBe(5);
  expect(r.detail?.indices).toEqual([5, 6, 7, 8]);

  // Nothing to sum → no value, not a zero.
  expect(r.noValues.labels).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'Other (4)']);
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
      /* The menu is the BUTTON's own, slotted — so sherpa-button drives it and
         holds `data-open` through the popover's light-dismiss. Hand-rolling the
         toggle opened it once and no later click could shut it.
         TRAP T-a-trigger-click-follows-light-dismiss */
      menuIsSlottedIntoButton: menu.parentElement === button && menu.getAttribute('slot') === 'menu',
      // aria-expanded lives on the button's INNER trigger, never on the host.
      hostHasNoAria: !button.hasAttribute('aria-expanded'),
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
    const openedBy = button.shadowRoot?.querySelector('.trigger')?.getAttribute('aria-expanded');
    for (const b of [boxes[0]!, boxes[2]!]) {
      b.checked = false;
      b.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const stillOpen = menu.shadowRoot!.querySelector('.menu')!.matches(':popover-open');

    let detail: { active: boolean; indices: number[] } | null = null;
    el.addEventListener('legend-item-click', (e) => {
      detail = (e as CustomEvent).detail;
    });
    (menu.shadowRoot!.querySelector('.apply') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return { structure, openedBy, stillOpen, detail };
  });

  expect(r.structure.toggleTag).toBe('BUTTON');
  expect(r.structure.buttonIsSibling).toBe(true);
  expect(r.structure.buttonNotInToggle).toBe(true);
  expect(r.structure.menuIsSlottedIntoButton).toBe(true);
  expect(r.structure.hostHasNoAria).toBe(true);
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

  // Apply reports the categories still on, in ONE event.
  expect(r.detail?.active).toBe(true);
  expect(r.detail?.indices).toEqual([6, 8]);
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

  expect(r.label, 'and it says how many it stands for').toBe('Other (2)');
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

/**
 * A ROW GOES INACTIVE; IT NEVER VANISHES.
 *
 * A filter that empties a category must leave its row in place, at zero and
 * drawn inactive. Dropping it loses the way back — the legend IS the control
 * that switches the category on again.
 *
 * TRAP T-a-legend-row-goes-inactive-it-never-vanishes
 */
test('an emptied category keeps its row, dimmed and still clickable', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>; populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await customElements.whenDefined('sherpa-chart-legend');
    await el.rendered;

    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();
    const read = (): Array<Record<string, unknown>> =>
      [...el.shadowRoot!.querySelectorAll<HTMLElement>('.item')].map((i) => ({
        label: i.querySelector('.label')?.textContent ?? '',
        value: i.querySelector('.value')?.textContent ?? '',
        empty: i.hasAttribute('data-empty'),
        // A filter emptied it; the READER did not switch it off.
        pressed: i.getAttribute('aria-pressed'),
        ink: getComputedStyle(i).color,
      }));

    el.populate([
      { label: 'Free', value: 25, colorIndex: 1 },
      { label: 'Starter', value: 27, colorIndex: 2 },
      { label: 'Pro', value: 24, colorIndex: 3 },
    ]);
    await settle();
    const before = read();

    // What `includeEmpty` hands a legend once a filter has emptied one.
    el.populate([
      { label: 'Free', value: 1, colorIndex: 1 },
      { label: 'Starter', value: 0, colorIndex: 2 },
      { label: 'Pro', value: 1, colorIndex: 3 },
    ]);
    await settle();
    return { before, after: read() };
  });

  expect(r.before.map((i) => i['label'])).toEqual(['Free', 'Starter', 'Pro']);
  expect(r.before.every((i) => i['empty'] === false)).toBe(true);

  // THE POINT: three rows still, and the emptied one is still one of them.
  expect(r.after.map((i) => i['label'])).toEqual(['Free', 'Starter', 'Pro']);
  expect(r.after[1]).toMatchObject({ label: 'Starter', value: '0', empty: true });
  // …and it is ON: the reader has not switched it off, a filter emptied it.
  expect(r.after[1]!['pressed']).toBe('true');
  // Drawn inactive, so a reader can see it is contributing nothing.
  expect(r.after[1]!['ink']).not.toBe(r.after[0]!['ink']);
});

/**
 * AT LEAST ONE ROW STAYS ON — and the LEGEND refuses it.
 *
 * Will, 2026-09-22: "legend filtering is just filtering. visibility & state is
 * a component concern." The floor used to live in a `legend-filter` module in
 * the data layer, which is gone: what is VISIBLE is this component's own state.
 *
 * TRAP T-a-legend-keeps-one-row-on
 */
test('the LAST active row cannot be switched off', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>; populate?: (d: unknown) => void; off?: string[];
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ label: 'A' }, { label: 'B' }, { label: 'C' }]);
    const settled = (window as unknown as { __settled: () => Promise<void> }).__settled;
    await settled();

    const clicks: string[] = [];
    el.addEventListener('legend-item-click', (e) =>
      clicks.push((e as CustomEvent).detail.label as string));

    const items = (): HTMLElement[] =>
      [...el.shadowRoot!.querySelectorAll<HTMLElement>('.item')];

    // Switch off two of three — allowed.
    items()[0]!.click(); await settled();
    items()[1]!.click(); await settled();
    const two = { off: [...el.off!], pressed: items().map((i) => i.getAttribute('aria-pressed')) };

    // The THIRD is the last one on. Refused, and nothing reported.
    items()[2]!.click(); await settled();
    const three = { off: [...el.off!], pressed: items().map((i) => i.getAttribute('aria-pressed')) };

    // And a caller cannot empty it either.
    el.off = ['A', 'B', 'C'];
    await settled();
    const set = [...el.off!];

    return { two, three, set, clicks };
  });

  expect(r.two.off).toEqual(['A', 'B']);
  expect(r.two.pressed).toEqual(['false', 'false', 'true']);

  // The refused click changes NOTHING — not the set, not the dimming.
  expect(r.three.off, 'the last row stays on').toEqual(['A', 'B']);
  expect(r.three.pressed, 'and it is not dimmed').toEqual(['false', 'false', 'true']);
  expect(r.clicks, 'a refused click is not reported either').toEqual(['A', 'B']);

  // The same floor for a host write — both reach the same state.
  expect(r.set).toEqual(['A', 'B']);
});

/**
 * A HORIZONTAL LEGEND IS THREE BY TWO.
 *
 * It was a wrapping flex row, so it put a different number of entries on each
 * line at every width. Six cells — which is MAX_ITEMS — so the last one is
 * always the roll-up with its breakdown menu.
 *
 * TRAP T-a-horizontal-legend-is-three-by-two
 */
test('a HORIZONTAL legend is a 3x2 grid, roll-up in the last cell', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>; populate?: (d: unknown) => void;
    };
    el.setAttribute('data-orientation', 'horizontal');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // EIGHT, so the roll-up fires — six cells cannot hold eight entries.
    el.populate!(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
      .map((label, i) => ({ label, value: (8 - i) * 10 })));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const legend = el.shadowRoot!.querySelector('.legend')!;
    const cells = [...el.shadowRoot!.querySelectorAll('.item, .rollup')]
      // The toggle is INSIDE the roll-up wrapper; count cells, not controls.
      .filter((n) => !n.closest('.rollup') || n.classList.contains('rollup'));

    return {
      tracks: getComputedStyle(legend).gridTemplateColumns.split(' ').length,
      cells: cells.map((n) => {
        const box = n.getBoundingClientRect();
        return { text: n.textContent!.trim().replace(/\s+/g, ' ').slice(0, 12),
                 x: Math.round(box.x), y: Math.round(box.y) };
      }),
      menuInLastCell: !!cells.at(-1)!.querySelector('.rollup-menu-btn'),
    };
  });

  expect(r.tracks, 'three columns').toBe(3);
  expect(r.cells.length, 'six cells, never more').toBe(6);

  // TWO rows of three: cells 0-2 share a y, cells 3-5 share the next.
  const rows = [...new Set(r.cells.map((c) => c.y))];
  expect(rows.length).toBe(2);
  expect(r.cells.slice(0, 3).every((c) => c.y === rows[0])).toBe(true);
  expect(r.cells.slice(3).every((c) => c.y === rows[1])).toBe(true);

  // THREE columns: each row's cells are at the same three x positions.
  const xs = [...new Set(r.cells.map((c) => c.x))];
  expect(xs.length).toBe(3);

  // The LAST cell is the roll-up, and it carries the breakdown button.
  expect(r.cells.at(-1)!.text).toContain('Other');
  expect(r.menuInLastCell).toBe(true);
});

/**
 * THE BREAKDOWN BUTTON SHARES THE OTHER ROW.
 *
 * The legend's grid had three tracks — swatch, label, value — so the button had
 * no cell and wrapped BELOW the row it belongs to. A fourth track is its own.
 *
 * TRAP T-the-breakdown-button-shares-the-other-row
 */
test('the breakdown button sits ON the Other row, after its value', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>; populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
      .map((label, i) => ({ label, value: (8 - i) * 10 })));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const at = (sel: string): { x: number; y: number } => {
      const box = sr.querySelector(sel)!.getBoundingClientRect();
      return { x: Math.round(box.x), y: Math.round(box.y) };
    };
    const rows = [...sr.querySelectorAll('.item, .rollup')]
      .filter((n) => !n.closest('.rollup') || n.classList.contains('rollup'));

    return {
      tracks: getComputedStyle(sr.querySelector('.legend')!).gridTemplateColumns.split(' ').length,
      rows: rows.map((n) => n.textContent!.trim().replace(/\s+/g, ' ').slice(0, 10)),
      value: at('.rollup-toggle .value'),
      button: at('.rollup-menu-btn'),
    };
  });

  expect(r.tracks, 'the fourth track is the button\'s own').toBe(4);
  // Other is the SIXTH item, not a seventh row below the list.
  expect(r.rows.length).toBe(6);
  expect(r.rows.at(-1)).toContain('Other');

  expect(r.button.y, 'same row as the value').toBe(r.value.y);
  expect(r.button.x, 'and to its right').toBeGreaterThan(r.value.x);
});

/**
 * A BREAKDOWN PICK IS A LEGEND PICK.
 *
 * Unticking a folded category did NOTHING to the view: the legend emitted
 * `legend-breakdown-change`, which nothing listened to, and never touched its
 * own off-set — so a caller reading `legend.off` saw no change at all.
 *
 * TRAP T-a-breakdown-pick-is-a-legend-pick
 */
test('unticking a folded category puts it in the OFF set, and reports', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>; populate?: (d: unknown) => void; off?: string[];
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(['a', 'b', 'c', 'd', 'e', 'f', 'g']
      .map((label, i) => ({ label, value: i + 1 })));
    const settle = (window as unknown as { __settled: () => Promise<void> }).__settled;
    await settle();

    const clicks: Array<{ label: string; indices?: number[] }> = [];
    el.addEventListener('legend-item-click', (e) =>
      clicks.push((e as CustomEvent).detail));

    const sr = el.shadowRoot!;
    const btn = sr.querySelector('.rollup-menu-btn') as HTMLElement & { shadowRoot?: ShadowRoot };
    (btn.shadowRoot?.querySelector('button') ?? btn).click();
    await settle();

    const menu = sr.querySelector('.rollup-menu')!;
    const boxes = [...menu.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    const folded = [...menu.querySelectorAll('.rollup-row-label')].map((n) => n.textContent);

    // Untick the FIRST folded row, then Apply.
    boxes[0]!.click();
    const apply = menu.shadowRoot!.querySelector('.apply') as HTMLElement & { shadowRoot?: ShadowRoot };
    (apply.shadowRoot?.querySelector('button') ?? apply).click();
    await settle();

    return { folded, off: [...el.off!], clicks };
  });

  // The menu lists the REAL categories, never "Other".
  expect(r.folded).toEqual(['f', 'g']);
  // The unticked one is OFF, which is what a caller reads.
  expect(r.off, 'it used to stay empty').toEqual(['f']);
  // …and it SAID so, in the event every other control speaks.
  expect(r.clicks.length).toBe(1);
  expect(r.clicks[0]!.indices, 'the folded rows still on').toEqual([6]);
});

/**
 * The breakdown menu opened ONCE and then stuck: the legend hand-rolled
 * `menu.toggle(button)`, and the popover's light-dismiss had already shut the
 * card by the time the click landed, so toggle re-opened what the click closed.
 * Measured before the fix: open, open, open. TRAP T-a-trigger-click-follows-light-dismiss
 */
test('a second click on the breakdown control CLOSES it', async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-chart-legend') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    // Nine categories → five named + Other, which is what carries the menu.
    el.populate(Array.from({ length: 9 }, (_, i) => ({ label: `C${i}`, value: i + 1 })));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
  });

  const box = await page.evaluate(() => {
    const el = document.querySelector('sherpa-chart-legend')!;
    const btn = el.shadowRoot!.querySelector('.rollup-menu-btn')!;
    const r = btn.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });

  // REAL clicks. A synthetic one does not reach the handler through a shadow root.
  const readOpen = (): Promise<boolean> =>
    page.evaluate(() => {
      const el = document.querySelector('sherpa-chart-legend')!;
      const menu = el.shadowRoot!.querySelector('.rollup-menu') as HTMLElement & { open?: boolean };
      return !!menu.open;
    });

  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(250);
  const first = await readOpen();

  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(250);
  const second = await readOpen();

  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(250);
  const third = await readOpen();

  expect(first).toBe(true);
  // The whole point: it must go BACK.
  expect(second).toBe(false);
  expect(third).toBe(true);
});

/**
 * A HORIZONTAL legend is a KEY, capped and centred — across a 12-column card
 * its cells sat a third of the page apart. Narrow, it fills. Will, 2026-09-26.
 * TRAP T-a-horizontal-legend-is-three-by-two
 */
test('a horizontal legend is capped and centred, and fills a narrow box', async ({ page }) => {
  const read = (width: number) => page.evaluate(async (w) => {
    const el = await window.__mount<HTMLElement & { populate(d: unknown): void }>(
      'sherpa-chart-legend', undefined,
      { 'data-orientation': 'horizontal', style: `inline-size: ${w}px` });
    el.populate([{ label: 'Free', value: 10 }, { label: 'Pro', value: 20 }, { label: 'Team', value: 30 }]);
    await window.__settled();
    const host = el.getBoundingClientRect();
    const grid = el.shadowRoot!.querySelector('.legend')!.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return { host: host.width, grid: grid.width, rem,
      left: Math.round(grid.left - host.left), right: Math.round(host.right - grid.right) };
  }, width);

  const wide = await read(1400);
  expect(wide.grid).toBeLessThanOrEqual(40 * wide.rem + 1);
  expect(Math.abs(wide.left - wide.right)).toBeLessThanOrEqual(1);
  const narrow = await read(300);
  expect(narrow.grid).toBeCloseTo(narrow.host, 0);
});

/**
 * THE OTHER ROW'S MENU DRAWS. It is slotted into an icon-only button, and the
 * button's ICON template had no menu slot — so the menu opened (every state
 * read "open") and drew nothing, 0x0. Measured in PIXELS, never by state.
 * TRAP T-an-icon-button-still-slots-its-menu
 */
test('the Other row opens a breakdown menu that is actually drawn', async ({ page }) => {
  await page.evaluate(async () => {
    const el = await window.__mount<HTMLElement & { populate(d: unknown): void }>(
      'sherpa-chart-legend', undefined, { 'data-orientation': 'horizontal', style: 'inline-size: 900px; margin-top: 40px' });
    el.populate(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((label, i) => ({ label, value: 10 - i })));
    await window.__settled();
  });
  await page.locator('sherpa-chart-legend .rollup-menu-btn button.trigger').first().click();
  const r = await page.evaluate(() => {
    const menu = document.querySelector('sherpa-chart-legend')!.shadowRoot!.querySelector('.rollup-menu')!;
    const pop = menu.shadowRoot!.querySelector<HTMLElement>('[popover]')!;
    const box = pop.getBoundingClientRect();
    return { open: pop.matches(':popover-open'), drawn: box.width > 0 && box.height > 0,
      rows: menu.querySelectorAll('input').length };
  });
  expect(r).toEqual({ open: true, drawn: true, rows: 3 });
});
