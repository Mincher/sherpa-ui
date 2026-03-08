/**
 * sherpa-filter-bar.js
 * Horizontal filter bar with zoned layout.
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
  #addBtn = null;
  #applied = true; // Toggle state — when false, getFilters() returns []
  #pendingEmit = false; // Microtask debounce for observer-driven filterchange
  #menuHeadingTpl = null; // Cached <template class="menu-heading-tpl">
  #menuItemTpl = null; // Cached <template class="menu-item-tpl">
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
      attributeFilter: ["data-active", "data-field", "data-mode"],
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

    // Add button — opens column menu
    this.#addBtn = this.$("sherpa-button.add-filter-btn");
    this.#addBtn?.addEventListener("menu-open", () => this.#populateAddMenu());
    this.#addBtn?.addEventListener("menu-select", (e) =>
      this.#onAddMenuSelect(e),
    );

    // Listen for chip removal events (from filter chips' × button)
    this.addEventListener("chipremove", (e) => {
      const chip = e.target;
      if (chip.tagName === "SHERPA-FILTER-CHIP") {
        chip.remove();
        this.#syncActiveState();
        this.#emitFilterChange();
      }
    });

    // Listen for value changes from filter chips
    this.addEventListener("filtervaluechange", () => {
      this.#syncActiveState();
      this.#emitFilterChange();
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
      if (chip.getAttribute("data-type") === "filter") {
        // Preset chips (slotted as presets) — just clear values
        if (chip.slot === "presets") {
          chip.clearValues?.();
        } else {
          // User-added dynamic filter chips — remove from DOM
          chip.remove();
        }
      } else {
        // Static chips (sort, segment) — reset attributes
        chip.removeAttribute("data-field");
        chip.removeAttribute("data-mode");
      }
    }
    this.removeAttribute("data-active");
    this.dispatchEvent(
      new CustomEvent("filterclear", { bubbles: true, composed: true }),
    );
    this.#dispatchContainerFilterChange([]);
  }

  /** Get all slotted sherpa-filter-chip elements across all slots. */
  #getFilterChips() {
    return Array.from(this.querySelectorAll("sherpa-filter-chip"));
  }

  /** Get fields already used by active filter chips (presets + user-added). */
  #getUsedFilterFields() {
    return new Set(
      this.#getFilterChips()
        .filter((c) => c.getAttribute("data-type") === "filter")
        .map((c) => c.getAttribute("data-field"))
        .filter(Boolean),
    );
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
    // Remove existing preset filter chips (preserve timeframe / other types)
    for (const chip of this.querySelectorAll(
      'sherpa-filter-chip[slot="presets"][data-type="filter"]',
    )) {
      chip.remove();
    }

    const fieldList = fields
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);
    for (const field of fieldList) {
      const col = this.#columns.find((c) => c.field === field);
      const chip = document.createElement("sherpa-filter-chip");
      chip.setAttribute("data-type", "filter");
      chip.setAttribute("data-field", field);
      chip.setAttribute("slot", "presets");
      chip.textContent = col?.name || formatFieldName(field);
      this.appendChild(chip);

      // Supply row data + column metadata so the chip can detect booleans
      if (this.#rows.length) {
        chip.setValueData(this.#rows, col);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Add Filter Menu
     ══════════════════════════════════════════════════════════════ */

  /** Populate the "Add" button menu with available columns. */
  #populateAddMenu() {
    if (!this.#addBtn?.menuElement) return;

    // Lazy-cache cloning templates
    if (!this.#menuHeadingTpl) {
      this.#menuHeadingTpl = this.$("template.menu-heading-tpl");
      this.#menuItemTpl = this.$("template.menu-item-tpl");
    }

    const usedFields = this.#getUsedFilterFields();
    const available = this.#columns.filter((c) => !usedFields.has(c.field));

    const frag = document.createDocumentFragment();

    // Heading
    const heading = this.#menuHeadingTpl.content
      .cloneNode(true)
      .querySelector("sherpa-menu-item");
    heading.textContent = "Add filter";
    frag.appendChild(heading);

    if (!available.length) {
      const emptyFrag = this.#menuItemTpl.content.cloneNode(true);
      const empty = emptyFrag.querySelector("sherpa-menu-item");
      empty.setAttribute("disabled", "");
      empty.textContent = "No columns available";
      frag.appendChild(emptyFrag);
    } else {
      const ul = document.createElement("ul");
      for (const col of available) {
        const itemFrag = this.#menuItemTpl.content.cloneNode(true);
        const item = itemFrag.querySelector("sherpa-menu-item");
        item.setAttribute("value", col.field);
        item.dataset.addField = col.field;
        item.textContent = col.name || col.field;
        ul.appendChild(itemFrag);
      }
      frag.appendChild(ul);
    }

    this.#addBtn.menuElement.replaceChildren(frag);
  }

  /** Handle selection from the "Add" column menu. */
  #onAddMenuSelect(e) {
    const data = e?.detail?.data || {};
    const field = data.addField;
    if (!field) return;

    const col = this.#columns.find((c) => c.field === field);
    if (!col) return;

    // Create a new filter chip (in default slot — user filters zone)
    const chip = document.createElement("sherpa-filter-chip");
    chip.setAttribute("data-type", "filter");
    chip.setAttribute("data-field", field);
    chip.textContent = col.name || col.field;

    // Insert in light DOM default slot
    this.appendChild(chip);

    // Supply row data + column metadata so the chip can detect booleans
    chip.setValueData(this.#rows, col);
  }

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
        const type = chip.getAttribute("data-type");
        const entry = {
          field: chip.getAttribute("data-field"),
          mode: chip.getAttribute("data-mode"),
          type,
        };
        if (type === "filter") {
          entry.values = chip.getSelectedValues?.() || [];
        }
        if (type === "timeframe") {
          entry.rangeKey = chip.getRangeKey?.() || "";
          entry.range = chip.getTimeRange?.() || null;
          // Use auto-detected timestamp field if chip has no explicit field
          if (!entry.field && typeof chip.getField === "function") {
            entry.field = chip.getField();
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
      const type = chip.getAttribute("data-type");
      if (type === "filter") {
        const col = this.#columns.find(
          (c) => c.field === chip.getAttribute("data-field"),
        );
        chip.setValueData(this.#rows, col);
        // Update label when column metadata becomes available
        if (col && chip.slot === "presets") {
          chip.textContent = col.name || formatFieldName(col.field);
        }
      } else {
        chip.setAvailableColumns?.(columns, rows);
      }
    }

    // If preset filters attribute is set but chips haven't been created yet, create them now
    const presetFields = this.getAttribute("data-preset-filters");
    if (
      presetFields &&
      !this.querySelector('sherpa-filter-chip[slot="presets"]')
    ) {
      this.#initPresetChips(presetFields);
    }
  }

  /** Remove filter chip for a specific field. */
  removeFilterChip(field) {
    for (const chip of this.#getFilterChips()) {
      if (
        chip.getAttribute("data-type") === "filter" &&
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
    const segmentChip = this.querySelector('sherpa-filter-chip[slot="group"]');
    if (segmentChip && !segmentChip.getField?.()) {
      const vizEl = e.target;
      const initField = vizEl?.getAttribute("data-segment-field");
      const initMode = vizEl?.getAttribute("data-segment-mode");
      if (initField) {
        segmentChip.setField(initField);
        if (initMode) segmentChip.setMode(initMode);
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
    const sortChip = this.querySelector('sherpa-filter-chip[data-type="sort"]');
    if (!sortChip) return;

    const { field, direction } = e.detail || {};
    this.#syncingSort = true;
    if (field && direction !== "off") {
      sortChip.setField(field);
      sortChip.setMode(direction);
    } else {
      sortChip.setField(null);
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
    const groupChip = this.querySelector('sherpa-filter-chip[slot="group"]');
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
}

customElements.define("sherpa-filter-bar", SherpaFilterBar);
