/**
 * @element sherpa-filter-bar
 * @category data
 * @description Horizontal filter bar with zoned layout. Supports global and
 *   local (container-scoped) modes. Template variants: default (global) | local.
 *
 * @attr {enum}    [data-density]          — Display density variant
 * @attr {boolean} [data-active]           — Whether filters are active
 * @attr {string}  [data-src-json]              — URL of a JSON file describing the filter bar
 *                                            (and optionally the parent data grid).
 *                                            Shape: { fields: [...], presetFilters: [...] }
 *                                            Fetched on connect and whenever the attribute changes;
 *                                            populates data-available-fields and data-preset-filters.
 * @attr {json}    [data-preset-filters]   — Preset filter configuration JSON
 * @attr {json}    [data-available-fields] — Field definitions: [{ field, name, type }]
 *
 * @slot toggle   — Filter on/off toggle
 * @slot group    — Segment/group chip
 * @slot sort     — Sort chip
 * @slot presets  — Preset filter chips
 * @slot (default) — User-added dynamic filter chips + Add button
 * @slot actions  — Clear / Apply / Save buttons
 *
 * @fires filter-change
 *   bubbles: true, composed: true
 *   detail: { filters: Array }
 * @fires filter-clear
 *   bubbles: true, composed: true
 *   detail: none
 * @fires container-filter-change
 *   bubbles: true, composed: true
 *   detail: { filters: Array }
 * @fires global-filter-change
 *   bubbles: false, composed: false
 *   detail: { filters: Array }
 *
 * @method getFilters()                      — Returns current filter array
 * @method setAvailableColumns(columns, rows)— Set columns and row data for menus
 * @method removeFilterChip(field)           — Remove filter chip by field name
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import type { EventHandler } from "../utilities/types.js";
import "../sherpa-button/sherpa-button.js";
import { formatFieldName } from "../utilities/format-utils.js";
import { TIME_RANGE_PRESETS } from "../utilities/timeframes.js";
import { applyLocalFilters, type FilterSpec } from "../utilities/aggregate.js";

/* ── Dataset Interface ─────────────────────────────────────────── */

interface SherpaFilterBarDataset extends DOMStringMap {
  density?: string;
  active?: string;
  srcJson?: string;
  presetFilters?: string;
  availableFields?: string;
  type?: string;
}

/* ── Domain types ──────────────────────────────────────────────── */

/** An available-field descriptor for the add-filter menu. */
interface FieldDef {
  field: string;
  name?: string;
  type?: string;
  values?: string[];
}

/** A sherpa-button acting as a menu trigger. */
interface MenuButtonLike extends HTMLElement {
  setMenuItems?(items: unknown[], options?: unknown): void;
  getSelectedValues?(): string[];
  clearSelection?(): void;
  menuElement?: Element | null;
}

export class SherpaFilterBar extends SherpaElement {

  override get dataset(): SherpaFilterBarDataset {
    return super.dataset as SherpaFilterBarDataset;
  }
  static override get cssUrl(): string {
    return new URL("./sherpa-filter-bar.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-filter-bar.html", import.meta.url).href;
  }

  /* ── Template selection ───────────────────────────────────────── */

