/**
 * sherpa-button.js
 * Unified button / behavior-chip web component.
 *
 * Layout: [ trigger ] [ select ▼ ] [ close × ]
 *
 * Plain buttons (no data-behavior): trigger only. Native <button>
 * provides keyboard, focus, and accessibility semantics — no
 * role="button", tabindex, or keydown handler needed.
 *
 * Behavior buttons (data-behavior="sort|filter|segment|timeframe"):
 * trigger cycles mode on click, native <select> provides dropdown,
 * close dispatches chipremove.
 *
 * Icons:
 *   <i> elements styled with Font Awesome 6. JS mirrors data-icon-start /
 *   data-icon-end to textContent. For sort behavior, icon-start swaps
 *   between sort / sort-up / sort-down unicode chars on mode change.
 *
 * Select:
 *   Native <select> with appearance: base-select. Adding `multiple`
 *   enables multi-selection — same CSS, same JS (.selectedOptions).
 *   Filter behavior sets multiple; sort/segment/timeframe single-select.
 *
 * Attributes:
 *   data-label, data-variant, data-size, data-active, disabled,
 *   data-status, data-icon-start, data-icon-end, data-icon-weight,
 *   data-behavior, data-mode, data-field, data-range-key,
 *   data-closeable, data-count, data-boolean
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

/* ── Constants ──────────────────────────────────────────────────── */

const NUMERIC_TYPES = new Set([
  "number", "int", "integer", "float", "double",
  "decimal", "currency", "percent", "percentage",
]);

const TIMESTAMP_TYPES = new Set([
  "date", "datetime", "timestamp", "time", "dateTime",
]);

/** Sort icon FA unicode chars. */
const SORT_ICONS = { off: "\uf0dc", asc: "\uf0de", desc: "\uf0dd" };

/** Behavior default icons. */
const BEHAVIOR_ICONS = {
  sort:      "\uf0dc",
  filter:    "\uf0b0",
  segment:   "\uf0c9",
  timeframe: "\uf017",
};

/** Behavior default icon weights. */
const BEHAVIOR_ICON_WEIGHTS = { timeframe: "regular" };

/** Compute { start, end } Date range for a preset key. */
function computeTimeRange(key) {
  if (!key) return null;
  const days = { "1d": 1, "1w": 7, "1m": 30, "1q": 90, "1y": 365 }[key];
  if (!days) return null;
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { start: start.toISOString(), end: now.toISOString() };
}


/* ── Component ─────────────────────────────────────────────────── */

