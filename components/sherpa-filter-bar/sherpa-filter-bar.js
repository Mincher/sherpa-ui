/**
 * sherpa-filter-bar.js
 * Horizontal filter bar with zoned layout.
 *
 * Filter chip configuration (new API):
 *   Each filter chip is a <sherpa-button data-type="button-select"> with:
 *     data-filter-field    — Data field to filter on (e.g. "severity", "amount")
 *     data-filter-type     — Filter type: "text" | "number" | "number-range" | "datetime-range"
 *     data-filter-operator — Operator (optional): "in" | "equals" | "contains" | "between" | "gt" | "lt" | "gte" | "lte"
 *                           Defaults: text→in, number→equals, number-range→between, datetime-range→between
 *
 *   Sort/segment chips retain data-behavior="sort" | "segment".
 *
 * Legacy support:
 *   data-behavior="filter" and data-behavior="timeframe" still work but emit
 *   a console deprecation warning. Migrate to data-filter-field + data-filter-type.
 *
 * Self-populating:
 *   Listens for `vizready` events bubbling from sibling viz children
 *   through the shared sherpa-container ancestor. Unions their columns
 *   and rows to seed chip menus automatically.
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
 *   containerfilterchange  — Dispatched on the closest sherpa-container
 *                           ancestor so viz children can self-filter.
 *                           detail: { filters }
 *
 * Events consumed:
 *   vizready   (bubbles up from viz children)  — auto-populates columns/rows
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
  #addSelect = null;
  #applied = true; // Toggle state — when false, getFilters() returns []
  #pendingEmit = false; // Microtask debounce for observer-driven filterchange
  #vizReadyHandler = null; // Bound handler for vizready events
  #sortChangeHandler = null; // Bound handler for sortchange events
  #syncingSort = false; // Guard against re-entrant filterchange during sort sync
  #containerEl = null; // Cached closest sherpa-container ancestor

  onConnect() {
    // Cache closest container — supports both light DOM and shadow DOM hosts
    this.#containerEl =
      this.closest("sherpa-container") ||
      (() => {
        const root = this.getRootNode();
        return root instanceof ShadowRoot &&
          root.host?.tagName === "SHERPA-CONTAINER"
          ? root.host
          : null;
      })();

    // ── Self-populating: listen for vizready from viz children ──
    if (this.#containerEl) {
      this.#vizReadyHandler = (e) => this.#onVizReady(e);
      this.#containerEl.addEventListener("vizready", this.#vizReadyHandler);

      // 2-way sort binding: viz child column-header sort → sort chip
      this.#sortChangeHandler = (e) => this.#onSortChange(e);
      this.#containerEl.addEventListener("sortchange", this.#sortChangeHandler);
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

    // Add filter button — sherpa-button[data-type="icon-select"] with <select>
    this.#addButton = this.$(".add-filter-button");
    // The button's shadow DOM may not have rendered yet, so we listen
    // for change on the button itself (events re-dispatch on host)
    this.#addButton?.addEventListener("change", this.#onAddSelectChange);

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
        this.#populateAddSelect();
      }
    });

    // Listen for button clicks from behavior chips (mode cycling)
    this.addEventListener("buttonclick", (e) => {
      const chip = e.target;
      // data-filter-field chips: button click is a no-op (select drives changes)
      if (chip?.hasAttribute?.("data-filter-field")) return;
      if (!chip?.hasAttribute?.("data-behavior")) return;
      const behavior = chip.getAttribute("data-behavior");
      if (behavior === "sort") {
        this.#cycleSortMode(chip);
      } else if (behavior === "segment") {
        this.#cycleSegmentMode(chip);
      }
      // Legacy timeframe / filter buttonclick → no-op
    });

    // Listen for select changes from data-filter-field chips and legacy behavior chips
    this.addEventListener("selectchange", (e) => {
      const chip = e.target;

      // ── New API: data-filter-field chips ──
      if (chip?.hasAttribute?.("data-filter-field")) {
        const filterType = chip.getAttribute("data-filter-type") || "text";
        const value = e.detail?.value;
        if (filterType === "datetime-range" && value) {
          // Update label from TIME_RANGE_PRESETS if applicable
          const preset = TIME_RANGE_PRESETS.find(p => p.key === value);
          if (preset) chip.dataset.label = preset.label;
        }
        chip.toggleAttribute("data-active", true);
        this.#syncActiveState();
        this.#emitFilterChange();
        return;
      }

      // ── Legacy API: data-behavior chips ──
      if (!chip?.hasAttribute?.("data-behavior")) return;
      const behavior = chip.getAttribute("data-behavior");
      if (behavior === "filter") {
        console.warn('[sherpa-filter-bar] data-behavior="filter" is deprecated. Use data-filter-field + data-filter-type instead.');
        chip.toggleAttribute("data-active", true);
        this.#syncActiveState();
        this.#emitFilterChange();
      } else if (behavior === "sort" || behavior === "segment") {
        const field = e.detail?.value;
        if (field) {
          chip.dataset.field = field;
          const col = this.#columns.find(c => c.field === field);
          if (col) chip.dataset.label = col.name || formatFieldName(field);
          chip.toggleAttribute("data-active", true);
          this.#emitFilterChange();
        }
      } else if (behavior === "timeframe") {
        console.warn('[sherpa-filter-bar] data-behavior="timeframe" is deprecated. Use data-filter-field + data-filter-type="datetime-range" instead.');
        const key = e.detail?.value;
        if (key) {
          const preset = TIME_RANGE_PRESETS.find(p => p.key === key);
          if (preset) chip.dataset.label = preset.label;
          chip.toggleAttribute("data-active", true);
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

    if (this.#containerEl && this.#vizReadyHandler) {
      this.#containerEl.removeEventListener("vizready", this.#vizReadyHandler);
    }
    if (this.#containerEl && this.#sortChangeHandler) {
      this.#containerEl.removeEventListener(
        "sortchange",
        this.#sortChangeHandler,
      );
    }
    this.#vizReadyHandler = null;
    this.#sortChangeHandler = null;
    this.#containerEl = null;
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
      const isDataFilter = chip.hasAttribute("data-filter-field");
      const isLegacyFilter = chip.getAttribute("data-behavior") === "filter";
      const isLegacyTimeframe = chip.getAttribute("data-behavior") === "timeframe";

      if (isDataFilter || isLegacyFilter || isLegacyTimeframe) {
        if (chip.hasAttribute("data-closeable")) {
          // User-added dynamic filter chips — remove from DOM
          chip.remove();
        } else {
          // Declarative / preset chips — clear values but keep in DOM
          const sel = chip.selectElement;
          if (sel) { for (const opt of sel.options) opt.selected = false; }
          chip.removeAttribute("data-active");
        }
      } else {
        // Static chips (sort, segment) — reset attributes
        chip.removeAttribute("data-field");
        chip.removeAttribute("data-mode");
      }
    }
    this.removeAttribute("data-active");
    this.#populateAddSelect();
    this.dispatchEvent(
      new CustomEvent("filterclear", { bubbles: true, composed: true }),
    );
    this.#dispatchContainerFilterChange([]);
  }

  /** Get all slotted behavior buttons and data-filter-field chips. */
  #getFilterChips() {
    return Array.from(
      this.querySelectorAll(
        "sherpa-button[data-behavior], sherpa-button[data-filter-field]",
      ),
    );
  }

  /** Get fields already used by active filter chips (presets + user-added). */
  #getUsedFilterFields() {
    const fields = new Set();
    for (const chip of this.#getFilterChips()) {
      // New API
      const ff = chip.getAttribute("data-filter-field");
      if (ff) { fields.add(ff); continue; }
      // Legacy API
      if (chip.getAttribute("data-behavior") === "filter") {
        const f = chip.getAttribute("data-field");
        if (f) fields.add(f);
      }
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
      'sherpa-button[slot="presets"][data-filter-field], sherpa-button[slot="presets"][data-behavior="filter"]',
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
      const chip = document.createElement("sherpa-button");
      chip.setAttribute("data-type", "button-select");
      chip.setAttribute("data-filter-field", field);
      chip.setAttribute("data-filter-type", filterType);
      chip.setAttribute("slot", "presets");
      chip.dataset.label = col?.name || formatFieldName(field);
      this.appendChild(chip);

      // Populate select based on filter type
      if (this.#rows.length || filterType === "datetime-range") {
        this.#populateFilterChip(chip);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Add Filter Select
     ══════════════════════════════════════════════════════════════ */

  /** Ensure we have a reference to the button's internal <select>. */
  #ensureAddSelect() {
    if (!this.#addSelect && this.#addButton) {
      this.#addSelect = this.#addButton.selectElement ?? null;
    }
    return this.#addSelect;
  }

  /** Populate the "Add filter" select with available (unused) columns. */
  #populateAddSelect() {
    const sel = this.#ensureAddSelect();
    if (!sel) return;

    const usedFields = this.#getUsedFilterFields();
    const available = this.#columns.filter((c) => !usedFields.has(c.field));

    sel.replaceChildren();

    // Placeholder
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "+ Add filter";
    placeholder.selected = true;
    placeholder.disabled = true;
    sel.appendChild(placeholder);

    for (const col of available) {
      const opt = document.createElement("option");
      opt.value = col.field;
      opt.textContent = col.name || formatFieldName(col.field);
      sel.appendChild(opt);
    }

    // Hide when no columns exist at all
    this.#addButton?.toggleAttribute(
      "hidden",
      this.#columns.length === 0,
    );
  }

  /** Handle selection from the "Add filter" select. */
  #onAddSelectChange = (_e) => {
    const sel = this.#ensureAddSelect();
    const field = sel?.value;
    if (!field) return;

    const col = this.#columns.find((c) => c.field === field);
    if (!col) return;

    const filterType = this.#inferFilterType(col.type);

    // Create a new filter chip (in default slot — user filters zone)
    const chip = document.createElement("sherpa-button");
    chip.setAttribute("data-type", "button-select");
    chip.setAttribute("data-filter-field", field);
    chip.setAttribute("data-filter-type", filterType);
    chip.setAttribute("data-closeable", "");
    chip.dataset.label = col.name || formatFieldName(field);

    // Insert in light DOM default slot
    this.appendChild(chip);

    // Populate select based on filter type
    this.#populateFilterChip(chip);

    // Repopulate to remove the now-used field
    this.#populateAddSelect();
  };

  /** Dispatch filterchange event + containerfilterchange on container ancestor. */
  #emitFilterChange() {
    const filters = this.getFilters();
    this.dispatchEvent(
      new CustomEvent("filterchange", {
        bubbles: true,
        composed: true,
        detail: { filters },
      }),
    );

    // Dispatch containerfilterchange on closest container so viz children
    // can self-filter without container acting as intermediary.
    this.#dispatchContainerFilterChange(filters);
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
        // ── New API: data-filter-field chips ──
        if (chip.hasAttribute("data-filter-field")) {
          const filterType = chip.getAttribute("data-filter-type") || "text";
          const operator = this.#resolveOperator(chip);
          const values = this.#getChipSelectedValues(chip);
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

        // ── Legacy API: data-behavior chips ──
        const type = chip.getAttribute("data-behavior");
        const entry = {
          field: chip.getAttribute("data-field"),
          mode: chip.getAttribute("data-mode"),
          type,
        };
        if (type === "filter") {
          entry.values = this.#getChipSelectedValues(chip);
        }
        if (type === "timeframe") {
          entry.rangeKey = chip.value || "";
          entry.range = this.#computeTimeRange(chip.value);
          if (!entry.field) {
            entry.field = chip.getAttribute("data-field") || "";
          }
        }
        return entry;
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
      // ── New API: data-filter-field chips ──
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

      // ── Legacy API: data-behavior chips ──
      const behavior = chip.getAttribute("data-behavior");
      if (behavior === "filter") {
        this.#populateChipSelect(chip, chip.getAttribute("data-field"));
        const col = this.#columns.find(
          (c) => c.field === chip.getAttribute("data-field"),
        );
        if (col && chip.slot === "presets") {
          chip.dataset.label = col.name || formatFieldName(col.field);
        }
      } else if (behavior === "timeframe") {
        this.#populateTimeframeSelect(chip);
      } else {
        this.#populateColumnsSelect(chip);
      }
    }

    // If preset filters attribute is set but chips haven't been created yet, create them now
    const presetFields = this.getAttribute("data-preset-filters");
    if (
      presetFields &&
      !this.querySelector('sherpa-button[slot="presets"]')
    ) {
      this.#initPresetChips(presetFields);
    }

    this.#populateAddSelect();
  }

  /** Remove filter chip for a specific field. */
  removeFilterChip(field) {
    for (const chip of this.#getFilterChips()) {
      // New API
      if (chip.getAttribute("data-filter-field") === field) {
        chip.remove();
        this.#syncActiveState();
        this.#emitFilterChange();
        return true;
      }
      // Legacy API
      if (
        chip.getAttribute("data-behavior") === "filter" &&
        chip.getAttribute("data-field") === field
      ) {
        chip.remove();
        this.#syncActiveState();
        this.#emitFilterChange();
        return true;
      }
    }
    return false;
  }

  /* ══════════════════════════════════════════════════════════════
     Self-populating event handlers
     ══════════════════════════════════════════════════════════════ */

  /**
   * Handle a vizready event from a viz child.
   * Unions columns and rows from all viz children that have fired so far.
   */
  #onVizReady(e) {
    const { columns = [], rows = [] } = e.detail || {};

    // Merge columns by field (union — first definition wins)
    const colMap = new Map();
    for (const c of this.#columns) colMap.set(c.field, c);
    for (const c of columns) {
      if (!colMap.has(c.field)) colMap.set(c.field, c);
    }
    const mergedCols = [...colMap.values()];
    const mergedRows = this.#rows.concat(rows);

    this.setAvailableColumns(mergedCols, mergedRows);

    // Seed segment chip from first viz element if not already set
    const segmentChip = this.querySelector('sherpa-button[slot="group"]');
    if (segmentChip && !segmentChip.getAttribute("data-field")) {
      const vizEl = e.target;
      const initField = vizEl?.getAttribute("data-segment-field");
      const initMode = vizEl?.getAttribute("data-segment-mode");
      if (initField) {
        segmentChip.dataset.field = initField;
        const col = this.#columns.find(c => c.field === initField);
        if (col) segmentChip.dataset.label = col.name || formatFieldName(initField);
        if (initMode) segmentChip.dataset.mode = initMode;
      }
    }

    // Auto-hide group chip if only barcharts with no valid segment columns
    this.#maybeHideGroupChip();

    // Dispatch containercolumnsready for any external listeners (global filter bars)
    this.dispatchEvent(
      new CustomEvent("containercolumnsready", {
        bubbles: true,
        composed: true,
        detail: { columns: mergedCols, rows: mergedRows },
      }),
    );
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
    this.#syncingSort = false;
  }

  /**
   * Dispatch containerfilterchange on the closest sherpa-container ancestor.
   * Viz children listen for this to self-filter.
   */
  #dispatchContainerFilterChange(filters) {
    const container = this.#containerEl || this.closest("sherpa-container");
    if (!container) return;
    container.dispatchEvent(
      new CustomEvent("containerfilterchange", {
        bubbles: false, // scoped to container
        detail: { filters },
      }),
    );
  }

  /**
   * Hide the group (segment) chip when all viz siblings are barcharts
   * and the only non-numeric column with >1 unique value is the category axis.
   */
  #maybeHideGroupChip() {
    const groupChip = this.querySelector('sherpa-button[slot="group"]');
    if (!groupChip) return;

    const container = this.#containerEl || this.closest("sherpa-container");
    if (!container) return;

    // Get all viz elements in the container
    const vizEls = [
      ...container.querySelectorAll(":is(sherpa-barchart, sherpa-data-grid)"),
    ];
    const allCharts =
      vizEls.length > 0 &&
      vizEls.every((el) => el.tagName === "SHERPA-BARCHART");
    if (!allCharts) return;

    // Collect category fields
    const catFields = new Set();
    for (const el of vizEls) {
      const cat =
        typeof el.getCategoryField === "function"
          ? el.getCategoryField()
          : null;
      if (cat) catFields.add(cat);
    }

    const NUMERIC_TYPES = new Set([
      "number",
      "numeric",
      "currency",
      "percent",
      "year",
      "monthNumber",
    ]);
    const validSegmentCols = this.#columns.filter((col) => {
      if (NUMERIC_TYPES.has((col.type || "").toLowerCase())) return false;
      if (catFields.has(col.field)) return false;
      const vals = new Set();
      for (const r of this.#rows) {
        vals.add(r[col.field]);
        if (vals.size > 1) break;
      }
      return vals.size > 1;
    });

    if (validSegmentCols.length === 0) {
      groupChip.toggleAttribute("disabled", true);
      groupChip.removeAttribute("data-field");
      groupChip.removeAttribute("data-mode");
    }
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

  /** Populate a filter chip's select with unique values for its field. */
  #populateChipSelect(chip, field) {
    if (!field) return;
    const values = this.#extractUniqueValues(field);
    const options = values.map(v => ({ value: v, text: v }));
    chip.setOptions?.(options);
  }

  /**
   * Populate a data-filter-field chip based on its filter type.
   * If the chip already has consumer-provided options, skip auto-population.
   * @param {HTMLElement} chip — sherpa-button with data-filter-field
   */
  #populateFilterChip(chip) {
    // If the consumer has already provided options via setOptions(), don't override
    const sel = chip.selectElement;
    if (sel && sel.options.length > 0) return;

    const field = chip.getAttribute("data-filter-field");
    const filterType = chip.getAttribute("data-filter-type") || "text";

    switch (filterType) {
      case "text":
      case "number":
        // Auto-populate from unique field values in the data
        if (field && this.#rows.length) {
          this.#populateChipSelect(chip, field);
        }
        break;
      case "datetime-range":
        // Auto-populate from TIME_RANGE_PRESETS
        this.#populateTimeframeSelect(chip);
        break;
      case "number-range":
        // Consumer must provide options — no auto-population
        break;
    }
  }

  /** Populate a sort/segment chip's select with column choices. */
  #populateColumnsSelect(chip) {
    const options = this.#columns.map(c => ({
      value: c.field,
      text: c.name || formatFieldName(c.field),
    }));
    chip.setOptions?.(options);
  }

  /** Get selected values from a chip's internal select. */
  #getChipSelectedValues(chip) {
    const sel = chip.selectElement;
    if (!sel) return [];
    return Array.from(sel.selectedOptions, o => o.value);
  }

  /* ══════════════════════════════════════════════════════════════
     Filter type / operator helpers
     ══════════════════════════════════════════════════════════════ */

  /** Map column type metadata to a canonical filter type. */
  static #COLUMN_TYPE_MAP = {
    number: "number", numeric: "number", currency: "number",
    percent: "number", year: "number",
    date: "datetime-range", datetime: "datetime-range", time: "datetime-range",
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

  /** Cycle sort mode: off → asc → desc → off. */
  #cycleSortMode(chip) {
    const current = chip.dataset.mode;
    if (!current || current === "off") {
      chip.dataset.mode = "asc";
      chip.toggleAttribute("data-active", true);
    } else if (current === "asc") {
      chip.dataset.mode = "desc";
    } else {
      delete chip.dataset.mode;
      chip.removeAttribute("data-active");
      delete chip.dataset.field;
      chip.dataset.label = "Sort";
    }
    this.#emitFilterChange();
  }

  /** Cycle segment mode: inactive → active → inactive. */
  #cycleSegmentMode(chip) {
    if (chip.hasAttribute("data-active")) {
      chip.removeAttribute("data-active");
      delete chip.dataset.field;
      chip.dataset.label = "Group";
    } else {
      chip.toggleAttribute("data-active", true);
    }
    this.#emitFilterChange();
  }

  /**
   * Populate a timeframe chip's select with TIME_RANGE_PRESETS.
   * @param {HTMLElement} chip — sherpa-button[data-behavior="timeframe"]
   */
  #populateTimeframeSelect(chip) {
    const options = TIME_RANGE_PRESETS.map(p => ({
      value: p.key,
      text: p.label,
    }));
    chip.setOptions?.(options);
  }
}

customElements.define("sherpa-filter-bar", SherpaFilterBar);
