/**
 * @element sherpa-sparkline
 * @category media
 * @description CSS-driven sparkline. JS sets raw data values as CSS custom
 *   properties; CSS handles normalisation via calc() and visual rendering
 *   (clip-path polygons per segment).
 *
 * @attr {string}  [data-values]  — Comma-separated or JSON array (e.g. "10,25,15,30")
 * @attr {enum}    [data-variant] — bar (default: line)
 * @attr {string}  [data-unit]    — Unit label for tooltip display
 *
 * @method setValues(values) — Set sparkline data points
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

// @ts-expect-error - TODO: Fix type
const formatTooltipValue = (value, unitLabel = '') => {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value ?? '');
  
  let formatted;
  const abs = Math.abs(num);
  
  // Apply magnitude shorthand for numbers with 4+ digits
  if (abs >= 1e6) {
    formatted = (num / 1e6).toFixed(2).replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '') + 'M';
  } else if (abs >= 1e3) {
    formatted = (num / 1e3).toFixed(2).replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '') + 'K';
  } else {
    formatted = num.toFixed(2).replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '');
  }
  
  return unitLabel ? `${unitLabel}: ${formatted}` : formatted;
};

export class SherpaSparkline extends SherpaElement {
  static override get cssUrl(): string { return new URL('./sherpa-sparkline.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-sparkline.html', import.meta.url).href; }

  static override get observedAttributes(): string[] { return [...super.observedAttributes, 'data-values']; }

  #values = [];
  #shapeEls = [];
  #pointEls = [];
  #shapeSlots = 0;
  #pointSlots = 0;

  els = this.cacheElements({
    tip: '.tip',
    tipText: '.tip-text'
  });

  override onRender(): void {
    this.#shapeEls = Array.from(this.$$('.shape'));
    this.#pointEls = Array.from(this.$$('.point'));
    this.#shapeSlots = this.#shapeEls.length;
    this.#pointSlots = this.#shapeSlots + 1;

    // Add tooltip handlers to points
    this.#pointEls.forEach((point: any) => {
      point.addEventListener('pointerenter', this.#onPointEnter);
      point.addEventListener('pointerleave', this.#onPointLeave);
    });

    // Re-apply values (handles initial load + any re-render)
    this.#updateFromAttribute();
  }

  override onDisconnect(): void {
    this.#pointEls.forEach((point: any) => {
      point.removeEventListener('pointerenter', this.#onPointEnter);
      point.removeEventListener('pointerleave', this.#onPointLeave);
    });
  }

  // @ts-expect-error - TODO: Fix type
  override onAttributeChanged(name: string, _oldValue, _newValue) {
    if (name === 'data-values') this.#updateFromAttribute();
  }

  #onPointEnter = (e: Event) => {
    const point = e.target;
    if (!this.els.tip) return;

    // @ts-expect-error - TODO: Fix type
    const rawValue = point.dataset["value"];
    if (rawValue === undefined) return;
    const unitLabel = this.dataset["unit"] || '';
    // @ts-expect-error - TODO: Fix type
    this.els.tipText.textContent = formatTooltipValue(rawValue, unitLabel);
    // @ts-expect-error - TODO: Fix type
    point.style.anchorName = '--spark-anchor';
    // @ts-expect-error - TODO: Fix type
    this.els.tip.showPopover();
  };

  #onPointLeave = (e: Event) => {
    // @ts-expect-error - TODO: Fix type
    this.els.tip?.hidePopover();
    // @ts-expect-error - TODO: Fix type
    e.target.style.removeProperty('anchor-name');
  };

  /**
   * Set sparkline data points.
   * Writes to the data-values attribute — the single source of truth.
   * The attribute persists through the async bootstrap, so values set
   * before the template loads are picked up by onRender().
   * @param {number[]} values - Array of numeric values (any range, will be normalized)
   */
  // @ts-expect-error - TODO: Fix type
  setValues(values) {
    if (!Array.isArray(values) || values.length === 0) return;
    this.dataset["values"] = JSON.stringify(values);
  }

  #updateFromAttribute() {
    const attr = this.dataset["values"];
    if (!attr) return;
    let parsed;
    try {
      parsed = JSON.parse(attr);
    } catch {
      // Try comma-separated format
      parsed = attr.split(',').map((v: any) => parseFloat(v.trim())).filter((v: any) => !isNaN(v));
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      // @ts-expect-error - TODO: Fix type
      this.#values = parsed;
      this.#applyPoints();
    }
  }

  #applyPoints() {
    const values = this.#values;
    if (!this.#shapeSlots) return;

    const maxPoints = this.#pointSlots;
    const limitedValues = values.slice(-maxPoints);
    const points = limitedValues;
    const actualPoints = points.length;
    const actualSegments = Math.max(actualPoints - 1, 0);

    if (!actualPoints) {
      this.#shapeEls.forEach((shape: any) => shape.toggleAttribute('hidden', true));
      this.#pointEls.forEach((point: any) => point.toggleAttribute('hidden', true));
      return;
    }

    // Compute range for CSS calc() normalisation
    const numPoints = points.map((v: any) => Number(v));
    const min = Math.min(...numPoints);
    const max = Math.max(...numPoints);
    const range = max - min || 1;

    // Set range info + raw values on host — CSS normalises via calc()
    // @ts-expect-error - TODO: Fix type
    this.style.setProperty('--_min', min);
    // @ts-expect-error - TODO: Fix type
    this.style.setProperty('--_range', range);

    for (let i = 0; i < this.#pointSlots; i++) {
      if (i < actualPoints) {
        // @ts-expect-error - TODO: Fix type
        this.style.setProperty(`--_v${i}`, numPoints[i]);
      } else {
        this.style.removeProperty(`--_v${i}`);
      }
    }

    // Toggle shape/point visibility
    this.#shapeEls.forEach((shape, index) => {
      // @ts-expect-error - TODO: Fix type
      shape.toggleAttribute('hidden', index >= actualSegments);
    });

    this.#pointEls.forEach((point: any) => {
      const index = Number(point.dataset["index"]);
      const active = Number.isFinite(index) && index < actualPoints;
      point.toggleAttribute('hidden', !active);
      if (active) {
        point.dataset["value"] = points[index];
      } else {
        delete point.dataset["value"];
      }
    });
  }
}

customElements.define('sherpa-sparkline', SherpaSparkline);
