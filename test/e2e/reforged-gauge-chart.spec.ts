import { test, expect } from '@playwright/test';

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

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

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
  expect(r.full.value).toBe('100');
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
    const rest = all.filter((b) => b.dataset['rest'] !== undefined);
    const tips = [...el.shadowRoot!.querySelectorAll('.chart-tip')] as HTMLElement[];

    return {
      bands: bands.length,
      rest: rest.length,
      tips: tips.length,
      tipText: tips.map((t) => t.textContent?.replace(/\s+/g, ' ').trim()),
      // The band is the pointer target — that is the whole point of drawing the
      // ring as real shapes rather than a gradient with a fake wedge over it.
      bandHits: bands.map((b) => getComputedStyle(b).pointerEvents),
      // The remainder is chrome, not data: nothing to hover, nothing to explain.
      restHits: rest.map((b) => getComputedStyle(b).pointerEvents),
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

  // TWO coloured bands, not three. A gauge reads as "how full", so the colour
  // stops where the value does: at 70 the success band draws whole, the warning
  // band is cut at 70, and the critical band (85–100) is entirely past the value
  // and is not drawn at all. Zones used to paint full-length whatever the value,
  // leaving the needle as the only thing that moved.
  expect(r.bands).toBe(2);
  // …and ONE grey remainder covering 70–100, so the gauge always reads full
  // width and the unfilled part is visible rather than blank.
  expect(r.rest).toBe(1);

  // One tip per DRAWN band. A tip for the undrawn critical zone would point at a
  // band that does not exist and would slip every later index by one.
  expect(r.tips).toBe(2);
  // Each names the zone's FULL range, not the part that was drawn: the reader
  // wants to know what the band MEANS, and the fill already shows how far it got.
  expect(r.tipText).toEqual(['Success 0–60', 'Warning 60–85']);

  // Every band is hittable…
  expect(r.bandHits).toEqual(['auto', 'auto']);
  // …and the remainder is not.
  expect(r.restHits).toEqual(['none']);
  // There is no second element competing for the pointer, because the band now
  // carries its own border.
  expect(r.outlines).toBe(0);
  expect(r.fillOpacity).toBe('0.6');
  expect(r.stroked).toBe(true);
  // Only the band group — no background rect, no full-circle track over the hole.
  expect(r.hostChildren).toEqual(['g']);
});

test('the grey remainder always pads what the value leaves over', async ({ page }) => {
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
        restFrac: rest ? sweep(rest) : null,
      };
    };
    const ZONES = '0-60:success,60-85:warning,85-100:critical';
    return {
      empty: await read({ 'data-value': '0', 'data-zones': ZONES }),
      part: await read({ 'data-value': '40', 'data-zones': ZONES }),
      full: await read({ 'data-value': '100', 'data-zones': ZONES }),
      bare: await read({ 'data-value': '25' }),
    };
  }, FRAC_FN);

  // At ZERO the whole gauge is grey — there is no coloured band to draw, and the
  // remainder covers the lot rather than leaving the ring blank.
  expect(r.empty.coloured).toBe(0);
  expect(r.empty.restFrac).toBe(1);

  // Part full: one band (success, cut at 40) plus grey over the rest.
  expect(r.part.coloured).toBe(1);
  expect(r.part.restFrac).toBe(0.6);

  // FULL is the one case with no remainder: there is no arc left to draw.
  expect(r.full.coloured).toBe(3);
  expect(r.full.restFrac).toBeNull();

  // The same holds with NO zones — the single value band plus its grey pad.
  expect(r.bare.coloured).toBe(1);
  expect(r.bare.restFrac).toBe(0.75);
});
