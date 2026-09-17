import { test, expect } from './harness';

/**
 * sherpa-gauge-chart — data-value drives the band's sweep + the needle angle.
 *
 * The ring is closed SVG ring-segment paths (half a donut with a needle), so
 * "how full is it" is the ANGLE the band's path sweeps — not a stroke-dasharray,
 * and not the older --_fill-pct custom property. Reading the sweep back off the
 * drawn path keeps these tests independent of the ring thickness, and tests the
 * geometry the reader actually sees rather than the numbers the TS fed in.
 */

/**
 * The FRACTION of the gauge a band's path sweeps.
 *
 * Measured across the band's two RADIAL EDGES, which lie exactly on its start and
 * end angle. NOT across the outer arc: the rounded corners inset that arc by the
 * corner radius at each end, so it reads a couple of degrees short of the band's
 * true sweep.
 *
 * Every path command's endpoint is its last two numbers; a naive "two numbers in
 * a row" scan is wrong, because an arc reads \u0060A rx ry rot large sweep x y\u0060 and its
 * radii would be read as a point. The path opens on the leading edge (command 0)
 * and returns to the trailing edge four commands later (move, line, corner, arc,
 * corner, line).
 *
 * The gauge's zero is 9 o'clock and it sweeps 180 degrees, so a fraction f of the
 * gauge is f * 180 of arc.
 */
const FRAC_FN = `(el) => {
  const ends = el.getAttribute('d').trim().split(/(?=[A-Za-z])/).map((cmd) => {
    const n = cmd.match(/-?[\\d.]+/g);
    return n && n.length >= 2 ? [Number(n[n.length - 2]), Number(n[n.length - 1])] : null;
  }).filter(Boolean);
  const angle = ([x, y]) => ((Math.atan2(x - 50, 50 - y) * 180) / Math.PI + 360) % 360;
  let sweep = angle(ends[5]) - angle(ends[0]);
  if (sweep <= 0) sweep += 360;
  return Math.round((sweep / 180) * 1000) / 1000;
}`;


test('data-value sets the band sweep and needle angle', async ({ page }) => {
  const r = await page.evaluate(async (fracSrc) => {
    const sweep = eval(fracSrc) as (el: SVGPathElement) => number;
    const read = async (value: string) => {
      const el = document.createElement('sherpa-gauge-chart') as HTMLElement & { rendered?: Promise<void> };
      el.setAttribute('data-value', value);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      // With no zones there is ONE value band, plus a grey remainder band when
      // the value leaves anything over. A zero-length band is not drawn at all:
      // a segment of no sweep has no path.
      const bands = [...el.shadowRoot!.querySelectorAll('.zone')] as SVGPathElement[];
      const rest = bands.find((b) => b.dataset['rest'] !== undefined);
      const value_ = bands.find((b) => b.dataset['rest'] === undefined);
      return {
        angle: getComputedStyle(el).getPropertyValue('--_angle').trim(),
        value: el.shadowRoot!.querySelector('.value')!.textContent,
        valueFrac: value_ ? sweep(value_) : null,
        restFrac: rest ? sweep(rest) : null,
      };
    };
    return { zero: await read('0'), half: await read('50'), full: await read('100') };
  }, FRAC_FN);
  // The value band spans the value; the remainder band spans what is left.
  // At zero there is no value band to draw — only the full grey remainder.
  expect(r.zero.valueFrac).toBeNull();
  expect(r.zero.restFrac).toBe(1);
  expect(r.zero.angle).toBe('-90deg');

  expect(r.half.valueFrac).toBe(0.5);
  expect(r.half.restFrac).toBe(0.5);
  expect(r.half.angle).toBe('0deg');

  expect(r.full.valueFrac).toBe(1);
  // Nothing left over at 100%, so no remainder band is drawn at all.
  expect(r.full.restFrac).toBeNull();
  expect(r.full.angle).toBe('90deg');
  // `.value` is the SCALE's midpoint, not the reading — Figma's 3x3 grid puts
  // "value% (top), 0% / caption / 100% (bottom row)", so the three labels are one
  // axis: 0 at the left, the midpoint above, the max at the right. All three are
  // the same 10px Regular. On a 0-100 scale the midpoint is 50 whatever the
  // needle reads, which is why this assertion does not move with data-value.
  expect(r.full.value).toBe('50');
});

test('data-status re-points the fill colour and a custom min/max scales', async ({ page }) => {
  const r = await page.evaluate(async (fracSrc) => {
    const sweep = eval(fracSrc) as (el: SVGPathElement) => number;
    const el = document.createElement('sherpa-gauge-chart') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-value', '10');
    el.setAttribute('data-min', '0');
    el.setAttribute('data-max', '20'); // 10/20 = 50%
    el.setAttribute('data-status', 'critical');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const cs = getComputedStyle(el);
    const band = el.shadowRoot!.querySelector('.zone') as SVGPathElement;
    return {
      // 10 on a 0–20 scale is half the gauge.
      valueFrac: sweep(band),
      fill: cs.getPropertyValue('--_fill').trim(),
      max: el.shadowRoot!.querySelector('.max')!.textContent,
    };
  }, FRAC_FN);
  expect(r.valueFrac).toBe(0.5);
  expect(r.fill.toLowerCase()).toBe('#ff856d'); // strong critical status surface (--_status-surface-strong → critical-color-2)
  expect(r.max).toBe('20');
});

