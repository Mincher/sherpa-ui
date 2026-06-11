/**
 * @element sherpa-donut-chart
 * @category media
 * @description Donut or pie chart for showing proportional part-to-whole relationships. Use
 *   when a total is divided into a small number of named segments (≤8 for legibility). Use
 *   the donut variant (default) over pie when you want a summary value in the centre hole
 *   via data-inner-label. Feed via setData([ {label, value, color?} ]), data-src-json
 *   (standalone/static pages), or the ContentAttributesMixin data pipeline (app-shell
 *   integration — last writer wins on datasetfiltered).
 *   NOTE: The ring uses container query units (cqw/cqh). The host must have explicit dimensions,
 *   or be placed inside a parent with `container-type: size` and fixed width+height. A parent
 *   with only `container-type: inline-size` produces a zero-height chart.
 *
 * @attr {string}  data-title          — Chart heading text
 * @attr {string}  data-inner-label    — Centre big text
 * @attr {string}  data-inner-sublabel — Centre small text
 * @attr {boolean} data-loading        — Show loading state
 * @attr {enum}    data-variant         — donut | pie
 * @attr {string}  data-segment-field  — Field for segment grouping
 * @attr {enum}    data-segment-mode    — Segment display mode
 * @attr {string}  data-sort-field     — Sort field
 * @attr {enum}    data-sort-direction — asc | desc
 * @attr {string}  data-src-json       — URL to JSON: { columns, rows } or [{ label, value }]
 *
 * @method setData(data) — Set chart data: Array<{ label, value, color? }> or config
 *
 * @prop {Array} data — Current chart data (getter-only)
 */

import { ContentAttributesMixin } from '../utilities/content-attributes-mixin.js';
import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { formatCompact } from '../utilities/format-utils.js';
import { getSegmentField, isSegmentEnabled, getActiveSort, applySegmentBy, syncChartTitle } from '../utilities/chart-utils.js';
import { injectFilterMenu, toggleFilters, toggleLegend, syncFilterMenuItems } from '../utilities/filter-menu-utils.js';
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

/** A donut slice. */
interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

