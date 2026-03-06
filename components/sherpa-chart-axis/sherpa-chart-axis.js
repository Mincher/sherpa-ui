/**
 * sherpa-chart-axis.js
 * SherpaChartAxis — Standalone chart axis with grid + labels.
 *
 * Usage:
 *   <sherpa-chart-axis data-orientation="horizontal"></sherpa-chart-axis>
 *   axis.setLabels(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
 *
 *   <sherpa-chart-axis data-orientation="vertical"></sherpa-chart-axis>
 *   axis.setRange(0, 100, 6);
 *
 * Attributes:
 *   data-orientation — horizontal (default) | vertical
 *   data-tick-count  — Number of grid divisions (default 5)
 *   data-loading     — Boolean
 *
 * Methods:
 *   setLabels(string[])
 *   setRange(min, max, count?)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaChartAxis extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-chart-axis.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-chart-axis.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'data-orientation',
      'data-tick-count',
      'data-loading',
    ];
  }

  /* ── State ────────────────────────────────────────────────────── */

  #labels = [];
  #labelsEl;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#labelsEl = this.$('.axis-labels');
    if (this.#labels.length) this.#render();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  /**
   * Set axis tick labels.
   * @param {string[]} labels
   */
  setLabels(labels) {
    this.#labels = labels || [];
    this.#render();
  }

  /**
   * Auto-generate numeric labels from a range.
   * @param {number} min
   * @param {number} max
   * @param {number} [count=6] — Number of labels
   */
  setRange(min, max, count = 6) {
    if (min === max) max = min + 1;
    const labels = [];
    for (let i = 0; i < count; i++) {
      const val = min + (max - min) * (i / (count - 1));
      labels.push(this.#formatValue(val));
    }
    // For vertical axis, reverse to show max at top
    if (this.dataset.orientation === 'vertical') {
      labels.reverse();
    }
    this.#labels = labels;
    this.#render();
  }

  /* ── Private ──────────────────────────────────────────────────── */

  #render() {
    if (!this.#labelsEl) return;
    this.#labelsEl.replaceChildren();

    for (const text of this.#labels) {
      const span = document.createElement('span');
      span.className = 'axis-label';
      span.textContent = text;
      this.#labelsEl.appendChild(span);
    }
  }

  #formatValue(val) {
    const abs = Math.abs(val);
    if (abs >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
    if (Number.isInteger(val)) return String(val);
    return val.toFixed(1);
  }
}

customElements.define('sherpa-chart-axis', SherpaChartAxis);
