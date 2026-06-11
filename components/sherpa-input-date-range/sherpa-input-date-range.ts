/**
 * @element sherpa-input-date-range
 * @category input
 * @extends SherpaInputBase
 * @description Two-field date range picker with calendar popups for start and end dates. Use
 *   for filtering or date-bounded form fields (report periods, booking windows, audit spans).
 *   The component soft-enforces start ≤ end via browser min/max constraints. The change event
 *   emits both values together as { start, end } — always in YYYY-MM-DD format.
 *
 * @attr {string}  data-value-start — Start date (YYYY-MM-DD)
 * @attr {string}  data-value-end   — End date (YYYY-MM-DD)
 * @attr {string}  min              — Minimum selectable date (YYYY-MM-DD)
 * @attr {string}  max              — Maximum selectable date (YYYY-MM-DD)
 *
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { start: string|null, end: string|null }
 * @fires input
 *   bubbles: true, composed: true
 *   detail: { start: string|null, end: string|null }
 *
 * @prop {string}                  valueStart  — Getter/setter for data-value-start
 * @prop {string}                  valueEnd    — Getter/setter for data-value-end
 * @prop {Temporal.PlainDate|null} startAsDate — Start value as PlainDate (getter-only)
 * @prop {Temporal.PlainDate|null} endAsDate   — End value as PlainDate (getter-only)
 */

import { SherpaInputBase } from "../utilities/sherpa-input-base/sherpa-input-base.js";
import {
  MONTH_NAMES,
  isoToDate,
  formatDateDisplay,
  renderCalendarGrid,
} from "../utilities/calendar-helper.js";

export class SherpaInputDateRange extends SherpaInputBase {

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
  #startViewDate = Temporal.Now.plainDateISO().with({ day: 1 });
  /** Current month displayed in the end calendar. */
  #endViewDate   = Temporal.Now.plainDateISO().add({ months: 1 }).with({ day: 1 });

