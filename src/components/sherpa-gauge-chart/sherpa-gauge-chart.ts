/**
 * sherpa-gauge-chart — a half-circle gauge for one value on a 0–100 scale.
 *
 * TRAP T-gauge-band-is-a-closed-path — the constants below are path geometry,
 * not style.
 */
import { SHARED_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import { formatTick, radialArea, ringSegmentPath } from '../../core/data/format-tick.js';

/** One resolved zone band, as a fraction (0–1) of the scale and a colour. */
interface Zone {
  from: number;
  to: number;
  /** Translucent FILL — the status sequence's mid step at 50%. */
  color: string;
  /** SOLID outline — the same sequence's `border` variable. */
  border: string;
  /** The band's bounds on the RAW scale, for its tooltip label. */
  rawFrom: number;
  rawTo: number;
  /** The colour NAME as written (a status name, or a raw CSS colour). */
  name: string;
}

/** TRAP T-gauge-status-is-named — resolved BY NAME, never by position. */
const STATUS_ORDER = ['success', 'warning', 'urgent', 'critical', 'info'] as const;

/** Centre of the 100-unit circle. Only its TOP half is inside the viewBox. */
const CENTRE = 50;

/* Path geometry in viewBox units — an SVG `d` cannot read a custom property, so
   none of these can move to CSS. */

const RING_WIDTH = 15;

const CORNER = 1;

/** Outline thickness, aligned INSIDE as in Figma. */
const OUTLINE = 0.5;

/** Zero and span, clockwise from 12 o'clock: 9 o'clock to 3. */
const START_DEG = 270;
const SPAN_DEG = 180;

export class SherpaGaugeChart extends SherpaElement {
  static override css = new URL('./sherpa-gauge-chart.css', import.meta.url);
  static override html = new URL('./sherpa-gauge-chart.html', import.meta.url);
  // ONE LINE, deliberately: the spec generator reads only the first line.
  /* DECLARED, not hand-synced: CSS-only, so the base class writes nothing. */
  static override props = {
    'data-has-caption': { type: 'boolean', kind: 'visibility' },
    'data-legend': SHARED_PROPS['data-legend'],
  } as const;

  static override observed = ['data-value', 'data-label', 'data-min', 'data-max', 'data-zones', 'data-caption', 'data-unit'];

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

  /** Redraw everything from the current attributes. */
  #sync(): void {
    const min = this.num('data-min', 0);
    const max = this.num('data-max', 100);
    const raw = this.num('data-value', 0);
    const frac = max > min ? Math.min(1, Math.max(0, (raw - min) / (max - min))) : 0;

    this.style.setProperty('--_angle', `${-90 + frac * 180}deg`);

    const zones = this.#parseZones(min, max);
    this.#renderHotspots(this.#renderArcs(zones, frac));

    // Three SCALE ticks: min, midpoint, max. The middle one is a tick, not the
    // reading — TRAP T-zones-paint-in-full.
    const unit = this.dataset['unit'] ?? '';
    const tick = (n: number): string => `${formatTick(n)}${unit}`;
    const mid = this.$('.value');
    if (mid) mid.textContent = this.dataset['label'] ?? tick((min + max) / 2);
    const minEl = this.$('.min');
    if (minEl) minEl.textContent = tick(min);
    const maxEl = this.$('.max');
    if (maxEl) maxEl.textContent = tick(max);

    // A filled caption slot wins via light-DOM content.
    const caption = this.$('.caption');
    if (caption && !this.dataset['hasCaption']) {
      const slot = caption.querySelector('slot');
      const slotFilled = slot instanceof HTMLSlotElement && slot.assignedNodes().length > 0;
      if (!slotFilled) caption.textContent = this.dataset['caption'] ?? '';
    }
  }

  /**
   * Parse data-zones into resolved bands (fractions of the scale).
   *
   * Accepts "0-50:success,50-80:warning" or a JSON array [{from?,to,color}].
   * A missing `from` chains from the previous band's `to`.
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
        border: this.#zoneBorder(band.color),
        // Kept unclamped: the tooltip names the band on the reader's scale.
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
   * TRAP T-hotspots-follow-what-was-drawn.
   */
  #renderHotspots(zones: Zone[]): void {
    const host = this.$('.hotspots');
    const tpl = this.$<HTMLTemplateElement>('template.hotspot-tpl');
    if (!host || !tpl) return;

    host.replaceChildren();
    zones.forEach((zone, i) => {
      // The dot and its tip are SIBLINGS; the index pairs each with its arc.
      const frag = tpl.content.cloneNode(true) as DocumentFragment;
      const dot = frag.querySelector<HTMLElement>('.hotspot')!;
      const tip = frag.querySelector<HTMLElement>('.chart-tip')!;
      tip.dataset['index'] = String(i);
      dot.dataset['index'] = String(i);

      // The needle's own mapping, so a band's midpoint lands on its own arc.
      const mid = (zone.from + zone.to) / 2;
      const angle = -90 + mid * 180;
      dot.style.setProperty('--_dot-angle', `${angle}deg`);
      tip.style.setProperty('--_area', radialArea(angle));
      dot.style.setProperty('--_hue', zone.color);
      dot.style.setProperty('--_anchor', `--gauge-zone-${i}`);
      tip.style.setProperty('--_anchor', `--gauge-zone-${i}`);
      // A raw CSS colour has no name worth showing — that row is the range alone.
      const isStatus = (STATUS_ORDER as readonly string[]).includes(zone.name);
      const label = isStatus ? this.#zoneLabel(zone.name) : '';
      tip.querySelector('.chart-tip-label')!.textContent = label;
      tip.querySelector('.chart-tip-value')!.textContent = `${zone.rawFrom}–${zone.rawTo}`;
      /* The accessible name goes on the ARC, and so does `tabindex` — without
         it the name was there and nothing could reach it. The CSS lights this
         zone's tip on :focus-visible as well as :hover.
         TRAP T-a-chart-datum-is-reachable-without-a-pointer */
      const arc = this.$(`.zone[data-index="${i}"]`);
      if (arc) {
        arc.setAttribute('tabindex', '0');
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

  /** A zone's colour name → its band's fill. Anything unknown passes through. */
  #zoneColour(name: string): string {
    const known = (STATUS_ORDER as readonly string[]).includes(name);
    return known ? `var(--sherpa-status-${name}-fill)` : name;
  }

  /** A status's SOLID colour, for the band's outline. */
  #zoneBorder(name: string): string {
    const known = (STATUS_ORDER as readonly string[]).includes(name);
    return known ? `var(--sherpa-status-${name})` : name;
  }

  /**
   * Draw the ring — one closed path per band — and return the zones it DREW.
   *
   * The last band is the grey filler, so there is no separate track element.
   */
  #renderArcs(zones: Zone[], frac: number): Zone[] {
    const host = this.$('.zones');
    const tpl = this.$<HTMLTemplateElement>('template.zone-tpl');
    if (!host || !tpl) return [];

    // The TRUE band edges; the path is inset half an outline inside them.
    const outer = CENTRE - OUTLINE / 2;
    const inner = CENTRE - RING_WIDTH + OUTLINE / 2;

    // Zones paint in full; a bare value paints only up to itself.
    const bands: Array<{
      from: number;
      to: number;
      color: string | null;
      border?: string;
      rest?: true;
      zone?: Zone;
    }> = zones.length
      ? zones.map((z) => ({ from: z.from, to: z.to, color: z.color, border: z.border, zone: z }))
      : [{ from: 0, to: frac, color: null }];

    // One grey band over whatever the bands leave uncovered, so the gauge reads
    // full width.
    const covered = bands.length ? bands[bands.length - 1]!.to : 0;
    if (covered < 1) bands.push({ from: covered, to: 1, color: null, rest: true });

    host.replaceChildren();
    const drawn: Zone[] = [];
    // Counts only bands that REACHED the screen, so the dot indices have no holes.
    let index = 0;
    bands.forEach((band) => {
      if (band.to <= band.from) return;
      const i = index++;
      // Clone the <path> INSIDE the template's <svg>, not the wrapper — the
      // wrapper only exists to put the clone in the SVG namespace.
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
      arc.dataset['index'] = String(i);
      // The remainder is chrome, not data.
      if (band.rest) arc.dataset['rest'] = '';
      if (band.color) arc.style.setProperty('--_hue', band.color);
      if (band.border) arc.style.setProperty('--_border', band.border);
      host.appendChild(arc);
      // The remainder names no zone, so it gets no hover dot.
      if (band.zone) drawn.push(band.zone);
    });
    return drawn;
  }
}

customElements.define('sherpa-gauge-chart', SherpaGaugeChart);
