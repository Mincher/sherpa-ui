import { test, expect } from '@playwright/test';

/**
 * sherpa-gauge-chart — data-value drives the arc's dash length + the needle angle.
 *
 * The ring is stroked SVG arcs (half a donut), so "how full is it" is a
 * stroke-dasharray, not the old --_fill-pct custom property. Asserting the dash
 * as a FRACTION of the circumference keeps these tests independent of the ring
 * thickness, which sets the radius.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('data-value sets the arc length and needle angle', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const read = async (value: string) => {
      const el = document.createElement('sherpa-gauge-chart') as HTMLElement & { rendered?: Promise<void> };
      el.setAttribute('data-value', value);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      // With no zones there is ONE value arc, plus a grey remainder arc when the
      // value leaves anything over.
      const arcs = [...el.shadowRoot!.querySelectorAll('.zone')] as SVGCircleElement[];
      const frac = (arc: SVGCircleElement | undefined) => {
        if (!arc) return null;
        const [len, gap] = (arc.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number);
        // The visible half is half the circumference, so a gauge fraction f is
        // f/2 of it — double it back to compare against the value.
        return Math.round(((len ?? 0) / (gap ?? 1)) * 2 * 1000) / 1000;
      };
      return {
        angle: getComputedStyle(el).getPropertyValue('--_angle').trim(),
        value: el.shadowRoot!.querySelector('.value')!.textContent,
        valueFrac: frac(arcs[0]),
        restFrac: frac(arcs.find((a) => a.dataset['rest'] !== undefined)),
      };
    };
    return { zero: await read('0'), half: await read('50'), full: await read('100') };
  });
  // The value arc spans the value; the remainder arc spans what is left.
  expect(r.zero.valueFrac).toBe(0);
  expect(r.zero.restFrac).toBe(1);
  expect(r.zero.angle).toBe('-90deg');

  expect(r.half.valueFrac).toBe(0.5);
  expect(r.half.restFrac).toBe(0.5);
  expect(r.half.angle).toBe('0deg');

  expect(r.full.valueFrac).toBe(1);
  // Nothing left over at 100%, so no remainder arc is drawn at all.
  expect(r.full.restFrac).toBeNull();
  expect(r.full.angle).toBe('90deg');
  expect(r.full.value).toBe('100');
});

test('data-status re-points the fill colour and a custom min/max scales', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-gauge-chart') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-value', '10');
    el.setAttribute('data-min', '0');
    el.setAttribute('data-max', '20'); // 10/20 = 50%
    el.setAttribute('data-status', 'critical');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const cs = getComputedStyle(el);
    const arc = el.shadowRoot!.querySelector('.zone') as SVGCircleElement;
    const [len, gap] = (arc.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number);
    return {
      // 10 on a 0–20 scale is half the gauge.
      valueFrac: Math.round(((len ?? 0) / (gap ?? 1)) * 2 * 1000) / 1000,
      fill: cs.getPropertyValue('--_fill').trim(),
      max: el.shadowRoot!.querySelector('.max')!.textContent,
    };
  });
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

    const bands = [...el.shadowRoot!.querySelectorAll('.zone')] as SVGCircleElement[];
    const tips = [...el.shadowRoot!.querySelectorAll('.chart-tip')] as HTMLElement[];
    const outlines = el.shadowRoot!.querySelectorAll('.zone-outline').length;

    return {
      bands: bands.length,
      tips: tips.length,
      tipText: tips.map((t) => t.textContent?.replace(/\s+/g, ' ').trim()),
      // The band is the pointer target — that is the whole point of drawing the
      // ring as arcs rather than a gradient with a fake wedge over it.
      bandHits: bands.map((b) => getComputedStyle(b).pointerEvents),
      // The OUTLINE must not compete for the pointer: two overlapping targets
      // would fight over which tooltip opens.
      outlines,
      outlineHits: [...el.shadowRoot!.querySelectorAll('.zone-outline')]
        .map((o) => getComputedStyle(o).pointerEvents),
      // The <svg> has no background and no full-circle track, so there is
      // nothing covering the hole. Anything BUT the arcs would be a hit target.
      hostChildren: [...el.shadowRoot!.querySelectorAll('svg.ring > *')].map((n) => n.tagName),
    };
  });

  expect(r.bands).toBe(3);
  expect(r.tips).toBe(3);
  expect(r.tipText).toEqual(['Success 0–60', 'Warning 60–85', 'Critical 85–100']);
  // Every band is hittable…
  expect(r.bandHits).toEqual(['auto', 'auto', 'auto']);
  // …and every outline is not. Two edges per band.
  expect(r.outlines).toBe(6);
  expect(r.outlineHits.every((p) => p === 'none')).toBe(true);
  // Only the arc group — no background rect, no full-circle track to fill the hole.
  expect(r.hostChildren).toEqual(['g']);
});
