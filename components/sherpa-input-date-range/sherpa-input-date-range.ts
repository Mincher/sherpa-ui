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

import { SherpaInputBase, SherpaInputDataset } from "../utilities/sherpa-input-base/sherpa-input-base.js";
import {
  MONTH_NAMES,
  isoToDate,
  formatDateDisplay,
  renderCalendarGrid,
} from "../utilities/calendar-helper.js";

/* ── Dataset Interface ─────────────────────────────────────────── */

interface SherpaInputDateRangeDataset extends SherpaInputDataset {
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

  #startEl: HTMLInputElement | null       = null;
  #endEl: HTMLInputElement | null         = null;
  #dayTpl: HTMLTemplateElement | null     = null;
  /** Current month displayed in the start calendar. */
  #startViewDate = new Date();
  /** Current month displayed in the end calendar. */
  #endViewDate   = new Date();

  protected override _popupClose() { this.#closeAll(); }

  /* ── Lifecycle ──────────────────────────────────────────────── */

  override onInputRender(): void {
    this.#startEl = this.$<HTMLInputElement>(".input-start");
    this.#endEl   = this.$<HTMLInputElement>(".input-end");
    this.#dayTpl  = this.$<HTMLTemplateElement>(".cal-day-tpl");

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
    this.$(".trigger-start")?.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      if (this.hasAttribute("disabled") || this.hasAttribute("readonly")) return;
      if (this.hasAttribute("data-open-start")) {
        this.#closeStart();
      } else {
        this.#closeEnd();
        this.#openStart();
      }
    });

    this.$(".trigger-end")?.addEventListener("click", (e: Event) => {
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
    this.$(".prev-start")?.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      this.#startViewDate = new Date(
        this.#startViewDate.getFullYear(),
        this.#startViewDate.getMonth() - 1,
        1,
      );
      this.#renderStartCalendar();
    });

    this.$(".next-start")?.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      this.#startViewDate = new Date(
        this.#startViewDate.getFullYear(),
        this.#startViewDate.getMonth() + 1,
        1,
      );
      this.#renderStartCalendar();
    });

    // ── End calendar navigation ──────────────────────────────
    this.$(".prev-end")?.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      this.#endViewDate = new Date(
        this.#endViewDate.getFullYear(),
        this.#endViewDate.getMonth() - 1,
        1,
      );
      this.#renderEndCalendar();
    });

    this.$(".next-end")?.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      this.#endViewDate = new Date(
        this.#endViewDate.getFullYear(),
        this.#endViewDate.getMonth() + 1,
        1,
      );
      this.#renderEndCalendar();
    });
  }

  override onInputConnect(): void    { this._attachPopupListeners(); }
  override onInputDisconnect(): void { this._detachPopupListeners(); }

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
  override getInputElement() {
    return this.#startEl || this.$(".input-start");
  }

  /* ── Open / Close ───────────────────────────────────────────── */

  #openStart() {
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
    const daysEl      = this.$<HTMLElement>(".days-start");
    if (!monthYearEl || !daysEl || !this.#dayTpl) return;

    monthYearEl.textContent =
      `${MONTH_NAMES[this.#startViewDate.getMonth()]} ${this.#startViewDate.getFullYear()}`;

    // End value constrains start max; global max constrains further
    const startMax = this.#endEl?.value || this.getAttribute("max");

    renderCalendarGrid(
      daysEl,
      this.#dayTpl,
      this.#startViewDate,
      this.#startEl?.value || null,
      this.#endEl?.value   || null,
      this.getAttribute("min"),
      startMax || null,
      (iso: string) => this.#selectStart(iso),
    );
  }

  #renderEndCalendar() {
    const monthYearEl = this.$(".month-year-end");
    const daysEl      = this.$<HTMLElement>(".days-end");
    if (!monthYearEl || !daysEl || !this.#dayTpl) return;

    monthYearEl.textContent =
      `${MONTH_NAMES[this.#endViewDate.getMonth()]} ${this.#endViewDate.getFullYear()}`;

    // Start value constrains end min; global min constrains further
    const endMin = this.#startEl?.value || this.getAttribute("min");

    renderCalendarGrid(
      daysEl,
      this.#dayTpl,
      this.#endViewDate,
      this.#startEl?.value || null,
      this.#endEl?.value   || null,
      endMin || null,
      this.getAttribute("max"),
      (iso: string) => this.#selectEnd(iso),
    );
  }

  /* ── Date selection ─────────────────────────────────────────── */

  #selectStart(iso: string) {
    if (!this.#startEl) return;
    this.#startEl.value = iso;
    this.dataset["valueStart"] = iso;
    this.#updateCrossConstraints();
    this.#syncStartTrigger();
    this.#onDateChange();
    this.#closeStart();
  }

  #selectEnd(iso: string) {
    if (!this.#endEl) return;
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
      this.#startEl.value = this.dataset["valueStart"] || "";
    }
    if (this.#endEl) {
      this.#endEl.value = this.dataset["valueEnd"] || "";
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
   * Enforce start ≤ end by dynamically setting the start input's max to
   * end's value, and end input's min to start's value.
   */
  #updateCrossConstraints() {
    if (!this.#startEl || !this.#endEl) return;

    const startVal = this.#startEl.value;
    const endVal   = this.#endEl.value;

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

  /** Update the start trigger display and slot data-has-value. */
  #syncStartTrigger() {
    const val    = this.#startEl?.value || "";
    const textEl = this.$(".start-text");
    if (textEl) textEl.textContent = formatDateDisplay(val);

    const slot = this.$<HTMLElement>(".slot-start");
    if (slot) {
      if (val) slot.dataset["hasValue"] = "";
      else     delete slot.dataset["hasValue"];
    }
  }

  /** Update the end trigger display and slot data-has-value. */
  #syncEndTrigger() {
    const val    = this.#endEl?.value || "";
    const textEl = this.$(".end-text");
    if (textEl) textEl.textContent = formatDateDisplay(val);

    const slot = this.$<HTMLElement>(".slot-end");
    if (slot) {
      if (val) slot.dataset["hasValue"] = "";
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
          start: this.#startEl?.value || null,
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

