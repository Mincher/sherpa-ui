/**
 * @element sherpa-input-date-range
 * @category input
 * @extends SherpaInputBase
 * @description Date range picker with calendar popups for start and end dates.
 *   Inherits label, description, helper, layout, validation from SherpaInputBase.
 *   Start ≤ end constraint soft-enforced via min/max on native inputs.
 *   Range highlight shown on days between selected start and end.
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
import {
  MONTH_NAMES,
  isoToDate,
  formatDateDisplay,
  renderCalendarGrid,
} from "../utilities/calendar-helper.js";

/* ── Dataset Interface ─────────────────────────────────────────── */

interface SherpaInputDateRangeDataset extends DOMStringMap {
  label?: string;
  description?: string;
  helper?: string;
  layout?: 'horizontal' | 'vertical';
  valueStart?: string;
  valueEnd?: string;
}

export class SherpaInputDateRange extends SherpaInputBase {

  override get dataset(): SherpaInputDateRangeDataset {
    return super.dataset as SherpaInputDateRangeDataset;
  }
  static override get cssUrl(): string {
    return new URL("sherpa-input-date-range.css", import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL("sherpa-input-date-range.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-value-start",
      "data-value-end",
      "min",
      "max",
    ];
  }

  /* ── Private state ──────────────────────────────────────────── */

  /** @type {HTMLInputElement|null} */     #startEl       = null;
  /** @type {HTMLInputElement|null} */     #endEl         = null;
  /** @type {HTMLTemplateElement|null} */  #dayTpl        = null;
  /** Current month displayed in the start calendar. */
  #startViewDate = new Date();
  /** Current month displayed in the end calendar. */
  #endViewDate   = new Date();

  /** Bound document handlers stored for removeEventListener. */
  #onDocClick = (e: Event) => {
    if (!e.composedPath().includes(this)) this.#closeAll();
  };

