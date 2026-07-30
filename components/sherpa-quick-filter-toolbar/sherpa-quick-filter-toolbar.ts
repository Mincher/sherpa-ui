/**
 * sherpa-quick-filter-toolbar.ts
 * SherpaQuickFilterToolbar — Quick-filter toolbar for data grids and lists.
 *
 * A horizontal strip of sherpa-quick-filter chips plus a trailing actions area.
 * Drop-in replacement for the legacy sherpa-filter-bar: it preserves the same
 * public data contract (attributes, methods, events, FilterSpec shape) that
 * sherpa-data-grid depends on, but composes sherpa-quick-filter chips (via a
 * cloning prototype) instead of createElement'd sherpa-button groups, and opens
 * option menus with sherpa-container-overlay + sherpa-overlay-item.
 *
 * @element sherpa-quick-filter-toolbar
 * @category data
 * @description Structured quick-filter toolbar for adding, editing, and removing field-level
 *   filters above a data grid or list. Point data-src-json at a descriptor to auto-populate
 *   available fields and preset chips. Wire filter-change to update the data source query.
 *   data-type="view|data" switches the treatment (saved-view vs data-scoped); data-type="local"
 *   selects the minimal container-scoped template. Supports global mode (page-level broadcast).
 *
 * @attr {enum}    data-type             — view | data (treatment) · "local" selects the minimal template
 * @attr {enum}    data-density          — compact | comfortable
 * @attr {boolean} data-active           — Present when any filter is active (auto-reflected)
 * @attr {boolean} data-embedded         — No border/padding (for nesting inside other components)
 * @attr {boolean} data-global           — Adds a built-in Time Range chip; broadcasts global-filter-change on document
 * @attr {string}  data-src-json         — URL of a descriptor JSON: { fields:[...], presetFilters?:[...] }
 * @attr {json}    data-available-fields — Field defs: [{ field, name, type, values? }]
 * @attr {string}  data-preset-filters   — CSV (or JSON array) of field names shown as preset chips
 * @attr {enum}    data-sort-type        — time | value — cycling mode for the built-in sort chip
 * @attr {boolean} data-hide-group       — Hide the built-in group chip
 * @attr {boolean} data-hide-sort        — Hide the built-in sort chip
 *
 * @slot toggle    — Filter on/off toggle (control tier)
 * @slot presets   — Preset filter chips
 * @slot (default) — User-added dynamic filter chips
 * @slot actions   — Reset / settings / save actions
 *
 * @fires filter-change            — bubbles, composed · detail: { filters: FilterSpec[] }
 * @fires filter-clear             — bubbles, composed · detail: none
 * @fires container-filter-change  — bubbles, composed · detail: { filters: FilterSpec[] }
 * @fires global-filter-change     — document broadcast (no bubbles) when data-global · detail: { filters }
 *
 * @method getFilters()                       — Returns the current FilterSpec[] (empty when the toggle is off)
 * @method setAvailableColumns(columns, rows) — Set field defs + row data and populate chip menus
 * @method removeFilterChip(field)            — Remove a filter chip by field name
 *
 * @prop {HTMLElement|null} sortChip    — The built-in sort behavior chip (for external syncing)
 * @prop {HTMLElement|null} segmentChip — The built-in group/segment behavior chip
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import type { EventHandler } from "../utilities/types.js";
import "../sherpa-quick-filter/sherpa-quick-filter.js";
import "../sherpa-container-overlay/sherpa-container-overlay.js";
import "../sherpa-overlay-item/sherpa-overlay-item.js";
import { formatFieldName } from "../utilities/format-utils.js";
import { TIME_RANGE_PRESETS } from "../utilities/timeframes.js";
import { applyLocalFilters, type FilterSpec } from "../utilities/aggregate.js";

/* ── Domain types ──────────────────────────────────────────────── */

/** An available-field descriptor for the add-filter menu and chip menus. */
interface FieldDef {
  field: string;
  name?: string;
  type?: string;
  values?: string[];
}

/** The sherpa-quick-filter chip surface consumed here. */
interface QuickFilterChip extends HTMLElement {
  setValue?(value: string | string[]): void;
  readonly field?: string;
}

/** The sherpa-container-overlay surface consumed here. */
interface OverlayMenu extends HTMLElement {
  show(anchor?: Element): void;
  hide(): void;
  getSelectedValues(): string[];
  clearSelection(): void;
}

