/**
 * sherpa-filter-chip.js
 * Sort / Filter / Segment chip with dropdown menu.
 *
 * Each chip type has its own HTML template (sort, filter, segment) with
 * the correct icons baked in. CSS handles icon visibility via
 * :host([data-mode]) selectors. The templateId getter selects the
 * template matching the type attribute at render time.
 *
 * The dropdown is an sherpa-button with the menu attribute; the menu
 * content comes from per-type menu templates in
 * sherpa-filter-chip-menu.html, following the sherpa-menu styled list
 * pattern. JS populates column items into the template at open time.
 *
 * Usage:
 *   <sherpa-filter-chip type="sort">Sort</sherpa-filter-chip>
 *   <sherpa-filter-chip type="filter">Filter</sherpa-filter-chip>
 *   <sherpa-filter-chip type="segment">Segment</sherpa-filter-chip>
 *
 * Attributes:
 *   type, data-mode, data-field, disabled
 *
 * Public API:
 *   setAvailableColumns(columns, rows?), getMode/setMode, getField/setField,
 *   getTimeRange, getRangeKey, type, disabled
 */

import { SherpaElement, parseTemplates } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';

const NUMERIC_TYPES = new Set([
  'number', 'int', 'integer', 'float', 'double', 'decimal', 'currency', 'percent', 'percentage'
]);

const TIMESTAMP_TYPES = new Set([
  'date', 'datetime', 'timestamp', 'time', 'dateTime'
]);

/** Compute { start, end } Date range for a preset key. */
function computeTimeRange(key) {
  if (!key) return null;
  const now = new Date();
  const days = { '1d': 1, '1w': 7, '1m': 30, '1q': 90, '1y': 365 }[key];
  if (!days) return null;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { start: start.toISOString(), end: now.toISOString() };
}

/* ── Menu templates (loaded once, shared across instances) ───── */

const MENU_URL = new URL('./sherpa-filter-chip-menu.html', import.meta.url).href;
let _menuTplMap = null;
let _menuTplPromise = null;

function loadMenuTemplates() {
  if (!_menuTplPromise) {
    _menuTplPromise = fetch(MENU_URL)
      .then(r => r.ok ? r.text() : '')
      .then(html => { _menuTplMap = parseTemplates(html); })
      .catch(() => { _menuTplMap = null; });
  }
  return _menuTplPromise;
}

/* ── Component ─────────────────────────────────────────────────── */

export class SherpaFilterChip extends SherpaElement {

  static get cssUrl()  { return new URL('./sherpa-filter-chip.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-filter-chip.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-type', 'data-mode', 'data-field', 'data-range-key', 'disabled'];
  }

  #toggleEl = null;
  #dropdownBtn = null;
  #labelEl = null;
  #closeBtn = null;
  #countEl = null;
  #columns = [];
  #userCleared = false;

  /* ── Filter-type state ────────────────────────────────────────── */
  #valueRows = [];          // Raw rows for extracting unique values
  #uniqueValues = [];       // Sorted unique values for the field
  #selectedValues = new Set(); // Currently selected filter values
  #isBoolean = false;       // True when field has only boolean values (no menu needed)

  /* ── Timeframe-type state ─────────────────────────────────────── */
  #rangeKey = '';            // Active range preset key ('1d','1w','1m','1q','1y','')
  #timestampField = null;    // Auto-detected timestamp column

  /* ── Lifecycle ────────────────────────────────────────────────── */

  /* ── Template selection — picks the per-type template ────────── */

  get templateId() { return this.type; }

  onRender() {
    this.#toggleEl = this.$('.chip-toggle');
    this.#dropdownBtn = this.$('.chip-dropdown');
    this.#labelEl = this.$('.chip-label');
    this.#closeBtn = this.$('.chip-close');
    this.#countEl = this.$('.chip-count');
  }

