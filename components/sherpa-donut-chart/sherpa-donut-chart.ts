/**
 * @element sherpa-donut-chart
 * @category media
 * @description Donut / pie chart using CSS conic-gradient.
 *   Supports declarative query loading via ContentAttributesMixin
 *   or programmatic setData().
 *
 * @attr {string}  [data-title]          — Chart heading text
 * @attr {string}  [data-inner-label]    — Centre big text
 * @attr {string}  [data-inner-sublabel] — Centre small text
 * @attr {boolean} [data-loading]        — Show loading state
 * @attr {enum}    [data-variant]         — donut | pie
 * @attr {string}  [data-segment-field]  — Field for segment grouping
 * @attr {enum}    [data-segment-mode]    — Segment display mode
 * @attr {string}  [data-sort-field]     — Sort field
 * @attr {enum}    [data-sort-direction] — asc | desc
 *
 * @method setData(data) — Set chart data: Array<{ label, value, color? }> or config
 *
 * @prop {Array} data — Current chart data (getter-only)
 */

import {
  ContentAttributesMixin,
  // @ts-expect-error - TODO: Fix type
  CONTENT_ATTRIBUTES,
} from '../utilities/content-attributes-mixin.js';
import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
// @ts-expect-error - TODO: Fix type
import { formatCompact, formatFieldName, cleanTitleBase } from '../utilities/index.js';
import { getSegmentField, isSegmentEnabled, getActiveSort } from '../utilities/chart-utils.js';
import { injectFilterMenu } from '../utilities/filter-menu-utils.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-filter-bar/sherpa-filter-bar.js';

/** Default palette — falls back to CSS token values, but also needed for
 *  inline conic-gradient stops where tokens can't be used directly. */
const MAX_SEGMENTS = 8;
const OTHER_COLOR = '#9e9ea8';

const DEFAULT_COLORS = [
  '#7b1ce6', // purple
  '#16abe2', // blue
  '#2bd1c1', // teal
  '#ffaa00', // amber
  '#f3699d', // pink
  '#c046ff', // violet
  '#e67c1c', // orange
  '#e6416e', // raspberry
];