  #onDocKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.#closeAll();
  };

  /* ── Lifecycle ──────────────────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  override onInputRender(): void {
    // @ts-expect-error - TODO: Fix type
    this.#startEl = this.$(".input-start");
    // @ts-expect-error - TODO: Fix type
    this.#endEl   = this.$(".input-end");
    // @ts-expect-error - TODO: Fix type
    this.#dayTpl  = this.$(".cal-day-tpl");

    // Initialise view months from current values (or today / today + 1 month)
    const today = new Date();
    const startD = isoToDate(this.dataset["valueStart"]);
    const endD   = isoToDate(this.dataset["valueEnd"]);

    this.#startViewDate = startD
      ? new Date(startD.getFullYear(), startD.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    this.#endViewDate = endD
      ? new Date(endD.getFullYear(), endD.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // Initial value sync
    this.#syncValues();
    this.#syncMinMax();
    this.#syncStartTrigger();
    this.#syncEndTrigger();

    // ── Trigger buttons ──────────────────────────────────────
    // @ts-expect-error - TODO: Fix type
    this.$(".trigger-start").addEventListener("click", (e: CustomEvent) => {
      e.stopPropagation();
      if (this.hasAttribute("disabled") || this.hasAttribute("readonly")) return;
      if (this.hasAttribute("data-open-start")) {
        this.#closeStart();
      } else {
        this.#closeEnd();
        this.#openStart();
      }
    });

    // @ts-expect-error - TODO: Fix type
    this.$(".trigger-end").addEventListener("click", (e: CustomEvent) => {
      e.stopPropagation();
      if (this.hasAttribute("disabled") || this.hasAttribute("readonly")) return;
      if (this.hasAttribute("data-open-end")) {
        this.#closeEnd();
      } else {
        this.#closeStart();
        this.#openEnd();
      }
    });

    // ── Start calendar navigation ────────────────────────────
    // @ts-expect-error - TODO: Fix type
    this.$(".prev-start").addEventListener("click", (e: CustomEvent) => {
      e.stopPropagation();
      this.#startViewDate = new Date(
        this.#startViewDate.getFullYear(),
        this.#startViewDate.getMonth() - 1,
        1,
      );
      this.#renderStartCalendar();
    });

    // @ts-expect-error - TODO: Fix type
    this.$(".next-start").addEventListener("click", (e: CustomEvent) => {
      e.stopPropagation();
      this.#startViewDate = new Date(
        this.#startViewDate.getFullYear(),
        this.#startViewDate.getMonth() + 1,
        1,
      );
      this.#renderStartCalendar();
    });

    // ── End calendar navigation ──────────────────────────────
    // @ts-expect-error - TODO: Fix type
    this.$(".prev-end").addEventListener("click", (e: CustomEvent) => {
      e.stopPropagation();
      this.#endViewDate = new Date(
        this.#endViewDate.getFullYear(),
        this.#endViewDate.getMonth() - 1,
        1,
      );
      this.#renderEndCalendar();
    });

    // @ts-expect-error - TODO: Fix type
    this.$(".next-end").addEventListener("click", (e: CustomEvent) => {
      e.stopPropagation();
      this.#endViewDate = new Date(
        this.#endViewDate.getFullYear(),
        this.#endViewDate.getMonth() + 1,
        1,
      );
      this.#renderEndCalendar();
    });
  }

  override onInputConnect(): void {
    document.addEventListener("click",   this.#onDocClick);
    document.addEventListener("keydown", this.#onDocKey);
  }

  override onInputDisconnect(): void {
    document.removeEventListener("click",   this.#onDocClick);
    document.removeEventListener("keydown", this.#onDocKey);
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null) {
    super.onAttributeChanged(name, oldValue, newValue);
    switch (name) {
      case "data-value-start":
      case "data-value-end":
        this.#syncValues();
        this.#syncStartTrigger();
        this.#syncEndTrigger();
        break;
      case "min":
      case "max":
        this.#syncMinMax();
        // Re-render open popups to refresh disabled states
        if (this.hasAttribute("data-open-start")) this.#renderStartCalendar();
        if (this.hasAttribute("data-open-end"))   this.#renderEndCalendar();
        break;
    }
  }

  /* ── Overrides ──────────────────────────────────────────────── */

  /** The primary input for base-class focus handling. */
  // @ts-expect-error - TODO: Fix type
  override getInputElement() {
    return this.#startEl || this.$(".input-start");
  }

  /* ── Open / Close ───────────────────────────────────────────── */

  #openStart() {
    // @ts-expect-error - TODO: Fix type
    const val = this.#startEl?.value;
    if (val) {
      const d = isoToDate(val);
      if (d) this.#startViewDate = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    this.#renderStartCalendar();
    this.setAttribute("data-open-start", "");
    this.$(".trigger-start")?.setAttribute("aria-expanded", "true");
  }

  #closeStart() {
    this.removeAttribute("data-open-start");
    this.$(".trigger-start")?.setAttribute("aria-expanded", "false");
  }

  #openEnd() {
    // @ts-expect-error - TODO: Fix type
    const val = this.#endEl?.value;
    if (val) {
      const d = isoToDate(val);
      if (d) this.#endViewDate = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    this.#renderEndCalendar();
    this.setAttribute("data-open-end", "");
    this.$(".trigger-end")?.setAttribute("aria-expanded", "true");
  }

  #closeEnd() {
    this.removeAttribute("data-open-end");
    this.$(".trigger-end")?.setAttribute("aria-expanded", "false");
  }

  #closeAll() {
    this.#closeStart();
    this.#closeEnd();
  }

  /* ── Calendar rendering ─────────────────────────────────────── */

  #renderStartCalendar() {
    const monthYearEl = this.$(".month-year-start");
    const daysEl      = this.$(".days-start");
    if (!monthYearEl || !daysEl || !this.#dayTpl) return;

    monthYearEl.textContent =
      `${MONTH_NAMES[this.#startViewDate.getMonth()]} ${this.#startViewDate.getFullYear()}`;

    // End value constrains start max; global max constrains further
    // @ts-expect-error - TODO: Fix type
    const startMax = this.#endEl?.value || this.getAttribute("max");

    renderCalendarGrid(
      daysEl,
      this.#dayTpl,
      this.#startViewDate,
      // @ts-expect-error - TODO: Fix type
      this.#startEl?.value || null,
      // @ts-expect-error - TODO: Fix type
      this.#endEl?.value   || null,
      this.getAttribute("min"),
      startMax || null,
      // @ts-expect-error - TODO: Fix type
      (iso) => this.#selectStart(iso),
    );
  }

  #renderEndCalendar() {
    const monthYearEl = this.$(".month-year-end");
    const daysEl      = this.$(".days-end");
    if (!monthYearEl || !daysEl || !this.#dayTpl) return;

    monthYearEl.textContent =
      `${MONTH_NAMES[this.#endViewDate.getMonth()]} ${this.#endViewDate.getFullYear()}`;

    // Start value constrains end min; global min constrains further
    // @ts-expect-error - TODO: Fix type
    const endMin = this.#startEl?.value || this.getAttribute("min");

    renderCalendarGrid(
      daysEl,
      this.#dayTpl,
      this.#endViewDate,
      // @ts-expect-error - TODO: Fix type
      this.#startEl?.value || null,
      // @ts-expect-error - TODO: Fix type
      this.#endEl?.value   || null,
      endMin || null,
      this.getAttribute("max"),
      // @ts-expect-error - TODO: Fix type
      (iso) => this.#selectEnd(iso),
    );
  }

  /* ── Date selection ─────────────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #selectStart(iso) {
    if (!this.#startEl) return;
    // @ts-expect-error - TODO: Fix type
    this.#startEl.value = iso;
    this.dataset["valueStart"] = iso;
    this.#updateCrossConstraints();
    this.#syncStartTrigger();
    this.#onDateChange();
    this.#closeStart();
  }

  // @ts-expect-error - TODO: Fix type
  #selectEnd(iso) {
    if (!this.#endEl) return;
    // @ts-expect-error - TODO: Fix type
    this.#endEl.value = iso;
    this.dataset["valueEnd"] = iso;
    this.#updateCrossConstraints();
    this.#syncEndTrigger();
    this.#onDateChange();
    this.#closeEnd();
  }

  /* ── Sync helpers ───────────────────────────────────────────── */

  #syncValues() {
    if (this.#startEl) {
      // @ts-expect-error - TODO: Fix type
      this.#startEl.value = this.dataset["valueStart"] || "";
    }
    if (this.#endEl) {
      // @ts-expect-error - TODO: Fix type
      this.#endEl.value = this.dataset["valueEnd"] || "";
    }
    this.#updateCrossConstraints();
  }

  #syncMinMax() {
    const min = this.getAttribute("min");
    const max = this.getAttribute("max");

    if (this.#startEl) {
      // @ts-expect-error - TODO: Fix type
      min ? this.#startEl.setAttribute("min", min) : this.#startEl.removeAttribute("min");
      // @ts-expect-error - TODO: Fix type
      max ? this.#startEl.setAttribute("max", max) : this.#startEl.removeAttribute("max");
    }
    if (this.#endEl) {
      // @ts-expect-error - TODO: Fix type
      min ? this.#endEl.setAttribute("min", min) : this.#endEl.removeAttribute("min");
      // @ts-expect-error - TODO: Fix type
      max ? this.#endEl.setAttribute("max", max) : this.#endEl.removeAttribute("max");
    }
    this.#updateCrossConstraints();
  }

  /**
   * Enforce start ≤ end by dynamically setting the start input's max to
   * end's value, and end input's min to start's value.
   */
  #updateCrossConstraints() {
    if (!this.#startEl || !this.#endEl) return;

    // @ts-expect-error - TODO: Fix type
    const startVal = this.#startEl.value;
    // @ts-expect-error - TODO: Fix type
    const endVal   = this.#endEl.value;

    // End can't be before start
    if (startVal) {
      // @ts-expect-error - TODO: Fix type
      this.#endEl.min = startVal;
    } else {
      const globalMin = this.getAttribute("min");
      globalMin
        // @ts-expect-error - TODO: Fix type
        ? this.#endEl.setAttribute("min", globalMin)
        // @ts-expect-error - TODO: Fix type
        : this.#endEl.removeAttribute("min");
    }

    // Start can't be after end
    if (endVal) {
      // @ts-expect-error - TODO: Fix type
      this.#startEl.max = endVal;
    } else {
      const globalMax = this.getAttribute("max");
      globalMax
        // @ts-expect-error - TODO: Fix type
        ? this.#startEl.setAttribute("max", globalMax)
        // @ts-expect-error - TODO: Fix type
        : this.#startEl.removeAttribute("max");
    }
  }

  /** Update the start trigger display and slot data-has-value. */
  #syncStartTrigger() {
    // @ts-expect-error - TODO: Fix type
    const val    = this.#startEl?.value || "";
    const textEl = this.$(".start-text");
    if (textEl) textEl.textContent = formatDateDisplay(val);

    const slot = this.$(".slot-start");
    if (slot) {
      // @ts-expect-error - TODO: Fix type
      if (val) slot.dataset["hasValue"] = "";
      // @ts-expect-error - TODO: Fix type
      else     delete slot.dataset["hasValue"];
    }
  }

  /** Update the end trigger display and slot data-has-value. */
  #syncEndTrigger() {
    // @ts-expect-error - TODO: Fix type
    const val    = this.#endEl?.value || "";
    const textEl = this.$(".end-text");
    if (textEl) textEl.textContent = formatDateDisplay(val);

    const slot = this.$(".slot-end");
    if (slot) {
      // @ts-expect-error - TODO: Fix type
      if (val) slot.dataset["hasValue"] = "";
      // @ts-expect-error - TODO: Fix type
      else     delete slot.dataset["hasValue"];
    }
  }

  /* ── Event dispatching ──────────────────────────────────────── */

  #onDateChange() {
    this.dispatchEvent(
      new CustomEvent("change", {
        bubbles: true,
        composed: true,
        detail: {
          // @ts-expect-error - TODO: Fix type
          start: this.#startEl?.value || null,
          // @ts-expect-error - TODO: Fix type
          end:   this.#endEl?.value   || null,
        },
      }),
    );
  }

  /* ── Public API ─────────────────────────────────────────────── */

  /** Start date as a string (YYYY-MM-DD). */
  get valueStart() { return this.dataset["valueStart"] || ""; }
  set valueStart(v) { this.dataset["valueStart"] = v || ""; }

  /** End date as a string (YYYY-MM-DD). */
  get valueEnd() { return this.dataset["valueEnd"] || ""; }
  set valueEnd(v) { this.dataset["valueEnd"] = v || ""; }

  /** Start date as a Date object, or null. */
  get startAsDate() {
    const v = this.dataset["valueStart"];
    if (!v) return null;
    const d = new Date(v + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  /** End date as a Date object, or null. */
  get endAsDate() {
    const v = this.dataset["valueEnd"];
    if (!v) return null;
    const d = new Date(v + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
}

customElements.define("sherpa-input-date-range", SherpaInputDateRange);

