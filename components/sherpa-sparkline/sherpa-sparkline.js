/**
 * sherpa-sparkline.js
 * Shadow DOM component extending SherpaElement — CSS-driven rendering.
 * JS sets raw data values and range info as CSS custom properties on the host;
 * CSS handles normalisation via calc() and all visual rendering
 * (clip-path polygons per segment).
 *
 * Status Styling:
 *   Inherits --border-color from parent component (e.g. sherpa-metric) which
 *   sets colour via status attribute selectors. CSS custom properties from
 *   the outer document inherit through the shadow boundary.
 *
 * Attributes:
 *   - data-values: string - Comma-separated or JSON array (e.g., "10,25,15,30")
 *   - data-variant: string - "bar" for bar mode
 *   - data-unit: string - Unit label for tooltip display
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

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
  static get cssUrl() { return new URL('./sherpa-sparkline.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-sparkline.html', import.meta.url).href; }

  static get observedAttributes() { return [...super.observedAttributes, 'data-values']; }

  #values = [];
  #shapeElements = [];
  #pointElements = [];
  #shapeSlots = 0;
  #pointSlots = 0;
  #tipEl = null;
  #tipText = null;

  onRender() {
    this.#shapeElements = Array.from(this.$$('.shape'));
    this.#pointElements = Array.from(this.$$('.point'));
    this.#shapeSlots = this.#shapeElements.length;
    this.#pointSlots = this.#shapeSlots + 1;
    this.#tipEl = this.$('.tip');
    this.#tipText = this.$('.tip-text');

    // Add tooltip handlers to points
    this.#pointElements.forEach(point => {
      point.addEventListener('pointerenter', this.#handlePointEnter);
      point.addEventListener('pointerleave', this.#handlePointLeave);
    });

    // Re-apply values (handles initial load + any re-render)
    this.#updateFromAttribute();
  }

  onDisconnect() {
    this.#pointElements.forEach(point => {
      point.removeEventListener('pointerenter', this.#handlePointEnter);
      point.removeEventListener('pointerleave', this.#handlePointLeave);
    });
  }

  onAttributeChanged(name, _oldValue, _newValue) {
    if (name === 'data-values') this.#updateFromAttribute();
  }

  #handlePointEnter = (e) => {
    const point = e.target;
    if (!this.#tipEl) return;

    const rawValue = point.dataset.value;
    if (rawValue === undefined) return;
    const unitLabel = this.dataset.unit || '';
    this.#tipText.textContent = formatTooltipValue(rawValue, unitLabel);
    point.style.anchorName = '--spark-anchor';
    this.#tipEl.showPopover();
  };

  #handlePointLeave = (e) => {
    this.#tipEl?.hidePopover();
    e.target.style.removeProperty('anchor-name');
  };

  /**
   * Set sparkline data points.
   * Writes to the data-values attribute — the single source of truth.
   * The attribute persists through the async bootstrap, so values set
   * before the template loads are picked up by onRender().
   * @param {number[]} values - Array of numeric values (any range, will be normalized)
   */
  setValues(values) {
    if (!Array.isArray(values) || values.length === 0) return;
    this.dataset.values = JSON.stringify(values);
  }

  #updateFromAttribute() {
    const attr = this.dataset.values;
    if (!attr) return;
    let parsed;
    try {
      parsed = JSON.parse(attr);
    } catch {
      // Try comma-separated format
      parsed = attr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
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
      this.#shapeElements.forEach(shape => shape.toggleAttribute('hidden', true));
      this.#pointElements.forEach(point => point.toggleAttribute('hidden', true));
      return;
    }

    // Compute range for CSS calc() normalisation
    const numPoints = points.map(v => Number(v));
    const min = Math.min(...numPoints);
    const max = Math.max(...numPoints);
    const range = max - min || 1;

    // Set range info + raw values on host — CSS normalises via calc()
    this.style.setProperty('--_min', min);
    this.style.setProperty('--_range', range);

    for (let i = 0; i < this.#pointSlots; i++) {
      if (i < actualPoints) {
        this.style.setProperty(`--_v${i}`, numPoints[i]);
      } else {
        this.style.removeProperty(`--_v${i}`);
      }
    }

    // Toggle shape/point visibility
    this.#shapeElements.forEach((shape, index) => {
      shape.toggleAttribute('hidden', index >= actualSegments);
    });

    this.#pointElements.forEach(point => {
      const index = Number(point.dataset.index);
      const active = Number.isFinite(index) && index < actualPoints;
      point.toggleAttribute('hidden', !active);
      if (active) {
        point.dataset.value = points[index];
      } else {
        delete point.dataset.value;
      }
    });
  }
}

customElements.define('sherpa-sparkline', SherpaSparkline);