/** Aggregated content payload delivered to setData() via the dataset cascade. */
interface ContentData {
  columns?: Array<{ field?: string; name?: string }>;
  rows?: Record<string, unknown>[];
  name?: string;
  _fromCascade?: boolean;
  segmentBy?: string | null;
  [key: string]: unknown;
}

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

  #data: DonutDatum[] = [];
  #contentData: ContentData | null = null;
  #legendItemTpl: HTMLTemplateElement | null = null;
  #bound = false;

  public els = this.cacheElements({
    title: '.chart-title',
    ring: { selector: '.donut-ring', type: HTMLElement },
    centreValue: '.centre-value',
    centreSublabel: '.centre-sublabel',
    legend: '.chart-legend',
  });

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {
    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');
    if (!this.hasAttribute('data-filters')) this.toggleAttribute('data-filters', true);

    this.#legendItemTpl = this.$<HTMLTemplateElement>('template.legend-item-tpl');

    if (!this.#bound) {
      injectFilterMenu(this);
      this.addEventListener('toggle-filters', this.#onToggleFilters);
      this.addEventListener('toggle-legend', this.#onToggleLegend);
      this.addEventListener('menu-populate', this.#onMenuPopulate);
      this.#bound = true;
    }

    this.#syncTitle();
    this.#syncCentreLabel();
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    super.onAttributeChanged(name, oldValue, newValue);
    switch (name) {
      case 'data-title': {
        this.#syncTitle();
        const layout = this.$<HTMLElement>('.chart-layout');
        if (layout) layout.setAttribute('aria-label', newValue || 'Donut chart');
        break;
      }
      case 'data-inner-label':
      case 'data-inner-sublabel': this.#syncCentreLabel(); break;
      case 'data-segment-field':
      case 'data-segment-mode':
        this.#syncTitle();
        if (this.isAttrReactionSuppressed) break;
        // External attribute change — full re-aggregate needed
        if (this.#contentData) this.reAggregate();
        break;
      case 'data-sort-field':
      case 'data-sort-direction':
        if (this.isAttrReactionSuppressed) break;
        // Local re-sort of existing data
        if (this.#contentData) {
          this.#transformContentData();
          this.#render();
        }
        break;
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  override async onJsonData(data: DonutDatum[] | ContentData): Promise<void> {
    await this.setData(data);
  }

  /**
   * Set chart data and render.
   * Accepts either:
   *   - A content config object (from ContentAttributesMixin.load())
   *   - A direct array of { label, value, color? }
   */
  async setData(data: DonutDatum[] | ContentData): Promise<void> {
    await this.rendered;

    // Direct array — original programmatic API
    if (Array.isArray(data)) {
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

    this.#contentData = data;
    applySegmentBy(this, data);
    this.#transformContentData();
    this.#render();
  }

  /** Get current data. */
  get data(): DonutDatum[] {
    return [...this.#data];
  }

  /* ── Private: transform ───────────────────────────────────────── */

  /* ── Sort helpers ──────────────────────────────────────────── */

  #applyLocalSort(data: DonutDatum[]): DonutDatum[] {
    const activeSort = getActiveSort(this);
    if (!activeSort || !data.length) return data;

    const sorted = [...data];
    const dir = activeSort.dir || 'asc';

    // Sort slices by numerical value
    sorted.sort((a, b) => {
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
  #transformContentData(): void {
    if (!this.#contentData) { this.#data = []; return; }

    const { columns = [], rows = [] } = this.#contentData;
    if (!rows.length || columns.length < 2) { this.#data = []; return; }

    // First column = category (label), last column = value (numeric measure)
    const labelField = columns[0]?.field;
    const valueField = columns[columns.length - 1]?.field;
    if (!labelField || !valueField) { this.#data = []; return; }

    // When grouping is explicitly off, collapse to a single total segment
    const segMode = this.getAttribute('data-segment-mode');
    if (segMode === 'off') {
      const total = rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r[valueField]) || 0), 0);
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
      this.#data = [...agg.entries()].map(([label, value]) => ({ label, value }));
    } else {
      this.#data = rows.map((row: Record<string, unknown>) => ({
        label: String(row[labelField] ?? ''),
        value: Number(row[valueField]) || 0,
      }));
    }

    // Apply local sort
    this.#data = this.#applyLocalSort(this.#data);

    // Auto-set centre label to total + sublabel to chart name
    const total = this.#data.reduce((s: number, d: DonutDatum) => s + d.value, 0);
    this.dataset["innerLabel"] = formatCompact(total);
  }

  /* ── Private: sync ────────────────────────────────────────────── */

  #syncTitle(): void { syncChartTitle(this.els.title ?? null, this); }

  #syncCentreLabel(): void {
    if (this.els.centreValue) {
      this.els.centreValue.textContent = this.dataset["innerLabel"] || '';
    }
    if (this.els.centreSublabel) {
      this.els.centreSublabel.textContent = this.dataset["innerSublabel"] || '';
    }
  }

  /* ── Private: cap segments ─────────────────────────────────────── */

  #capSegments(data: DonutDatum[]): DonutDatum[] {
    if (data.length <= MAX_SEGMENTS) return data;
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const kept = sorted.slice(0, MAX_SEGMENTS - 1);
    const rest = sorted.slice(MAX_SEGMENTS - 1);
    const otherValue = rest.reduce((s, d) => s + (d.value || 0), 0);
    kept.push({ label: 'Other', value: otherValue, color: OTHER_COLOR });
    return kept;
  }

  /* ── Private: render ──────────────────────────────────────────── */

  #render(): void {
    const ring = this.els.ring;
    const legend = this.els.legend;
    if (!ring || !legend) return;

    const total = this.#data.reduce((sum, d) => sum + (d.value || 0), 0);
    if (!total) {
      ring.style.setProperty('--_conic', 'conic-gradient(#e0e0e0 0% 100%)');
      legend.replaceChildren();
      return;
    }

    const displayData = this.#capSegments(this.#data);

    // Build conic-gradient stops
    const stops: string[] = [];
    let cumulative = 0;

    displayData.forEach((d: DonutDatum, i: number) => {
      const color = d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const pct = (d.value / total) * 100;
      const start = cumulative;
      cumulative += pct;
      stops.push(`${color} ${start}% ${cumulative}%`);
    });

    ring.style.setProperty(
      '--_conic',
      `conic-gradient(${stops.join(', ')})`
    );

    // Build legend
    legend.replaceChildren();

    const tpl = this.#legendItemTpl;
    displayData.forEach((d: DonutDatum, i: number) => {
      const color = d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const item = tpl?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
      if (!item) return;
      const key = item.querySelector<HTMLElement>('.legend-key');
      if (key) key.style.backgroundColor = color ?? '';
      const lbl = item.querySelector('.legend-label');
      if (lbl) lbl.textContent = d.label || '';
      const val = item.querySelector('.legend-value');
      if (val) val.textContent = d.value != null ? d.value.toLocaleString() : '';
      this.els.legend?.appendChild(item);
    });

    this.#updateAriaLabel(displayData, total);
  }

  #updateAriaLabel(segments: DonutDatum[], total: number): void {
    const title = this.getAttribute('data-title') || 'Donut chart';
    const layout = this.$<HTMLElement>('.chart-layout');
    const summary = this.$<HTMLElement>('.chart-sr-summary');
    if (layout) layout.setAttribute('aria-label', title);
    if (summary && segments.length) {
      const topSegment = [...segments].sort((a, b) => b.value - a.value)[0];
      const topLabel = topSegment?.label ?? '';
      const topPct = total > 0 ? Math.round(((topSegment?.value ?? 0) / total) * 100) : 0;
      summary.textContent = `${title}. ${segments.length} segments. Largest: ${topLabel} at ${topPct}%.`;
    }
  }

  /* ── Filter menu ─────────────────────────────────────────────────────── */

  #onToggleFilters = (): void => { toggleFilters(this); };
  #onToggleLegend  = (): void => { toggleLegend(this); };
  #onMenuPopulate  = (e: CustomEvent): void => { syncFilterMenuItems(e, this); };
}

customElements.define('sherpa-donut-chart', SherpaDonutChart);