export class SherpaButton extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-button.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-button.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-variant",
      "data-size",
      "data-active",
      "disabled",
      "data-icon-start",
      "data-icon-end",
      "data-behavior",
      "data-mode",
      "data-field",
      "data-range-key",
      "data-closeable",
    ];
  }

  /* ── Private state ────────────────────────────────────────────── */

  #triggerEl = null;
  #labelEl = null;
  #iconStartEl = null;
  #iconEndEl = null;
  #badgeEl = null;
  #selectEl = null;
  #selectIconEl = null;
  #closeEl = null;

  /* ── Behavior state (sort / filter / segment / timeframe) ────── */

  #columns = [];
  #userCleared = false;
  #valueRows = [];
  #uniqueValues = [];
  #selectedValues = new Set();
  #isBoolean = false;
  #rangeKey = "";
  #timestampField = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#triggerEl = this.$(".trigger");
    this.#labelEl = this.$(".label");
    this.#iconStartEl = this.$(".icon-start");
    this.#iconEndEl = this.$(".icon-end");
    this.#badgeEl = this.$(".badge");
    this.#selectEl = this.$(".select");
    this.#selectIconEl = this.$(".select-icon");
    this.#closeEl = this.$(".close");

    // Default variant for plain buttons (not behavior, not select-only)
    if (!this.dataset.behavior && !this.dataset.variant && !this.hasAttribute("data-select-only")) {
      this.dataset.variant = "primary";
    }

    if (this.hasAttribute("disabled")) {
      this.setAttribute("aria-disabled", "true");
    }

    this.#initBehavior();
    this.#initSelectOnly();
    this.#syncLabel();
    this.#syncIcons();
  }

  onConnect() {
    this.#triggerEl?.addEventListener("click", this.#onTriggerClick);
    this.#selectEl?.addEventListener("change", this.#onSelectChange);
    this.#closeEl?.addEventListener("click", this.#onCloseClick);

    // Timeframe: initialise from data-range-key attribute
    if (this.behavior === "timeframe") {
      const attrKey = this.getAttribute("data-range-key");
      if (attrKey && !this.#rangeKey) {
        this.#rangeKey = attrKey;
        this.setAttribute("data-mode", "on");
        this.#updateLabel();
        this.#updateActive();
        queueMicrotask(() => this.#emitFilterChange());
      }
    }
  }

  onDisconnect() {
    this.#triggerEl?.removeEventListener("click", this.#onTriggerClick);
    this.#selectEl?.removeEventListener("change", this.#onSelectChange);
    this.#closeEl?.removeEventListener("click", this.#onCloseClick);
  }

  onAttributeChanged(name, _old, newValue) {
    switch (name) {
      case "disabled":
        if (newValue !== null) {
          this.setAttribute("aria-disabled", "true");
        } else {
          this.removeAttribute("aria-disabled");
        }
        if (this.#selectEl) this.#selectEl.disabled = newValue !== null;
        break;

      case "data-label":
        this.#syncLabel();
        break;

      case "data-icon-start":
      case "data-icon-end":
        this.#syncIcons();
        break;

      case "data-mode":
        if (this.behavior === "sort") this.#syncSortIcon();
        this.#updateActive();
        break;

      case "data-field":
        this.#updateLabel();
        this.#updateActive();
        break;

      case "data-range-key":
        if (this.behavior === "timeframe" && newValue) {
          this.#rangeKey = newValue;
          this.setAttribute("data-mode", "on");
          this.#updateLabel();
          this.#updateActive();
          this.#emitFilterChange();
        }
        break;
    }
  }

  /* ── Behavior init ────────────────────────────────────────────── */

  #initBehavior() {
    const bvr = this.behavior;
    if (!bvr) return;

    // Default icon per behavior
    if (!this.dataset.iconStart && BEHAVIOR_ICONS[bvr]) {
      this.dataset.iconStart = BEHAVIOR_ICONS[bvr];
    }
    if (BEHAVIOR_ICON_WEIGHTS[bvr] && !this.dataset.iconWeight) {
      this.dataset.iconWeight = BEHAVIOR_ICON_WEIGHTS[bvr];
    }

    if (!this.#selectEl) return;

    // Filter: multi-select
    if (bvr === "filter") {
      this.#selectEl.multiple = true;
    }

    // Timeframe: populate preset options
    if (bvr === "timeframe") {
      const opts = [
        ["", "All time"], ["1d", "Last 24 hours"], ["1w", "Last 7 days"],
        ["1m", "Last 30 days"], ["1q", "Last 90 days"], ["1y", "Last 365 days"],
      ];
      for (const [value, text] of opts) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = text;
        opt.selected = value === "";
        this.#selectEl.appendChild(opt);
      }
    }

    // Sort / segment: add "None" default option
    if (bvr === "sort" || bvr === "segment") {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "None";
      opt.selected = true;
      this.#selectEl.appendChild(opt);
    }
  }

  /* ── Select-only init ─────────────────────────────────────────── */

  /**
   * Icon-only select mode: import <option>, <optgroup>, <hr> from
   * light DOM into the shadow <select>. Consumers declare options
   * declaratively as children of the host element.
   */
  #initSelectOnly() {
    if (!this.hasAttribute("data-select-only") || !this.#selectEl) return;
    for (const el of this.querySelectorAll(
      ":scope > option, :scope > optgroup, :scope > hr",
    )) {
      this.#selectEl.appendChild(el.cloneNode(true));
    }
  }

  /* ── Label ────────────────────────────────────────────────────── */

  #syncLabel() {
    if (!this.#labelEl) return;
    if (this.behavior) {
      this.#updateLabel();
    } else {
      this.#labelEl.textContent = this.dataset.label ?? "";
    }
  }

  #updateLabel() {
    if (!this.#labelEl) return;

    if (this.behavior === "timeframe") {
      const labels = {
        "1d": "Last 24 hours", "1w": "Last 7 days",
        "1m": "Last 30 days", "1q": "Last 90 days",
        "1y": "Last 365 days",
      };
      this.#labelEl.textContent =
        labels[this.#rangeKey] || this.dataset.label ||
        this.textContent.trim() || "Time frame";
      return;
    }

    const field = this.getAttribute("data-field");
    if (field) {
      const col = this.#columns.find((c) => c.field === field);
      const raw = col?.name || col?.field || field;
      this.#labelEl.textContent =
        raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    } else {
      const text = this.dataset.label || this.textContent.trim();
      const raw = text || this.behavior;
      this.#labelEl.textContent =
        raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
  }

  /* ── Icons ─────────────────────────────────────────────────────── */

  #syncIcons() {
    if (this.#iconStartEl) {
      this.#iconStartEl.textContent = this.dataset.iconStart ?? "";
    }
    if (this.#iconEndEl) {
      this.#iconEndEl.textContent = this.dataset.iconEnd ?? "";
    }
    if (this.#selectIconEl) {
      this.#selectIconEl.textContent = this.dataset.iconStart ?? "";
    }
  }

  #syncSortIcon() {
    const mode = this.getAttribute("data-mode") || "off";
    this.dataset.iconStart = SORT_ICONS[mode] || SORT_ICONS.off;
  }

  /* ── Active state ─────────────────────────────────────────────── */

  #updateActive() {
    if (!this.behavior) return;
    const mode = this.getAttribute("data-mode");
    let active;
    if (this.behavior === "filter") {
      active = this.#selectedValues.size > 0 && mode !== "off";
    } else if (this.behavior === "timeframe") {
      active = !!this.#rangeKey && mode !== "off";
    } else {
      active = this.hasAttribute("data-field") && !!mode && mode !== "off";
    }
    this.toggleAttribute("data-active", active);
    this.#updateCount();
  }

  #updateCount() {
    if (!this.#badgeEl) return;
    const count = this.#selectedValues.size;
    if (count > 0) {
      this.#badgeEl.textContent = count;
      this.dataset.count = count;
    } else {
      this.#badgeEl.textContent = "";
      delete this.dataset.count;
    }
  }

  /* ── Trigger click — cycle mode ───────────────────────────────── */

  #onTriggerClick = (_e) => {
    if (this.disabled || !this.behavior) return;
    this.#cycle();
  };

  #cycle() {
    const bvr = this.behavior;

    if (bvr === "filter") {
      if (this.#isBoolean) {
        const mode = this.getAttribute("data-mode");
        const nowOff = !mode || mode === "off";
        if (nowOff) {
          const truthyVals = this.#uniqueValues.filter(
            (v) => v === "true" || v === "1" || v === "yes",
          );
          this.#selectedValues = new Set(
            truthyVals.length ? truthyVals : this.#uniqueValues.slice(0, 1),
          );
        } else {
          this.#selectedValues.clear();
        }
        this.setAttribute("data-mode", nowOff ? "on" : "off");
        this.#syncSelectToValues();
        this.#updateActive();
        this.#emitFilterChange();
        return;
      }
      // Non-boolean filter: toggle on/off if values selected, else open picker
      if (this.#selectedValues.size > 0) {
        const mode = this.getAttribute("data-mode");
        const nowOff = !mode || mode === "off";
        this.setAttribute("data-mode", nowOff ? "on" : "off");
        this.#updateActive();
        this.#emitFilterChange();
      } else {
        this.#selectEl?.showPicker?.();
      }
      return;
    }

    if (bvr === "timeframe") {
      if (this.#rangeKey) {
        const mode = this.getAttribute("data-mode");
        const nowOff = !mode || mode === "off";
        this.setAttribute("data-mode", nowOff ? "on" : "off");
        this.#updateActive();
        this.#emitFilterChange();
      } else {
        this.#selectEl?.showPicker?.();
      }
      return;
    }

    // Sort / segment
    const field = this.getAttribute("data-field");
    if (!field) {
      // No field selected — open picker so user can choose one
      this.#selectEl?.showPicker?.();
      return;
    }
    const mode = this.getAttribute("data-mode") || "";
    const next =
      bvr === "sort"
        ? mode === "asc" ? "desc" : mode === "desc" ? "off" : "asc"
        : mode === "on" ? "off" : "on";
    this.setAttribute("data-mode", next);
    this.#emitFilterChange();
  }

  /* ── Select change ────────────────────────────────────────────── */

  #onSelectChange = (_e) => {
    const bvr = this.behavior;

    if (bvr === "filter") {
      this.#selectedValues = new Set(
        Array.from(this.#selectEl.selectedOptions, (o) => o.value),
      );
      this.setAttribute(
        "data-mode",
        this.#selectedValues.size > 0 ? "on" : "off",
      );
      this.#updateActive();
      this.#emitFilterChange();
    } else if (bvr === "timeframe") {
      const value = this.#selectEl?.value ?? "";
      this.#rangeKey = value;
      this.setAttribute("data-mode", value ? "on" : "off");
      this.#updateLabel();
      this.#updateActive();
      this.#emitFilterChange();
    } else if (bvr === "sort" || bvr === "segment") {
      const value = this.#selectEl?.value ?? "";
      if (!value) {
        this.#userCleared = true;
        this.removeAttribute("data-field");
        this.removeAttribute("data-mode");
      } else {
        this.#userCleared = false;
        this.setAttribute("data-field", value);
        if (!this.getAttribute("data-mode")) {
          this.setAttribute("data-mode", bvr === "sort" ? "asc" : "on");
        }
      }
    }

    // Re-dispatch change on host (native change doesn't cross shadow boundary)
    this.dispatchEvent(new Event("change", { bubbles: true }));
  };

  /* ── Close button ─────────────────────────────────────────────── */

  #onCloseClick = (e) => {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("chipremove", {
        bubbles: true,
        composed: true,
        detail: { field: this.getAttribute("data-field"), type: this.behavior },
      }),
    );
  };

  /* ── Select ↔ value sync ──────────────────────────────────────── */

  #syncSelectToValues() {
    if (!this.#selectEl) return;
    for (const opt of this.#selectEl.options) {
      opt.selected = this.#selectedValues.has(opt.value);
    }
  }

  /* ── Public API ──────────────────────────────────────────────── */

  /** The behavior type or null for plain buttons. */
  get behavior() {
    return this.dataset.behavior || null;
  }

  /** Alias — compatibility with filter-chip consumers. */
  get type() {
    return this.behavior || "button";
  }

  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(v) {
    v ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  get active() {
    return this.hasAttribute("data-active");
  }
  set active(val) {
    this.toggleAttribute("data-active", !!val);
  }

  get label() {
    return this.dataset.label ?? "";
  }
  set label(val) {
    this.dataset.label = val;
  }

  setActive(isActive) {
    this.active = !!isActive;
  }

  /** The native <select> element in shadow DOM. */
  get selectElement() {
    return this.#selectEl;
  }

  /** Current select value (single-select). */
  get value() {
    return this.#selectEl?.value ?? "";
  }
  set value(v) {
    if (this.#selectEl) this.#selectEl.value = v;
  }

  getMode() {
    return this.getAttribute("data-mode") || null;
  }
  setMode(mode) {
    mode === null
      ? this.removeAttribute("data-mode")
      : this.setAttribute("data-mode", mode);
  }

  getField() {
    return this.getAttribute("data-field") || this.#timestampField || null;
  }
  setField(field) {
    if (field) {
      this.#userCleared = false;
      this.setAttribute("data-field", field);
      if (!this.getAttribute("data-mode")) {
        this.setAttribute(
          "data-mode",
          this.behavior === "sort" ? "asc" : "on",
        );
      }
      if (this.#selectEl && !this.#selectEl.multiple) {
        this.#selectEl.value = field;
      }
    } else {
      this.removeAttribute("data-field");
      this.removeAttribute("data-mode");
    }
  }

  /**
   * Populate available columns for the select dropdown.
   * Segment auto-hides when no valid columns exist.
   * @param {Array} columns — { field, name, type }
   * @param {Array} [rows] — optional rows (for segment single-value filtering)
   * @returns {number} column count
   */
  setAvailableColumns(columns, rows) {
    const bvr = this.behavior;
    const cols = Array.isArray(columns) ? columns : [];

    if (bvr === "timeframe") {
      this.#timestampField =
        cols.find((c) => TIMESTAMP_TYPES.has((c?.type || "").toLowerCase()))
          ?.field || null;
      this.#columns = cols;
      this.#updateLabel();
      return cols.length;
    }

    this.#columns =
      bvr === "segment"
        ? cols.filter((c) => {
            if (NUMERIC_TYPES.has((c?.type || "").toLowerCase())) return false;
            if (Array.isArray(rows) && rows.length) {
              const vals = new Set();
              for (const r of rows) {
                vals.add(r[c.field]);
                if (vals.size > 1) break;
              }
              if (vals.size <= 1) return false;
            }
            return true;
          })
        : cols;

    if (bvr === "segment") {
      this.toggleAttribute("hidden", this.#columns.length === 0);
      if (!this.#columns.length) {
        this.removeAttribute("data-field");
        this.removeAttribute("data-mode");
      } else if (
        this.#columns.length === 1 &&
        !this.getAttribute("data-field") &&
        !this.#userCleared
      ) {
        this.setField(this.#columns[0].field);
      }
    }

    this.#populateSelectOptions();
    this.#updateLabel();
    this.#updateActive();
    return this.#columns.length;
  }

  /**
   * Build <option> elements from #columns (sort / segment only).
   */
  #populateSelectOptions() {
    if (!this.#selectEl || this.behavior === "filter") return;

    const currentField = this.getAttribute("data-field") || "";
    const noneOption = this.#selectEl.querySelector('option[value=""]');

    // Remove everything after the None option
    while (noneOption && noneOption.nextElementSibling) {
      noneOption.nextElementSibling.remove();
    }
    for (const og of this.#selectEl.querySelectorAll("optgroup")) {
      og.remove();
    }
    if (noneOption) noneOption.selected = !currentField;

    if (this.behavior === "sort") {
      const alpha = [];
      const numeric = [];
      for (const c of this.#columns) {
        (NUMERIC_TYPES.has((c.type || "").toLowerCase()) ? numeric : alpha).push(c);
      }
      for (const [label, cols] of [["Alphabetical", alpha], ["Numerical", numeric]]) {
        if (!cols.length) continue;
        const optgroup = document.createElement("optgroup");
        optgroup.label = label;
        for (const c of cols) {
          const opt = document.createElement("option");
          opt.value = c.field ?? "";
          opt.textContent = c.name || c.field || "";
          opt.selected = (c.field ?? "") === currentField;
          optgroup.appendChild(opt);
        }
        this.#selectEl.appendChild(optgroup);
      }
    } else {
      for (const c of this.#columns) {
        const opt = document.createElement("option");
        opt.value = c.field ?? "";
        opt.textContent = c.name || c.field || "";
        opt.selected = (c.field ?? "") === currentField;
        this.#selectEl.appendChild(opt);
      }
    }
  }

  /**
   * Set row data for filter-type buttons to extract unique values.
   * @param {Array} rows — full dataset rows
   * @param {Object} [colMeta] — { type, name, field }
   */
  setValueData(rows, colMeta) {
    this.#valueRows = Array.isArray(rows) ? rows : [];
    this.#extractUniqueValues();

    const BOOL_VALUES = new Set(["true", "false", "0", "1", "yes", "no"]);
    const colType = (colMeta?.type || "").toLowerCase();
    this.#isBoolean =
      colType === "boolean" ||
      (this.#uniqueValues.length > 0 &&
        this.#uniqueValues.length <= 2 &&
        this.#uniqueValues.every((v) => BOOL_VALUES.has(v.toLowerCase())));

    if (this.#isBoolean) this.dataset.boolean = "";

    this.#populateFilterOptions();
  }

  #populateFilterOptions() {
    if (!this.#selectEl || this.behavior !== "filter") return;
    this.#selectEl.replaceChildren();
    for (const val of this.#uniqueValues) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent =
        val === "" ? "(empty)" : val.charAt(0).toUpperCase() + val.slice(1);
      opt.selected = this.#selectedValues.has(val);
      this.#selectEl.appendChild(opt);
    }
  }

  #extractUniqueValues() {
    const field = this.getAttribute("data-field");
    if (!field || !this.#valueRows.length) {
      this.#uniqueValues = [];
      return;
    }
    const seen = new Set();
    for (const row of this.#valueRows) {
      const val = row[field];
      seen.add(val == null ? "" : String(val));
    }
    this.#uniqueValues = [...seen].sort((a, b) => a.localeCompare(b));
  }

  #emitFilterChange() {
    const detail = {
      field: this.getAttribute("data-field") || this.#timestampField,
      active: this.getAttribute("data-mode") !== "off",
      type: this.behavior,
    };
    if (this.behavior === "timeframe") {
      detail.rangeKey = this.#rangeKey;
      detail.range = computeTimeRange(this.#rangeKey);
    } else {
      detail.values = [...this.#selectedValues];
    }
    this.dispatchEvent(
      new CustomEvent("filtervaluechange", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  getSelectedValues() {
    return [...this.#selectedValues];
  }

  getTimeRange() {
    return computeTimeRange(this.#rangeKey);
  }

  getRangeKey() {
    return this.#rangeKey;
  }

  clearValues() {
    this.#selectedValues.clear();
    this.setAttribute("data-mode", "off");
    this.#syncSelectToValues();
    this.#updateActive();
  }

  /**
   * Programmatically set options on the select.
   * @param {Array<{value, text, selected?, disabled?}>} options
   */
  setOptions(options) {
    if (!this.#selectEl) return;
    this.#selectEl.replaceChildren();
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o.value ?? "";
      opt.textContent = o.text ?? o.value ?? "";
      if (o.selected) opt.selected = true;
      if (o.disabled) opt.disabled = true;
      this.#selectEl.appendChild(opt);
    }
  }

  /**
   * Programmatically set option groups on the select.
   * @param {Array<{label, options: Array<{value, text}>}>} groups
   */
  setOptionGroups(groups) {
    if (!this.#selectEl) return;
    this.#selectEl.replaceChildren();
    for (const g of groups) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = g.label ?? "";
      for (const o of g.options || []) {
        const opt = document.createElement("option");
        opt.value = o.value ?? "";
        opt.textContent = o.text ?? o.value ?? "";
        if (o.selected) opt.selected = true;
        optgroup.appendChild(opt);
      }
      this.#selectEl.appendChild(optgroup);
    }
  }
}

customElements.define("sherpa-button", SherpaButton);
