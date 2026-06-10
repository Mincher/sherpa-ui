/**
 * @element sherpa-gauge-chart
 * @category media
 * @description Semicircular gauge dial for displaying a single numeric value within a defined
 *   range. Use on dashboards for KPIs with a clear upper bound (SLA compliance %, storage
 *   usage, score out of 100). The series variant (data-variant="series") divides the arc into
 *   coloured threshold segments — use it to show red/amber/green performance zones.
 *
 * @attr {string}  data-title   — Chart heading text
 * @attr {number}  data-value   — Numeric value 0–100
 * @attr {string}  data-min     — Min range label (default: "0%")
 * @attr {string}  data-max     — Max range label (default: "100%")
 * @attr {string}  data-label   — Descriptive text below value
 * @attr {boolean} data-loading — Show loading state
 * @attr {enum}    data-variant  — solid | series
 *
 * @method setSegments(segments) — Series variant: set arc segments [{ value, color? }]
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

/** A coloured arc segment in the series variant. */
interface GaugeSegment {
  value: number;
  color?: string;
}

const DEFAULT_COLORS = [
  '#058142', // green
  '#ffaa00', // amber
  '#ff6b35', // orange
  '#e84c3d', // red
];

export class SherpaGaugeChart extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-gauge-chart.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-gauge-chart.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-title',
      'data-value',
      'data-min',
      'data-max',
      'data-label',
      'data-loading',
      'data-variant',
    ];
  }

  /* ── State ────────────────────────────────────────────────────── */

  #segments: GaugeSegment[] = [];
  #titleEl: HTMLElement | null = null;
  #fillEl: HTMLElement | null = null;
  #needleEl: HTMLElement | null = null;
  #valueEl: HTMLElement | null = null;
  #labelEl: HTMLElement | null = null;
  #rangeMinEl: HTMLElement | null = null;
  #rangeMaxEl: HTMLElement | null = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {
    this.#titleEl    = this.$<HTMLElement>('.chart-title');
    this.#fillEl     = this.$<HTMLElement>('.gauge-fill');
    this.#needleEl   = this.$<HTMLElement>('.needle');
    this.#valueEl    = this.$<HTMLElement>('.gauge-value');
    this.#labelEl    = this.$<HTMLElement>('.gauge-label');
    this.#rangeMinEl = this.$<HTMLElement>('.range-min');
    this.#rangeMaxEl = this.$<HTMLElement>('.range-max');

    this.#syncTitle();
    this.#syncRange();
    this.#syncValue();
  }

  override onAttributeChanged(name: string) {
    switch (name) {
      case 'data-title': this.#syncTitle(); break;
      case 'data-value': this.#syncValue(); break;
      case 'data-min':
      case 'data-max':   this.#syncRange(); break;
      case 'data-label': this.#syncLabel(); break;
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  /**
   * Series variant — set coloured arc segments.
   * Each segment: { value: number (0–100 contribution), color?: string }
   * Values should sum to ≤ 100.
   * @param {Array<{value: number, color?: string}>} segments
   */
  setSegments(segments: GaugeSegment[]) {
    this.#segments = segments || [];
    this.#renderSeries();
  }

  /* ── Private: sync ────────────────────────────────────────────── */

  #syncTitle() {
    if (this.#titleEl) {
      this.#titleEl.textContent = this.dataset["title"] || '';
    }
  }

  #syncLabel() {
    if (this.#labelEl) {
      this.#labelEl.textContent = this.dataset["label"] || '';
    }
  }

  #syncRange() {
    if (this.#rangeMinEl) {
      this.#rangeMinEl.textContent = this.dataset["min"] ?? '0%';
    }
    if (this.#rangeMaxEl) {
      this.#rangeMaxEl.textContent = this.dataset["max"] ?? '100%';
    }
  }

  /**
   * Map 0–100 value to needle rotation.
   * Needle rotates from -90deg (left, 0%) through 0deg (top, 50%) to +90deg (right, 100%).
   * CSS transform-origin is bottom-centre of the needle.
   */
  #syncValue() {
    const raw = parseFloat(this.dataset["value"] || "");
    const pct = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;

    // Needle angle: -90 (left) → +90 (right)
    const angle = (pct / 100) * 180 - 90;

    if (this.#needleEl) {
      this.#needleEl.style.setProperty('--_angle', `${angle}deg`);
    }

    // Fill percentage: conic-gradient spans 0–50% of the circle (the visible top half)
    // so value 0–100 maps to 0–50% of the gradient
    const fillPct = (pct / 100) * 50;

    if (this.#fillEl) {
      this.#fillEl.style.setProperty('--_fill-pct', `${fillPct}%`);
    }

    // Value text
    if (this.#valueEl) {
      this.#valueEl.textContent = Number.isFinite(raw) ? `${Math.round(raw)}%` : '';
    }

    // Label text
    if (this.#labelEl) {
      this.#labelEl.textContent = this.dataset["label"] || '';
    }
  }

  /* ── Private: series rendering ────────────────────────────────── */

  #renderSeries() {
    if (!this.#fillEl) return;

    const total = this.#segments.reduce((s, seg) => s + (seg.value || 0), 0);
    if (!total) {
      this.#fillEl.style.setProperty('--_fill-gradient',
        'conic-gradient(from 0.5turn, transparent 0% 50%, transparent 50% 100%)');
      return;
    }

    // Build conic-gradient stops across the top semicircle (0–50% of circle)
    const stops: string[] = [];
    let cumulative = 0;

    this.#segments.forEach((seg, i) => {
      const color = seg.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const segPct = (seg.value / 100) * 50; // map 0–100 → 0–50%
      const start = cumulative;
      cumulative += segPct;
      stops.push(`${color} ${start}% ${cumulative}%`);
    });

    // Transparent for remainder
    stops.push(`transparent ${cumulative}% 50%`);
    stops.push(`transparent 50% 100%`);

    this.#fillEl.style.setProperty('--_fill-gradient',
      `conic-gradient(from 0.5turn, ${stops.join(', ')})`);

    // Update needle to total value
    const angle = (Math.min(total, 100) / 100) * 180 - 90;
    if (this.#needleEl) {
      this.#needleEl.style.setProperty('--_angle', `${angle}deg`);
    }
    if (this.#valueEl) {
      this.#valueEl.textContent = `${Math.round(total)}%`;
    }
  }
}

customElements.define('sherpa-gauge-chart', SherpaGaugeChart);