  onConnect() {
    this.#toggleEl?.addEventListener('click', (e) => {
      if (this.disabled) return;
      e.stopPropagation();
      this.#cycle();
    });

    this.#toggleEl?.addEventListener('keydown', (e) => {
      if (this.disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.#cycle();
      }
    });

    this.#dropdownBtn?.addEventListener('menu-open', () => this.#populateMenu());
    this.#dropdownBtn?.addEventListener('menu-select', (e) => this.#onMenuSelect(e));

    // Close button (filter chips only)
    this.#closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('chipremove', {
        bubbles: true,
        detail: { field: this.getAttribute('data-field'), type: this.type },
      }));
    });

    this.#updateLabel();
    this.#updateActive();

    // Timeframe chips: initialise from data-range-key attribute
    if (this.type === 'timeframe') {
      const attrKey = this.getAttribute('data-range-key');
      if (attrKey && !this.#rangeKey) {
        this.#rangeKey = attrKey;
        this.setAttribute('data-mode', 'on');
        this.#updateLabel();
        this.#updateActive();
        // Emit initial filtervaluechange so the bar picks up the default
        queueMicrotask(() => this.#emitFilterChange());
      }
    }
  }

  onAttributeChanged(name, _old, newValue) {
    switch (name) {
      case 'data-type':
        this.renderTemplate(this.type);
        this.#updateLabel();
        this.#updateActive();
        break;
      case 'data-mode':
        this.#updateActive();
        break;
      case 'data-field':
        this.#updateLabel();
        this.#updateActive();
        break;
      case 'data-range-key': {
        if (this.type === 'timeframe' && newValue) {
          this.#rangeKey = newValue;
          this.setAttribute('data-mode', 'on');
          this.#updateLabel();
          this.#updateActive();
          this.#emitFilterChange();
        }
        break;
      }
      case 'disabled': {
        const d = newValue !== null;
        if (this.#dropdownBtn) this.#dropdownBtn.disabled = d;
        break;
      }
    }
  }

  /* ── Label ────────────────────────────────────────────────────── */

  #updateLabel() {
    if (!this.#labelEl) return;
    const field = this.getAttribute('data-field');

    if (this.type === 'timeframe') {
      const labels = { '1d': 'Last 24 hours', '1w': 'Last 7 days', '1m': 'Last 30 days', '1q': 'Last 90 days', '1y': 'Last 365 days' };
      this.#labelEl.textContent = labels[this.#rangeKey] || this.textContent.trim() || 'Time frame';
      return;
    }

    if (field) {
      const col = this.#columns.find(c => c.field === field);
      const raw = col?.name || col?.field || field;
      this.#labelEl.textContent = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    } else {
      const text = this.textContent.trim();
      const raw = text || this.type;
      this.#labelEl.textContent = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
  }

  /* ── Active state ─────────────────────────────────────────────── */

  #updateActive() {
    const mode = this.getAttribute('data-mode');
    let active;
    if (this.type === 'filter') {
      active = this.#selectedValues.size > 0 && mode !== 'off';
    } else if (this.type === 'timeframe') {
      active = !!this.#rangeKey && mode !== 'off';
    } else {
      active = this.hasAttribute('data-field') && !!mode && mode !== 'off';
    }
    this.toggleAttribute('data-active', active);
    this.#updateCount();
  }

  /** Update the value count badge (filter chips only). */
  #updateCount() {
    if (!this.#countEl) return;
    const count = this.#selectedValues.size;
    if (count > 0) {
      this.#countEl.textContent = count;
      this.#countEl.hidden = false;
    } else {
      this.#countEl.hidden = true;
    }
  }

  /* ── Cycle ────────────────────────────────────────────────────── */

  #cycle() {
    if (this.type === 'filter') {
      if (this.#isBoolean) {
        // Boolean toggle: switch between filtering for truthy values and no filter
        const mode = this.getAttribute('data-mode');
        const nowOff = !mode || mode === 'off';
        if (nowOff) {
          const truthyVals = this.#uniqueValues.filter(v =>
            v === 'true' || v === '1' || v === 'yes'
          );
          this.#selectedValues = new Set(
            truthyVals.length ? truthyVals : this.#uniqueValues.slice(0, 1)
          );
        } else {
          this.#selectedValues.clear();
        }
        this.setAttribute('data-mode', nowOff ? 'on' : 'off');
        this.#updateActive();
        this.#emitFilterChange();
        return;
      }
      // Multi-value toggle: preserve selected values
      if (this.#selectedValues.size > 0) {
        const mode = this.getAttribute('data-mode');
        const nowOff = !mode || mode === 'off';
        this.setAttribute('data-mode', nowOff ? 'on' : 'off');
        this.#updateActive();
        this.#emitFilterChange();
      }
      return;
    }

    if (this.type === 'timeframe') {
      // Toggle active/inactive — preserve range key
      if (this.#rangeKey) {
        const mode = this.getAttribute('data-mode');
        const nowOff = !mode || mode === 'off';
        this.setAttribute('data-mode', nowOff ? 'on' : 'off');
        this.#updateActive();
        this.#emitFilterChange();
      }
      return;
    }

    const field = this.getAttribute('data-field');
    if (!field) return;

    const mode = this.getAttribute('data-mode') || '';
    let next;
    if (this.type === 'sort') {
      next = mode === 'asc' ? 'desc' : mode === 'desc' ? 'off' : 'asc';
    } else {
      next = mode === 'on' ? 'off' : 'on';
    }

    this.setAttribute('data-mode', next);
  }

  /* ── Menu ───────────────────────────────────────────────────────────── */

  async #populateMenu() {
    await loadMenuTemplates();
    const html = _menuTplMap?.get(this.type);
    if (!html) return;

    const frag = document.createRange().createContextualFragment(html);

    /* Set menu heading to match the chip’s current label */
    const heading = frag.querySelector('sherpa-menu-item[data-type="heading"]');
    if (heading) heading.textContent = this.#labelEl?.textContent || this.type;

    if (this.type === 'filter') {
      this.#populateFilterMenu(frag);
    } else if (this.type === 'timeframe') {
      this.#populateTimeframeMenu(frag);
    } else {
      this.#populateColumnMenu(frag);
    }

    this.#dropdownBtn.menuElement.replaceChildren(frag);
  }

  /** Populate column-picker menu for sort/segment chips. */
  #populateColumnMenu(frag) {
    const group = frag.querySelector('ul[data-group="columns"]');
    if (!group) return;

    const currentField = this.getAttribute('data-field') || '';

    const none = group.querySelector('[data-role="none-option"]');
    if (none) {
      none.setAttribute('value', '');
      none.dataset.field = '';
      none.toggleAttribute('checked', !currentField);
    }

    const makeItem = (col) => {
      const li = document.createElement('li');
      const item = document.createElement('sherpa-menu-item');
      item.setAttribute('data-selection', 'radio');
      item.setAttribute('value', col.field ?? '');
      item.dataset.field = col.field ?? '';
      if ((col.field ?? '') === currentField) item.setAttribute('checked', '');
      item.textContent = col.name || col.field || '';
      li.appendChild(item);
      return li;
    };

    if (this.type === 'sort') {
      const alpha = [], numeric = [];
      this.#columns.forEach(c =>
        (NUMERIC_TYPES.has((c.type || '').toLowerCase()) ? numeric : alpha).push(c)
      );
      for (const [headingText, cols] of [['Alphabetical', alpha], ['Numerical', numeric]]) {
        if (!cols.length) continue;
        const h = document.createElement('sherpa-menu-item');
        h.setAttribute('data-type', 'heading');
        h.textContent = headingText;
        group.appendChild(h);
        cols.forEach(c => group.appendChild(makeItem(c)));
      }
    } else {
      this.#columns.forEach(c => group.appendChild(makeItem(c)));
    }
  }

  /** Populate value-picker menu for filter chips. */
  #populateFilterMenu(frag) {
    const group = frag.querySelector('ul[data-group="values"]');
    if (!group) return;

    // Extract unique values if not already done
    if (!this.#uniqueValues.length) {
      this.#extractUniqueValues();
    }

    for (const val of this.#uniqueValues) {
      const li = document.createElement('li');
      const item = document.createElement('sherpa-menu-item');
      item.setAttribute('data-selection', 'checkbox');
      item.setAttribute('value', val);
      item.dataset.filterValue = val;
      if (this.#selectedValues.has(val)) item.setAttribute('checked', '');
      // Sentence case: capitalise first character, leave rest as-is
      const display = val === '' ? '(empty)' : val.charAt(0).toUpperCase() + val.slice(1);
      item.textContent = display;
      li.appendChild(item);
      group.appendChild(li);
    }
  }

  /** Mark the active range preset in the timeframe menu. */
  #populateTimeframeMenu(frag) {
    const items = frag.querySelectorAll('[data-role="range-option"]');
    for (const item of items) {
      item.dataset.rangeKey = item.getAttribute('value') ?? '';
      item.toggleAttribute('checked', item.getAttribute('value') === this.#rangeKey);
    }
  }

  #onMenuSelect(e) {
    const data = e?.detail?.data || {};

    /* Filter-type: handle value checkbox toggling and action buttons */
    if (this.type === 'filter') {
      if (data.action === 'select-all') {
        this.#selectedValues = new Set(this.#uniqueValues);
        this.setAttribute('data-mode', 'on');
        this.#updateActive();
        this.#emitFilterChange();
      } else if (data.action === 'clear-all') {
        this.#selectedValues.clear();
        this.setAttribute('data-mode', 'off');
        this.#updateActive();
        this.#emitFilterChange();
      } else if (data.filterValue !== undefined) {
        const val = data.filterValue;
        if (this.#selectedValues.has(val)) {
          this.#selectedValues.delete(val);
        } else {
          this.#selectedValues.add(val);
        }
        this.setAttribute('data-mode', this.#selectedValues.size > 0 ? 'on' : 'off');
        this.#updateActive();
        this.#emitFilterChange();
      }
      return;
    }

    /* Timeframe-type: handle range radio selection */
    if (this.type === 'timeframe') {
      const key = data.rangeKey ?? '';
      this.#rangeKey = key;
      this.setAttribute('data-mode', key ? 'on' : 'off');
      this.#updateLabel();
      this.#updateActive();
      this.#emitFilterChange();
      return;
    }

    /* Sort/Segment: handle column radio selection */
    if (data.role === 'none-option' || data.field === '') {
      this.#userCleared = true;
      this.removeAttribute('data-field');
      this.removeAttribute('data-mode');
    } else if (data.field !== undefined) {
      this.#userCleared = false;
      this.setAttribute('data-field', data.field);
      if (!this.getAttribute('data-mode')) {
        this.setAttribute('data-mode', this.type === 'sort' ? 'asc' : 'on');
      }
    }
  }

  /* ── Public API ──────────────────────────────────────────────── */

  get type() { return (this.dataset.type || 'sort').toLowerCase(); }
  set type(v) { this.dataset.type = v; }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  getMode() { return this.getAttribute('data-mode') || null; }
  setMode(mode) {
    mode === null ? this.removeAttribute('data-mode') : this.setAttribute('data-mode', mode);
  }

  getField() { return this.getAttribute('data-field') || null; }
  setField(field) {
    if (field) {
      this.#userCleared = false;
      this.setAttribute('data-field', field);
      if (!this.getAttribute('data-mode')) this.setAttribute('data-mode', this.type === 'sort' ? 'asc' : 'on');
    } else {
      this.removeAttribute('data-field');
      this.removeAttribute('data-mode');
    }
  }

  /**
   * Populate available columns for the chip menu.
   * Segment chips auto-hide when no valid columns exist.
   * @param {Array} columns — { field, name, type }
   * @param {Array} [rows] — optional rows (filters single-value segment cols)
   * @returns {number} count of available columns
   */
  setAvailableColumns(columns, rows) {
    const isSegment = this.type === 'segment';
    const isTimeframe = this.type === 'timeframe';
    const cols = Array.isArray(columns) ? columns : [];

    if (isTimeframe) {
      // Auto-detect first timestamp column
      this.#timestampField = cols.find(c =>
        TIMESTAMP_TYPES.has((c?.type || '').toLowerCase())
      )?.field || null;
      this.#columns = cols;
      this.#updateLabel();
      return cols.length;
    }

    this.#columns = isSegment
      ? cols.filter(c => {
          if (NUMERIC_TYPES.has((c?.type || '').toLowerCase())) return false;
          if (Array.isArray(rows) && rows.length) {
            const vals = new Set();
            for (const r of rows) { vals.add(r[c.field]); if (vals.size > 1) break; }
            if (vals.size <= 1) return false;
          }
          return true;
        })
      : cols;

    if (isSegment) {
      this.toggleAttribute('hidden', this.#columns.length === 0);
      if (!this.#columns.length) {
        this.removeAttribute('data-field'); this.removeAttribute('data-mode');
      } else if (this.#columns.length === 1 && !this.getAttribute('data-field') && !this.#userCleared) {
        this.setField(this.#columns[0].field);
      }
    }

    this.#updateLabel();
    this.#updateActive();
    return this.#columns.length;
  }

  /**
   * Set row data for filter-type chips to extract unique values from.
   * @param {Array} rows — full dataset rows
   * @param {Object} [colMeta] — optional column metadata { type, name, field }
   */
  setValueData(rows, colMeta) {
    this.#valueRows = Array.isArray(rows) ? rows : [];
    this.#extractUniqueValues();

    // Detect boolean fields: explicit column type or value-based heuristic
    const BOOL_VALUES = new Set(['true', 'false', '0', '1', 'yes', 'no']);
    const colType = (colMeta?.type || '').toLowerCase();
    this.#isBoolean = colType === 'boolean'
      || (this.#uniqueValues.length > 0
          && this.#uniqueValues.length <= 2
          && this.#uniqueValues.every(v => BOOL_VALUES.has(v.toLowerCase())));

    // Boolean chips don't need a dropdown or count badge
    if (this.#isBoolean) {
      if (this.#dropdownBtn) this.#dropdownBtn.hidden = true;
      if (this.#countEl) this.#countEl.hidden = true;
    }
  }

  /** Extract unique values for the current field from stored rows. */
  #extractUniqueValues() {
    const field = this.getAttribute('data-field');
    if (!field || !this.#valueRows.length) {
      this.#uniqueValues = [];
      return;
    }

    const seen = new Set();
    for (const row of this.#valueRows) {
      const val = row[field];
      seen.add(val == null ? '' : String(val));
    }

    this.#uniqueValues = [...seen].sort((a, b) => a.localeCompare(b));
  }

  /** Dispatch filtervaluechange event with current selected values. */
  #emitFilterChange() {
    const detail = {
      field: this.getAttribute('data-field') || this.#timestampField,
      active: this.getAttribute('data-mode') !== 'off',
      type: this.type,
    };

    if (this.type === 'timeframe') {
      detail.rangeKey = this.#rangeKey;
      detail.range = computeTimeRange(this.#rangeKey);
    } else {
      detail.values = [...this.#selectedValues];
    }

    this.dispatchEvent(new CustomEvent('filtervaluechange', {
      bubbles: true,
      composed: true,
      detail,
    }));
  }

  /** Get the currently selected filter values (filter-type only). */
  getSelectedValues() {
    return [...this.#selectedValues];
  }

  /** Get the current time range (timeframe-type only). */
  getTimeRange() {
    return computeTimeRange(this.#rangeKey);
  }

  /** Get the active range preset key (timeframe-type only). */
  getRangeKey() {
    return this.#rangeKey;
  }

  /** Clear selected filter values (filter-type only). */
  clearValues() {
    this.#selectedValues.clear();
    this.setAttribute('data-mode', 'off');
    this.#updateActive();
  }
}

customElements.define('sherpa-filter-chip', SherpaFilterChip);
