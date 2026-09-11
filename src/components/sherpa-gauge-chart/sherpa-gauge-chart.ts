/**
 * sherpa-gauge-chart — a half-circle gauge for one value on a 0–100 scale.
 *
 * HALF A DONUT: the ring is stroked SVG arcs, one per band, with exactly the
 * geometry sherpa-donut-chart uses for a slice — a <circle> whose stroke-dasharray
 * exposes only its own span. With data-zones there is one arc per threshold band;
 * without, a single arc whose dash follows data-value.
 *
 * That replaced a pair of conic-gradient divs. A gradient has no per-band element,
 * so a zone could not be hovered directly: the hit target was a separate HTML
 * wedge clipped to an 8-point polygon from the HUB to the rim. It made the hollow
 * centre hittable, and its straight chords cut inside the true arc so the band's
 * outer edge was not. Now the STROKE is the target, so it matches the band exactly
 * and the hole is not hittable at all.
 *
 * JS still hands CSS the needle angle. The big number, caption and scale are text.
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import { radialArea } from '../../core/format-tick.js';

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

/**
 * Ring thickness in viewBox units. The viewBox is a 100-unit circle, and Figma
 * draws the gauge 16px thick on a 200px circle — 8 units here. Kept in TS rather
 * than CSS because the arc RADIUS depends on it (the band sits on its mid-line),
 * and an SVG `r` attribute cannot be written in terms of a CSS custom property.
 */
const RING_WIDTH = 8;

/**
 * Outline thickness in viewBox units — Figma strokes each band 1px on a 200px
 * chart, which is 0.5 units here. The same value sherpa-donut-chart uses.
 */