  override get templateId(): string {
    return this.dataset["type"] || "default";
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-density",
      "data-active",
      "data-preset-filters",
      "data-available-fields",
      "data-sort-type",
    ];
  }

  /** Public accessor for the shadow DOM sort chip (for external syncing). */
  get sortChip() {
    return this.$<HTMLElement>("sherpa-button[data-behavior='sort']");
  }

  /** Public accessor for the shadow DOM segment/group chip (for external syncing). */
  get segmentChip() {
    return this.$<HTMLElement>("sherpa-button[data-behavior='segment']");
  }

  #observer: MutationObserver | null = null;
  #columns: FieldDef[] = [];
  #rows: Record<string, unknown>[] = [];
  #applied = true; // Toggle state — when false, getFilters() returns []
  #pendingEmit = false; // Microtask debounce for observer-driven filterchange
  #sortChangeHandler: ((e: Event) => void) | null = null; // Bound sortchange handler
  #syncingSort = false; // Guard against re-entrant filterchange during sort sync
  #bound = false;

  /** Event scope (container or shadow host) for sortchange listening. */
  #scope: Element | null = null;
  /** The "add filter" menu button, resolved after render. */
  #addButton: MenuButtonLike | null = null;

  override onRender(): void {
    if (this.#bound) return;

    // Wire sortchange listener on parent scope (container or shadow host)
    // Fallback to parent element or host if shadow scope doesn't exist
    if (!this.#scope) {
      const root = this.getRootNode();
      this.#scope = this.parentElement
        || (root instanceof ShadowRoot ? root.host : null)
        || null;
    }
    if (this.#scope && !this.#sortChangeHandler) {
      this.#sortChangeHandler = (e: Event) => this.#onSortChange(e as CustomEvent);
      this.#scope.addEventListener("sort-change", this.#sortChangeHandler);
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
      slot.addEventListener("slotchange", () => {
        this.#applyDefaultSizing();
        this.#syncActiveState();
        this.#syncUserFiltersFlag();
        this.#sealChipMenus();
      });
    }
    this.#applyDefaultSizing();
    this.#syncUserFiltersFlag();
    this.#sealChipMenus();

    // Clear button delegation — look for click on actions-slotted button
    this.addEventListener("click", (e: Event) => {
      const path = e.composedPath();
      const clearBtn = path.find(
        (n) =>
          n instanceof HTMLElement &&
          n.slot === "actions" &&
          n.tagName === "SHERPA-BUTTON" &&
          (n.dataset["action"] === "clear" ||
            n.textContent.trim().toLowerCase().includes("clear")),
      );
      if (clearBtn) this.#clearAll();
    });

    // Add filter button — sherpa-button with data-menu="true"
    this.#addButton = this.$<MenuButtonLike>(".add-filter-button");
    // Listen for menu-select on the add button to create new chips
    this.#addButton?.addEventListener("menu-select", this.#onAddMenuSelect);

    // Listen for button clicks from behavior chips (mode cycling) and dismiss buttons
    this.addEventListener("button-click", (e: Event) => {
      // Use composedPath()[0] so shadow DOM chips are resolved correctly
      // (e.target is retargeted to the host when the event crosses shadow boundaries).
      const btn = e.composedPath()[0] as HTMLElement;

      // Dismiss button inside a filter chip group
      if (btn?.dataset?.["action"] === "dismiss") {
        const container = btn.closest(".grouped-component") ?? btn;
        container.remove();
        this.#syncActiveState();
        this.#emitFilterChange();
        this.#populateAddMenu();
        return;
      }

      const chip = btn;

      // Filter-field chip label — toggle active state on click
      if (chip?.hasAttribute?.("data-filter-field")) {
        chip.toggleAttribute("data-active", !chip.hasAttribute("data-active"));
        this.#syncActiveState();
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
    this.addEventListener("menu-select", (e: CustomEvent) => {
      // Use composedPath()[0] so shadow DOM behavior chips are resolved correctly.
      const chip = e.composedPath()[0] as HTMLElement;

      // Skip the add-filter button's own menu-select — handled separately
      if (chip === this.#addButton) return;

      // ── New API: data-filter-field chips ──
      // e.target may be the chevron button — resolve the filter-field label button
      const filterChip = (chip?.hasAttribute?.("data-filter-field")
        ? chip
        : chip?.closest<HTMLElement>(".grouped-component")?.querySelector<HTMLElement>("sherpa-button[data-filter-field]") ?? null) as HTMLElement | null;
      if (filterChip) {
        const menuBtn = this.#getChipMenuButton(filterChip);
        // Activate chip when any value is checked
        const values = menuBtn.getSelectedValues?.() ?? [];
        const wasActive = filterChip.hasAttribute("data-active");
        filterChip.toggleAttribute("data-active", values.length > 0);
        // Update label and badge count based on selection count
        this.#syncFilterChipLabel(filterChip, values.length);
        this.#syncActiveState();
        // If data-active didn't change (e.g. switching time range presets
        // while already active), the MutationObserver won't fire, so
        // emit explicitly.
        if (wasActive === filterChip.hasAttribute("data-active")) {
          this.#emitFilterChange();
        }
        return;
      }

      // ── Sort / segment chips ──
      // The event may come from the chevron (menu) button; the chip may be
      // inside .chip-group (shadow DOM) or .grouped-component (light DOM). Resolve the
      // label button which holds data-behavior, data-field, etc.
      const labelBtn = ((chip.closest?.(".grouped-component") ?? chip.closest?.(".chip-group"))
        ?.querySelector<HTMLElement>("sherpa-button[data-behavior]")
        ?? (chip?.hasAttribute?.("data-behavior") ? chip : null)) as HTMLElement | null;
      if (!labelBtn) return;
      const behavior = labelBtn.getAttribute("data-behavior");
      if (behavior === "sort" || behavior === "segment") {
        const field = e.detail?.value;
        const prefix = behavior === "sort" ? "Sort" : "Group";
        if (field) {
          labelBtn.dataset["field"] = field;
          const col = this.#columns.find((c: any) => c.field === field);
          const valueLabel = col?.name || formatFieldName(field);
          labelBtn.dataset["label"] = `${prefix}: ${valueLabel}`;
          // Reset to default mode for a newly-picked field
          // (clear any stale "off" mode left over from a previous cycle).
          labelBtn.dataset["mode"] = behavior === "sort" ? "asc" : "on";
          labelBtn.toggleAttribute("data-active", true);
        } else {
          // Deactivate (e.g. user picked "None")
          delete labelBtn.dataset["field"];
          delete labelBtn.dataset["mode"];
          labelBtn.dataset["label"] = prefix;
          labelBtn.removeAttribute("data-active");
        }
        // Shadow DOM mutations aren't observed by the MutationObserver — emit explicitly.
        this.#emitFilterChange();
      }
    });

    // Toggle switch — applies / unapplies all filters
    this.addEventListener("change", (e: Event) => {
      const sw = e.target as HTMLElement | null;
      if (sw?.tagName === "SHERPA-SWITCH" && sw.slot === "toggle") {
        this.#applied = sw.dataset["state"] === "on";
        this.#emitFilterChange();
      }
    });

    this.#syncActiveState();

    // Group/sort chips are always present in shadow DOM — set flags so
    // zone-divider CSS conditions activate immediately.
    this.setAttribute("data-has-group", "");
    this.setAttribute("data-has-sort", "");

    // Propagate data-sort-type to the shadow DOM sort chip
    this.#syncSortType();

    // Global filter bars get a built-in Time Range chip
    if (this.hasAttribute("data-global")) {
      this.#initDefaultTimeRangeChip();
    }

    // Populate from declarative fields attribute (if set before connect)
    this.#syncAvailableFields();
    this.#bound = true;
  }

  override onDisconnect(): void {
    this.#observer?.disconnect();
    this.#observer = null;

    if (this.#scope && this.#sortChangeHandler) {
      this.#scope.removeEventListener(
        "sort-change",
        this.#sortChangeHandler,
      );
    }
    this.#sortChangeHandler = null;
    this.#scope = null;
  }

  override onAttributeChanged(name: string, _old: string | null, newValue: string | null) {
    if (name === "data-preset-filters" && newValue) {
      this.#initPresetChips(newValue);
    }
    if (name === "data-available-fields") {
      this.#syncAvailableFields();
    }
    if (name === "data-sort-type") {
      this.#syncSortType();
    }
  }

  /** Propagate host data-sort-type to the shadow DOM sort chip. */
  #syncSortType() {
    const sortBtn = this.sortChip;
    if (!sortBtn) return;
    const type = this.dataset["sortType"];
    if (type) {
      sortBtn.dataset["sortType"] = type;
    } else {
      delete sortBtn.dataset["sortType"];
    }
  }

  /**
   * Called after `data-src-json` is fetched. Populates
   * `data-available-fields` and optionally `data-preset-filters`.
   *
   * Expected JSON shape:
   *   {
   *     "fields":        [{ field, name, type, values? }, ...],
   *     "presetFilters": ["fieldName", ...]   // optional
   *   }
   *
   * @param {object} data
   */
  override onJsonData(data: any) {
    if (Array.isArray(data?.fields)) {
      this.setAttribute("data-available-fields", JSON.stringify(data.fields));
    }
    if (Array.isArray(data?.presetFilters)) {
      this.setAttribute("data-preset-filters", data.presetFilters.join(","));
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
          chip.dataset["label"] = col.name || formatFieldName(col.field);
          chip.dataset["defaultLabel"] = chip.dataset["label"];
        }
        this.#populateFilterChip(chip);
        continue;
      }
      this.#populateColumnsMenu(chip);
    }

    // Create preset chips if declared but not yet created.
    // Preset chips are wrapped in .grouped-component[slot="presets"] (Phase 5); check
    // for any non-_timerange chip to know if they have been initialised.
    const presetFields = this.getAttribute("data-preset-filters");
    if (presetFields && !this.querySelector('.grouped-component[slot="presets"] sherpa-button[data-filter-field]:not([data-filter-field="_timerange"])')) {
      this.#initPresetChips(presetFields);
    }

    this.#populateAddMenu();
  }

  /** Toggle data-has-user-filters when ad-hoc filter chips appear in the default slot. */
  #syncUserFiltersFlag() {
    const has = !!(
      this.querySelector(":scope > sherpa-button[data-filter-field]:not([slot])") ||
      this.querySelector(":scope > .grouped-component:not([slot]) sherpa-button[data-filter-field]")
    );
    this.toggleAttribute("data-has-user-filters", has);
  }

  /**
   * Force every filter/sort/preset chip in this bar to ignore ancestor
   * `<template data-menu>` templates. This prevents container-level menu
   * items (e.g. the data-grid's "Show / hide filters" toggle) from leaking
   * into individual chip menus when the bar is rendered inside a viz host.
   */
  #sealChipMenus() {
    // Shadow DOM behavior chips already have data-menu-scope="none" in the
    // template. Only seal light DOM filter-field chips and their menu buttons.
    const chips = this.querySelectorAll(
      "sherpa-button[data-filter-field], .grouped-component sherpa-button[data-menu]",
    );
    for (const chip of chips) {
      if (chip.getAttribute("data-menu-scope") !== "none") {
        chip.setAttribute("data-menu-scope", "none");
      }
    }
  }

  /**
   * Filter bars use a one-step-down button scale ("small") by default for
   * all sherpa-button children — preset chips, ad-hoc filter chips, the
   * built-in Add button, and any consumer-slotted toggle / sort / group
   * buttons. Consumers can still override per-button by setting
   * `data-size` explicitly in markup.
   */
  #applyDefaultSizing() {
    const buttons = this.querySelectorAll("sherpa-button");
    for (const btn of buttons) {
      // Treat missing OR the global default ("base") as "no explicit choice"
      // and downscale to "small". sherpa-button.onRender() sets data-size
      // to "base" on upgrade, so checking hasAttribute alone is unreliable.
      const size = btn.getAttribute("data-size");
      if (!size || size === "base") btn.setAttribute("data-size", "small");
    }
    if (this.#addButton) {
      const size = this.#addButton.getAttribute("data-size");
      if (!size || size === "base") this.#addButton.setAttribute("data-size", "small");
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
        if (chip.hasAttribute("data-user-filter")) {
          // User-added dynamic filter chips — remove from DOM
          (chip.closest(".grouped-component") ?? chip).remove();
        } else {
          // Declarative / preset chips — clear values but keep in DOM
          this.#getChipMenuButton(chip).clearSelection?.();
          delete chip.dataset["count"];
          chip.dataset["label"] = chip.dataset["defaultLabel"] || chip.dataset["label"];
          chip.removeAttribute("data-active");
        }
      } else {
        // Static chips (sort, segment) — reset attributes
        const behavior = chip.getAttribute("data-behavior");
        chip.removeAttribute("data-field");
        chip.removeAttribute("data-mode");
        chip.removeAttribute("data-active");
        chip.dataset["label"] = behavior === "sort" ? "Sort" : "Group";
      }
    }
    this.removeAttribute("data-active");
    this.#populateAddMenu();
    this.dispatchEvent(
      new CustomEvent("filter-clear", { bubbles: true, composed: true }),
    );
    this.#dispatchContainerFilterChange([]);
    this.#dispatchGlobalFilterChange([]);
  }

  /** Get all sort/segment behavior chips (shadow DOM) and data-filter-field chips (light DOM). */
  #getFilterChips(): HTMLElement[] {
    const behaviorChips = Array.from(
      this.$$<HTMLElement>("sherpa-button[data-behavior='sort'], sherpa-button[data-behavior='segment']"),
    );
    const filterFieldChips = Array.from(
      this.querySelectorAll<HTMLElement>("sherpa-button[data-filter-field]"),
    );
    return [...behaviorChips, ...filterFieldChips];
  }

  /**
   * Returns the element that holds the menu for a behavior chip.
   * In a .grouped-component wrapper the icon button is the menu holder; for
   * standalone chips the chip itself is the menu holder.
   * @param {HTMLElement} chip — sherpa-button with data-behavior
   */
  #getChipMenuButton(chip: HTMLElement): MenuButtonLike {
    return ((chip.closest(".grouped-component") ?? chip.closest(".chip-group"))
      ?.querySelector<HTMLElement>("sherpa-button[data-menu='true']")
      ?? chip) as MenuButtonLike;
  }

  /**
   * Create a filter chip button (or .grouped-component wrapper for dismissable chips).
   * @param {object}  opts
   * @param {string}  opts.filterField   — data-filter-field value
   * @param {string}  opts.filterType    — data-filter-type value
   * @param {string}  opts.label         — initial label text
   * @param {string}  [opts.slot]        — slot attribute for placement
   * @param {boolean} [opts.dismissable] — add a dismiss (×) button
   * @returns {{ container: HTMLElement, chip: HTMLElement }}
   */
  #createFilterChipGroup({ filterField, filterType, label, slot, dismissable = false }: {
    filterField: string;
    filterType: string;
    label: string;
    slot?: string;
    dismissable?: boolean;
  }) {
    const chip = document.createElement("sherpa-button");
    chip.setAttribute("data-filter-field", filterField);
    chip.setAttribute("data-filter-type", filterType);
    chip.setAttribute("data-variant", "secondary");
    chip.setAttribute("data-menu-scope", "none");
    chip.setAttribute("data-size", "small");
    chip.dataset["label"] = label;
    chip.dataset["defaultLabel"] = label;

    if (dismissable) chip.setAttribute("data-user-filter", "");

    const isBoolToggle = filterType === "boolean";

    const group = document.createElement("div");
    group.className = "grouped-component";
    if (slot) group.setAttribute("slot", slot);
    group.appendChild(chip);

    // Chevron / menu button — not needed for boolean toggles (no dropdown)
    if (!isBoolToggle) {
      const menuBtn = document.createElement("sherpa-button");
      menuBtn.setAttribute("data-type", "icon");
      menuBtn.setAttribute("data-icon-start", "\uf078"); // fa-chevron-down
      menuBtn.setAttribute("data-menu", "true");
      menuBtn.setAttribute("data-menu-scope", "none");
      menuBtn.setAttribute("data-size", "small");
      menuBtn.setAttribute("data-separator", "");
      menuBtn.setAttribute("data-variant", "secondary");
      menuBtn.setAttribute("aria-label", "Filter options");
      group.appendChild(menuBtn);
    }

    if (dismissable) {
      const dismiss = document.createElement("sherpa-button");
      dismiss.setAttribute("data-type", "icon");
      dismiss.setAttribute("data-icon-start", "\uf00d"); // fa-xmark
      dismiss.setAttribute("data-action", "dismiss");
      dismiss.setAttribute("data-separator", "");
      dismiss.setAttribute("data-size", "small");
      dismiss.setAttribute("data-variant", "secondary");
      dismiss.setAttribute("aria-label", "Remove filter");
      group.appendChild(dismiss);
    }

    return { container: group, chip };
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

    const { container, chip } = this.#createFilterChipGroup({
      filterField: "_timerange",
      filterType: "datetime-range",
      label: "Time Range",
      slot: "presets",
    });
    this.appendChild(container);

    this.#populateTimeframeMenu(this.#getChipMenuButton(chip));
  }

  /* ══════════════════════════════════════════════════════════════
     Preset Chips
     ══════════════════════════════════════════════════════════════ */

  /**
   * Create preset filter chips from a comma-separated list of field names.
   * Called when data-preset-filters attribute is set.
   * @param {string} fields — comma-separated field names (e.g. "severity,status")
   */
  #initPresetChips(fields: string) {
    // Remove existing preset filter chips (preserve built-in _timerange chip)
    for (const chip of this.querySelectorAll(
      'sherpa-button[data-filter-field][slot="presets"], .grouped-component[slot="presets"] sherpa-button[data-filter-field]',
    )) {
      if (chip.getAttribute("data-filter-field") === "_timerange") continue;
      (chip.closest(".grouped-component") ?? chip).remove();
    }

    const fieldList = fields
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);
    for (const field of fieldList) {
      const col = this.#columns.find((c) => c.field === field);
      const filterType = this.#inferFilterType(col?.type);

      const { container, chip } = this.#createFilterChipGroup({
        filterField: field,
        filterType,
        label: col?.name || formatFieldName(field),
        slot: "presets",
      });
      this.appendChild(container);

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

    // Always re-sync menu items (including clearing to empty) so the
    // previously-shown set never lingers and lets users re-add the last field.
    this.#addButton.setMenuItems?.(
      available.map((col) => ({
        value: col.field,
        text: col.name || formatFieldName(col.field),
      })),
    );

    // Hide only when no columns are configured at all; otherwise disable
    // when every column is already in use so the button stays visible but
    // unclickable.
    const noColumns = this.#columns.length === 0;
    this.#addButton.toggleAttribute("hidden", noColumns);
    this.#addButton.toggleAttribute("disabled", !noColumns && available.length === 0);
    // Reflect Add-button visibility on the host so CSS can light up the
    // Custom-zone divider even when no ad-hoc filter chips exist yet.
    this.toggleAttribute("data-has-add", !noColumns);
  }

  /** Handle selection from the "Add filter" menu. */
  #onAddMenuSelect: EventHandler<CustomEvent> = (e: CustomEvent) => {
    const field = e.detail?.value;
    if (!field) return;

    const col = this.#columns.find((c) => c.field === field);
    if (!col) return;

    const filterType = this.#inferFilterType(col.type);

    // Create a new filter chip (in default slot — user filters zone)
    const { container, chip } = this.#createFilterChipGroup({
      filterField: field,
      filterType,
      label: col.name || formatFieldName(field),
      dismissable: true,
    });

    // Insert in light DOM default slot
    this.appendChild(container);

    // Populate menu based on filter type
    this.#populateFilterChip(chip);

    // Repopulate to remove the now-used field
    this.#populateAddMenu();
  };

  /** Dispatch filterchange + containerfilterchange, and globalfilterchange when data-global. */
  #emitFilterChange() {
    const filters = this.getFilters();
    this.dispatchEvent(
      new CustomEvent("filter-change", {
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

    // Update "(count)" suffixes on each chip's menu options so users can see
    // how many rows each value would yield in combination with other active
    // filters. Mutates textContent in place — checked state is preserved.
    this.#refreshOptionCounts();
  }

  /* ══════════════════════════════════════════════════════════════
     Public API
     ══════════════════════════════════════════════════════════════ */

  /** Get current filter state from all chips. Returns [] when toggle is off. */
  getFilters() {
    if (!this.#applied) return [];

    return this.#getFilterChips()
      .filter((chip) => {
        // Sort/segment chips report their field even when paused (off)
        // so the host can remember the selected field across cycle-offs.
        // The field is only fully cleared by picking "None" from the
        // chip menu (which deletes data-field on the chip).
        const behavior = chip.getAttribute("data-behavior");
        if (behavior === "sort" || behavior === "segment") {
          return chip.hasAttribute("data-field");
        }
        return chip.hasAttribute("data-active");
      })
      .map((chip) => {
        // ── data-filter-field chips ──
        if (chip.hasAttribute("data-filter-field")) {
          const filterType = chip.getAttribute("data-filter-type") || "text";
          const operator = this.#resolveOperator(chip);

          // Boolean chips have no menu — value comes from the stored truthy value
          if (filterType === "boolean") {
            const boolValue = chip.dataset["filterBooleanValue"] || "true";
            return {
              field: chip.getAttribute("data-filter-field"),
              type: "boolean",
              operator: "equals",
              values: [boolValue],
              value: boolValue,
            };
          }

          const values = this.#getChipMenuButton(chip).getSelectedValues?.() ?? [];
          const entry: FilterSpec = {
            field: chip.getAttribute("data-filter-field"),
            type: filterType,
            operator,
            values,
            value: values[0] || "",
          };
          // Attach computed range for datetime-range filters
          if (filterType === "datetime-range" && entry.value) {
            entry.range = this.#computeTimeRange(String(entry.value)) ?? undefined;
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
  setAvailableColumns(columns: FieldDef[], rows?: Record<string, unknown>[]) {
    if (!Array.isArray(columns) || !columns.length) return;
    if (Array.isArray(rows)) this.#rows = rows;
    this.setAttribute("data-available-fields", JSON.stringify(columns));
  }

  /** Remove filter chip for a specific field. */
  removeFilterChip(field: string) {
    for (const chip of this.#getFilterChips()) {
      if (chip.getAttribute("data-filter-field") === field) {
        (chip.closest(".grouped-component") ?? chip).remove();
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
  #onSortChange(e: CustomEvent) {
    const sortChip = this.$<HTMLElement>('sherpa-button[data-behavior="sort"]');
    if (!sortChip) return;

    const { field, direction } = e.detail || {};
    this.#syncingSort = true;
    if (field && direction !== "off") {
      sortChip.dataset["field"] = field;
      const col = this.#columns.find((c) => c.field === field);
      const valueLabel = col?.name || formatFieldName(field);
      sortChip.dataset["label"] = `Sort: ${valueLabel}`;
      sortChip.dataset["mode"] = direction;
      sortChip.toggleAttribute("data-active", true);
    } else {
      // Sort paused — preserve the remembered field and "Sort: <Field>"
      // label so the user can re-engage the same field via another click
      // cycle. The field is only cleared when the user explicitly picks
      // "None" from the menu.
      sortChip.dataset["mode"] = "off";
      sortChip.removeAttribute("data-active");
      if (!sortChip.dataset["field"]) {
        sortChip.dataset["label"] = "Sort";
      }
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
  #dispatchContainerFilterChange(filters: unknown[]) {
    this.dispatchEvent(
      new CustomEvent("container-filter-change", {
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
  #dispatchGlobalFilterChange(filters: unknown[]) {
    if (!this.hasAttribute("data-global")) return;
    document.dispatchEvent(
      new CustomEvent("global-filter-change", {
        detail: { filters },
      }),
    );
  }

  /* ══════════════════════════════════════════════════════════════
     Chip management helpers
     ══════════════════════════════════════════════════════════════ */

  /**
   * Extract unique values from a row set for a given field.
   * @param {string} field — column field name
   * @param {Array<Object>} [rows] — rows to extract from (defaults to #rows)
   * @returns {string[]} sorted unique values
   */
  #extractUniqueValues(field: string, rows?: Record<string, unknown>[]): string[] {
    const source = rows || this.#rows;
    const seen = new Set();
    const values = [];
    for (const row of source) {
      const v = row[field];
      if (v != null && !seen.has(v)) {
        seen.add(v);
        values.push(String(v));
      }
    }
    return values.sort();
  }

  /**
   * Get unique values for a field from the best available source.
   * When a column declares an explicit `values` array, those values
   * are always shown (preserving their order). When rows are present,
   * any extra observed values are appended after the declared set.
   * Options are never reduced by other active filters — every chip
   * always exposes the full set of values it could ever filter on.
   * @param {string} field — column field name
   * @returns {string[]}
   */
  #getValuesForField(field: string): string[] {
    const col = this.#columns.find((c) => c.field === field);
    const declared = col?.values?.length ? col.values.map(String) : [];
    if (this.#rows.length) {
      const extracted = this.#extractUniqueValues(field, this.#rows);
      if (!declared.length) return extracted;
      const seen = new Set(declared.map((v) => v.toLowerCase()));
      const extras = extracted.filter((v) => !seen.has(String(v).toLowerCase()));
      return [...declared, ...extras];
    }
    return declared;
  }

  /**
   * Get rows that match all currently-active value filters except those on
   * `excludeField`. Used to compute "(count)" suffixes that reflect how many
   * rows each candidate value would yield in combination with the other
   * active filters.
   * @param {string} excludeField
   * @returns {Array<Object>}
   */
  #getFilteredRowsExcluding(excludeField: string): Record<string, unknown>[] {
    if (!this.#rows.length) return this.#rows;
    const filters = this.getFilters().filter(
      (f) => f.field !== excludeField && f.type !== "sort" && f.type !== "segment",
    );
    if (!filters.length) return this.#rows;
    return applyLocalFilters(this.#rows, filters);
  }

  /**
   * Count how many rows in `scopeRows` carry each value of `field`.
   * Comparison is case-insensitive on stringified values to match how the
   * chip's value attributes are produced.
   * @param {string} field
   * @param {Array<Object>} scopeRows
   * @returns {Map<string, number>} key = lowercased value, value = count
   */
  #countValuesIn(field: string | null, scopeRows: Record<string, unknown>[]): Map<string, number> {
    const counts = new Map<string, number>();
    if (!field) return counts;
    for (const row of scopeRows) {
      const raw = row?.[field];
      if (raw === null || raw === undefined || raw === "") continue;
      const key = String(raw).toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * Mutate each filter chip's menu items so their label reads `"<value> (N)"`
   * where N is how many rows would match if that value were selected in
   * combination with the chip's other active filters. Touches only
   * textContent so existing checked / aria-checked state is preserved.
   */
  #refreshOptionCounts() {
    if (!this.#rows.length) return;
    for (const chip of this.#getFilterChips()) {
      if (!chip.hasAttribute("data-filter-field")) continue;
      const filterType = chip.getAttribute("data-filter-type") || "text";
      if (filterType !== "text" && filterType !== "number") continue;

      const field = chip.getAttribute("data-filter-field");
      if (!field) continue;
      const scope = this.#getFilteredRowsExcluding(field);
      const counts = this.#countValuesIn(field, scope);
      const menuBtn = this.#getChipMenuButton(chip);
      const items = menuBtn.menuElement?.querySelectorAll<HTMLElement>("sherpa-menu-item") ?? [];
      for (const item of items) {
        const base = item.dataset["baseText"];
        if (base === undefined) continue;
        const key = (item.getAttribute("value") ?? base).toLowerCase();
        const n = counts.get(key) ?? 0;
        item.textContent = `${base} (${n})`;
      }
    }
  }

  /**
   * Populate a data-filter-field chip based on its filter type.
   * For text/number types, populates a checkbox menu of unique values.
   * Skips re-population when the menu already contains items, preventing
   * the destructive setMenuItems → replaceChildren cycle that
   * wipes checked state.
   * @param {HTMLElement} chip — sherpa-button with data-filter-field
   */
  #populateFilterChip(chip: HTMLElement) {
    const menuBtn = this.#getChipMenuButton(chip);
    // Guard: if menu already has items, don't re-populate (preserves checked state)
    if (menuBtn.menuElement?.querySelector("sherpa-menu-item")) return;

    const field = chip.getAttribute("data-filter-field");
    const filterType = chip.getAttribute("data-filter-type") || "text";

    switch (filterType) {
      case "text":
      case "number": {
        if (!field) break;
        const values = this.#getValuesForField(field);
        if (values.length) {
          const items = values.map((v) => ({ value: v, text: v }));
          menuBtn.setMenuItems?.(items, { selection: "checkbox", group: "values" });
          // Stash the raw label so #refreshOptionCounts can re-append the
          // "(N)" suffix without losing the original text.
          for (const el of menuBtn.menuElement?.querySelectorAll<HTMLElement>("sherpa-menu-item") ?? []) {
            el.dataset["baseText"] = el.textContent.trim();
          }
          this.#refreshOptionCounts();
        }
        break;
      }
      case "datetime-range":
        // Auto-populate from TIME_RANGE_PRESETS
        this.#populateTimeframeMenu(menuBtn);
        break;
      case "boolean":
        // No menu — chip acts as a simple toggle.
        if (!chip.dataset["filterBooleanValue"]) {
          chip.dataset["filterBooleanValue"] = "true";
        }
        break;
      case "number-range":
        // Consumer must provide options — no auto-population
        break;
    }
  }

  /**
   * Update a filter chip's label and badge based on selection count.
   * All active chips follow the canonical "Label: value" format:
   *   1 selected  → "Label: SelectedValue", no badge.
   *   >1 selected → "Label:" + numeric badge (count).
   *   0 selected  → "Label" (default), no badge.
   */
  #syncFilterChipLabel(chip: HTMLElement, count: number) {
    const defaultLabel = chip.dataset["defaultLabel"] || chip.dataset["label"] || "";
    if (count === 1) {
      const menuEl = this.#getChipMenuButton(chip)?.menuElement ?? chip.querySelector("sherpa-menu");
      const checked = menuEl?.querySelector<HTMLElement>("sherpa-menu-item[checked]");
      // Prefer the stashed base text (without the "(N)" count suffix that
      // #refreshOptionCounts appends) so the chip label stays clean.
      const value = checked?.dataset["baseText"] ?? checked?.textContent?.trim();
      chip.dataset["label"] = value ? `${defaultLabel}: ${value}` : defaultLabel;
      delete chip.dataset["count"];
    } else if (count > 1) {
      chip.dataset["label"] = `${defaultLabel}:`;
      chip.dataset["count"] = String(count);
    } else {
      chip.dataset["label"] = defaultLabel;
      delete chip.dataset["count"];
    }
  }

  /** Populate a sort/segment chip's menu with column choices. */
  #populateColumnsMenu(chip: HTMLElement) {
    // Segment (group) chips only show string-type columns
    const isSegment = chip.getAttribute("data-behavior") === "segment";
    const cols = isSegment
      ? this.#columns.filter((c) => this.#inferFilterType(c.type) === "text")
      : this.#columns;
    const currentField = chip.getAttribute("data-field");
    const items = [
      { value: "", text: "None", selected: !currentField },
      ...cols.map((c) => ({
        value: c.field,
        text: c.name || formatFieldName(c.field),
        selected: c.field === currentField,
      })),
    ];
    // In a .grouped-component wrapper the chevron button is the menu holder
    const menuBtn = this.#getChipMenuButton(chip);
    menuBtn.setMenuItems?.(items, { selection: "radio", group: "columns" });
  }

  /* ══════════════════════════════════════════════════════════════
     Filter type / operator helpers
     ══════════════════════════════════════════════════════════════ */

  /** Map column type metadata to a canonical filter type. */
  static #COLUMN_TYPE_MAP: Record<string, string> = {
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
  #inferFilterType(columnType?: string): string {
    if (!columnType) return "text";
    return SherpaFilterBar.#COLUMN_TYPE_MAP[columnType.toLowerCase()] || "text";
  }

  /** Default operator per filter type. */
  static #DEFAULT_OPERATORS: Record<string, string> = {
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
  #resolveOperator(chip: HTMLElement): string {
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
  #computeTimeRange(rangeKey: string): { start: Date; end: Date } | null {
    if (!rangeKey) return null;
    const preset = TIME_RANGE_PRESETS.find((p) => p.key === rangeKey);
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
      case "minute":  start.setTime(now.getTime() - preset.count * 60000);    break;
      case "hour":    start.setHours(now.getHours() - preset.count);     break;
      case "day":     start.setDate(now.getDate() - preset.count);       break;
      case "month":   start.setMonth(now.getMonth() - preset.count);     break;
      case "quarter": start.setMonth(now.getMonth() - preset.count * 3); break;
      case "year":    start.setFullYear(now.getFullYear() - preset.count); break;
      default: return null;
    }
    return { start, end: now };
  }

  /**
   * Cycle sort mode on the main-button click.
   *
   * Field sort:  off → asc → desc → off (cycling never clears the
   *              chosen field — `data-field` and the "Sort: <Field>"
   *              label are preserved across the off state so the user
   *              can keep cycling indefinitely).
   * Time sort:   off → desc (Newest first) → asc (Oldest first) → off
   * Value sort:  off → desc (Largest first) → asc (Smallest first) → off
   *
   * To clear the chosen field entirely, the user must pick "None"
   * from the menu — handled in the menu-select listener.
   */
  #cycleSortMode(chip: HTMLElement) {
    const current = chip.dataset["mode"];
    const sortType = chip.dataset["sortType"];

    if (sortType === "time") {
      // Time sort: off → desc (Newest first) → asc (Oldest first) → off
      if (!current || current === "off") {
        chip.dataset["mode"] = "desc";
        chip.dataset["iconStart"] = "\uf063"; // fa-arrow-down
        chip.dataset["label"] = "Newest first";
        chip.toggleAttribute("data-active", true);
      } else if (current === "desc") {
        chip.dataset["mode"] = "asc";
        chip.dataset["iconStart"] = "\uf062"; // fa-arrow-up
        chip.dataset["label"] = "Oldest first";
      } else {
        chip.dataset["mode"] = "off";
        chip.dataset["iconStart"] = "\uf0dc"; // fa-sort (neutral)
        chip.removeAttribute("data-active");
      }
    } else if (sortType === "value") {
      // Value sort: off → desc (Largest first) → asc (Smallest first) → off
      if (!current || current === "off") {
        chip.dataset["mode"] = "desc";
        chip.dataset["iconStart"] = "\uf063"; // fa-arrow-down
        chip.dataset["label"] = "Largest first";
        chip.toggleAttribute("data-active", true);
      } else if (current === "desc") {
        chip.dataset["mode"] = "asc";
        chip.dataset["iconStart"] = "\uf062"; // fa-arrow-up
        chip.dataset["label"] = "Smallest first";
      } else {
        chip.dataset["mode"] = "off";
        chip.dataset["iconStart"] = "\uf0dc"; // fa-sort (neutral)
        chip.removeAttribute("data-active");
      }
    } else {
      // Field sort: off → asc → desc → off.
      // Never clear data-field or the "Sort: <Field>" label — the user
      // should be able to cycle off → asc → desc indefinitely on the
      // same field. The only way to clear the field is the menu "None".
      //
      // If no field is selected, the chip's main-button is a no-op —
      // the user must pick a field from the menu first.
      if (!chip.hasAttribute("data-field")) return;
      if (!current || current === "off") {
        chip.dataset["mode"] = "asc";
        chip.dataset["iconStart"] = "\uf062"; // fa-arrow-up
        chip.toggleAttribute("data-active", true);
      } else if (current === "asc") {
        chip.dataset["mode"] = "desc";
        chip.dataset["iconStart"] = "\uf063"; // fa-arrow-down
      } else {
        chip.dataset["mode"] = "off";
        chip.dataset["iconStart"] = "\uf0dc"; // fa-sort (neutral)
        chip.removeAttribute("data-active");
      }
    }
    // Shadow DOM mutations aren't observed by the MutationObserver — emit explicitly.
    this.#emitFilterChange();
  }

  /**
   * Cycle segment mode: off → on → off.  Field is preserved across
   * the off state — the user must pick "None" from the menu to fully
   * clear it.
   */
  #cycleSegmentMode(chip: HTMLElement) {
    // No field selected yet — user must pick from the dropdown first
    if (!chip.hasAttribute("data-field")) return;
    if (chip.hasAttribute("data-active")) {
      chip.dataset["mode"] = "off";
      chip.removeAttribute("data-active");
    } else {
      chip.dataset["mode"] = "on";
      chip.toggleAttribute("data-active", true);
    }
    // Shadow DOM mutations aren't observed by the MutationObserver — emit explicitly.
    this.#emitFilterChange();
  }

  /**
   * Populate a timeframe chip's menu with TIME_RANGE_PRESETS.
   * @param {HTMLElement} chip — sherpa-button with datetime-range type
   */
  #populateTimeframeMenu(chip: MenuButtonLike) {
    const items = TIME_RANGE_PRESETS.map((p) => ({
      value: p.key,
      text: p.label,
    }));
    chip.setMenuItems?.(items, { selection: "radio", group: "timeframes" });
  }
}

customElements.define("sherpa-filter-bar", SherpaFilterBar);