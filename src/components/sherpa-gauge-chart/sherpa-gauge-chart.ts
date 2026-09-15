/**
 * sherpa-gauge-chart — a half-circle gauge for one value on a 0–100 scale.
 *
 * HALF A DONUT WITH A NEEDLE. Each band is ONE CLOSED <path> — a ring segment
 * with all four corners rounded, built by the same ringSegmentPath() that draws a
 * donut slice, over the half circle from 9 o'clock to 3 o'clock. With data-zones
 * there is one segment per threshold band; without, a single segment as long as
 * the value. The leftover is one grey remainder band.
 *
 * It was a stroked circle whose dash exposed its own span, and before that a pair
 * of conic-gradient divs. The gradient had no per-band element at all, so a zone's
 * hit target was a separate HTML wedge clipped to an 8-point polygon — which made
 * the hollow centre hittable and missed the band's outer edge. The stroked circle
 * fixed the hit target but not the paint: a stroke is a thick LINE, so it has two
 * caps and no corners. It could carry no border round the whole band (only a
 * second arc along the two long edges) and no corner rounding at all. A closed
 * path does both in one element, exactly as the donut does.
 *
 * JS still hands CSS the needle angle. The big number, caption and scale are text.
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import { radialArea, ringSegmentPath } from '../../core/format-tick.js';

/** One resolved zone band, as a fraction (0–1) of the scale and a colour. */
interface Zone {
  from: number;
  to: number;
  color: string;
  /** The band's bounds on the RAW scale, for its hover tooltip's label. */
  rawFrom: number;
  rawTo: number;
  /** The colour NAME as written (a status name, or a raw CSS colour). */
  name: string;
}

/**
 * A zone as it was actually DRAWN — the zone plus the span that reached the
 * screen. `drawnFrom`/`drawnTo` are the zone's own bounds clipped at the value,
 * so a band straddling the value is cut and its dot still sits on the coloured
 * part. The zone's untouched `from`/`to` and raw bounds ride along for the
 * tooltip, which names what the band MEANS rather than how full it is.
 */
interface DrawnZone extends Zone {
  drawnFrom: number;
  drawnTo: number;
}

/**
 * Status name → the band's colour.
 *
 * The `-2` step is the SATURATED middle of each status ramp — the one a chart
 * mark wants. `base` and `-1` are the pale tints a card fills with, and `-3`/`-4`
 * are the dark inks for text on them.
 *
 * These used to read `--sherpa-style-surface-<status>-strong`, which does not
 * exist: `style-surface/*` is status-MODED (one `[data-status]` pin re-points the
 * whole set) and has no per-status names, so all five silently fell through to
 * their hardcoded hex. A gauge paints several statuses at once, so the moded
 * token could not serve it anyway — it has to name each ramp directly.
 */
const STATUS_COLOUR: Record<string, string> = {
  success: 'var(--sherpa-theme-surface-success-2, #36de8c)',
  warning: 'var(--sherpa-theme-surface-warning-2, #ffc44c)',
  urgent: 'var(--sherpa-theme-surface-urgent-2, #ff7300)',
  critical: 'var(--sherpa-theme-surface-critical-2, #dd2c01)',
  info: 'var(--sherpa-theme-surface-info-2, #008bba)',
};

/** Centre of the 100-unit circle. Only its TOP half is inside the viewBox. */
const CENTRE = 50;

/**
 * Ring thickness in viewBox units. The gauge is half a donut, so its band is the
 * donut's: innerRadius 0.7 on a 100-unit circle, the outer 30% — 15 units. Kept
 * in TS, not CSS, because it is path GEOMETRY: an SVG `d` cannot read a custom
 * property.
 *
 * It was 9 (Figma's older innerRadius 0.82), which read as a thin hoop beside the
 * donut's band on the same dashboard row.
 */
const RING_WIDTH = 15;

/**
 * Corner rounding, in viewBox units — the donut's 2px on a 200px chart.
 * ringSegmentPath() clamps it down for a band too thin or too short to hold it.
 */
const CORNER = 1;

/**
 * Outline thickness in viewBox units — 1px on a 200px chart, ALIGNED INSIDE as
 * in Figma. SVG has no inside stroke (it always straddles the path), so the path
 * is drawn half a stroke in from the true band edges and the stroke lands inside.
 * The same value and the same trick sherpa-donut-chart uses.
 */
