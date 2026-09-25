import { test, expect } from './harness';

/**
 * Chart mark tooltips — the shared .chart-tip rules in core/sherpa-base.css.
 *
 * NO JS POSITIONING. anchor-name / position-anchor tie a tip to its own mark,
 * position-area picks a preferred side and position-try-fallbacks lets the browser
 * flip it to whichever side has room. These specs assert the wiring resolves and
 * the tip actually lands beside its mark, because an unresolved anchor FAILS
 * SILENTLY — the tip drops to the viewport corner rather than erroring.
 */


test('the shared tip rules resolve: anchored, flippable, hidden until hover', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([{ label: 'Disk', value: 42 }, { label: 'CPU', value: 31 }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const mark = sr.querySelector<HTMLElement>('.bar-col')!;
    const tip = mark.querySelector<HTMLElement>('.chart-tip')!;
    // The BAR carries the anchor name, not its column: `.bar-col` is the full
    // plot height, so a tip anchored to it would float far above a short bar.
    // `.chart-anchor` names the child instead and the column's own name is
    // switched off, which is what this pair asserts.
    const anchor = mark.querySelector<HTMLElement>('.chart-anchor')!;
    const cs = getComputedStyle(tip);
    return {
      // The anchor declares a name and the tip points at the SAME one.
      // A mismatch is the silent failure that drops the tip in the corner.
      markAnchor: getComputedStyle(anchor).anchorName,
      columnAnchorOff: getComputedStyle(mark).anchorName,
      tipAnchor: cs.positionAnchor,
      // Above by default, and every fallback tried before flipping BELOW — a tip
      // under a mark hides the series the reader is comparing against.
      area: cs.positionArea,
      fallbacks: cs.positionTryFallbacks,
      // Hidden with `display: none`, so it takes no layout and AT cannot read it.
      hiddenByDefault: cs.display === 'none',
      // The tip must never eat the hover it depends on.
      pointerEvents: cs.pointerEvents,
      label: tip.querySelector('.chart-tip-label')!.textContent,
      value: tip.querySelector('.chart-tip-value')!.textContent,
    };
  });

  expect(r.markAnchor).toBe('--bar-mark-0');
  // The column's own name is off, so only the bar can be the anchor.
  expect(r.columnAnchorOff).toBe('none');
  expect(r.tipAnchor).toBe('--bar-mark-0');
  expect(r.area).toBe('block-start');
  // ABOVE is favoured: the sides come before `block-end` in the fallback order,
  // so a tip is only flipped underneath as a last resort.
  expect(r.fallbacks.indexOf('inline-end')).toBeLessThan(r.fallbacks.indexOf('block-end'));
  expect(r.hiddenByDefault).toBe(true);
  expect(r.pointerEvents).toBe('none');
  expect(r.label).toBe('Disk');
  expect(r.value).toBe('42');
});

/* This test is also the only guard on the chart HAVING A HEIGHT: a plot floor
   that collapses leaves no room above the bar.
   TRAP T-a-percentage-floor-needs-a-definite-parent */