test('a zone tooltip is triggered by the BAND itself; the hollow centre triggers none', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-gauge-chart') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-value', '70');
    el.setAttribute('data-zones', '0-60:success,60-85:warning,85-100:critical');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const all = [...el.shadowRoot!.querySelectorAll('.zone')] as SVGPathElement[];
    const bands = all.filter((b) => b.dataset['rest'] === undefined);
    const tips = [...el.shadowRoot!.querySelectorAll('.chart-tip')] as HTMLElement[];

    return {
      bands: bands.length,
      // These zones cover the whole scale, so there is nothing left to fill.
      filler: all.length - bands.length,
      tips: tips.length,
      tipText: tips.map((t) => t.textContent?.replace(/\s+/g, ' ').trim()),
      // The band is the pointer target — that is the whole point of drawing the
      // ring as real shapes rather than a gradient with a fake wedge over it.
      bandHits: bands.map((b) => getComputedStyle(b).pointerEvents),
      // ONE element per band, carrying BOTH paints. It used to be three — a
      // tinted arc plus two outline arcs — because a stroke holds one paint and
      // cannot round a corner. Any .zone-outline left would be that old model.
      outlines: el.shadowRoot!.querySelectorAll('.zone-outline').length,
      // Each band fills at 60% and strokes its own outline solid, like a donut
      // slice, so the reader sees a bordered shape rather than a bare band.
      fillOpacity: getComputedStyle(bands[0]!).fillOpacity,
      stroked: bands.every((b) => Number(b.getAttribute('stroke-width')) > 0),
      // The <svg> has no background and no full-circle track, so there is
      // nothing covering the hole. Anything BUT the bands would be a hit target.
      hostChildren: [...el.shadowRoot!.querySelectorAll('svg.ring > *')].map((n) => n.tagName),
    };
  });

  // ALL THREE zones draw, in full, at a value of 70. A zone is a THRESHOLD — it
  // says what a reading in that range would mean — so it belongs to the scale,
  // not to the reading. The needle says where the value falls. Clipping the
  // colour at the value would grey out the very band the reader is about to
  // enter, which is the one they most need to see.
  expect(r.bands).toBe(3);
  // …and these zones cover 0–100, so no grey filler is drawn.
  expect(r.filler).toBe(0);

  expect(r.tips).toBe(3);
  expect(r.tipText).toEqual(['Success 0–60', 'Warning 60–85', 'Critical 85–100']);

  // Every band is hittable…
  expect(r.bandHits).toEqual(['auto', 'auto', 'auto']);
  // …and there is no second element competing for the pointer, because the band
  // now carries its own border.
  expect(r.outlines).toBe(0);
  // fill-opacity is 1: the 50% lives in the series TOKEN, and a fill-opacity here
  // would multiply it down.
  expect(r.fillOpacity).toBe('1');
  expect(r.stroked).toBe(true);
  // Only the band group — no background rect, no full-circle track over the hole.
  expect(r.hostChildren).toEqual(['g']);
});

test('grey fills only the scale the bands leave uncovered', async ({ page }) => {
  const r = await page.evaluate(async (fracSrc) => {
    const sweep = eval(fracSrc) as (el: SVGPathElement) => number;
    const read = async (attrs: Record<string, string>) => {
      const el = document.createElement('sherpa-gauge-chart') as HTMLElement & { rendered?: Promise<void> };
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const all = [...el.shadowRoot!.querySelectorAll('.zone')] as SVGPathElement[];
      const rest = all.find((b) => b.dataset['rest'] !== undefined);
      return {
        coloured: all.filter((b) => b.dataset['rest'] === undefined).length,
        fillerFrac: rest ? sweep(rest) : null,
      };
    };
    return {
      // Zones covering the whole scale — nothing to fill, at ANY value.
      fullLow: await read({ 'data-value': '10', 'data-zones': '0-60:success,60-85:warning,85-100:critical' }),
      fullHigh: await read({ 'data-value': '95', 'data-zones': '0-60:success,60-85:warning,85-100:critical' }),
      // Zones stopping short — grey covers 80–100 whatever the value.
      short: await read({ 'data-value': '30', 'data-zones': '0-50:success,50-80:warning' }),
      // No zones at all: the single band IS the reading, so it stops at the
      // value and grey pads the rest.
      bare: await read({ 'data-value': '25' }),
      bareFull: await read({ 'data-value': '100' }),
    };
  }, FRAC_FN);

  // Zones are the SCALE, so they do not move with the value: the same three
  // bands and the same (absent) filler at 10 as at 95.
  expect(r.fullLow.coloured).toBe(3);
  expect(r.fullLow.fillerFrac).toBeNull();
  expect(r.fullHigh.coloured).toBe(3);
  expect(r.fullHigh.fillerFrac).toBeNull();

  // Zones stopping at 80 leave a fifth of the scale, whatever the value.
  expect(r.short.coloured).toBe(2);
  expect(r.short.fillerFrac).toBe(0.2);

  // With NO zones the band is the READING, so it stops at the value and the
  // grey pads what is left.
  expect(r.bare.coloured).toBe(1);
  expect(r.bare.fillerFrac).toBe(0.75);
  // …and at 100 there is nothing left to pad.
  expect(r.bareFull.coloured).toBe(1);
  expect(r.bareFull.fillerFrac).toBeNull();
});