const OUTLINE = 0.5;

/**
 * The gauge's zero and its full span, in ringSegmentPath's degrees — CLOCKWISE
 * from 12 o'clock. The visible half runs 9 o'clock (270) round the top to 3
 * o'clock (270 + 180 = 450, which is 90 wrapped past the top).
 */
const START_DEG = 270;
const SPAN_DEG = 180;

export class SherpaGaugeChart extends SherpaElement {
  static override css = new URL('./sherpa-gauge-chart.css', import.meta.url);
  static override html = new URL('./sherpa-gauge-chart.html', import.meta.url);
  static override observed = ['data-value', 'data-label', 'data-min', 'data-max', 'data-zones', 'data-caption'];

  override onRender(): void {
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** populate(number) — set the value. */
  protected override renderData(data: unknown): void {
    if (typeof data === 'number') this.dataset['value'] = String(data);
  }

  get value(): number {
    return this.num('data-value', 0);
  }
  set value(v: number) {
    this.dataset['value'] = String(v);
  }

  #sync(): void {
    const min = this.num('data-min', 0);
    const max = this.num('data-max', 100);
    const raw = this.num('data-value', 0);
    const frac = max > min ? Math.min(1, Math.max(0, (raw - min) / (max - min))) : 0;

    // Needle: -90deg (left) → +90deg (right) across the half.
    this.style.setProperty('--_angle', `${-90 + frac * 180}deg`);

    // One arc per threshold band; with no bands, one arc as long as the value.
    const zones = this.#parseZones(min, max);
    // The arcs decide which zones are actually on screen — a zone entirely past
    // the value is not drawn — so the hotspots are stamped from what was drawn,
    // never from the full zone list. Otherwise tip 2 would point at a band that
    // does not exist and the indices would slip out of step.
    this.#renderHotspots(this.#renderArcs(zones, frac));

    const value = this.$('.value');
    if (value) value.textContent = this.dataset['label'] ?? String(raw);
    const minEl = this.$('.min');
    if (minEl) minEl.textContent = String(min);
    const maxEl = this.$('.max');
    if (maxEl) maxEl.textContent = String(max);

    // Caption text (the caption slot, when filled, wins via light-DOM content).
    const caption = this.$('.caption');
    if (caption && !this.dataset['hasCaption']) {
      const slot = caption.querySelector('slot');
      const slotFilled = slot instanceof HTMLSlotElement && slot.assignedNodes().length > 0;
      if (!slotFilled) caption.textContent = this.dataset['caption'] ?? '';
    }
  }

  /**
   * Parse data-zones into resolved bands (fractions of the scale).
   * Accepts a compact string "0-50:success,50-80:warning,80-100:critical"
   * or a JSON array [{to,color}] / [{from,to,color}]. Missing `from` chains
   * from the previous band's `to`. Values are on the min–max scale.
   */
  #parseZones(min: number, max: number): Zone[] {
    const spec = this.dataset['zones'];
    if (!spec) return [];
    const span = max > min ? max - min : 1;
    const clamp = (n: number): number => Math.min(1, Math.max(0, (n - min) / span));