  protected override _popupClose(): void { this.#closeAll(); }

  /* ── Lifecycle ──────────────────────────────────────────────── */

  override onInputRender(): void {
    this.#startEl = this.$<HTMLInputElement>(".input-start");
    this.#endEl   = this.$<HTMLInputElement>(".input-end");
    this.#dayTpl  = this.$<HTMLTemplateElement>(".cal-day-tpl");

    // Initialise view months from current values (or today / today + 1 month)
    const today  = Temporal.Now.plainDateISO();
    const startD = isoToDate(this.dataset["valueStart"]);
    const endD   = isoToDate(this.dataset["valueEnd"]);

    this.#startViewDate = (startD || today).with({ day: 1 });
    this.#endViewDate   = (endD   || today.add({ months: 1 })).with({ day: 1 });

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

    // ── Calendar navigation ──────────────────────────────────
    this.#wireMonthNav(
      ".prev-start", ".next-start",
      () => this.#startViewDate,
      (d) => { this.#startViewDate = d; },
      () => this.#renderStartCalendar(),
    );
    this.#wireMonthNav(
      ".prev-end", ".next-end",
      () => this.#endViewDate,
      (d) => { this.#endViewDate = d; },
      () => this.#renderEndCalendar(),
    );
  }

  override onInputConnect(): void    { this._attachPopupListeners(); }
  override onInputDisconnect(): void { this._detachPopupListeners(); }

  /** Wire prev/next month nav buttons for one calendar panel. */
  #wireMonthNav(
    prevSel: string, nextSel: string,
    getDate: () => Temporal.PlainDate,
    setDate: (d: Temporal.PlainDate) => void,
    render: () => void,
  ): void {
    this.$(prevSel)?.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      setDate(getDate().subtract({ months: 1 }));
      render();
    });
    this.$(nextSel)?.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      setDate(getDate().add({ months: 1 }));
      render();
    });
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null): void {
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
  override getInputElement(): HTMLInputElement | null {
    return this.#startEl || this.$(".input-start");
  }

  /* ── Open / Close ───────────────────────────────────────────── */

  #openStart(): void {
    const val = this.#startEl?.value;
    if (val) {
      const d = isoToDate(val);
      if (d) this.#startViewDate = d.with({ day: 1 });
    }
    this.#renderStartCalendar();
    this.setAttribute("data-open-start", "");
    this.$(".trigger-start")?.setAttribute("aria-expanded", "true");
    this.#positionPopup('.popup-start', '.trigger-start');
  }

  #closeStart(): void {
    this.removeAttribute("data-open-start");
    this.$(".trigger-start")?.setAttribute("aria-expanded", "false");
  }

  #openEnd(): void {
    const val = this.#endEl?.value;
    if (val) {
      const d = isoToDate(val);
      if (d) this.#endViewDate = d.with({ day: 1 });
    }
    this.#renderEndCalendar();
    this.setAttribute("data-open-end", "");
    this.$(".trigger-end")?.setAttribute("aria-expanded", "true");
    this.#positionPopup('.popup-end', '.trigger-end');
  }

  #positionPopup(popupSel: string, triggerSel: string): void {
    const popup = this.$<HTMLElement>(popupSel);
    const trigger = this.$<HTMLElement>(triggerSel);
    if (!popup || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const popupH = popup.offsetHeight || 320;
    if (spaceBelow < popupH + 4 && rect.top > popupH + 4) {
      popup.style.top = `${rect.top - popupH - 4}px`;
    } else {
      popup.style.top = `${rect.bottom + 4}px`;
    }
    popup.style.left = `${Math.min(rect.left, window.innerWidth - (popup.offsetWidth || 280) - 8)}px`;
  }

  #closeEnd(): void {
    this.removeAttribute("data-open-end");
    this.$(".trigger-end")?.setAttribute("aria-expanded", "false");
  }

  #closeAll(): void {
    this.#closeStart();
    this.#closeEnd();
  }

  /* ── Calendar rendering ─────────────────────────────────────── */

  #renderStartCalendar(): void {
    const monthYearEl = this.$(".month-year-start");
    const daysEl      = this.$<HTMLElement>(".days-start");
    if (!monthYearEl || !daysEl || !this.#dayTpl) return;

    monthYearEl.textContent =
      `${MONTH_NAMES[this.#startViewDate.month - 1]} ${this.#startViewDate.year}`;

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

  #renderEndCalendar(): void {
    const monthYearEl = this.$(".month-year-end");
    const daysEl      = this.$<HTMLElement>(".days-end");
    if (!monthYearEl || !daysEl || !this.#dayTpl) return;

    monthYearEl.textContent =
      `${MONTH_NAMES[this.#endViewDate.month - 1]} ${this.#endViewDate.year}`;

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

  #selectStart(iso: string): void {
    if (!this.#startEl) return;
    this.#startEl.value = iso;
    this.dataset["valueStart"] = iso;
    this.#updateCrossConstraints();
    this.#syncStartTrigger();
    this.#onDateChange();
    this.#closeStart();
  }

  #selectEnd(iso: string): void {
    if (!this.#endEl) return;
    this.#endEl.value = iso;
    this.dataset["valueEnd"] = iso;
    this.#updateCrossConstraints();
    this.#syncEndTrigger();
    this.#onDateChange();
    this.#closeEnd();
  }

  /* ── Sync helpers ───────────────────────────────────────────── */

  #syncValues(): void {
    if (this.#startEl) {
      this.#startEl.value = this.dataset["valueStart"] || "";
    }
    if (this.#endEl) {
      this.#endEl.value = this.dataset["valueEnd"] || "";
    }
    this.#updateCrossConstraints();
  }

  #syncMinMax(): void {
    const min = this.getAttribute("min");
    const max = this.getAttribute("max");

    if (this.#startEl) {
      if (min) { this.#startEl.setAttribute("min", min); } else { this.#startEl.removeAttribute("min"); }
      if (max) { this.#startEl.setAttribute("max", max); } else { this.#startEl.removeAttribute("max"); }
    }
    if (this.#endEl) {
      if (min) { this.#endEl.setAttribute("min", min); } else { this.#endEl.removeAttribute("min"); }
      if (max) { this.#endEl.setAttribute("max", max); } else { this.#endEl.removeAttribute("max"); }
    }
    this.#updateCrossConstraints();
  }

  /**
   * Enforce start ≤ end by dynamically setting the start input's max to
   * end's value, and end input's min to start's value.
   */
  #updateCrossConstraints(): void {
    if (!this.#startEl || !this.#endEl) return;

    const startVal = this.#startEl.value;
    const endVal   = this.#endEl.value;

    // End can't be before start
    if (startVal) {
      this.#endEl.min = startVal;
    } else {
      const globalMin = this.getAttribute("min");
      if (globalMin) { this.#endEl.setAttribute("min", globalMin); } else { this.#endEl.removeAttribute("min"); }
    }

    // Start can't be after end
    if (endVal) {
      this.#startEl.max = endVal;
    } else {
      const globalMax = this.getAttribute("max");
      if (globalMax) { this.#startEl.setAttribute("max", globalMax); } else { this.#startEl.removeAttribute("max"); }
    }
  }

  /** Update the start trigger display and slot data-has-value. */
  #syncStartTrigger(): void {
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
  #syncEndTrigger(): void {
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

  #onDateChange(): void {
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
  public get valueStart(): string { return this.dataset["valueStart"] || ""; }
  public set valueStart(v: string) { this.dataset["valueStart"] = v || ""; }

  /** End date as a string (YYYY-MM-DD). */
  public get valueEnd(): string { return this.dataset["valueEnd"] || ""; }
  public set valueEnd(v: string) { this.dataset["valueEnd"] = v || ""; }

  /** Start date as a Temporal.PlainDate, or null. */
  get startAsDate(): Temporal.PlainDate | null {
    return isoToDate(this.dataset["valueStart"]);
  }

  /** End date as a Temporal.PlainDate, or null. */
  get endAsDate(): Temporal.PlainDate | null {
    return isoToDate(this.dataset["valueEnd"]);
  }
}

customElements.define("sherpa-input-date-range", SherpaInputDateRange);