test('hovering a bar shows its tip ABOVE the bar, with a gap', async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-barchart') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.style.inlineSize = '400px';
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate([{ label: 'Disk', value: 42 }, { label: 'CPU', value: 31 }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
  });

  // A REAL pointer move: :hover cannot be faked by dispatching an event.
  const at = await page.evaluate(() => {
    const sr = document.querySelector('sherpa-barchart')!.shadowRoot!;
    const b = sr.querySelectorAll('.bar-col')[1]!.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.mouse.move(at.x, at.y);
  await page.waitForTimeout(250);

  const r = await page.evaluate(() => {
    const sr = document.querySelector('sherpa-barchart')!.shadowRoot!;
    const mark = sr.querySelectorAll<HTMLElement>('.bar-col')[1]!;
    const tip = mark.querySelector<HTMLElement>('.chart-tip')!;
    // Measured against the BAR, not the column. `.bar-col` is the full plot
    // height, so the tip sits above the bar's own top edge — which is the point
    // of naming the bar as the anchor (`.chart-anchor`).
    const bar = mark.querySelector<HTMLElement>('.bar')!;
    const t = tip.getBoundingClientRect();
    const m = bar.getBoundingClientRect();
    return {
      shown: getComputedStyle(tip).display !== 'none',
      text: tip.textContent!.replace(/\s+/g, ' ').trim(),
      // ABOVE the bar…
      above: t.bottom <= m.top + 0.5,
      // …with real whitespace between them, not touching.
      gap: Math.round(m.top - t.bottom),
      // Centred on the bar rather than parked in a corner — the symptom of an
      // anchor that never resolved.
      centred: Math.abs(t.x + t.width / 2 - (m.x + m.width / 2)) < 2,
      // A tip has real size; a corner-parked one often collapses.
      hasSize: t.width > 20 && t.height > 10,
    };
  });

  expect(r.shown).toBe(true);
  expect(r.text).toBe('CPU 31');
  expect(r.above).toBe(true);
  expect(r.gap).toBe(4); // space/2xs
  expect(r.centred).toBe(true);
  expect(r.hasSize).toBe(true);
});

test('a donut anchors its tips to invisible points, hovered from the SLICE', async ({ page }) => {
  // NO VISIBLE MARKERS. The reader hovers the segment itself. The anchor points
  // exist only because an SVG element cannot be a CSS anchor in Chromium
  // (anchor-name computes to the right value and never resolves), so a zero-size
  // HTML span is placed on the ring by cos()/sin() from the JS's one angle.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-radial-chart') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    // Four equal slices, so each mid-angle is predictable: 45, 135, 225, 315.
    el.populate([
      { label: 'A', value: 25 },
      { label: 'B', value: 25 },
      { label: 'C', value: 25 },
      { label: 'D', value: 25 },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const dots = Array.from(sr.querySelectorAll<HTMLElement>('.hotspot'));
    const wrap = sr.querySelector('.ring-wrap')!.getBoundingClientRect();
    const centre = { x: wrap.left + wrap.width / 2, y: wrap.top + wrap.height / 2 };
    return {
      count: dots.length,
      // Zero-size and undrawn — an anchor, not a marker.
      sizes: dots.map((d) => {
        const b = d.getBoundingClientRect();
        return b.width === 0 && b.height === 0;
      }),
      angles: dots.map((d) => d.style.getPropertyValue('--_dot-angle') || d.style.getPropertyValue('--_angle')),
      // Every dot sits at the OUTER radius — 50% of the box, so it HALF-HANGS
      // over the ring's edge. On the band's midline it read as a blemish on the
      // colour rather than a marker.
      radii: dots.map((d) => {
        const b = d.getBoundingClientRect();
        const r2 = Math.hypot(b.left + b.width / 2 - centre.x, b.top + b.height / 2 - centre.y);
        return Math.round((r2 / wrap.width) * 1000) / 10;
      }),
      // The tip is the dot's next SIBLING, not its child: an absolutely-placed
      // ancestor breaks anchor positioning for a fixed tip.
      tips: dots.map((d) => d.nextElementSibling!.textContent!.replace(/\s+/g, ' ').trim()),
      tipIsSibling: dots.every((d) => d.nextElementSibling?.classList.contains('chart-tip')),
    };
  });

  expect(r.count).toBe(4);
  // Nothing is drawn: each anchor is a zero-size span.
  expect(r.sizes).toEqual([true, true, true, true]);
  expect(r.angles).toEqual(['45deg', '135deg', '225deg', '315deg']);
  // All four on the OUTER edge — proof the trig lands on the ring.
  expect(r.radii).toEqual([50, 50, 50, 50]);
  expect(r.tips).toEqual(['A 25', 'B 25', 'C 25', 'D 25']);
  expect(r.tipIsSibling).toBe(true);
});

test('gauge zone dots ride the ring and name their threshold', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-gauge-chart') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-value', '70');
    el.setAttribute('data-zones', '0-60:success,60-85:warning,85-100:critical');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const dots = Array.from(sr.querySelectorAll<HTMLElement>('.hotspot'));
    // The hub is the BOTTOM centre of the gauge box — a gauge is a half circle, so
    // the full circle's centre sits on its lower edge.
    const box = sr.querySelector('.gauge')!.getBoundingClientRect();
    const hub = { x: box.left + box.width / 2, y: box.bottom };
    return {
      count: dots.length,
      // The gauge's own radius, to measure the dots against. Not a fixed number:
      // the gauge SCALES to its card, so a hardcoded 100 only ever described one
      // particular width.
      radius: Math.round(box.height),
      // Each dot sits on the ring's OUTER radius, so it half-hangs over the
      // edge rather than sitting buried in the band.
      radii: dots.map((d) => {
        const b = d.getBoundingClientRect();
        return Math.round(Math.hypot(b.left + b.width / 2 - hub.x, b.top + b.height / 2 - hub.y));
      }),
      // The tip is the dot's next SIBLING, not its child.
      tips: dots.map((d) => d.nextElementSibling!.textContent!.replace(/\s+/g, ' ').trim()),
      // The dot wears its band's own colour, not a neutral grey.
      hues: dots.map((d) => d.style.getPropertyValue('--_hue')),
      // The overlay must sit OUTSIDE .gauge, whose overflow:hidden clipped the tips.
      outsideClip: sr.querySelector('.hotspots')!.parentElement!.className,
    };
  });

  expect(r.count).toBe(3);
  // Every dot at the SAME distance from the hub, and that distance is the ring's
  // outer radius. They used to scatter: `--_ring-r` was a percentage, and
  // `inset-inline-start` resolves one against the width while `inset-block-start`
  // resolves it against the height — a factor of two apart on this 2:1 box. It is
  // a container unit now, which means the same length on either axis.
  expect(r.radii).toEqual([r.radius, r.radius, r.radius]);
  expect(r.tips).toEqual(['Success 0–60', 'Warning 60–85', 'Critical 85–100']);
  // A status name picks a data-viz series BY POSITION — success → series 1,
  // warning → 2, urgent → 3, critical → 4, info → 5 — which is the same variable
  // its own sequence. A status is a MODE in the Status palette — sequence 1 is
  // the whole green ramp, sequence 2 the whole amber one — so a status cannot be
  // a series INDEX: series 1..10 within a mode are ten steps of ONE hue.
  //
  // It used to read `--sherpa-data-viz-series-N` by position, on the earlier
  // reading that the palette re-pointed series 1-5 onto the five status ramps.
  // A gauge painting success/warning/critical then asked for series 1, 2 and 4 —
  // three shades of green.
  //
  // A gauge paints several statuses at once and so cannot pin a mode, which is
  // why the status is NAMED. The `-fill` is that sequence's mid step at 50%; the
  // bare name is its border, solid.
  expect(r.hues).toEqual([
    'var(--sherpa-status-success-fill)',
    'var(--sherpa-status-warning-fill)',
    'var(--sherpa-status-critical-fill)',
  ]);
  expect(r.outsideClip).toBe('gauge-wrap');
});

