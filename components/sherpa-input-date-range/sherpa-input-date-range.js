/**
 * @element sherpa-input-date-range
 * @extends SherpaInputBase
 * @description Date range picker composing two native date inputs (start / end).
 *   Inherits label, description, helper, layout, validation from SherpaInputBase.
 *   Start ≤ end constraint soft-enforced via min/max on native inputs.
 *
 * @attr {string}  [data-value-start] — Start date (YYYY-MM-DD)
 * @attr {string}  [data-value-end]   — End date (YYYY-MM-DD)
 * @attr {string}  [min]              — Minimum selectable date (YYYY-MM-DD)
 * @attr {string}  [max]              — Maximum selectable date (YYYY-MM-DD)
 *
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { start: string|null, end: string|null }
 * @fires input
 *   bubbles: true, composed: true
 *   detail: { start: string|null, end: string|null }
 *
 * @prop {string}    valueStart  — Getter/setter for data-value-start
 * @prop {string}    valueEnd    — Getter/setter for data-value-end
 * @prop {Date|null} startAsDate — Start value as Date (getter-only)
 * @prop {Date|null} endAsDate   — End value as Date (getter-only)
 */

import { SherpaInputBase } from "../utilities/sherpa-input-base/sherpa-input-base.js";

export class SherpaInputDateRange extends SherpaInputBase {
  static get cssUrl() {
    return new URL("sherpa-input-date-range.css", import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL("sherpa-input-date-range.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-value-start",
      "data-value-end",
      "min",
      "max",
    ];
  }

  /** @type {HTMLInputElement|null} */
  #startEl = null;
  /** @type {HTMLInputElement|null} */
  #endEl = null;

  /* ── lifecycle ───────────────────────────────────────────── */

  onInputRender() {
    this.#startEl = this.$(".input-start");
    this.#endEl = this.$(".input-end");

    // Wire events
    this.#startEl.addEventListener("change", () => this.#onDateChange());
    this.#endEl.addEventListener("change", () => this.#onDateChange());
    this.#startEl.addEventListener("input", () => this.#onDateInput());
    this.#endEl.addEventListener("input", () => this.#onDateInput());

    // Sync initial values
    this.#syncValues();
    this.#syncMinMax();
  }

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);
    switch (name) {
      case "data-value-start":
      case "data-value-end":
        this.#syncValues();
        break;
      case "min":
      case "max":
        this.#syncMinMax();
        break;
    }
  }

  /* ── overrides ───────────────────────────────────────────── */

  /** The primary input for base-class focus handling. */
  getInputElement() {
    return this.#startEl || this.$(".input-start");
  }

  /* ── sync helpers ────────────────────────────────────────── */

  #syncValues() {
    if (this.#startEl) {
      this.#startEl.value = this.dataset.valueStart || "";
    }
    if (this.#endEl) {
      this.#endEl.value = this.dataset.valueEnd || "";
    }
    this.#updateCrossConstraints();
  }

  #syncMinMax() {
    const min = this.getAttribute("min");
    const max = this.getAttribute("max");

    if (this.#startEl) {
      min ? this.#startEl.setAttribute("min", min) : this.#startEl.removeAttribute("min");
      max ? this.#startEl.setAttribute("max", max) : this.#startEl.removeAttribute("max");
    }
    if (this.#endEl) {
      min ? this.#endEl.setAttribute("min", min) : this.#endEl.removeAttribute("min");
      max ? this.#endEl.setAttribute("max", max) : this.#endEl.removeAttribute("max");
    }
    this.#updateCrossConstraints();
  }

  /**
   * Enforce start ≤ end by setting the start input's max to end's value
   * and end input's min to start's value.
   */
  #updateCrossConstraints() {
    if (!this.#startEl || !this.#endEl) return;

    const startVal = this.#startEl.value;
    const endVal = this.#endEl.value;

    // End can't be before start
    if (startVal) {
      this.#endEl.min = startVal;
    } else {
      const globalMin = this.getAttribute("min");
      globalMin
        ? this.#endEl.setAttribute("min", globalMin)
        : this.#endEl.removeAttribute("min");
    }

    // Start can't be after end
    if (endVal) {
      this.#startEl.max = endVal;
    } else {
      const globalMax = this.getAttribute("max");
      globalMax
        ? this.#startEl.setAttribute("max", globalMax)
        : this.#startEl.removeAttribute("max");
    }
  }

  /* ── event handlers ──────────────────────────────────────── */

  #onDateChange() {
    // Read native inputs back into data attributes
    this.dataset.valueStart = this.#startEl.value;
    this.dataset.valueEnd = this.#endEl.value;
    this.#updateCrossConstraints();

    this.dispatchEvent(
      new CustomEvent("change", {
        bubbles: true,
        composed: true,
        detail: {
          start: this.#startEl.value || null,
          end: this.#endEl.value || null,
        },
      })
    );
  }

  #onDateInput() {
    this.dispatchEvent(
      new CustomEvent("input", {
        bubbles: true,
        composed: true,
        detail: {
          start: this.#startEl.value || null,
          end: this.#endEl.value || null,
        },
      })
    );
  }

  /* ── public API ──────────────────────────────────────────── */

  /** Start date as a string (YYYY-MM-DD). */
  get valueStart() {
    return this.dataset.valueStart || "";
  }
  set valueStart(v) {
    this.dataset.valueStart = v || "";
  }

  /** End date as a string (YYYY-MM-DD). */
  get valueEnd() {
    return this.dataset.valueEnd || "";
  }
  set valueEnd(v) {
    this.dataset.valueEnd = v || "";
  }

  /** Start date as a Date object, or null. */
  get startAsDate() {
    const v = this.valueStart;
    if (!v) return null;
    const d = new Date(v + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  /** End date as a Date object, or null. */
  get endAsDate() {
    const v = this.valueEnd;
    if (!v) return null;
    const d = new Date(v + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
}

customElements.define("sherpa-input-date-range", SherpaInputDateRange);