export class SherpaDonutChart extends ContentAttributesMixin(SherpaElement) {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-donut-chart.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-donut-chart.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-title',
      'data-inner-label',
      'data-inner-sublabel',
      'data-loading',
      'data-variant',
      'data-segment-field',
      'data-segment-mode',
      'data-sort-field',
      'data-sort-direction',
    ];
  }

  /* ── State ────────────────────────────────────────────────────── */

  #data = [];
  #contentData = null;
  // @ts-expect-error - TODO: Fix type
  #titleEl;
  // @ts-expect-error - TODO: Fix type
  #ringEl;
  // @ts-expect-error - TODO: Fix type
  #centreValueEl;
  // @ts-expect-error - TODO: Fix type
  #centreSublabelEl;
  // @ts-expect-error - TODO: Fix type
  #legendEl;
  // @ts-expect-error - TODO: Fix type
  #legendItemTpl;
  // @ts-expect-error - TODO: Fix type
  #filterMenuTpl = null;
  #bound = false;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {
    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');
    if (!this.hasAttribute('data-filters')) this.toggleAttribute('data-filters', true);

    // @ts-expect-error - TODO: Fix type
    this.els.title          = this.$('.chart-title');
    // @ts-expect-error - TODO: Fix type
    this.els.ring           = this.$('.donut-ring');
    // @ts-expect-error - TODO: Fix type
    this.els.centreValue    = this.$('.centre-value');
    // @ts-expect-error - TODO: Fix type
    this.els.centreSublabel = this.$('.centre-sublabel');
    // @ts-expect-error - TODO: Fix type
    this.els.legend         = this.$('.chart-legend');
    // @ts-expect-error - TODO: Fix type
    this.#legendItemTpl    = this.shadowRoot.querySelector('template.legend-item-tpl');

    if (!this.#bound) {
      // @ts-expect-error - TODO: Fix type
      this.#filterMenuTpl = injectFilterMenu(this);
      this.addEventListener('toggle-filters', this.#onToggleFilters);
      this.addEventListener('toggle-legend', this.#onToggleLegend);
      // @ts-expect-error - TODO: Fix type
      this.addEventListener('menu-populate', this.#onMenuPopulate);
      this.#bound = true;
    }

    this.#syncTitle();
    this.#syncCentreLabel();
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    super.onAttributeChanged(name, oldValue, newValue);
    switch (name) {
      case 'data-title':          this.#syncTitle(); break;
      case 'data-inner-label':
      case 'data-inner-sublabel': this.#syncCentreLabel(); break;
      case 'data-segment-field':
      case 'data-segment-mode':
        this.#syncTitle();
        if (this._suppressAttrReaction) break;
        // External attribute change — full re-aggregate needed
        if (this.#contentData) this.reAggregate();
        break;
      case 'data-sort-field':
      case 'data-sort-direction':
        if (this._suppressAttrReaction) break;
        // Local re-sort of existing data
        if (this.#contentData) {
          this.#transformContentData();
          this.#render();
        }
        break;
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  /**
   * Set chart data and render.
   * Accepts either:
   *   - A content config object (from ContentAttributesMixin.load())
   *   - A direct array of { label, value, color? }
   */
  // @ts-expect-error - TODO: Fix type
  async setData(data) {
    await this.rendered;

    // Direct array — original programmatic API
    if (Array.isArray(data)) {
      // @ts-expect-error - TODO: Fix type
      this.#data = data;
      this.#render();
      return;
    }

    // Pre-aggregated data from dataset cascade
    if (data?._fromCascade) {
      this.#contentData = data;
      this.#transformContentData();
      this.#render();
      return;
    }

    // Content config from ContentAttributesMixin (legacy)
    const explicitSegmentBy =
      data && Object.prototype.hasOwnProperty.call(data, "segmentBy");
    this.#contentData = data;

    // Apply segmentBy from config
    if (explicitSegmentBy) {
      if (data.segmentBy) {
        this.setAttribute("data-segment-field", data.segmentBy);
        this.setAttribute("data-segment-mode", "on");
      } else {
        this.removeAttribute("data-segment-field");
        this.removeAttribute("data-segment-mode");
      }
    }

    this.#transformContentData();
    this.#render();
  }

  /** Get current data. */
  get data() {
    return [...this.#data];
  }

  /* ── Private: transform ───────────────────────────────────────── */

  /* ── Sort helpers ──────────────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #applyLocalSort(data) {
    const activeSort = getActiveSort(this);
    if (!activeSort || !data.length) return data;

    const sorted = [...data];
    const dir = activeSort.dir || 'asc';

    // Sort slices by numerical value
    sorted.sort((a: any, b: any) => {
      const diff = (Number(a.value) || 0) - (Number(b.value) || 0);
      return dir === 'desc' ? -diff : diff;
    });

    return sorted;
  }

  /**
   * Transform unified { columns, rows } into [{ label, value }] for donut.
   * Uses the category column as label. When a series column is present,
   * aggregate the value column by the category to produce one slice per
   * category value.
   *
   * When data-segment-field is active, re-aggregates by the segment field
   * so each unique segment value becomes one donut slice.
   */
  #transformContentData() {
    if (!this.#contentData) { this.#data = []; return; }

    // @ts-expect-error - TODO: Fix type
    const { columns = [], rows = [], name = '' } = this.#contentData;
    if (!rows.length || columns.length < 2) { this.#data = []; return; }

    // First column = category (label), last column = value (numeric measure)
    // @ts-expect-error - TODO: Fix type
    const labelField = columns[0]?.field;
    // @ts-expect-error - TODO: Fix type
    const valueField = columns[columns.length - 1]?.field;
    if (!labelField || !valueField) { this.#data = []; return; }

    // When grouping is explicitly off, collapse to a single total segment
    const segMode = this.getAttribute('data-segment-mode');
    if (segMode === 'off') {
      const total = rows.reduce((s: any, r: any) => s + (Number(r[valueField]) || 0), 0);
      // @ts-expect-error - TODO: Fix type
      this.#data = [{ label: 'Total', value: total }];
      this.dataset["innerLabel"] = formatCompact(total);
      return;
    }

    // Segment-driven aggregation: slices = unique segment values
    const segmentField = getSegmentField(this);
    if (segmentField && isSegmentEnabled(this) && segmentField !== labelField) {
      const agg = new Map();
      for (const row of rows) {
        const key = String(row[segmentField] ?? '');
        agg.set(key, (agg.get(key) || 0) + (Number(row[valueField]) || 0));
      }
      // @ts-expect-error - TODO: Fix type
      this.#data = [...agg.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, value }));
    } else if (columns.length > 2) {
      // If there's a series column (3+ columns), aggregate value by category
      const agg = new Map();
      for (const row of rows) {
        const key = String(row[labelField] ?? '');
        agg.set(key, (agg.get(key) || 0) + (Number(row[valueField]) || 0));
      }
      // @ts-expect-error - TODO: Fix type
      this.#data = [...agg.entries()].map(([label, value]) => ({ label, value }));
    } else {
      // @ts-expect-error - TODO: Fix type
      this.#data = rows.map((row: any) => ({
        label: String(row[labelField] ?? ''),
        value: Number(row[valueField]) || 0,
      }));
    }

    // Apply local sort
    this.#data = this.#applyLocalSort(this.#data);

    // Auto-set centre label to total + sublabel to chart name
    const total = this.#data.reduce((s: any, d: any) => s + d.value, 0);
    this.dataset["innerLabel"] = formatCompact(total);
  }

  /* ── Private: sync ────────────────────────────────────────────── */

  #syncTitle() {
    // @ts-expect-error - TODO: Fix type
    if (this.els.title) {
      const entity = cleanTitleBase(this.dataset["title"] || '');
      const segMode = this.getAttribute('data-segment-mode');
      const groupField = this.getAttribute('data-segment-field')
        || this.getAttribute('data-category');
      const hasActiveGroup = segMode !== 'off' && !!groupField;
      // @ts-expect-error - TODO: Fix type
      this.els.title.textContent = hasActiveGroup
        ? `${entity} by ${formatFieldName(groupField)}`
        : `All ${entity}`;
    }
  }

  #syncCentreLabel() {
    // @ts-expect-error - TODO: Fix type
    if (this.els.centreValue) {
      // @ts-expect-error - TODO: Fix type
      this.els.centreValue.textContent = this.dataset["innerLabel"] || '';
    }
    // @ts-expect-error - TODO: Fix type
    if (this.els.centreSublabel) {
      // @ts-expect-error - TODO: Fix type
      this.els.centreSublabel.textContent = this.dataset["innerSublabel"] || '';
    }
  }

  /* ── Private: cap segments ─────────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #capSegments(data) {
    if (data.length <= MAX_SEGMENTS) return data;
    const sorted = [...data].sort((a: any, b: any) => b.value - a.value);
    const kept = sorted.slice(0, MAX_SEGMENTS - 1);
    const rest = sorted.slice(MAX_SEGMENTS - 1);
    const otherValue = rest.reduce((s: any, d: any) => s + (d.value || 0), 0);
    kept.push({ label: 'Other', value: otherValue, color: OTHER_COLOR });
    return kept;
  }

  /* ── Private: render ──────────────────────────────────────────── */

  #render() {
    // @ts-expect-error - TODO: Fix type
    if (!this.els.ring || !this.els.legend) return;

    const total = this.#data.reduce((sum: any, d: any) => sum + (d.value || 0), 0);
    if (!total) {
      // @ts-expect-error - TODO: Fix type
      this.els.ring.style.setProperty('--_conic', 'conic-gradient(#e0e0e0 0% 100%)');
      // @ts-expect-error - TODO: Fix type
      this.els.legend.replaceChildren();
      return;
    }

    const displayData = this.#capSegments(this.#data);

    // Build conic-gradient stops
    // @ts-expect-error - TODO: Fix type
    const stops = [];
    let cumulative = 0;

    // @ts-expect-error - TODO: Fix type
    displayData.forEach((d, i) => {
      const color = d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const pct = (d.value / total) * 100;
      const start = cumulative;
      cumulative += pct;
      stops.push(`${color} ${start}% ${cumulative}%`);
    });

    // @ts-expect-error - TODO: Fix type
    this.els.ring.style.setProperty(
      '--_conic',
      // @ts-expect-error - TODO: Fix type
      `conic-gradient(${stops.join(', ')})`
    );

    // Build legend
    // @ts-expect-error - TODO: Fix type
    this.els.legend.replaceChildren();

    // @ts-expect-error - TODO: Fix type
    displayData.forEach((d, i) => {
      const color = d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const item = this.#legendItemTpl.content.firstElementChild.cloneNode(true);
      item.querySelector('.legend-key').style.backgroundColor = color;
      item.querySelector('.legend-label').textContent = d.label || '';
      item.querySelector('.legend-value').textContent = d.value != null ? d.value.toLocaleString() : '';
      // @ts-expect-error - TODO: Fix type
      this.els.legend.appendChild(item);
    });
  }

  /* ── Filter menu ─────────────────────────────────────────────────────── */

  #onToggleFilters = () => {
    this.toggleAttribute('data-filters');
  };

  #onToggleLegend = () => {
    this.toggleAttribute('data-hide-legend');
  };

  #onMenuPopulate = (e: CustomEvent) => {
    const menu = e.detail?.menu;
    if (!menu) return;
    const filterItem = menu.querySelector('sherpa-menu-item[data-event="toggle-filters"]');
    if (filterItem) {
      filterItem.toggleAttribute('checked', this.hasAttribute('data-filters'));
    }
    const legendItem = menu.querySelector('sherpa-menu-item[data-event="toggle-legend"]');
    if (legendItem) {
      legendItem.toggleAttribute('checked', !this.hasAttribute('data-hide-legend'));
    }
  };
}

customElements.define('sherpa-donut-chart', SherpaDonutChart);