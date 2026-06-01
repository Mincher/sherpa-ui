/**
 * @element sherpa-slider
 * @category control
 * @description Single or dual-handle range slider with optional numeric inputs.
 *   Pointer event drag with setPointerCapture. Keyboard arrows with step.
 *
 * @attr {string}  [data-label]       — Label text above the slider
 * @attr {enum}    [data-type=single] — single | range
 * @attr {number}  [data-min=0]       — Minimum value
 * @attr {number}  [data-max=100]     — Maximum value
 * @attr {number}  [data-step=1]      — Step increment
 * @attr {string}  [data-value]       — Current value (single mode)
 * @attr {string}  [data-value-low]   — Low handle value (range mode)
 * @attr {string}  [data-value-high]  — High handle value (range mode)
 * @attr {boolean} [data-show-inputs] — Show numeric input fields beside track
 * @attr {boolean} [data-show-labels] — Show min/max increment labels
 * @attr {boolean} [disabled]         — Disabled state
 *
 * @fires input
 *   bubbles: true, composed: true
 *   detail: { value: number } (single) or { low: number, high: number } (range)
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { value: number } (single) or { low: number, high: number } (range)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaSlider extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("sherpa-slider.css", import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL("sherpa-slider.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-type",
      "data-min",
      "data-max",
      "data-step",
      "data-value",
      "data-value-low",
      "data-value-high",
      "data-show-labels",
      "disabled",
    ];
  }

  /* ── cached refs ─────────────────────────────────────────── */

  // Cached shadow DOM elements (typed for better autocomplete)
  els = this.cacheElements({
    label: { selector: '.label', type: HTMLSpanElement },
    trackArea: { selector: '.track-area', type: HTMLDivElement },
    fill: { selector: '.fill', type: HTMLDivElement },
    lowHandle: { selector: '.handle-low', type: HTMLDivElement },
    highHandle: { selector: '.handle-high', type: HTMLDivElement },
    inputLow: { selector: '.input-low', type: HTMLInputElement },
    inputHigh: { selector: '.input-high', type: HTMLInputElement },
    incrementMin: { selector: '.increment-min', type: HTMLSpanElement },
    incrementMax: { selector: '.increment-max', type: HTMLSpanElement },
  });

  /** @type {'low'|'high'|null} which handle is being dragged */
  #activeHandle = null;

  /* ── lifecycle ───────────────────────────────────────────── */

  override onRender(): void {
    // Element cache auto-populated on first access

    // Defaults
    if (!this.dataset["type"]) this.dataset["type"] = "single";
    if (!this.dataset["min"]) this.dataset["min"] = "0";
    if (!this.dataset["max"]) this.dataset["max"] = "100";
    if (!this.dataset["step"]) this.dataset["step"] = "1";

    // Set initial values if not provided
    if (this.#isRange) {
      if (!this.dataset["valueLow"])
        this.dataset["valueLow"] = this.dataset["min"] || "0";
      if (!this.dataset["valueHigh"])
        this.dataset["valueHigh"] = this.dataset["max"] || "100";
    } else {
      if (!this.dataset["value"])
        this.dataset["value"] = this.dataset["min"] || "0";
    }

    // Set up input attributes
    this.#syncInputAttrs();

    // Wire pointer events on track area
    // @ts-expect-error - TODO: Fix type
    this.els.trackArea.addEventListener("pointerdown", (e: CustomEvent) =>
      this.#onPointerDown(e)
    );

    // Wire keyboard events on handles
    // @ts-expect-error - TODO: Fix type
    this.els.lowHandle.addEventListener("keydown", (e: CustomEvent) =>
      this.#onKeyDown(e, "low")
    );
    // @ts-expect-error - TODO: Fix type
    this.els.highHandle.addEventListener("keydown", (e: CustomEvent) =>
      this.#onKeyDown(e, "high")
    );

    // Wire input change events
    // @ts-expect-error - TODO: Fix type
    this.els.inputLow.addEventListener("change", (e: CustomEvent) =>
      this.#onInputChange(e, "low")
    );
    // @ts-expect-error - TODO: Fix type
    this.els.inputHigh.addEventListener("change", (e: CustomEvent) =>
      this.#onInputChange(e, "high")
    );

    // Initial sync
    this.#syncAll();
  }

  // @ts-expect-error - TODO: Fix type
  override onAttributeChanged(name: string, _old, _new) {
    switch (name) {
      case "data-label":
        this.#syncLabel();
        break;
      case "data-value":
      case "data-value-low":
      case "data-value-high":
        this.#syncTrack();
        this.#syncInputValues();
        this.#syncAria();
        break;
      case "data-min":
      case "data-max":
      case "data-step":
        this.#syncInputAttrs();
        this.#syncTrack();
        this.#syncLabels();
        this.#syncAria();
        break;
      case "data-type":
        this.#syncAll();
        break;
      case "data-show-labels":
        this.#syncLabels();
        break;
      case "disabled":
        this.#syncDisabled();
        break;
    }
  }

  /* ── getters ─────────────────────────────────────────────── */

  get #isRange() {
    return this.dataset["type"] === "range";
  }

  get #min() {
    // @ts-expect-error - TODO: Fix type
    return parseFloat(this.dataset["min"]) || 0;
  }

  get #max() {
    // @ts-expect-error - TODO: Fix type
    const v = parseFloat(this.dataset["max"]);
    return Number.isFinite(v) ? v : 100;
  }

  get #step() {
    // @ts-expect-error - TODO: Fix type
    const v = parseFloat(this.dataset["step"]);
    return v > 0 ? v : 1;
  }

  get #valueLow() {
    // @ts-expect-error - TODO: Fix type
    const v = parseFloat(this.dataset["valueLow"]);
    return Number.isFinite(v) ? this.#clamp(v) : this.#min;
  }

  get #valueHigh() {
    if (this.#isRange) {
      // @ts-expect-error - TODO: Fix type
      const v = parseFloat(this.dataset["valueHigh"]);
      return Number.isFinite(v) ? this.#clamp(v) : this.#max;
    }
    // @ts-expect-error - TODO: Fix type
    const v = parseFloat(this.dataset["value"]);
    return Number.isFinite(v) ? this.#clamp(v) : this.#min;
  }

  /* ── sync helpers ────────────────────────────────────────── */

  #syncAll() {
    this.#syncLabel();
    this.#syncTrack();
    this.#syncInputAttrs();
    this.#syncInputValues();
    this.#syncLabels();
    this.#syncAria();
    this.#syncDisabled();
  }

  #syncLabel() {
    if (this.els.label) {
      this.els.label.textContent = this.dataset["label"] || "";
    }
  }

  #syncTrack() {
    const range = this.#max - this.#min;
    if (range <= 0) return;

    const lowPct = ((this.#valueLow - this.#min) / range) * 100;
    const highPct = ((this.#valueHigh - this.#min) / range) * 100;

    this.style.setProperty("--_low-pct", `${lowPct}%`);
    this.style.setProperty("--_high-pct", `${highPct}%`);
  }

  #syncInputAttrs() {
    if (this.els.inputLow) {
      this.els.inputLow.min = String(this.#min);
      this.els.inputLow.max = String(this.#max);
      this.els.inputLow.step = String(this.#step);
    }
    if (this.els.inputHigh) {
      this.els.inputHigh.min = String(this.#min);
      this.els.inputHigh.max = String(this.#max);
      this.els.inputHigh.step = String(this.#step);
    }
  }

  #syncInputValues() {
    if (this.els.inputLow) {
      this.els.inputLow.value = String(this.#valueLow);
    }
    if (this.els.inputHigh) {
      this.els.inputHigh.value = String(this.#valueHigh);
    }
  }

  #syncLabels() {
    if (this.els.incrementMin) {
      this.els.incrementMin.textContent = String(this.#min);
    }
    if (this.els.incrementMax) {
      this.els.incrementMax.textContent = String(this.#max);
    }
  }

  #syncAria() {
    if (this.#isRange) {
      // Low handle
      if (this.els.lowHandle) {
        this.els.lowHandle.setAttribute("aria-valuemin", String(this.#min));
        this.els.lowHandle.setAttribute(
          "aria-valuemax",
          String(this.#valueHigh)
        );
        this.els.lowHandle.setAttribute("aria-valuenow", String(this.#valueLow));
        this.els.lowHandle.setAttribute("aria-label", "Range low value");
      }
      // High handle
      if (this.els.highHandle) {
        this.els.highHandle.setAttribute(
          "aria-valuemin",
          String(this.#valueLow)
        );
        this.els.highHandle.setAttribute("aria-valuemax", String(this.#max));
        this.els.highHandle.setAttribute(
          "aria-valuenow",
          String(this.#valueHigh)
        );
        this.els.highHandle.setAttribute("aria-label", "Range high value");
      }
    } else {
      // Single handle — use high handle
      if (this.els.highHandle) {
        this.els.highHandle.setAttribute("aria-valuemin", String(this.#min));
        this.els.highHandle.setAttribute("aria-valuemax", String(this.#max));
        this.els.highHandle.setAttribute(
          "aria-valuenow",
          String(this.#valueHigh)
        );
        this.els.highHandle.setAttribute("aria-label", "Slider value");
      }
    }
  }

  #syncDisabled() {
    const dis = this.hasAttribute("disabled");
    if (this.els.lowHandle)
      this.els.lowHandle.tabIndex = dis ? -1 : 0;
    if (this.els.highHandle)
      this.els.highHandle.tabIndex = dis ? -1 : 0;
    if (this.els.inputLow) this.els.inputLow.disabled = dis;
    if (this.els.inputHigh) this.els.inputHigh.disabled = dis;
  }

  /* ── value helpers ───────────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #clamp(v) {
    return Math.min(this.#max, Math.max(this.#min, v));
  }

  // @ts-expect-error - TODO: Fix type
  #snap(v) {
    const step = this.#step;
    const min = this.#min;
    return Math.round((v - min) / step) * step + min;
  }

  // @ts-expect-error - TODO: Fix type
  #pctToValue(pct) {
    return this.#snap(this.#min + pct * (this.#max - this.#min));
  }

  #getPctFromPointer(e: Event) {
    // @ts-expect-error - TODO: Fix type
    const rect = this.els.trackArea.getBoundingClientRect();
    // @ts-expect-error - TODO: Fix type
    const x = e.clientX - rect.left;
    return Math.min(1, Math.max(0, x / rect.width));
  }

  /* ── pointer events ──────────────────────────────────────── */

  #onPointerDown(e: Event) {
    if (this.hasAttribute("disabled")) return;
    // @ts-expect-error - TODO: Fix type
    if (e.button !== 0) return;

    e.preventDefault();
    const pct = this.#getPctFromPointer(e);
    const value = this.#pctToValue(pct);

    // Determine which handle
    if (this.#isRange) {
      const distLow = Math.abs(value - this.#valueLow);
      const distHigh = Math.abs(value - this.#valueHigh);
      // Choose closest handle; if equal, prefer high
      // @ts-expect-error - TODO: Fix type
      this.#activeHandle = distLow < distHigh ? "low" : "high";
    } else {
      // @ts-expect-error - TODO: Fix type
      this.#activeHandle = "high";
    }

    this.#setHandleValue(this.#activeHandle, value);
    this.#emitInput();

    const activeEl =
      this.#activeHandle === "low" ? this.els.lowHandle : this.els.highHandle;
    // @ts-expect-error - TODO: Fix type
    activeEl.setAttribute("data-dragging", "");
    // @ts-expect-error - TODO: Fix type
    activeEl.setPointerCapture(e.pointerId);

    // @ts-expect-error - TODO: Fix type
    const onMove = (ev) => {
      const p = this.#getPctFromPointer(ev);
      this.#setHandleValue(this.#activeHandle, this.#pctToValue(p));
      this.#emitInput();
    };

    // @ts-expect-error - TODO: Fix type
    const onUp = (ev) => {
      // @ts-expect-error - TODO: Fix type
      activeEl.removeAttribute("data-dragging");
      // @ts-expect-error - TODO: Fix type
      activeEl.releasePointerCapture(ev.pointerId);
      // @ts-expect-error - TODO: Fix type
      activeEl.removeEventListener("pointermove", onMove);
      // @ts-expect-error - TODO: Fix type
      activeEl.removeEventListener("pointerup", onUp);
      // @ts-expect-error - TODO: Fix type
      activeEl.removeEventListener("pointercancel", onUp);
      this.#emitChange();
      this.#activeHandle = null;
    };

    // @ts-expect-error - TODO: Fix type
    activeEl.addEventListener("pointermove", onMove);
    // @ts-expect-error - TODO: Fix type
    activeEl.addEventListener("pointerup", onUp);
    // @ts-expect-error - TODO: Fix type
    activeEl.addEventListener("pointercancel", onUp);
  }

  // @ts-expect-error - TODO: Fix type
  #setHandleValue(handle, value) {
    const clamped = this.#clamp(value);
    if (handle === "low") {
      // Collision avoidance: low can't exceed high
      const maxLow = this.#valueHigh;
      this.dataset["valueLow"] = String(Math.min(clamped, maxLow));
    } else {
      if (this.#isRange) {
        // Collision avoidance: high can't go below low
        const minHigh = this.#valueLow;
        this.dataset["valueHigh"] = String(Math.max(clamped, minHigh));
      } else {
        this.dataset["value"] = String(clamped);
      }
    }
  }

  /* ── keyboard events ─────────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #onKeyDown(e, handle) {
    if (this.hasAttribute("disabled")) return;

    const step = this.#step;
    const bigStep = step * 10;
    let delta = 0;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        delta = e.shiftKey ? bigStep : step;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        delta = e.shiftKey ? -bigStep : -step;
        break;
      case "Home":
        delta = this.#min - (handle === "low" ? this.#valueLow : this.#valueHigh);
        break;
      case "End":
        delta = this.#max - (handle === "low" ? this.#valueLow : this.#valueHigh);
        break;
      default:
        return;
    }

    e.preventDefault();
    const current = handle === "low" ? this.#valueLow : this.#valueHigh;
    this.#setHandleValue(handle, this.#snap(current + delta));
    this.#emitInput();
    this.#emitChange();
  }

  /* ── input field events ──────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #onInputChange(e, handle) {
    const raw = parseFloat(e.target.value);
    if (!Number.isFinite(raw)) return;
    this.#setHandleValue(handle, this.#snap(raw));
    this.#emitChange();
  }

  /* ── event emission ──────────────────────────────────────── */

  #getDetail() {
    if (this.#isRange) {
      return { low: this.#valueLow, high: this.#valueHigh };
    }
    return { value: this.#valueHigh };
  }

  #emitInput() {
    this.dispatchEvent(
      new CustomEvent("input", {
        bubbles: true,
        composed: true,
        detail: this.#getDetail(),
      })
    );
  }

  #emitChange() {
    this.dispatchEvent(
      new CustomEvent("change", {
        bubbles: true,
        composed: true,
        detail: this.#getDetail(),
      })
    );
  }
}

customElements.define("sherpa-slider", SherpaSlider);
export { SherpaSlider };
