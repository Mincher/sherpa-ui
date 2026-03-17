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
 * Field declaration:
 *   Sort / group / add-filter menus are populated from a declarative
 *   `data-available-fields` JSON attribute on the filter bar element.
 *   Format: [{"field":"name","name":"Display Name","type":"string"},...]
 *
 *   The consuming app sets this attribute on the filter bar (or on
 *   the container, which forwards it). No event-based discovery is
 *   required — all timing/race issues are eliminated.
 *
 *   Backwards-compatible: `setAvailableColumns(columns, rows)` still
 *   works by writing to the `data-available-fields` attribute. When
 *   rows are supplied, unique values are extracted per field and
 *   used to populate chip menus.
 *
 *   Value menus:
 *   Filter chips with a selected field show a menu of all unique values.
 *   Values come from two sources (in priority order):
 *     1. `values` array in the field definition JSON
 *     2. Extracted from row data passed to `setAvailableColumns(cols, rows)`
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
      "data-available-fields",
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

  onConnect() {
    // Wire sortchange listener on parent scope (container or shadow host)
    this.#scopeEl = this.parentElement || this.getRootNode()?.host || null;
    if (this.#scopeEl && !this.#sortChangeHandler) {
      this.#sortChangeHandler = (e) => this.#onSortChange(e);
      this.#scopeEl.addEventListener("sortchange", this.#sortChangeHandler);
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
          // Skip re-entrant filterchange when we are syncing chip
          // state from a viz child's sortchange event or mixin sync.
          if (this.#syncingSort || this.hasAttribute("data-syncing")) return;
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
        // Observer picks up the data-active mutation and dispatches.
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
        const wasActive = chip.hasAttribute("data-active");
        chip.toggleAttribute("data-active", values.length > 0);
        // Update label and badge count based on selection count
        this.#syncFilterChipLabel(chip, values.length);
        this.#syncActiveState();
        // If data-active didn't change (e.g. switching time range presets
        // while already active), the MutationObserver won't fire, so
        // emit explicitly.
        if (wasActive === chip.hasAttribute("data-active")) {
          this.#emitFilterChange();
        }
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
          // Observer picks up the data-field/data-active mutations and dispatches.
        } else {
          // Deactivate
          delete chip.dataset.field;
          delete chip.dataset.mode;
          chip.dataset.label = behavior === "sort" ? "Sort" : "Group";
          chip.removeAttribute("data-active");
          // Observer picks up the data-field/data-mode/data-active mutations and dispatches.
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

    // Global filter bars get a built-in Time Range chip
    if (this.hasAttribute("data-global")) {
      this.#initDefaultTimeRangeChip();
    }

    // Populate from declarative fields attribute (if set before connect)
    this.#syncAvailableFields();
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
  }

  onAttributeChanged(name, _old, newValue) {
    if (name === "data-preset-filters" && newValue) {
      this.#initPresetChips(newValue);
    }
    if (name === "data-available-fields") {
      this.#syncAvailableFields();
    }
  }

  /**
   * Parse the data-available-fields JSON attribute and populate all menus.
   * Called on connect and whenever the attribute changes.
   */
  #syncAvailableFields() {
    const raw = this.getAttribute("data-available-fields");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      this.#columns = parsed;
    } catch {
      return;
    }

    const chips = this.#getFilterChips();

    // Populate sort / segment chip menus
    for (const chip of chips) {
      if (chip.hasAttribute("data-filter-field")) {
        const field = chip.getAttribute("data-filter-field");
        const col = this.#columns.find((c) => c.field === field);
        if (col) {
          chip.dataset.label = col.name || formatFieldName(col.field);
          chip.dataset.defaultLabel = chip.dataset.label;
        }
        this.#populateFilterChip(chip);
        continue;
      }
      this.#populateColumnsMenu(chip);
    }

    // Create preset chips if declared but not yet created
    const presetFields = this.getAttribute("data-preset-filters");
    if (presetFields && !this.querySelector('sherpa-button[slot="presets"]')) {
      this.#initPresetChips(presetFields);
    }

    this.#populateAddMenu();
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
          chip.dataset.label = chip.dataset.defaultLabel || chip.dataset.label;
          chip.removeAttribute("data-active");
        }
      } else {
        // Static chips (sort, segment) — reset attributes
        const behavior = chip.getAttribute("data-behavior");
        chip.removeAttribute("data-field");
        chip.removeAttribute("data-mode");
        chip.removeAttribute("data-active");
        chip.dataset.label = behavior === "sort" ? "Sort" : "Group";
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
     Default Time Range Chip (global bars only)
     ══════════════════════════════════════════════════════════════ */

  /**
   * Create a built-in "Time Range" chip for global filter bars.
   * Uses the sentinel field `_timerange` so consuming apps can map it
   * to each dataset's actual date field via the `range` property.
   */
  #initDefaultTimeRangeChip() {
    // Don't duplicate if already present
    if (this.querySelector('sherpa-button[data-filter-field="_timerange"]')) return;

    const chip = document.createElement("sherpa-button");
    chip.setAttribute("data-type", "button-menu");
    chip.setAttribute("data-split", "");
    chip.setAttribute("data-filter-field", "_timerange");
    chip.setAttribute("data-filter-type", "datetime-range");
    chip.setAttribute("slot", "presets");
    chip.dataset.label = "Time Range";
    chip.dataset.defaultLabel = "Time Range";
    this.appendChild(chip);

    this.#populateTimeframeMenu(chip);
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
    // Remove existing preset filter chips (preserve built-in _timerange chip)
    for (const chip of this.querySelectorAll(
      'sherpa-button[slot="presets"][data-filter-field]',
    )) {
      if (chip.getAttribute("data-filter-field") === "_timerange") continue;
      chip.remove();
    }

    const fieldList = fields
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);
    for (const field of fieldList) {
      const col = this.#columns.find((c) => c.field === field);
      const filterType = this.#inferFilterType(col?.type);

      const chip = document.createElement("sherpa-button");
      chip.setAttribute("data-type", "button-menu");
      chip.setAttribute("data-split", "");
      chip.setAttribute("data-filter-field", field);
      chip.setAttribute("data-filter-type", filterType);
      chip.setAttribute("slot", "presets");
      chip.dataset.label = col?.name || formatFieldName(field);
      chip.dataset.defaultLabel = chip.dataset.label;
      this.appendChild(chip);

      // Populate menu based on filter type
      this.#populateFilterChip(chip);
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

    // Create a new filter chip (in default slot — user filters zone)
    const chip = document.createElement("sherpa-button");
    chip.setAttribute("data-type", "button-menu");
    chip.setAttribute("data-split", "");
    chip.setAttribute("data-filter-field", field);
    chip.setAttribute("data-filter-type", filterType);
    chip.setAttribute("data-dismissable", "");
    chip.dataset.label = col.name || formatFieldName(field);
    chip.dataset.defaultLabel = chip.dataset.label;

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
   * Set available fields and optional row data for chip menu population.
   * Writes columns to `data-available-fields` (triggers `#syncAvailableFields()`).
   * When rows are supplied, unique values are extracted per field for chip menus.
   * @param {Array} columns — { field, name, type }
   * @param {Array} [rows] — full dataset rows for unique value extraction
   */
  setAvailableColumns(columns, rows) {
    if (!Array.isArray(columns) || !columns.length) return;
    if (Array.isArray(rows)) this.#rows = rows;
    this.setAttribute("data-available-fields", JSON.stringify(columns));
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

  /**
   * Extract unique values from stored row data for a given field.
   * @param {string} field — column field name
   * @returns {string[]} sorted unique values
   */
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

  /**
   * Get unique values for a field from the best available source:
   *   1. Declarative `values` array in the column definition
   *   2. Extracted from `#rows` row data
   * @param {string} field — column field name
   * @returns {string[]}
   */
  #getValuesForField(field) {
    const col = this.#columns.find((c) => c.field === field);
    if (col?.values?.length) return col.values.map(String);
    if (this.#rows.length) return this.#extractUniqueValues(field);
    return [];
  }

  /**
   * Populate a data-filter-field chip based on its filter type.
   * For text/number types, populates a checkbox menu of unique values.
   * Skips re-population when the menu already contains items, preventing
   * the destructive setMenuItems → replaceChildren cycle that
   * wipes checked state.
   * @param {HTMLElement} chip — sherpa-button with data-filter-field
   */
  #populateFilterChip(chip) {
    // Guard: if menu already has items, don't re-populate (preserves checked state)
    if (chip.menuElement?.querySelector("sherpa-menu-item")) return;

    const field = chip.getAttribute("data-filter-field");
    const filterType = chip.getAttribute("data-filter-type") || "text";

    switch (filterType) {
      case "text":
      case "number": {
        const values = this.#getValuesForField(field);
        if (values.length) {
          const items = values.map((v) => ({ value: v, text: v }));
          chip.setMenuItems?.(items, { selection: "checkbox", group: "values" });
        }
        break;
      }
      case "datetime-range":
        // Auto-populate from TIME_RANGE_PRESETS
        this.#populateTimeframeMenu(chip);
        break;
      case "boolean":
        // No menu — chip acts as a simple toggle.
        if (!chip.dataset.filterBooleanValue) {
          chip.dataset.filterBooleanValue = "true";
        }
        break;
      case "number-range":
        // Consumer must provide options — no auto-population
        break;
    }
  }

  /**
   * Update a filter chip's label and badge based on selection count.
   * 1 selected  → label = selected item's text, no badge.
   * >1 selected → label = default field name, badge = count.
   * 0 selected  → label = default field name, no badge.
   */
  #syncFilterChipLabel(chip, count) {
    const defaultLabel = chip.dataset.defaultLabel || chip.dataset.label;
    if (count === 1) {
      const menuEl = chip.menuElement ?? chip.querySelector("sherpa-menu");
      const checked = menuEl?.querySelector("sherpa-menu-item[checked]");
      chip.dataset.label = checked?.textContent?.trim() || defaultLabel;
      delete chip.dataset.count;
    } else if (count > 1) {
      chip.dataset.label = defaultLabel;
      chip.dataset.count = String(count);
    } else {
      chip.dataset.label = defaultLabel;
      delete chip.dataset.count;
    }
  }

  /** Populate a sort/segment chip's menu with column choices. */
  #populateColumnsMenu(chip) {
    // Segment (group) chips only show string-type columns
    const isSegment = chip.getAttribute("data-behavior") === "segment";
    const cols = isSegment
      ? this.#columns.filter(c => this.#inferFilterType(c.type) === "text")
      : this.#columns;
    const currentField = chip.getAttribute("data-field");
    const items = cols.map(c => ({
      value: c.field,
      text: c.name || formatFieldName(c.field),
      selected: c.field === currentField,
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

  /** Cycle sort mode: off → asc → desc → off (field), off → desc → asc → off (value/time). */
  #cycleSortMode(chip) {
    const current = chip.dataset.mode;
    const sortType = chip.dataset.sortType;

    if (sortType === "time") {
      // Time sort: off → desc (Newest first) → asc (Oldest first) → off
      if (!current || current === "off") {
        chip.dataset.mode = "desc";
        chip.dataset.iconStart = "\uf063"; // fa-arrow-down
        chip.dataset.label = "Newest first";
        chip.toggleAttribute("data-active", true);
      } else if (current === "desc") {
        chip.dataset.mode = "asc";
        chip.dataset.iconStart = "\uf062"; // fa-arrow-up
        chip.dataset.label = "Oldest first";
      } else {
        delete chip.dataset.mode;
        chip.dataset.iconStart = "\uf0dc"; // fa-sort (neutral)
        chip.dataset.label = "Sort";
        chip.removeAttribute("data-active");
      }
    } else if (sortType === "value") {
      // Value sort: off → desc (Largest first) → asc (Smallest first) → off
      if (!current || current === "off") {
        chip.dataset.mode = "desc";
        chip.dataset.iconStart = "\uf063"; // fa-arrow-down
        chip.dataset.label = "Largest first";
        chip.toggleAttribute("data-active", true);
      } else if (current === "desc") {
        chip.dataset.mode = "asc";
        chip.dataset.iconStart = "\uf062"; // fa-arrow-up
        chip.dataset.label = "Smallest first";
      } else {
        delete chip.dataset.mode;
        chip.dataset.iconStart = "\uf0dc"; // fa-sort (neutral)
        chip.dataset.label = "Sort";
        chip.removeAttribute("data-active");
      }
    } else {
      // Field sort: off → asc → desc → off
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
    }
    // Observer picks up the data-mode/data-active mutations and dispatches.
  }

  /** Cycle segment mode: inactive → active → inactive. */
  #cycleSegmentMode(chip) {
    // No field selected yet — user must pick from the dropdown first
    if (!chip.hasAttribute("data-field")) return;
    if (chip.hasAttribute("data-active")) {
      chip.removeAttribute("data-active");
    } else {
      chip.toggleAttribute("data-active", true);
    }
    // Observer picks up the data-active mutation and dispatches.
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