    let raw: Array<{ from?: number; to: number; color: string }> = [];
    const trimmed = spec.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as Array<{ from?: number; to: number; color: string }>;
        raw = parsed;
      } catch {
        return [];
      }
    } else {
      raw = trimmed
        .split(',')
        .map((part) => {
          const [range, color] = part.split(':').map((s) => s.trim());
          if (!range || !color) return null;
          const [a, b] = range.split('-').map((n) => Number(n));
          return b === undefined
            ? { to: a, color }
            : { from: a, to: b, color };
        })
        .filter((z): z is { from?: number; to: number; color: string } => z !== null);
    }

    const out: Zone[] = [];
    let cursor = min;
    for (const band of raw) {
      const from = band.from ?? cursor;
      out.push({
        from: clamp(from),
        to: clamp(band.to),
        color: this.#zoneColour(band.color),
        // Kept alongside the fractions: the tooltip names the band on the scale
        // the reader sees ("60–85"), not as a 0–1 fraction of it.
        rawFrom: from,
        rawTo: band.to,
        name: band.color,
      });
      cursor = band.to;
    }
    return out;
  }

  /**
   * Stamp one hover dot per DRAWN zone band, on that band's mid-angle.
   *
   * Takes what #renderArcs actually drew rather than the full zone list: a zone
   * entirely past the value has no band, so a tip for it would point at nothing
   * and every later index would slip by one.
   *
   * The ONLY numbers JS gives CSS are the angle and the colour — cos()/sin() in
   * the CSS turn the angle into a position on the ring, so the dots follow the
   * gauge at any size with nothing measured here.
   */
  #renderHotspots(zones: DrawnZone[]): void {
    const host = this.$('.hotspots');
    const tpl = this.$<HTMLTemplateElement>('template.hotspot-tpl');
    if (!host || !tpl) return;

    host.replaceChildren();
    zones.forEach((zone, i) => {
      // BOTH children — the dot and its tip are SIBLINGS. The tip cannot be a
      // descendant of the dot: an absolutely-positioned ancestor breaks anchor
      // positioning for a fixed tip, and the dot must be absolute to sit on its
      // band.
      const frag = tpl.content.cloneNode(true) as DocumentFragment;
      const dot = frag.querySelector<HTMLElement>('.hotspot')!;
      const tip = frag.querySelector<HTMLElement>('.chart-tip')!;
      // The index pairs the ARC with its tip; CSS cannot derive it. (There is no
      // hit wedge any more — the arc's own stroke is the target.)
      tip.dataset['index'] = String(i);
      dot.dataset['index'] = String(i);

      // The visible half runs -90deg (left) → +90deg (right), matching the
      // needle's own mapping, so a band's midpoint fraction lands on the same arc
      // the fill paints it on. Measured across the DRAWN span, so a clipped
      // band's dot sits on the part that is actually there.
      const mid = (zone.drawnFrom + zone.drawnTo) / 2;
      // -90deg (left) → +90deg (right) across the visible half.
      const angle = -90 + mid * 180;
      dot.style.setProperty('--_dot-angle', `${angle}deg`);
      // Push the tip OUTWARD along this band's radius, so neighbouring zones'
      // tips diverge instead of stacking on top of each other.
      tip.style.setProperty('--_area', radialArea(angle));
      dot.style.setProperty('--_hue', zone.color);
      // The ANCHOR NAME. Without it the tip has no anchor, `position-area` is
      // meaningless and the browser parks the tip wherever it likes.
      // The anchor NAME on BOTH: the dot declares it, the tip points at it.
      dot.style.setProperty('--_anchor', `--gauge-zone-${i}`);
      tip.style.setProperty('--_anchor', `--gauge-zone-${i}`);
      // A status band is named by its status; a raw CSS colour has no name worth
      // showing, so that row falls back to the range alone.
      const label = STATUS_COLOUR[zone.name] ? this.#zoneLabel(zone.name) : '';
      tip.querySelector('.chart-tip-label')!.textContent = label;
      // The zone's FULL range, not the drawn span: the reader wants to know what
      // the band MEANS ("Warning 60–85"), not how much of it the value has
      // reached — the fill already shows that.
      tip.querySelector('.chart-tip-value')!.textContent = `${zone.rawFrom}–${zone.rawTo}`;
      // The accessible name goes on the ARC, which is the thing a pointer (and a
      // screen reader's virtual cursor) actually lands on. The <svg> itself is
      // aria-hidden, so the band needs role="img" to be announced at all.
      const arc = this.$(`.zone[data-index="${i}"]`);
      if (arc) {
        arc.setAttribute('role', 'img');
        arc.setAttribute('aria-label', `${label} ${zone.rawFrom} to ${zone.rawTo}`.trim());
      }
      host.append(dot, tip);
    });
  }

  /** A status name, title-cased for display ("warning" → "Warning"). */
  #zoneLabel(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /** Map a zone colour token/name to a CSS colour. Status names route to tokens. */
  #zoneColour(name: string): string {
    return STATUS_COLOUR[name] ?? name;
  }

  /**
   * Draw the ring: one closed ring-segment path per band (or one for the value).
   *
   * Same primitive as a donut slice — ringSegmentPath() over the half circle from
   * 9 o'clock to 3 o'clock, with all four corners rounded and the band's whole
   * boundary stroked. A band's fraction of the GAUGE maps straight onto degrees:
   * START_DEG + fraction * SPAN_DEG, measured clockwise from 12.
   *
   * No transform and no dash offset. The old stroked circle was a full 360° whose
   * dash had to be pushed half a circumference along to reach the gauge's zero,
   * because rotating it instead resolved `transform-origin` against the circle's
   * own fill box and swung the whole ring off centre. A path is drawn where it
   * belongs, so neither workaround is needed — and a transform would skew the
   * rounded corners anyway.
   *
   * The last band is the grey remainder, so there is no separate track element.
   *
   * Returns the zones it actually drew, in the order it drew them, so the hover
   * layer can stamp one dot per real band rather than one per declared zone.
   */
  #renderArcs(zones: Zone[], frac: number): DrawnZone[] {
    const host = this.$('.zones');
    const tpl = this.$<HTMLTemplateElement>('template.zone-tpl');
    if (!host || !tpl) return [];

    // The TRUE band edges. The path itself is inset half an outline inside them,
    // so the stroke lands within the band — Figma's strokeAlign INSIDE.
    const outer = CENTRE - OUTLINE / 2;
    const inner = CENTRE - RING_WIDTH + OUTLINE / 2;

    // The coloured bands, CLIPPED AT THE VALUE. A gauge reads as "how full", so
    // the colour has to stop where the value does: a zone past the value says
    // what the reading WOULD mean, not what it does. A zone straddling the value
    // is cut, and one entirely past it is dropped.
    //
    // Zones used to paint full-length whatever the value, leaving the needle as
    // the only thing that moved — so a gauge at 20 and one at 90 drew the same
    // three full bands.
    //
    // With no zones there is a single band as long as the value; its colour comes
    // from CSS (--_fill), which already resolves data-status.
    const bands: Array<{
      from: number;
      to: number;
      color: string | null;
      rest?: true;
      zone?: Zone;
    }> = zones.length
      ? zones
          .filter((z) => z.from < frac)
          .map((z) => ({ from: z.from, to: Math.min(z.to, frac), color: z.color, zone: z }))
      : [{ from: 0, to: frac, color: null }];

    // The REMAINDER — one grey band covering everything past the value, so the
    // gauge always reads full-width and the unfilled part is visible rather than
    // blank. Skipped only at 100%, where there is no arc left to draw.
    //
    // It replaced a full half-circle track drawn underneath everything. The bands
    // already cover the gauge up to the value, so the only part of that track
    // that ever showed WAS the remainder; drawing just that removes a second copy
    // of the half-circle geometry, which is where it kept going wrong.
    if (frac < 1) bands.push({ from: frac, to: 1, color: null, rest: true });

    host.replaceChildren();
    const drawn: DrawnZone[] = [];
    // Counts only bands that REACHED the screen. `forEach`'s own index would leave
    // a hole wherever a zero-width band was skipped, and the hover layer indexes
    // its dots from 0 with no holes — so tip N would pair with band N+1.
    let index = 0;
    bands.forEach((band) => {
      if (band.to <= band.from) return;
      const i = index++;
      // Clone the <path> INSIDE the template's <svg> wrapper, not the wrapper —
      // the wrapper only exists to put the clone in the SVG namespace.
      const arc = tpl.content.querySelector('.zone')!.cloneNode(true) as SVGPathElement;
      arc.setAttribute(
        'd',
        ringSegmentPath({
          cx: CENTRE,
          cy: CENTRE,
          inner,
          outer,
          startDeg: START_DEG + band.from * SPAN_DEG,
          endDeg: START_DEG + band.to * SPAN_DEG,
          radius: CORNER,
        }),
      );
      arc.setAttribute('stroke-width', String(OUTLINE));
      // The index pairs the band with its tip; CSS cannot derive it.
      arc.dataset['index'] = String(i);
      // The remainder is chrome, not data: CSS greys it and drops its pointer
      // target, so it never claims a tooltip.
      if (band.rest) arc.dataset['rest'] = '';
      if (band.color) arc.style.setProperty('--_hue', band.color);
      host.appendChild(arc);
      // The remainder is chrome and names no zone, so it gets no hover dot.
      if (band.zone) drawn.push({ ...band.zone, drawnFrom: band.from, drawnTo: band.to });
    });
    return drawn;
  }
}

customElements.define('sherpa-gauge-chart', SherpaGaugeChart);
