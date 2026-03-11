/**
 * sherpa-filter-bar.js
 * Horizontal filter bar with zoned layout.
 *
 * Templates:
 *   default (global) — Full filter bar: toggle, group, sort, presets, dynamic
 *                       filters, add-filter button, actions. Used at page level.
 *   local            — Minimal: group + sort + actions only. Used inside
 *                       containers (sherpa-data-viz-container). Selected via data-type="local".
 *
 * Filter chip configuration:
 *   Each filter chip is a <sherpa-button data-type="button-menu"> with:
 *     data-filter-field    — Data field to filter on (e.g. "severity", "amount")
 *     data-filter-type     — Filter type: "text" | "number" | "number-range" | "datetime-range"
 *     data-filter-operator — Operator (optional): "in" | "equals" | "contains" | "between" | "gt" | "lt" | "gte" | "lte"
 *                           Defaults: text→in, number→equals, number-range→between, datetime-range→between
 *
 *   Sort/segment chips use data-behavior="sort" | "segment".
 *
 * Self-populating:
 *   Sort / group / add-filter menus self-populate by listening on
 *   `document` for `columnsready` events dispatched by viz children.
 *   No container or parent involvement is required.
 *
 *   Row-dependent features (text/number value menus, boolean auto-
 *   detection) are populated from the row data carried in the event.
 *
 * Slot-based layout:
 *   toggle   — Filter on/off toggle
 *   group    — Segment/group chip
 *   sort     — Sort chip
 *   presets  — Preset filter chips (declared by content template)
 *   default  — User-added dynamic filter chips + Add button
 *   actions  — Clear / Apply / Save buttons
 *
 * Events dispatched:
 *   filterchange          — When any chip changes. detail: { filters }
 *   filterclear            — When the clear action is invoked.
 *   containerfilterchange  — Dispatched on self with bubbles: true so it
 *                           reaches any ancestor scope. Viz children listen
 *                           on their parent for this event.
 *                           detail: { filters }
 *   globalfilterchange     — Dispatched on `document` when `data-global` is
 *                           set. All viz children that wire global filter
 *                           listeners receive this event directly.
 *                           detail: { filters }
 *
 * Events consumed:
 *   sortchange (bubbles up from viz children)  — syncs sort chip state
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import "../sherpa-button/sherpa-button.js";
import { formatFieldName } from "../utilities/format-utils.js";
import { TIME_RANGE_PRESETS } from "../utilities/timeframes.js";

export class SherpaFilterBar extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-filter-bar.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-filter-bar.html", import.meta.url).href;
  }

  /* ── Template selection ───────────────────────────────────────── */

  get templateId() {
    return this.dataset.type || "default";
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-density",
      "data-active",
      "data-preset-filters",
    ];
  }

  #observer = null;
  #columns = [];
  #rows = [];
  #addButton = null;
  #applied = true; // Toggle state — when false, getFilters() returns []
  #pendingEmit = false; // Microtask debounce for observer-driven filterchange
  #sortChangeHandler = null; // Bound handler for sortchange events
  #syncingSort = false; // Guard against re-entrant filterchange during sort sync
  #scopeEl = null; // Parent element used as event scope for sortchange
  #columnsHandler = null; // Bound handler for document-level columnsready

  onConnect() {
    // Wire sortchange listener on parent scope (container or shadow host)
    this.#scopeEl = this.parentElement || this.getRootNode()?.host || null;
    if (this.#scopeEl && !this.#sortChangeHandler) {
      this.#sortChangeHandler = (e) => this.#onSortChange(e);
      this.#scopeEl.addEventListener("sortchange", this.#sortChangeHandler);
    }

    // Listen on document for columnsready — any viz child anywhere can
    // broadcast its column list; we self-populate sort / group / add menus.
    if (!this.#columnsHandler) {
      this.#columnsHandler = (e) => {
        const { columns, rows } = e.detail || {};
        if (columns?.length) this.setAvailableColumns(columns, rows || []);
      };
      document.addEventListener("columnsready", this.#columnsHandler);
    }

    // Watch for attribute changes on slotted filter chips
    this.#observer = new MutationObserver(() => {
      this.#syncActiveState();
      // Debounce filterchange emission via microtask so that rapid
      // data-field + data-mode attribute sets from a single chip
      // produce only one event.
      if (!this.#pendingEmit) {
        this.#pendingEmit = true;
        queueMicrotask(() => {
          this.#pendingEmit = false;
          // Skip re-entrant filterchange when we are syncing sort chip
          // state from a viz child's sortchange event.
          if (this.#syncingSort) return;
          this.#emitFilterChange();
        });
      }
    });
    this.#observer.observe(this, {
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-active", "data-field", "data-mode",
        "data-filter-field", "data-filter-type", "data-filter-operator",
      ],
    });

    // Listen for slotchange on all zone slots to track chip additions/removals
    for (const slot of this.$$("slot")) {
      slot.addEventListener("slotchange", () => this.#syncActiveState());
    }

    // Clear button delegation — look for click on actions-slotted button
    this.addEventListener("click", (e) => {
      const path = e.composedPath();
      const clearBtn = path.find(
        (n) =>
          n instanceof HTMLElement &&
          n.slot === "actions" &&
          n.tagName === "SHERPA-BUTTON" &&
          (n.dataset.action === "clear" ||
            n.textContent.trim().toLowerCase().includes("clear")),
      );
      if (clearBtn) this.#clearAll();
    });

    // Add filter button — sherpa-button[data-type="button-menu"]
    this.#addButton = this.$(".add-filter-button");
    // Listen for menu-select on the add button to create new chips
    this.#addButton?.addEventListener("menu-select", this.#onAddMenuSelect);

    // Listen for chip removal events (from filter chips' × button)
    this.addEventListener("chipremove", (e) => {
      const chip = e.target;
      if (
        chip.tagName === "SHERPA-BUTTON" &&
        (chip.hasAttribute("data-behavior") || chip.hasAttribute("data-filter-field"))
      ) {
        chip.remove();
        this.#syncActiveState();
        this.#emitFilterChange();
        this.#populateAddMenu();
      }
    });

    // Listen for button clicks from behavior chips (mode cycling)
    this.addEventListener("buttonclick", (e) => {
      const chip = e.target;
      // data-filter-field chips: toggle active state on/off
      if (chip?.hasAttribute?.("data-filter-field")) {
        chip.toggleAttribute("data-active", !chip.hasAttribute("data-active"));
        this.#syncActiveState();
        this.#emitFilterChange();
        return;
      }
      if (!chip?.hasAttribute?.("data-behavior")) return;
      const behavior = chip.getAttribute("data-behavior");
      if (behavior === "sort") {
        this.#cycleSortMode(chip);
      } else if (behavior === "segment") {
        this.#cycleSegmentMode(chip);
      }
    });

    // Listen for menu-select from data-filter-field chips and sort/segment chips
    this.addEventListener("menu-select", (e) => {
      const chip = e.target;

      // Skip the add-filter button's own menu-select — handled separately
      if (chip === this.#addButton) return;

      // ── New API: data-filter-field chips ──
      if (chip?.hasAttribute?.("data-filter-field")) {
        const filterType = chip.getAttribute("data-filter-type") || "text";
        const value = e.detail?.value;
        if (filterType === "datetime-range" && value) {
          // Update label from TIME_RANGE_PRESETS if applicable
          const preset = TIME_RANGE_PRESETS.find(p => p.key === value);
          if (preset) chip.dataset.label = preset.label;
        }
        // Activate chip when any value is checked
        const values = chip.getSelectedValues?.() ?? [];
        chip.toggleAttribute("data-active", values.length > 0);
        // Update badge count for multi-select
        if (values.length > 1) {
          chip.dataset.count = String(values.length);
        } else {
          delete chip.dataset.count;
        }
        this.#syncActiveState();
        this.#emitFilterChange();
        return;
      }

      // ── Sort / segment chips ──
      if (!chip?.hasAttribute?.("data-behavior")) return;
      const behavior = chip.getAttribute("data-behavior");
      if (behavior === "sort" || behavior === "segment") {
        const field = e.detail?.value;
        if (field) {
          chip.dataset.field = field;
          const col = this.#columns.find(c => c.field === field);
          if (col) chip.dataset.label = col.name || formatFieldName(field);
          chip.toggleAttribute("data-active", true);
          this.#emitFilterChange();
        } else {
          // Deactivate
          delete chip.dataset.field;
          delete chip.dataset.mode;
          chip.dataset.label = behavior === "sort" ? "Sort" : "Group";
          chip.removeAttribute("data-active");
          this.#emitFilterChange();
        }
      }
    });

    // Toggle switch — applies / unapplies all filters
    this.addEventListener("change", (e) => {
      const sw = e.target;
      if (sw?.tagName === "SHERPA-SWITCH" && sw.slot === "toggle") {
        this.#applied = sw.dataset.state === "on";
        this.#emitFilterChange();
      }
    });

    this.#syncActiveState();
  }

  onDisconnect() {
    this.#observer?.disconnect();
    this.#observer = null;

    if (this.#scopeEl && this.#sortChangeHandler) {
      this.#scopeEl.removeEventListener(
        "sortchange",
        this.#sortChangeHandler,
      );
    }
    this.#sortChangeHandler = null;
    this.#scopeEl = null;

    if (this.#columnsHandler) {
      document.removeEventListener("columnsready", this.#columnsHandler);
      this.#columnsHandler = null;
    }
  }

  onAttributeChanged(name, _old, newValue) {
    if (name === "data-preset-filters" && newValue) {
      this.#initPresetChips(newValue);
    }
  }

  /** Check if any slotted filter chip has an active filter and update host attribute. */
  #syncActiveState() {
    const chips = this.#getFilterChips();
    const anyActive = chips.some((chip) => chip.hasAttribute("data-active"));
    this.toggleAttribute("data-active", anyActive);
  }

  /** Clear all slotted filter chips and remove dynamic ones. */
  #clearAll() {
    for (const chip of this.#getFilterChips()) {
      if (chip.hasAttribute("data-filter-field")) {
        if (chip.hasAttribute("data-dismissable")) {
          // User-added dynamic filter chips — remove from DOM
          chip.remove();
        } else {
          // Declarative / preset chips — clear values but keep in DOM
          chip.clearSelection?.();
          delete chip.dataset.count;
          chip.removeAttribute("data-active");
        }
      } else {
        // Static chips (sort, segment) — reset attributes
        chip.removeAttribute("data-field");
        chip.removeAttribute("data-mode");
      }
    }
    this.removeAttribute("data-active");
    this.#populateAddMenu();
    this.dispatchEvent(
      new CustomEvent("filterclear", { bubbles: true, composed: true }),
    );
    this.#dispatchContainerFilterChange([]);
    this.#dispatchGlobalFilterChange([]);
  }

  /** Get all slotted sort/segment behavior buttons and data-filter-field chips. */
  #getFilterChips() {
    return Array.from(
      this.querySelectorAll(
        "sherpa-button[data-behavior='sort'], sherpa-button[data-behavior='segment'], sherpa-button[data-filter-field]",
      ),
    );
  }

  /** Get fields already used by active filter chips (presets + user-added). */
  #getUsedFilterFields() {
    const fields = new Set();
    for (const chip of this.#getFilterChips()) {
      const ff = chip.getAttribute("data-filter-field");
      if (ff) fields.add(ff);
    }
    return fields;
  }

  /* ══════════════════════════════════════════════════════════════
     Preset Chips
     ══════════════════════════════════════════════════════════════ */

  /**
   * Create preset filter chips from a comma-separated list of field names.
   * Called when data-preset-filters attribute is set.
   * @param {string} fields — comma-separated field names (e.g. "severity,status")
   */
  #initPresetChips(fields) {
    // Remove existing preset filter chips
    for (const chip of this.querySelectorAll(
      'sherpa-button[slot="presets"][data-filter-field]',
    )) {
      chip.remove();
    }

    const fieldList = fields
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);
    for (const field of fieldList) {
      const col = this.#columns.find((c) => c.field === field);
      const filterType = this.#inferFilterType(col?.type);
      // Auto-detect boolean from values when column type is generic
      const isBool = filterType === "text" && this.#rows.length && this.#isBooleanValues(field);
      const resolvedType = isBool ? "boolean" : filterType;

      const chip = document.createElement("sherpa-button");
      chip.setAttribute("data-type", "button-menu");
      chip.setAttribute("data-split", "");
      chip.setAttribute("data-filter-field", field);
      chip.setAttribute("data-filter-type", resolvedType);
      chip.setAttribute("slot", "presets");
      chip.dataset.label = col?.name || formatFieldName(field);
      this.appendChild(chip);

      // Populate menu based on filter type
      if (this.#rows.length || filterType === "datetime-range") {
        this.#populateFilterChip(chip);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Add Filter Menu
     ══════════════════════════════════════════════════════════════ */

  /** Populate the "Add filter" button menu with available (unused) columns. */
  #populateAddMenu() {
    if (!this.#addButton) return;

    const usedFields = this.#getUsedFilterFields();
    const available = this.#columns.filter((c) => !usedFields.has(c.field));

    if (available.length > 0) {
      this.#addButton.setMenuItems(
        available.map((col) => ({
          value: col.field,
          text: col.name || formatFieldName(col.field),
        })),
      );
    }

    // Hide when no columns exist at all
    this.#addButton?.toggleAttribute(
      "hidden",
      this.#columns.length === 0,
    );
  }

  /** Handle selection from the "Add filter" menu. */
  #onAddMenuSelect = (e) => {
    const field = e.detail?.value;
    if (!field) return;

    const col = this.#columns.find((c) => c.field === field);
    if (!col) return;

    const filterType = this.#inferFilterType(col.type);
    // Auto-detect boolean from values when column type is generic
    const isBool = filterType === "text" && this.#isBooleanValues(field);
    const resolvedType = isBool ? "boolean" : filterType;

    // Create a new filter chip (in default slot — user filters zone)
    const chip = document.createElement("sherpa-button");
    chip.setAttribute("data-type", "button-menu");
    chip.setAttribute("data-split", "");
    chip.setAttribute("data-filter-field", field);
    chip.setAttribute("data-filter-type", resolvedType);
    chip.setAttribute("data-dismissable", "");
    chip.dataset.label = col.name || formatFieldName(field);

    // Insert in light DOM default slot
    this.appendChild(chip);

    // Populate menu based on filter type
    this.#populateFilterChip(chip);

    // Repopulate to remove the now-used field
    this.#populateAddMenu();
  };

  /** Dispatch filterchange + containerfilterchange, and globalfilterchange when data-global. */
  #emitFilterChange() {
    const filters = this.getFilters();
    this.dispatchEvent(
      new CustomEvent("filterchange", {
        bubbles: true,
        composed: true,
        detail: { filters },
      }),
    );

    // Dispatch containerfilterchange (bubbles to parent scope) so
    // viz children can self-filter.
    this.#dispatchContainerFilterChange(filters);

    // Global scope — dispatch on document so all viz children receive it.
    this.#dispatchGlobalFilterChange(filters);
  }

  /* ══════════════════════════════════════════════════════════════
     Public API
     ══════════════════════════════════════════════════════════════ */

  /** Get current filter state from all chips. Returns [] when toggle is off. */
  getFilters() {
    if (!this.#applied) return [];

    return this.#getFilterChips()
      .filter((chip) => chip.hasAttribute("data-active"))
      .map((chip) => {
        // ── data-filter-field chips ──
        if (chip.hasAttribute("data-filter-field")) {
          const filterType = chip.getAttribute("data-filter-type") || "text";
          const operator = this.#resolveOperator(chip);

          // Boolean chips have no menu — value comes from the stored truthy value
          if (filterType === "boolean") {
            const boolValue = chip.dataset.filterBooleanValue || "true";
            return {
              field: chip.getAttribute("data-filter-field"),
              type: "boolean",
              operator: "equals",
              values: [boolValue],
              value: boolValue,
            };
          }

          const values = chip.getSelectedValues?.() ?? [];
          const entry = {
            field: chip.getAttribute("data-filter-field"),
            type: filterType,
            operator,
            values,
            value: values[0] || "",
          };
          // Attach computed range for datetime-range filters
          if (filterType === "datetime-range" && entry.value) {
            entry.range = this.#computeTimeRange(entry.value);
          }
          return entry;
        }

        // ── Sort / segment chips ──
        const type = chip.getAttribute("data-behavior");
        return {
          field: chip.getAttribute("data-field"),
          mode: chip.getAttribute("data-mode"),
          type,
        };
      });
  }

  /**
   * Set available columns and row data for chip menu population.
   * @param {Array} columns — { field, name, type }
   * @param {Array} [rows] — full dataset rows (for segment filtering + value extraction)
   */
  setAvailableColumns(columns, rows) {
    this.#columns = Array.isArray(columns) ? columns : [];
    this.#rows = Array.isArray(rows) ? rows : [];

    for (const chip of this.#getFilterChips()) {
      // ── data-filter-field chips ──
      if (chip.hasAttribute("data-filter-field")) {
        const field = chip.getAttribute("data-filter-field");
        const col = this.#columns.find((c) => c.field === field);
        // Update label when column metadata becomes available
        if (col) {
          chip.dataset.label = col.name || formatFieldName(col.field);
        }
        this.#populateFilterChip(chip);
        continue;
      }

      // ── Sort / segment chips ──
      this.#populateColumnsMenu(chip);
    }

    // If preset filters attribute is set but chips haven't been created yet, create them now
    const presetFields = this.getAttribute("data-preset-filters");
    if (
      presetFields &&
      !this.querySelector('sherpa-button[slot="presets"]')
    ) {
      this.#initPresetChips(presetFields);
    }

    this.#populateAddMenu();
  }

  /** Remove filter chip for a specific field. */
  removeFilterChip(field) {
    for (const chip of this.#getFilterChips()) {
      if (chip.getAttribute("data-filter-field") === field) {
        chip.remove();
        this.#syncActiveState();
        this.#emitFilterChange();
        return true;
      }
    }
    return false;
  }

  /**
   * Handle sortchange from a viz child — sync the sort chip to match.
   */
  #onSortChange(e) {
    const sortChip = this.querySelector('sherpa-button[data-behavior="sort"]');
    if (!sortChip) return;

    const { field, direction } = e.detail || {};
    this.#syncingSort = true;
    if (field && direction !== "off") {
      sortChip.dataset.field = field;
      const col = this.#columns.find(c => c.field === field);
      if (col) sortChip.dataset.label = col.name || formatFieldName(field);
      sortChip.dataset.mode = direction;
      sortChip.toggleAttribute("data-active", true);
    } else {
      delete sortChip.dataset.field;
      delete sortChip.dataset.mode;
      sortChip.dataset.label = "Sort";
      sortChip.removeAttribute("data-active");
    }
    // Clear flag after microtask so the MutationObserver callback
    // (which also fires as a microtask) sees it as true and skips.
    queueMicrotask(() => { this.#syncingSort = false; });
  }

  /**
   * Dispatch containerfilterchange on this element with bubbles: true.
   * Bubbles up through the DOM so any ancestor (e.g. a container) and
   * its descendants that listen on that ancestor will receive it.
   */
  #dispatchContainerFilterChange(filters) {
    this.dispatchEvent(
      new CustomEvent("containerfilterchange", {
        bubbles: true,
        composed: true,
        detail: { filters },
      }),
    );
  }

  /**
   * When `data-global` is set, dispatch globalfilterchange on document so
   * all viz children that listen for global filters receive the update.
   */
  #dispatchGlobalFilterChange(filters) {
    if (!this.hasAttribute("data-global")) return;
    document.dispatchEvent(
      new CustomEvent("globalfilterchange", {
        detail: { filters },
      }),
    );
  }

  /* ══════════════════════════════════════════════════════════════
     Chip management helpers
     ══════════════════════════════════════════════════════════════ */

  /** Extract unique values from rows for a given field. */
  #extractUniqueValues(field) {
    const seen = new Set();
    const values = [];
    for (const row of this.#rows) {
      const v = row[field];
      if (v != null && !seen.has(v)) {
        seen.add(v);
        values.push(String(v));
      }
    }
    return values.sort();
  }

  /** Populate a filter chip's menu with unique values for its field. */
  #populateChipMenu(chip, field) {
    if (!field) return;
    const values = this.#extractUniqueValues(field);
    const items = values.map(v => ({ value: v, text: v }));
    chip.setMenuItems?.(items, { selection: "checkbox", group: "values" });
  }

  /**
   * Populate a data-filter-field chip based on its filter type.
   * Skips re-population when the menu already contains items, preventing
   * the destructive setMenuItems → replaceChildren cycle that
   * wipes checked state.
   * @param {HTMLElement} chip — sherpa-button with data-filter-field
   */
  #populateFilterChip(chip) {
    // Guard: if menu already has items, don't re-populate (preserves checked state)
    if (chip.menuElement?.querySelector("sherpa-menu-item")) return;

    const field = chip.getAttribute("data-filter-field");
    let filterType = chip.getAttribute("data-filter-type") || "text";

    // Auto-detect boolean fields from row values when type is still generic
    if (filterType === "text" && field && this.#rows.length) {
      if (this.#isBooleanValues(field)) {
        filterType = "boolean";
        chip.setAttribute("data-filter-type", "boolean");
      }
    }

    switch (filterType) {
      case "text":
      case "number":
        // Auto-populate from unique field values in the data
        if (field && this.#rows.length) {
          this.#populateChipMenu(chip, field);
        }
        break;
      case "datetime-range":
        // Auto-populate from TIME_RANGE_PRESETS
        this.#populateTimeframeMenu(chip);
        break;
      case "boolean":
        // No menu — chip acts as a simple toggle. Store the truthy value
        // so getFilters() knows what to report when the chip is active.
        if (field && this.#rows.length) {
          chip.dataset.filterBooleanValue = this.#getTruthyValue(field);
        }
        break;
      case "number-range":
        // Consumer must provide options — no auto-population
        break;
    }
  }

  /** Populate a sort/segment chip's menu with column choices. */
  #populateColumnsMenu(chip) {
    const items = this.#columns.map(c => ({
      value: c.field,
      text: c.name || formatFieldName(c.field),
    }));
    chip.setMenuItems?.(items, { selection: "radio", group: "columns" });
  }

  /* ══════════════════════════════════════════════════════════════
     Filter type / operator helpers
     ══════════════════════════════════════════════════════════════ */

  /** Map column type metadata to a canonical filter type. */
  static #COLUMN_TYPE_MAP = {
    number: "number", numeric: "number", currency: "number",
    percent: "number", year: "number",
    date: "datetime-range", datetime: "datetime-range", time: "datetime-range",
    boolean: "boolean",
  };

  /**
   * Infer a data-filter-type from column type metadata.
   * @param {string} [columnType] — Column type from the data schema (e.g. "number", "date")
   * @returns {string} — "text" | "number" | "number-range" | "datetime-range"
   */
  #inferFilterType(columnType) {
    if (!columnType) return "text";
    return SherpaFilterBar.#COLUMN_TYPE_MAP[columnType.toLowerCase()] || "text";
  }

  /** Default operator per filter type. */
  static #DEFAULT_OPERATORS = {
    text: "in",
    number: "equals",
    "number-range": "between",
    "datetime-range": "between",
    boolean: "equals",
  };

  /** Sets of value-pairs that indicate a boolean field. */
  static #BOOLEAN_VALUE_SETS = [
    new Set(["true", "false"]),
    new Set(["yes", "no"]),
    new Set(["0", "1"]),
    new Set(["on", "off"]),
  ];

  /**
   * Check whether a field's unique values are boolean-like (e.g. true/false, yes/no).
   * @param {string} field — column field name
   * @returns {boolean}
   */
  #isBooleanValues(field) {
    const unique = new Set();
    for (const row of this.#rows) {
      const v = row[field];
      if (v != null) unique.add(String(v).toLowerCase());
      if (unique.size > 2) return false;
    }
    if (unique.size === 0) return false;
    return SherpaFilterBar.#BOOLEAN_VALUE_SETS.some(
      (bs) => [...unique].every((v) => bs.has(v)),
    );
  }

  /**
   * Return the "truthy" value for a boolean field (e.g. "true", "yes", "1", "on").
   * Preserves original casing from the data.
   * @param {string} field
   * @returns {string}
   */
  #getTruthyValue(field) {
    const TRUTHY = new Set(["true", "yes", "1", "on"]);
    for (const row of this.#rows) {
      const v = row[field];
      if (v != null && TRUTHY.has(String(v).toLowerCase())) return String(v);
    }
    return "true";
  }

  /**
   * Return the effective operator for a chip, falling back to the default for its type.
   * @param {HTMLElement} chip — a sherpa-button with data-filter-field
   * @returns {string}
   */
  #resolveOperator(chip) {
    const explicit = chip.getAttribute("data-filter-operator");
    if (explicit) return explicit;
    const type = chip.getAttribute("data-filter-type") || "text";
    return SherpaFilterBar.#DEFAULT_OPERATORS[type] || "in";
  }

  /**
   * Compute a time range { start, end } from a TIME_RANGE_PRESETS key.
   * @param {string} rangeKey — e.g. "last-7d", "last-30d", "ytd"
   * @returns {{ start: Date, end: Date } | null}
   */
  #computeTimeRange(rangeKey) {
    if (!rangeKey) return null;
    const preset = TIME_RANGE_PRESETS.find(p => p.key === rangeKey);
    if (!preset) return null;
    if (preset.key === "all") return { start: new Date(0), end: new Date() };

    const now = new Date();
    const start = new Date(now);

    if (preset.key === "ytd") {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }

    switch (preset.unit) {
      case "hour":    start.setHours(now.getHours() - preset.count);     break;
      case "day":     start.setDate(now.getDate() - preset.count);       break;
      case "month":   start.setMonth(now.getMonth() - preset.count);     break;
      case "quarter": start.setMonth(now.getMonth() - preset.count * 3); break;
      case "year":    start.setFullYear(now.getFullYear() - preset.count); break;
      default: return null;
    }
    return { start, end: now };
  }

  /** Cycle sort mode: off → asc → desc → off. */
  #cycleSortMode(chip) {
    const current = chip.dataset.mode;
    if (!current || current === "off") {
      chip.dataset.mode = "asc";
      chip.dataset.iconStart = "\uf062"; // fa-arrow-up
      chip.toggleAttribute("data-active", true);
    } else if (current === "asc") {
      chip.dataset.mode = "desc";
      chip.dataset.iconStart = "\uf063"; // fa-arrow-down
    } else {
      delete chip.dataset.mode;
      chip.dataset.iconStart = "\uf0dc"; // fa-sort (neutral)
      chip.removeAttribute("data-active");
    }
    this.#emitFilterChange();
  }

  /** Cycle segment mode: inactive → active → inactive. */
  #cycleSegmentMode(chip) {
    if (chip.hasAttribute("data-active")) {
      chip.removeAttribute("data-active");
    } else {
      chip.toggleAttribute("data-active", true);
    }
    this.#emitFilterChange();
  }

  /**
   * Populate a timeframe chip's menu with TIME_RANGE_PRESETS.
   * @param {HTMLElement} chip — sherpa-button with datetime-range type
   */
  #populateTimeframeMenu(chip) {
    const items = TIME_RANGE_PRESETS.map(p => ({
      value: p.key,
      text: p.label,
    }));
    chip.setMenuItems?.(items, { selection: "radio", group: "timeframes" });
  }
}

customElements.define("sherpa-filter-bar", SherpaFilterBar);