export class SherpaQuickFilterToolbar extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string {
    return new URL("./sherpa-quick-filter-toolbar.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-quick-filter-toolbar.html", import.meta.url).href;
  }

  /* ── Template selection ───────────────────────────────────────── */

  override get templateId(): string {
    return this.dataset["type"] === "local" ? "local" : "default";
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

  /* ── Public accessors (external sync) ─────────────────────────── */

  /** The built-in sort behavior chip's label button (holds data-field/data-mode). */
  get sortChip(): HTMLElement | null {
    return this.$<HTMLElement>(".sort-chip .behavior-btn");
  }

  /** The built-in group/segment behavior chip's label button. */
  get segmentChip(): HTMLElement | null {
    return this.$<HTMLElement>(".group-chip .behavior-btn");
  }

  /* ── Instance state ───────────────────────────────────────────── */

  #columns: FieldDef[] = [];
  #rows: Record<string, unknown>[] = [];
  #applied = true;            // Toggle state — when false, getFilters() returns []
  #syncingSort = false;       // Guard against re-entrant emit during sort sync
  #bound = false;

  /** Event scope (container / shadow host) for sort-change listening. */
  #scope: Element | null = null;
  #sortChangeHandler: ((e: Event) => void) | null = null;

  #qfTpl: HTMLTemplateElement | null = null;   // chip cloning prototype
  #addButton: HTMLElement | null = null;
  #menu: OverlayMenu | null = null;            // shared option-menu overlay
  #activeMenuChip: HTMLElement | null = null;  // chip whose menu is open

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {
    this.#qfTpl = this.$<HTMLTemplateElement>(".qf-tpl");
    this.#addButton = this.$<HTMLElement>(".add-filter-button");

    if (!this.#bound) {
      // Behavior chips (group / sort) — label click cycles mode, chevron opens menu.
      this.$$<HTMLElement>(".behavior-btn").forEach((btn) =>
        btn.addEventListener("click", this.#onBehaviorClick));
      this.$$<HTMLElement>(".chip-group .menu-btn").forEach((btn) =>
        btn.addEventListener("click", this.#onBehaviorMenuClick));

      // Add filter button.
      this.#addButton?.addEventListener("click", this.#onAddClick);

      // Chip events (bubbled from sherpa-quick-filter in the light DOM).
      this.addEventListener("quick-filter-menu-open", this.#onChipMenuOpen as EventListener);
      this.addEventListener("quick-filter-click", this.#onChipMenuOpen as EventListener);
      this.addEventListener("quick-filter-dismiss", this.#onChipDismiss as EventListener);

      // Toggle switch (slotted) applies / unapplies all filters.
      this.addEventListener("change", this.#onToggleChange);

      // Reset action button (slotted in actions).
      this.addEventListener("click", this.#onActionClick);

      // Track chip additions / removals in the light DOM slots.
      for (const slot of this.$$("slot")) {
        slot.addEventListener("slotchange", () => {
          this.#syncActiveState();
          this.#syncUserFiltersFlag();
        });
      }

      // Wire sort-change listener on the parent scope for external sort sync.
      const root = this.getRootNode();
      this.#scope = this.parentElement
        || (root instanceof ShadowRoot ? root.host : null);
      if (this.#scope) {
        this.#sortChangeHandler = (e: Event) => this.#onSortChange(e as CustomEvent);
        this.#scope.addEventListener("sort-change", this.#sortChangeHandler);
      }

      this.#bound = true;
    }

    // Group / sort chips always exist in shadow DOM — light up dividers.
    this.setAttribute("data-has-group", "");
    this.setAttribute("data-has-sort", "");

    this.#syncSortType();
    this.#syncActiveState();
    this.#syncUserFiltersFlag();

    if (this.hasAttribute("data-global")) {
      this.#initDefaultTimeRangeChip();
    }

    this.#syncAvailableFields();
  }

  override onDisconnect(): void {
    if (this.#scope && this.#sortChangeHandler) {
      this.#scope.removeEventListener("sort-change", this.#sortChangeHandler);
    }
    this.#sortChangeHandler = null;
    this.#scope = null;
    this.#menu?.remove();
    this.#menu = null;
  }

  override onAttributeChanged(name: string, _old: string | null, newValue: string | null): void {
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

  /**
   * Called after `data-src-json` is fetched. Populates
   * `data-available-fields` and optionally `data-preset-filters`.
   * Expected shape: { fields: [{ field, name, type, values? }], presetFilters?: string[] }
   */
  override onJsonData(data: unknown): void {
    if (!data || typeof data !== "object") return;
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj["fields"])) {
      this.setAttribute("data-available-fields", JSON.stringify(obj["fields"]));
    }
    if (Array.isArray(obj["presetFilters"])) {
      this.setAttribute("data-preset-filters", (obj["presetFilters"] as unknown[]).join(","));
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Public API
     ══════════════════════════════════════════════════════════════ */

  /** Get the current filter state from all chips. Returns [] when the toggle is off. */
  public getFilters(): FilterSpec[] {
    if (!this.#applied) return [];

    const specs: FilterSpec[] = [];

    // ── Value / preset / user filter chips ──
    for (const chip of this.#getValueChips()) {
      if (!chip.hasAttribute("data-active")) continue;
      const field = chip.getAttribute("data-filter-field");
      if (!field) continue;
      const filterType = chip.getAttribute("data-filter-type") || "text";
      const operator = this.#resolveOperator(chip);

      if (filterType === "boolean") {
        const boolValue = chip.dataset["filterBooleanValue"] || "true";
        specs.push({ field, type: "boolean", operator, values: [boolValue], value: boolValue });
        continue;
      }

      const values = this.#getChipSelectedValues(chip);
      const entry: FilterSpec = {
        field,
        type: filterType,
        operator,
        values,
        value: values[0] ?? "",
      };
      if (filterType === "datetime-range" && entry.value) {
        const range = this.#computeTimeRange(String(entry.value));
        if (range) entry.range = range;
      }
      specs.push(entry);
    }

    // ── Sort / segment behavior chips ──
    for (const chip of this.#getBehaviorChips()) {
      if (!chip.hasAttribute("data-field")) continue;
      specs.push({
        field: chip.getAttribute("data-field"),
        mode: chip.getAttribute("data-mode"),
        type: chip.getAttribute("data-behavior"),
      });
    }

    return specs;
  }

  /**
   * Set available fields and optional row data for chip menu population.
   * Writes columns to `data-available-fields` (triggers #syncAvailableFields()).
   */
  public setAvailableColumns(columns: FieldDef[], rows?: Record<string, unknown>[]): void {
    if (!Array.isArray(columns) || !columns.length) return;
    if (Array.isArray(rows)) this.#rows = rows;
    this.setAttribute("data-available-fields", JSON.stringify(columns));
  }

  /** Remove the filter chip for a specific field. */
  public removeFilterChip(field: string): boolean {
    for (const chip of this.#getValueChips()) {
      if (chip.getAttribute("data-filter-field") === field) {
        chip.remove();
        this.#syncActiveState();
        this.#emitFilterChange();
        this.#populateAddMenu();
        return true;
      }
    }
    return false;
  }

  /* ══════════════════════════════════════════════════════════════
     Chip collection helpers
     ══════════════════════════════════════════════════════════════ */

  /** All value/preset/user filter chips (sherpa-quick-filter, light DOM). */
  #getValueChips(): HTMLElement[] {
    return Array.from(
      this.querySelectorAll<HTMLElement>("sherpa-quick-filter[data-filter-field]"),
    );
  }

  /** The built-in sort + segment behavior chips (shadow DOM label buttons). */
  #getBehaviorChips(): HTMLElement[] {
    return Array.from(this.$$<HTMLElement>(".behavior-btn"));
  }

  /** The behavior chip's label button for a given behavior. */
  #behaviorChip(behavior: string): HTMLElement | null {
    return this.$<HTMLElement>(`.behavior-btn[data-behavior="${behavior}"]`);
  }

  /** Fields already used by preset / user chips — hidden from the Add menu. */
  #getUsedFilterFields(): Set<string> {
    const used = new Set<string>();
    for (const chip of this.#getValueChips()) {
      const ff = chip.getAttribute("data-filter-field");
      if (ff) used.add(ff);
    }
    return used;
  }

  /** Read a chip's remembered selected values (from data-selected-values JSON). */
  #getChipSelectedValues(chip: HTMLElement): string[] {
    const raw = chip.dataset["selectedValues"];
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Chip creation (cloning prototype)
     ══════════════════════════════════════════════════════════════ */

  /**
   * Create a sherpa-quick-filter chip from the cloning prototype.
   * @param opts.filterField   — data-filter-field value
   * @param opts.filterType    — data-filter-type value
   * @param opts.label         — initial label / default label text
   * @param opts.slot          — slot attribute for placement (omit for default slot)
   * @param opts.dismissible   — user-added chip shows an ×
   */
  #createChip(opts: {
    filterField: string;
    filterType: string;
    label: string;
    slot?: string;
    dismissible?: boolean;
  }): QuickFilterChip | null {
    if (!this.#qfTpl) return null;
    const frag = this.#qfTpl.content.cloneNode(true) as DocumentFragment;
    const chip = frag.querySelector<QuickFilterChip>("sherpa-quick-filter");
    if (!chip) return null;

    chip.setAttribute("data-filter-field", opts.filterField);
    chip.setAttribute("data-filter-type", opts.filterType);
    chip.dataset["label"] = opts.label;
    chip.dataset["defaultLabel"] = opts.label;
    chip.dataset["field"] = opts.filterField;
    if (opts.slot) chip.setAttribute("slot", opts.slot);
    if (opts.dismissible) chip.setAttribute("data-dismissible", "");
    if (opts.dismissible) chip.setAttribute("data-user-filter", "");
    // Boolean chips are plain toggles — no chevron menu.
    if (opts.filterType === "boolean") {
      chip.setAttribute("data-no-menu", "");
      chip.dataset["filterBooleanValue"] = "true";
    }

    this.appendChild(chip);
    return chip;
  }

  /* ══════════════════════════════════════════════════════════════
     Preset + default chips
     ══════════════════════════════════════════════════════════════ */

  /** Create preset chips from a CSV (or JSON array) of field names. */
  #initPresetChips(fields: string): void {
    // Remove existing preset chips (preserve the built-in _timerange chip).
    for (const chip of this.querySelectorAll<HTMLElement>(
      'sherpa-quick-filter[data-filter-field][slot="presets"]',
    )) {
      if (chip.getAttribute("data-filter-field") === "_timerange") continue;
      chip.remove();
    }

    for (const field of this.#parseFieldList(fields)) {
      const col = this.#columns.find((c) => c.field === field);
      const filterType = this.#inferFilterType(col?.type);
      this.#createChip({
        filterField: field,
        filterType,
        label: col?.name || formatFieldName(field),
        slot: "presets",
      });
    }
  }

  /** Parse a preset-filters attribute (CSV or JSON array) into field names. */
  #parseFieldList(raw: string): string[] {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String).map((f) => f.trim()).filter(Boolean);
      } catch {
        /* fall through to CSV */
      }
    }
    return trimmed.split(",").map((f) => f.trim()).filter(Boolean);
  }

  /**
   * Create the built-in "Time Range" chip for global toolbars.
   * Uses the sentinel field `_timerange` so consuming apps can map it to each
   * dataset's actual date field via the FilterSpec `range`.
   */
  #initDefaultTimeRangeChip(): void {
    if (this.querySelector('sherpa-quick-filter[data-filter-field="_timerange"]')) return;
    this.#createChip({
      filterField: "_timerange",
      filterType: "datetime-range",
      label: "Time Range",
      slot: "presets",
    });
  }

  /* ══════════════════════════════════════════════════════════════
     Available fields — parse + wire menus
     ══════════════════════════════════════════════════════════════ */

  #syncAvailableFields(): void {
    const raw = this.getAttribute("data-available-fields");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      this.#columns = parsed as FieldDef[];
    } catch {
      return;
    }

    // Refresh labels on existing preset / user chips.
    for (const chip of this.#getValueChips()) {
      const field = chip.getAttribute("data-filter-field");
      if (field === "_timerange") continue;
      const col = this.#columns.find((c) => c.field === field);
      if (col) {
        chip.dataset["defaultLabel"] = col.name || formatFieldName(col.field);
        if (!chip.hasAttribute("data-active")) {
          chip.dataset["label"] = chip.dataset["defaultLabel"];
        }
      }
    }

    // Create declared preset chips if not yet present.
    const presetFields = this.getAttribute("data-preset-filters");
    if (
      presetFields &&
      !this.querySelector(
        'sherpa-quick-filter[slot="presets"][data-filter-field]:not([data-filter-field="_timerange"])',
      )
    ) {
      this.#initPresetChips(presetFields);
    }

    this.#populateAddMenu();
  }

  /* ══════════════════════════════════════════════════════════════
     Add filter menu
     ══════════════════════════════════════════════════════════════ */

  #populateAddMenu(): void {
    if (!this.#addButton) return;
    const noColumns = this.#columns.length === 0;
    const used = this.#getUsedFilterFields();
    const available = this.#columns.filter((c) => !used.has(c.field));

    this.#addButton.toggleAttribute("hidden", noColumns);
    this.#addButton.toggleAttribute("disabled", !noColumns && available.length === 0);
    this.toggleAttribute("data-has-add", !noColumns);
  }

  #onAddClick: EventHandler<MouseEvent> = () => {
    if (!this.#addButton) return;
    const used = this.#getUsedFilterFields();
    const available = this.#columns.filter((c) => !used.has(c.field));
    if (!available.length) return;

    const menu = this.#ensureMenu();
    this.#activeMenuChip = null; // sentinel: add-field picker
    menu.replaceChildren(
      ...available.map((col) => this.#makeItem({
        value: col.field,
        text: col.name || formatFieldName(col.field),
        selection: "radio",
        group: "add-field",
      })),
    );
    menu.dataset["mode"] = "add";
    menu.show(this.#addButton);
  };

  /* ══════════════════════════════════════════════════════════════
     Behavior chips (group / sort)
     ══════════════════════════════════════════════════════════════ */

  #onBehaviorClick: EventHandler<MouseEvent> = (e: MouseEvent) => {
    const btn = e.currentTarget as HTMLElement;
    const behavior = btn.dataset["behavior"];
    if (behavior === "sort") this.#cycleSortMode(btn);
    else if (behavior === "segment") this.#cycleSegmentMode(btn);
  };

  #onBehaviorMenuClick: EventHandler<MouseEvent> = (e: MouseEvent) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    const behavior = btn.dataset["behavior"] || "sort";
    const chip = this.#behaviorChip(behavior);
    if (!chip) return;
    this.#openColumnsMenu(chip, btn, behavior);
  };

  /** Open the field-picker menu for a sort / segment chip. */
  #openColumnsMenu(chip: HTMLElement, anchor: HTMLElement, behavior: string): void {
    const isSegment = behavior === "segment";
    const cols = isSegment
      ? this.#columns.filter((c) => this.#inferFilterType(c.type) === "text")
      : this.#columns;
    const currentField = chip.getAttribute("data-field");

    const menu = this.#ensureMenu();
    this.#activeMenuChip = chip;
    menu.dataset["mode"] = "columns";
    menu.dataset["behavior"] = behavior;

    const items = [
      this.#makeItem({ value: "", text: "None", selection: "radio", group: "columns", checked: !currentField }),
      ...cols.map((c) => this.#makeItem({
        value: c.field,
        text: c.name || formatFieldName(c.field),
        selection: "radio",
        group: "columns",
        checked: c.field === currentField,
      })),
    ];
    menu.replaceChildren(...items);
    menu.show(anchor);
  }

  /**
   * Cycle sort mode on label click.
   *   time:  off → desc (Newest first) → asc (Oldest first) → off
   *   value: off → desc (Largest first) → asc (Smallest first) → off
   *   field: off → asc → desc → off (requires a chosen field; never clears it)
   */
  #cycleSortMode(chip: HTMLElement): void {
    const current = chip.dataset["mode"];
    const sortType = chip.dataset["sortType"];
    const label = this.#chipLabelEl(chip);
    const icon = chip.querySelector<HTMLElement>(".sort-icon");

    const setIcon = (glyph: string): void => { if (icon) icon.textContent = glyph; };
    const setText = (text: string): void => { if (label) label.textContent = text; };

    if (sortType === "time" || sortType === "value") {
      const descText = sortType === "time" ? "Newest first" : "Largest first";
      const ascText = sortType === "time" ? "Oldest first" : "Smallest first";
      if (!current || current === "off") {
        chip.dataset["mode"] = "desc"; setIcon("\uf063"); setText(descText);
        chip.toggleAttribute("data-active", true);
      } else if (current === "desc") {
        chip.dataset["mode"] = "asc"; setIcon("\uf062"); setText(ascText);
      } else {
        chip.dataset["mode"] = "off"; setIcon("\uf0dc"); chip.removeAttribute("data-active");
      }
    } else {
      // Field sort — requires a chosen field.
      if (!chip.hasAttribute("data-field")) return;
      if (!current || current === "off") {
        chip.dataset["mode"] = "asc"; setIcon("\uf062");
        chip.toggleAttribute("data-active", true);
      } else if (current === "asc") {
        chip.dataset["mode"] = "desc"; setIcon("\uf063");
      } else {
        chip.dataset["mode"] = "off"; setIcon("\uf0dc"); chip.removeAttribute("data-active");
      }
    }
    this.#syncChipGroupActive(chip);
    this.#emitFilterChange();
  }

  /** Cycle segment mode: off → on → off. Field preserved across off. */
  #cycleSegmentMode(chip: HTMLElement): void {
    if (!chip.hasAttribute("data-field")) return;
    if (chip.hasAttribute("data-active")) {
      chip.dataset["mode"] = "off";
      chip.removeAttribute("data-active");
    } else {
      chip.dataset["mode"] = "on";
      chip.toggleAttribute("data-active", true);
    }
    this.#syncChipGroupActive(chip);
    this.#emitFilterChange();
  }

  /* ══════════════════════════════════════════════════════════════
     Chip option menu (value / preset / user chips)
     ══════════════════════════════════════════════════════════════ */

  #onChipMenuOpen: EventHandler<CustomEvent> = (e: CustomEvent) => {
    const chip = (e.composedPath().find(
      (n) => n instanceof HTMLElement && n.tagName === "SHERPA-QUICK-FILTER",
    ) ?? e.target) as HTMLElement | null;
    if (!chip || !chip.hasAttribute("data-filter-field")) return;

    const filterType = chip.getAttribute("data-filter-type") || "text";
    if (filterType === "boolean") {
      // Boolean chip — clicking toggles it directly, no menu.
      const active = chip.toggleAttribute("data-active");
      chip.dataset["filterBooleanValue"] = active ? "true" : "false";
      this.#emitFilterChange();
      return;
    }

    this.#openChipMenu(chip);
  };

  /** Open the value / timeframe option menu for a filter chip. */
  #openChipMenu(chip: HTMLElement): void {
    const field = chip.getAttribute("data-filter-field");
    if (!field) return;
    const filterType = chip.getAttribute("data-filter-type") || "text";
    const menu = this.#ensureMenu();
    this.#activeMenuChip = chip;
    menu.dataset["mode"] = "values";

    if (filterType === "datetime-range") {
      const current = this.#getChipSelectedValues(chip)[0] ?? "";
      menu.replaceChildren(
        ...TIME_RANGE_PRESETS.map((p) => this.#makeItem({
          value: p.key,
          text: p.label,
          selection: "radio",
          group: "timeframes",
          checked: p.key === current,
        })),
      );
    } else {
      // text / number → checkbox multi-select of unique values with live counts.
      const selected = new Set(this.#getChipSelectedValues(chip));
      const values = this.#getValuesForField(field);
      const counts = this.#countValuesIn(field, this.#getFilteredRowsExcluding(field));
      menu.replaceChildren(
        ...values.map((v) => {
          const n = counts.get(v.toLowerCase());
          return this.#makeItem({
            value: v,
            text: n === undefined ? v : `${v} (${n})`,
            selection: "checkbox",
            group: "values",
            checked: selected.has(v),
            keepOpen: true,
          });
        }),
      );
    }

    const anchor = chip.shadowRoot?.querySelector<HTMLElement>(".chip-menu") ?? chip;
    menu.show(anchor);
  }

  /** Central overlay-select handler for all menu modes. */
  #onOverlaySelect: EventHandler<CustomEvent> = (e: CustomEvent) => {
    const menu = this.#menu;
    if (!menu) return;
    const mode = menu.dataset["mode"];

    if (mode === "add") {
      const field = e.detail?.value as string | undefined;
      menu.hide();
      if (field) this.#addUserChip(field);
      return;
    }

    if (mode === "columns") {
      const behavior = menu.dataset["behavior"] || "sort";
      const chip = this.#activeMenuChip;
      if (chip) this.#applyColumnSelection(chip, behavior, e.detail?.value as string | undefined);
      menu.hide();
      return;
    }

    // mode === "values" — value / timeframe selection.
    const chip = this.#activeMenuChip;
    if (!chip) return;
    const filterType = chip.getAttribute("data-filter-type") || "text";

    if (filterType === "datetime-range") {
      const value = (e.detail?.value as string | undefined) ?? "";
      this.#setChipValues(chip, value ? [value] : []);
      menu.hide();
    } else {
      // checkbox multi-select — menu stays open; read the live selection.
      const values = menu.getSelectedValues();
      this.#setChipValues(chip, values);
    }
    this.#emitFilterChange();
  };

  /** Apply a chosen field to a sort / segment behavior chip. */
  #applyColumnSelection(chip: HTMLElement, behavior: string, field: string | undefined): void {
    const label = this.#chipLabelEl(chip);
    const prefix = behavior === "sort" ? "Sort" : "Group";
    if (field) {
      chip.dataset["field"] = field;
      const col = this.#columns.find((c) => c.field === field);
      const valueLabel = col?.name || formatFieldName(field);
      if (label) label.textContent = `${prefix}: ${valueLabel}`;
      chip.dataset["mode"] = behavior === "sort" ? "asc" : "on";
      chip.toggleAttribute("data-active", true);
    } else {
      delete chip.dataset["field"];
      delete chip.dataset["mode"];
      if (label) label.textContent = prefix;
      chip.removeAttribute("data-active");
    }
    this.#syncChipGroupActive(chip);
    this.#emitFilterChange();
  }

  /** Store a chip's selected values and refresh its label + active state. */
  #setChipValues(chip: HTMLElement, values: string[]): void {
    chip.dataset["selectedValues"] = JSON.stringify(values);
    const active = values.length > 0;
    chip.toggleAttribute("data-active", active);

    // Reuse the chip's own "Label: Value" + count convention via setValue().
    const qf = chip as QuickFilterChip;
    const defaultLabel = chip.dataset["defaultLabel"] || chip.dataset["label"] || "";
    if (active) {
      qf.setValue?.(values);
      // sherpa-quick-filter's setValue drops the field prefix on multi-select,
      // so re-assert the field label as the chip's data-label.
      chip.dataset["label"] = defaultLabel;
    } else {
      qf.setValue?.("");
      chip.dataset["label"] = defaultLabel;
      delete chip.dataset["value"];
      delete chip.dataset["count"];
    }
    this.#syncActiveState();
  }

  /** Create a user-added (dismissible) chip in the default slot. */
  #addUserChip(field: string): void {
    const col = this.#columns.find((c) => c.field === field);
    if (!col) return;
    const chip = this.#createChip({
      filterField: field,
      filterType: this.#inferFilterType(col.type),
      label: col.name || formatFieldName(field),
      dismissible: true,
    });
    this.#populateAddMenu();
    // Immediately open its value menu so the user can pick straight away.
    if (chip && col.type !== "boolean") {
      customElements.whenDefined("sherpa-quick-filter").then(() => this.#openChipMenu(chip));
    }
  }

  #onChipDismiss: EventHandler<CustomEvent> = (e: CustomEvent) => {
    const chip = (e.composedPath().find(
      (n) => n instanceof HTMLElement && n.tagName === "SHERPA-QUICK-FILTER",
    ) ?? e.target) as HTMLElement | null;
    if (!chip) return;
    chip.remove();
    this.#syncActiveState();
    this.#emitFilterChange();
    this.#populateAddMenu();
  };

  /* ══════════════════════════════════════════════════════════════
     Toggle / reset actions
     ══════════════════════════════════════════════════════════════ */

  #onToggleChange: EventHandler<Event> = (e: Event) => {
    const sw = e.target as HTMLElement | null;
    if (sw?.tagName === "SHERPA-SWITCH" && sw.slot === "toggle") {
      this.#applied = sw.dataset["state"] === "on";
      this.#emitFilterChange();
    }
  };

  #onActionClick: EventHandler<MouseEvent> = (e: MouseEvent) => {
    const btn = e.composedPath().find(
      (n) =>
        n instanceof HTMLElement &&
        n.slot === "actions" &&
        (n.dataset?.["action"] === "reset" ||
          n.dataset?.["action"] === "clear" ||
          (n.textContent ?? "").trim().toLowerCase().includes("reset") ||
          (n.textContent ?? "").trim().toLowerCase().includes("clear")),
    ) as HTMLElement | undefined;
    if (btn) this.#clearAll();
  };

  #clearAll(): void {
    for (const chip of this.#getValueChips()) {
      if (chip.hasAttribute("data-user-filter")) {
        chip.remove();
      } else {
        this.#setChipValues(chip, []);
      }
    }
    for (const chip of this.#getBehaviorChips()) {
      delete chip.dataset["field"];
      delete chip.dataset["mode"];
      chip.removeAttribute("data-active");
      const label = this.#chipLabelEl(chip);
      if (label) label.textContent = chip.dataset["behavior"] === "sort" ? "Sort" : "Group";
      const icon = chip.querySelector<HTMLElement>(".sort-icon");
      if (icon) icon.textContent = "\uf0dc";
      this.#syncChipGroupActive(chip);
    }
    this.removeAttribute("data-active");
    this.#populateAddMenu();
    this.dispatchEvent(new CustomEvent("filter-clear", { bubbles: true, composed: true }));
    this.#dispatchContainerFilterChange([]);
    this.#dispatchGlobalFilterChange([]);
  }

  /* ══════════════════════════════════════════════════════════════
     External sort sync
     ══════════════════════════════════════════════════════════════ */

  #onSortChange(e: CustomEvent): void {
    const chip = this.sortChip;
    if (!chip) return;
    const label = this.#chipLabelEl(chip);
    const icon = chip.querySelector<HTMLElement>(".sort-icon");
    const detail = (e.detail ?? {}) as { field?: string; direction?: string };

    this.#syncingSort = true;
    if (detail.field && detail.direction && detail.direction !== "off") {
      chip.dataset["field"] = detail.field;
      const col = this.#columns.find((c) => c.field === detail.field);
      const valueLabel = col?.name || formatFieldName(detail.field);
      if (label) label.textContent = `Sort: ${valueLabel}`;
      chip.dataset["mode"] = detail.direction;
      if (icon) icon.textContent = detail.direction === "desc" ? "\uf063" : "\uf062";
      chip.toggleAttribute("data-active", true);
    } else {
      chip.dataset["mode"] = "off";
      chip.removeAttribute("data-active");
      if (icon) icon.textContent = "\uf0dc";
      if (!chip.dataset["field"] && label) label.textContent = "Sort";
    }
    this.#syncChipGroupActive(chip);
    queueMicrotask(() => { this.#syncingSort = false; });
  }

  /* ══════════════════════════════════════════════════════════════
     Emit + broadcast
     ══════════════════════════════════════════════════════════════ */

  #emitFilterChange(): void {
    if (this.#syncingSort || this.hasAttribute("data-syncing")) return;
    const filters = this.getFilters();
    this.dispatchEvent(
      new CustomEvent("filter-change", { bubbles: true, composed: true, detail: { filters } }),
    );
    this.#dispatchContainerFilterChange(filters);
    this.#dispatchGlobalFilterChange(filters);
  }

  #dispatchContainerFilterChange(filters: FilterSpec[]): void {
    this.dispatchEvent(
      new CustomEvent("container-filter-change", {
        bubbles: true,
        composed: true,
        detail: { filters },
      }),
    );
  }

  #dispatchGlobalFilterChange(filters: FilterSpec[]): void {
    if (!this.hasAttribute("data-global")) return;
    document.dispatchEvent(new CustomEvent("global-filter-change", { detail: { filters } }));
  }

  /* ══════════════════════════════════════════════════════════════
     Sync helpers
     ══════════════════════════════════════════════════════════════ */

  #syncActiveState(): void {
    const anyValue = this.#getValueChips().some((c) => c.hasAttribute("data-active"));
    const anyBehavior = this.#getBehaviorChips().some((c) => c.hasAttribute("data-active"));
    this.toggleAttribute("data-active", anyValue || anyBehavior);
  }

  #syncUserFiltersFlag(): void {
    const has = !!this.querySelector(
      ':scope > sherpa-quick-filter[data-filter-field]:not([slot])',
    );
    this.toggleAttribute("data-has-user-filters", has);
  }

  #syncSortType(): void {
    const chip = this.sortChip;
    if (!chip) return;
    const type = this.dataset["sortType"];
    if (type) chip.dataset["sortType"] = type;
    else delete chip.dataset["sortType"];
  }

  /** Reflect a behavior chip's active state onto its .chip-group wrapper. */
  #syncChipGroupActive(chip: HTMLElement): void {
    const group = chip.closest<HTMLElement>(".chip-group");
    if (group) group.toggleAttribute("data-active", chip.hasAttribute("data-active"));
  }

  #chipLabelEl(chip: HTMLElement): HTMLElement | null {
    return chip.querySelector<HTMLElement>(".chip-label");
  }

  /* ══════════════════════════════════════════════════════════════
     Overlay menu (shared, lazily created)
     ══════════════════════════════════════════════════════════════ */

  #ensureMenu(): OverlayMenu {
    if (this.#menu) return this.#menu;
    const menu = document.createElement("sherpa-container-overlay") as OverlayMenu;
    menu.setAttribute("data-variant", "menu");
    // Identifying hook for the singleton option menu (not a visual-state toggle).
    menu.setAttribute("data-qf-toolbar-menu", "");
    menu.addEventListener("overlay-select", this.#onOverlaySelect as EventListener);
    document.body.appendChild(menu);
    this.#menu = menu;
    return menu;
  }

  /**
   * Create a sherpa-overlay-item for the shared menu.
   * @param opts.keepOpen — keep the overlay open after selection (multi-select)
   */
  #makeItem(opts: {
    value: string;
    text: string;
    selection?: string;
    group?: string;
    checked?: boolean;
    keepOpen?: boolean;
  }): HTMLElement {
    const item = document.createElement("sherpa-overlay-item");
    item.setAttribute("value", opts.value);
    item.textContent = opts.text;
    if (opts.selection) item.dataset["selection"] = opts.selection;
    if (opts.group) item.dataset["group"] = opts.group;
    if (opts.checked) item.setAttribute("checked", "");
    if (opts.keepOpen) item.setAttribute("data-keep-open", "");
    return item;
  }

  /* ══════════════════════════════════════════════════════════════
     Value extraction + counts
     ══════════════════════════════════════════════════════════════ */

  #extractUniqueValues(field: string, rows: Record<string, unknown>[]): string[] {
    const seen = new Set<string>();
    const values: string[] = [];
    for (const row of rows) {
      const v = row[field];
      if (v != null && !seen.has(String(v))) {
        seen.add(String(v));
        values.push(String(v));
      }
    }
    return values.sort();
  }

  #getValuesForField(field: string): string[] {
    const col = this.#columns.find((c) => c.field === field);
    const declared = col?.values?.length ? col.values.map(String) : [];
    if (this.#rows.length) {
      const extracted = this.#extractUniqueValues(field, this.#rows);
      if (!declared.length) return extracted;
      const seen = new Set(declared.map((v) => v.toLowerCase()));
      const extras = extracted.filter((v) => !seen.has(v.toLowerCase()));
      return [...declared, ...extras];
    }
    return declared;
  }

  #getFilteredRowsExcluding(excludeField: string): Record<string, unknown>[] {
    if (!this.#rows.length) return this.#rows;
    const filters = this.getFilters().filter(
      (f) => f.field !== excludeField && f.type !== "sort" && f.type !== "segment",
    );
    if (!filters.length) return this.#rows;
    return applyLocalFilters(this.#rows, filters);
  }

  #countValuesIn(field: string | null, scopeRows: Record<string, unknown>[]): Map<string, number> {
    const counts = new Map<string, number>();
    if (!field || !this.#rows.length) return counts;
    for (const row of scopeRows) {
      const raw = row[field];
      if (raw === null || raw === undefined || raw === "") continue;
      const key = String(raw).toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }

  /* ══════════════════════════════════════════════════════════════
     Filter type / operator inference
     ══════════════════════════════════════════════════════════════ */

  static #COLUMN_TYPE_MAP: Record<string, string> = {
    number: "number", numeric: "number", currency: "number",
    percent: "number", year: "number",
    date: "datetime-range", datetime: "datetime-range", time: "datetime-range",
    boolean: "boolean",
  };

  #inferFilterType(columnType?: string): string {
    if (!columnType) return "text";
    return SherpaQuickFilterToolbar.#COLUMN_TYPE_MAP[columnType.toLowerCase()] || "text";
  }

  static #DEFAULT_OPERATORS: Record<string, string> = {
    text: "in",
    number: "equals",
    "number-range": "between",
    "datetime-range": "between",
    boolean: "equals",
  };

  #resolveOperator(chip: HTMLElement): string {
    const explicit = chip.getAttribute("data-filter-operator");
    if (explicit) return explicit;
    const type = chip.getAttribute("data-filter-type") || "text";
    return SherpaQuickFilterToolbar.#DEFAULT_OPERATORS[type] || "in";
  }

  /**
   * Compute a { start, end } ISO range from a TIME_RANGE_PRESETS key.
   * @param rangeKey — e.g. "last-7d", "ytd", "all"
   */
  #computeTimeRange(rangeKey: string): { start: string; end: string } | undefined {
    if (!rangeKey) return undefined;
    const preset = TIME_RANGE_PRESETS.find((p) => p.key === rangeKey);
    if (!preset) return undefined;

    const today = Temporal.Now.plainDateISO();

    if (preset.key === "all") {
      return { start: "1970-01-01", end: today.toString() };
    }
    if (preset.key === "ytd") {
      return { start: today.with({ month: 1, day: 1 }).toString(), end: today.toString() };
    }

    let start: Temporal.PlainDate | Temporal.PlainDateTime;
    switch (preset.unit) {
      case "minute":
      case "hour": {
        const nowDt = Temporal.Now.plainDateTimeISO();
        const count = preset.count ?? 0;
        start = preset.unit === "minute"
          ? nowDt.subtract({ minutes: count })
          : nowDt.subtract({ hours: count });
        return { start: start.toString().substring(0, 10), end: today.toString() };
      }
      case "day":     start = today.subtract({ days: preset.count ?? 0 });          break;
      case "month":   start = today.subtract({ months: preset.count ?? 0 });        break;
      case "quarter": start = today.subtract({ months: (preset.count ?? 0) * 3 });  break;
      case "year":    start = today.subtract({ years: preset.count ?? 0 });          break;
      default: return undefined;
    }
    return { start: start.toString(), end: today.toString() };
  }
}

customElements.define("sherpa-quick-filter-toolbar", SherpaQuickFilterToolbar);