const OUTLINE = 0.5;

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
    return Number(this.dataset['value'] ?? 0);
  }
  set value(v: number) {
    this.dataset['value'] = String(v);
  }

  #sync(): void {
    const min = Number(this.dataset['min'] ?? 0);
    const max = Number(this.dataset['max'] ?? 100);
    const raw = Number(this.dataset['value'] ?? 0);
    const frac = max > min ? Math.min(1, Math.max(0, (raw - min) / (max - min))) : 0;

    // Needle: -90deg (left) → +90deg (right) across the half.
    this.style.setProperty('--_angle', `${-90 + frac * 180}deg`);

    // One arc per threshold band; with no bands, one arc as long as the value.
    const zones = this.#parseZones(min, max);
    this.#renderArcs(zones, frac);
    this.#renderHotspots(zones);

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
   * Stamp one hover dot per zone, on its band's mid-angle.
   *
   * The ONLY numbers JS gives CSS are the angle and the colour — cos()/sin() in
   * the CSS turn the angle into a position on the ring, so the dots follow the
   * gauge at any size with nothing measured here.
   *
   * The fill is a conic-gradient, so there is no per-band element these could have
   * been attached to instead.
   */
  #renderHotspots(zones: Zone[]): void {
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
      // the fill paints it on.
      const mid = (zone.from + zone.to) / 2;
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
   * Draw the ring: one stroked arc per band (or one for the value).
   *
   * Same primitive as a donut slice — a full <circle> whose stroke-dasharray
   * shows only this band's run and hides the rest. The gap in the pair is the
   * WHOLE circumference, so the dash never repeats and a band cannot wrap round
   * and reappear on the far side.
   *
   * The circle is a full 360°, but the viewBox shows only its top half, so a
   * fraction f of the GAUGE is f/2 of the circumference. The gauge's zero (9
   * o'clock) is baked into the dash OFFSET here rather than reached by rotating
   * the circle in CSS — see the offset line below for why.
   *
   * The last band is the grey remainder, so there is no separate track element.
   */
  #renderArcs(zones: Zone[], frac: number): void {
    const host = this.$('.zones');
    const tpl = this.$<HTMLTemplateElement>('template.zone-tpl');
    if (!host || !tpl) return;

    // Radius and stroke come from the ring thickness, so the band sits on the
    // mid-line between its inner and outer edge — the donut's rule.
    const width = RING_WIDTH;
    const radius = 50 - width / 2;
    const circumference = 2 * Math.PI * radius;

    // With no bands the gauge is a single arc as long as the value; the colour
    // comes from CSS (--_fill), which already resolves data-status.
    const bands: Array<{ from: number; to: number; color: string | null; rest?: true }> =
      zones.length
        ? zones.map((z) => ({ from: z.from, to: z.to, color: z.color }))
        : [{ from: 0, to: frac, color: null }];

    // The REMAINDER — one grey band covering whatever the data leaves over.
    //
    // This replaced a full half-circle track drawn underneath everything. The
    // bands already cover the gauge up to their end, so the only part of that
    // track that ever showed WAS the remainder; drawing just that removes a
    // second copy of the half-circle dash maths, which is where the geometry
    // kept going wrong.
    const filled = bands.length ? bands[bands.length - 1]!.to : 0;
    if (filled < 1) bands.push({ from: filled, to: 1, color: null, rest: true });

    host.replaceChildren();
    bands.forEach((band, i) => {
      const svg = tpl.content.firstElementChild!;
      const arc = svg.firstElementChild!.cloneNode(true) as SVGCircleElement;
      // HALF the circumference is the visible gauge, so every fraction halves.
      const length = Math.max((band.to - band.from) * circumference * 0.5, 0);
      arc.setAttribute('r', String(radius));
      arc.setAttribute('stroke-width', String(width));
      arc.setAttribute('stroke-dasharray', `${length} ${circumference}`);
      // A NEGATIVE offset advances the dash along the path.
      //
      // The +0.5 is the gauge's zero. An unrotated <circle> path starts at 3
      // o'clock and runs CLOCKWISE, so 9 o'clock — where the gauge begins — is
      // exactly half the circumference along it, and clockwise from there runs
      // up over the visible top. Baking that half-turn in here is why the arcs
      // need no CSS rotation: rotating the circle instead meant resolving a
      // transform-origin against the fill box, which swung the whole ring.
      arc.setAttribute(
        'stroke-dashoffset',
        String(-(0.5 + band.from * 0.5) * circumference),
      );
      // The index pairs the arc with its tip; CSS cannot derive it.
      arc.dataset['index'] = String(i);
      // The remainder is chrome, not data: CSS greys it and drops its pointer
      // target, so it never claims a tooltip.
      if (band.rest) arc.dataset['rest'] = '';
      if (band.color) arc.style.setProperty('--_hue', band.color);
      host.appendChild(arc);

      // The OUTLINE — two thin arcs tracing this band's inner and outer edge,
      // exactly as sherpa-donut-chart outlines a slice. It has to be separate
      // geometry because one stroked circle carries one paint, and the band is
      // two: a 60% tint plus a solid edge. Each edge arc sits half its own width
      // inside the band, so the stroke lands ON the edge rather than straddling
      // it and bleeding outside the ring.
      if (band.rest) return;
      const inner = radius - width / 2;
      const outer = radius + width / 2;
      for (const edgeRadius of [inner + OUTLINE / 2, outer - OUTLINE / 2]) {
        const edge = svg.firstElementChild!.cloneNode(true) as SVGCircleElement;
        edge.classList.replace('zone', 'zone-outline');
        edge.setAttribute('r', String(edgeRadius));
        edge.setAttribute('stroke-width', String(OUTLINE));
        // ITS OWN circumference — a different radius means a different path
        // length, so reusing the band's numbers would leave the outline short.
        const edgeCircumference = 2 * Math.PI * edgeRadius;
        edge.setAttribute(
          'stroke-dasharray',
          `${Math.max((band.to - band.from) * edgeCircumference * 0.5, 0)} ${edgeCircumference}`,
        );
        edge.setAttribute(
          'stroke-dashoffset',
          String(-(0.5 + band.from * 0.5) * edgeCircumference),
        );
        if (band.color) edge.style.setProperty('--_hue', band.color);
        host.appendChild(edge);
      }
    });
  }
}

customElements.define('sherpa-gauge-chart', SherpaGaugeChart);
