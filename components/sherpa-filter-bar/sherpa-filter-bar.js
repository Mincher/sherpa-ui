/**
 * sherpa-filter-bar.js
 * Horizontal filter bar with zoned layout.
 *
 * Slot-based layout:
 *   toggle   — Filter on/off toggle
 *   group    — Segment/group chip
 *   sort     — Sort chip
 *   presets  — Preset filter chips (declared by content template)
 *   default  — User-added dynamic filter chips + Add button
 *   actions  — Clear / Apply / Save buttons
 *
 * The "Add" button allows users to dynamically add filter-type chips.
 *
 * Usage:
 *   <sherpa-filter-bar>
 *     <sherpa-filter-chip slot="group" data-type="segment">Group</sherpa-filter-chip>
 *     <sherpa-filter-chip slot="sort" data-type="sort">Sort</sherpa-filter-chip>
 *     <sherpa-filter-chip slot="presets" data-type="filter" data-field="severity">Severity</sherpa-filter-chip>
 *     <sherpa-button slot="actions" data-variant="tertiary">Clear filter</sherpa-button>
 *   </sherpa-filter-bar>
 *
 * Events:
 *   filterchange — Dispatched when any slotted filter chip changes state.
 *                  detail: { filters: Array<{ field, mode, type, values? }> }
 *   filterclear  — Dispatched when the clear action is invoked.
 */

import { AuxElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';
import { formatFieldName } from '../utilities/format-utils.js';

export class SherpaFilterBar extends AuxElement {
  static get cssUrl()  { return new URL('./sherpa-filter-bar.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-filter-bar.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-density', 'data-active', 'data-preset-filters'];
  }

  #observer = null;
  #columns = [];
  #rows = [];
  #addBtn = null;
  #applied = true;  // Toggle state — when false, getFilters() returns []
  #pendingEmit = false;  // Microtask debounce for observer-driven filterchange

  onConnect() {
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
      attributeFilter: ['data-active', 'data-field', 'data-mode'],
    });

    // Listen for slotchange on all zone slots to track chip additions/removals
    for (const slot of this.$$('slot')) {
      slot.addEventListener('slotchange', () => this.#syncActiveState());
    }

    // Clear button delegation — look for click on actions-slotted button
    this.addEventListener('click', (e) => {
      const path = e.composedPath();
      const clearBtn = path.find(n =>
        n instanceof HTMLElement && n.slot === 'actions' && n.tagName === 'SHERPA-BUTTON' &&
        (n.dataset.action === 'clear' || n.textContent.trim().toLowerCase().includes('clear'))
      );
      if (clearBtn) this.#clearAll();
    });

    // Add button — opens column menu
    this.#addBtn = this.$('sherpa-button.add-filter-btn');
    this.#addBtn?.addEventListener('menu-open', () => this.#populateAddMenu());
    this.#addBtn?.addEventListener('menu-select', (e) => this.#onAddMenuSelect(e));

    // Listen for chip removal events (from filter chips' × button)
    this.addEventListener('chipremove', (e) => {
      const chip = e.target;
      if (chip.tagName === 'SHERPA-FILTER-CHIP') {
        chip.remove();
        this.#syncActiveState();
        this.#emitFilterChange();
      }
    });

    // Listen for value changes from filter chips
    this.addEventListener('filtervaluechange', () => {
      this.#syncActiveState();
      this.#emitFilterChange();
    });

    // Toggle switch — applies / unapplies all filters
    this.addEventListener('change', (e) => {
      const sw = e.target;
      if (sw?.tagName === 'SHERPA-SWITCH' && sw.slot === 'toggle') {
        this.#applied = sw.dataset.state === 'on';
        this.#emitFilterChange();
      }
    });

    this.#syncActiveState();
  }

  onDisconnect() {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  onAttributeChanged(name, _old, newValue) {
    if (name === 'data-preset-filters' && newValue) {
      this.#initPresetChips(newValue);
    }
  }

  /** Check if any slotted filter chip has an active filter and update host attribute. */
  #syncActiveState() {
    const chips = this.#getFilterChips();
    const anyActive = chips.some(chip => chip.hasAttribute('data-active'));
    this.toggleAttribute('data-active', anyActive);
  }

  /** Clear all slotted filter chips and remove dynamic ones. */
  #clearAll() {
    for (const chip of this.#getFilterChips()) {
      if (chip.getAttribute('data-type') === 'filter') {
        // Preset chips (slotted as presets) — just clear values
        if (chip.slot === 'presets') {
          chip.clearValues?.();
        } else {
          // User-added dynamic filter chips — remove from DOM
          chip.remove();
        }
      } else {
        // Static chips (sort, segment) — reset attributes
        chip.removeAttribute('data-field');
        chip.removeAttribute('data-mode');
      }
    }
    this.removeAttribute('data-active');
    this.dispatchEvent(new CustomEvent('filterclear', { bubbles: true, composed: true }));
  }

  /** Get all slotted sherpa-filter-chip elements across all slots. */
  #getFilterChips() {
    return Array.from(this.querySelectorAll('sherpa-filter-chip'));
  }

  /** Get fields already used by active filter chips (presets + user-added). */
  #getUsedFilterFields() {
    return new Set(
      this.#getFilterChips()
        .filter(c => c.getAttribute('data-type') === 'filter')
        .map(c => c.getAttribute('data-field'))
        .filter(Boolean)
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
    for (const chip of this.querySelectorAll('sherpa-filter-chip[slot="presets"][data-type="filter"]')) {
      chip.remove();
    }

    const fieldList = fields.split(',').map(f => f.trim()).filter(Boolean);
    for (const field of fieldList) {
      const col = this.#columns.find(c => c.field === field);
      const chip = document.createElement('sherpa-filter-chip');
      chip.setAttribute('data-type', 'filter');
      chip.setAttribute('data-field', field);
      chip.setAttribute('slot', 'presets');
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

    const usedFields = this.#getUsedFilterFields();
    const available = this.#columns.filter(c => !usedFields.has(c.field));

    const frag = document.createDocumentFragment();

    // Heading
    const heading = document.createElement('sherpa-menu-item');
    heading.setAttribute('data-type', 'heading');
    heading.textContent = 'Add filter';
    frag.appendChild(heading);

    if (!available.length) {
      const empty = document.createElement('sherpa-menu-item');
      empty.setAttribute('disabled', '');
      empty.textContent = 'No columns available';
      frag.appendChild(empty);
    } else {
      const ul = document.createElement('ul');
      for (const col of available) {
        const li = document.createElement('li');
        const item = document.createElement('sherpa-menu-item');
        item.setAttribute('value', col.field);
        item.dataset.addField = col.field;
        item.textContent = col.name || col.field;
        li.appendChild(item);
        ul.appendChild(li);
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

    const col = this.#columns.find(c => c.field === field);
    if (!col) return;

    // Create a new filter chip (in default slot — user filters zone)
    const chip = document.createElement('sherpa-filter-chip');
    chip.setAttribute('data-type', 'filter');
    chip.setAttribute('data-field', field);
    chip.textContent = col.name || col.field;

    // Insert in light DOM default slot
    this.appendChild(chip);

    // Supply row data + column metadata so the chip can detect booleans
    chip.setValueData(this.#rows, col);
  }

  /** Dispatch filterchange event. */
  #emitFilterChange() {
    this.dispatchEvent(new CustomEvent('filterchange', {
      bubbles: true,
      composed: true,
      detail: { filters: this.getFilters() },
    }));
  }


  /* ══════════════════════════════════════════════════════════════
     Public API
     ══════════════════════════════════════════════════════════════ */

  /** Get current filter state from all chips. Returns [] when toggle is off. */
  getFilters() {
    if (!this.#applied) return [];

    return this.#getFilterChips()
      .filter(chip => chip.hasAttribute('data-active'))
      .map(chip => {
        const type = chip.getAttribute('data-type');
        const entry = {
          field: chip.getAttribute('data-field'),
          mode: chip.getAttribute('data-mode'),
          type,
        };
        if (type === 'filter') {
          entry.values = chip.getSelectedValues?.() || [];
        }
        if (type === 'timeframe') {
          entry.rangeKey = chip.getRangeKey?.() || '';
          entry.range = chip.getTimeRange?.() || null;
          // Use auto-detected timestamp field if chip has no explicit field
          if (!entry.field && typeof chip.getField === 'function') {
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
      const type = chip.getAttribute('data-type');
      if (type === 'filter') {
        const col = this.#columns.find(c => c.field === chip.getAttribute('data-field'));
        chip.setValueData(this.#rows, col);
        // Update label when column metadata becomes available
        if (col && chip.slot === 'presets') {
          chip.textContent = col.name || formatFieldName(col.field);
        }
      } else {
        chip.setAvailableColumns?.(columns, rows);
      }
    }

    // If preset filters attribute is set but chips haven't been created yet, create them now
    const presetFields = this.getAttribute('data-preset-filters');
    if (presetFields && !this.querySelector('sherpa-filter-chip[slot="presets"]')) {
      this.#initPresetChips(presetFields);
    }
  }

  /** Remove filter chip for a specific field. */
  removeFilterChip(field) {
    for (const chip of this.#getFilterChips()) {
      if (chip.getAttribute('data-type') === 'filter' && chip.getAttribute('data-field') === field) {
        chip.remove();
        this.#syncActiveState();
        this.#emitFilterChange();
        return true;
      }
    }
    return false;
  }
}

customElements.define('sherpa-filter-bar', SherpaFilterBar);