test('sparkline dots space themselves across the box at the data heights', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-sparkline') as HTMLElement;
    el.style.inlineSize = '200px';
    // A rising ramp, so each dot must be HIGHER than the one before it.
    el.setAttribute('data-values', '10,20,30,40,50');
    document.getElementById('root')!.replaceChildren(el);
    await (el as HTMLElement & { rendered?: Promise<void> }).rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const shown = Array.from(sr.querySelectorAll<HTMLElement>('.hotspot')).filter(
      (d) => getComputedStyle(d).display !== 'none',
    );
    const chart = sr.querySelector('.chart')!.getBoundingClientRect();
    return {
      // One per value, and only per value — data-len gates the rest.
      shown: shown.length,
      total: sr.querySelectorAll('.hotspot').length,
      len: getComputedStyle(el).getPropertyValue('--_len').trim(),
      // Evenly spaced across the chart's width…
      xs: shown.map((d) => {
        const b = d.getBoundingClientRect();
        return Math.round(b.left + b.width / 2 - chart.left);
      }),
      // …and each higher than the last, because the values rise.
      ys: shown.map((d) => {
        const b = d.getBoundingClientRect();
        return Math.round(b.top + b.height / 2 - chart.top);
      }),
      // The tip is the dot's next SIBLING, not its child — an absolutely-placed
      // mark breaks anchor positioning for a fixed descendant.
      tips: shown.map((d) => d.nextElementSibling!.textContent!.trim()),
    };
  });

  expect(r.total).toBe(8); // eight fixed slots
  expect(r.shown).toBe(5); // five values
  expect(r.len).toBe('5');
  expect(r.tips).toEqual(['10', '20', '30', '40', '50']);

  // First dot at the left edge, last at the right, evenly spaced between.
  expect(r.xs[0]).toBe(0);
  expect(r.xs[r.xs.length - 1]).toBe(200);
  const steps = r.xs.slice(1).map((x, i) => x - r.xs[i]!);
  for (const step of steps) expect(step).toBe(50);

  // A rising series means each dot is strictly higher (a SMALLER top offset).
  for (let i = 1; i < r.ys.length; i++) expect(r.ys[i]!).toBeLessThan(r.ys[i - 1]!);
});

test('a tip ignores the status around it — it pins Style=default', async ({ page }) => {
  const r = await page.evaluate(async () => {
    type El = HTMLElement & { rendered?: Promise<void>; populate(d: unknown): Promise<void> };
    const root = document.getElementById('root')!;
    const bg = (el: Element) => getComputedStyle(el).backgroundColor;
    const ink = document.createElement('span');
    ink.style.color = 'var(--sherpa-style-content-base)';
    root.replaceChildren(ink);

    // A metric pins its own status from the trend; its sparkline tip must not.
    const metric = document.createElement('sherpa-metric') as El;
    root.appendChild(metric);
    await metric.rendered;
    await metric.populate({ name: 'Sessions', value: '9', deltaPercent: -6, values: [4, 6, 5, 9] });
    const spark = metric.shadowRoot!.querySelector('sherpa-sparkline') as El;
    await spark.rendered;

    const box = document.createElement('div');
    box.dataset['status'] = 'critical';
    root.appendChild(box);
    const tooltip = document.createElement('sherpa-tooltip') as El;
    tooltip.innerHTML = '<span style="color: var(--sherpa-style-content-base)">t</span>';
    box.appendChild(tooltip);
    await tooltip.rendered;

    return {
      status: metric.dataset['status'],
      plain: getComputedStyle(ink).color,
      spark: bg(spark.shadowRoot!.querySelector('.chart-tip')!),
      bubble: bg(tooltip.shadowRoot!.querySelector('.bubble')!),
      trigger: getComputedStyle(tooltip.firstElementChild!).color,
    };
  });
  expect(r.status).toBe('critical');
  expect(r.spark).toBe(r.plain);
  expect(r.bubble).toBe(r.plain);
  // The pin is on the bubble only — the trigger keeps the status it sits in.
  expect(r.trigger).not.toBe(r.plain);
});
