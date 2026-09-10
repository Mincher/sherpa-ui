/**
 * sherpa-gauge-chart — a half-circle gauge for one value on a 0–100 scale.
 *
 * From data-value, JS works out how full the gauge is and which way the needle
 * points, then hands those two numbers to CSS. CSS draws the arc and turns the
 * needle. With data-zones, JS composes the threshold bands into a single
 * conic-gradient value (--_zones) and CSS paints it; without zones, CSS draws
 * the plain single-colour sweep. The big number, caption and scale are text.
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

/** Status name → the token used for the single-colour route, with a hex fallback. */
const STATUS_COLOUR: Record<string, string> = {
  success: 'var(--sherpa-style-surface-success-strong, #20c173)',
  warning: 'var(--sherpa-style-surface-warning-strong, #ffc44c)',
  urgent: 'var(--sherpa-style-surface-urgent-strong, #ff7300)',
  critical: 'var(--sherpa-style-surface-critical-strong, #fc4e2d)',
  info: 'var(--sherpa-style-surface-info-strong, #3b4ccd)',
};

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

    // Fill: 0–50% of the circle covers the visible top half.
    this.style.setProperty('--_fill-pct', `${frac * 50}%`);
    // Needle: -90deg (left) → +90deg (right) across the half.
    this.style.setProperty('--_angle', `${-90 + frac * 180}deg`);

    // Threshold zones → a full conic-gradient value bridged to CSS via --_zones.
    const zones = this.#parseZones(min, max);
    if (zones.length) {
      this.style.setProperty('--_zones', this.#zonesGradient(zones));
    } else {
      this.style.removeProperty('--_zones');
    }
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
      const wedge = frag.querySelector<HTMLElement>('.hit-wedge')!;
      const dot = frag.querySelector<HTMLElement>('.hotspot')!;
      const tip = frag.querySelector<HTMLElement>('.chart-tip')!;
      // The index pairs the wedge with its tip; CSS cannot derive it.
      wedge.dataset['index'] = String(i);
      tip.dataset['index'] = String(i);
      dot.dataset['index'] = String(i);

      // The hit wedge's own edges, plus six interior samples of its arc. The
      // clip-path walks these to trace the band, so the target follows the
      // coloured band rather than being a rectangle over it.
      const from = -90 + zone.from * 180;
      const to = -90 + zone.to * 180;
      wedge.style.setProperty('--_from', `${from}deg`);
      wedge.style.setProperty('--_to', `${to}deg`);
      for (let k = 1; k <= 6; k++) {
        wedge.style.setProperty(`--_a${k}`, `${from + ((to - from) * k) / 7}deg`);
      }
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
      wedge.setAttribute('aria-label', `${label} ${zone.rawFrom} to ${zone.rawTo}`.trim());
      host.append(wedge, dot, tip);
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
   * Build the conic-gradient. The visible half spans 0–50% of the circle
   * (from 270deg). Each zone fraction 0–1 maps to 0–50% of the sweep. Hard
   * stops keep the bands crisp; anything past the last band is transparent.
   */
  #zonesGradient(zones: Zone[]): string {
    const stops: string[] = [];
    for (const z of zones) {
      const start = (z.from * 50).toFixed(3);
      const end = (z.to * 50).toFixed(3);
      stops.push(`${z.color} ${start}% ${end}%`);
    }
    stops.push('transparent 50% 100%');
    return `conic-gradient(from 270deg, ${stops.join(', ')})`;
  }
}

customElements.define('sherpa-gauge-chart', SherpaGaugeChart);
