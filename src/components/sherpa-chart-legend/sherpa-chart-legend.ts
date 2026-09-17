/**
 * sherpa-chart-legend — the colour key beside a chart.
 *
 * Give it a list with populate([{ label, value?, colorIndex }]) and it draws one
 * entry per item in a three-column grid (swatch · category · value), matching the
 * rebuilt Figma component. JS tells each entry which colour to use; CSS draws the
 * swatch and the grid.
 *
 * Clicking an entry toggles it and fires legend-item-click. The legend does not
 * know what it labels, so the PAGE joins them up — it listens for that event and
 * calls the chart's setSeriesHidden / setSliceHidden / setBarHidden. Prefer
 * `detail.indices` over `detail.index`: an "Other" row stands for several.
 *
 * TRAP T-readonly-legend-is-a-key-not-a-filter — `data-readonly` is a pure KEY.
 * TRAP T-legend-status-swatch-shares-the-band-tokens — `status` beats colorIndex.
 * TRAP T-legend-caps-at-six-and-rolls-up — the tail folds into one "Other" total.
 * TRAP T-rollup-row-has-its-own-prototype — with an itemised breakdown menu.
 */
import type { LegendDatum } from '../../core/chart-datum.js';
import { SherpaElement } from '../../core/sherpa-element.js';
import { seriesBorderVar, seriesVar } from '../../core/format-tick.js';
// The roll-up row composes a real button + a committing menu, so both must be
// defined here — the page may not have imported them.
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';

/**
 * The most rows a legend will ever draw.
 *
 * TRAP T-legend-caps-at-six-and-rolls-up — past six it stops being a key, so
 * the tail folds into one "Other" total.
 */
const MAX_ITEMS = 6;

/**
 * One legend row — an alias of the shared `LegendDatum`.
 *
 * TRAP T-chart-datum-aliases-are-not-copies
 */
export type LegendItem = LegendDatum;

/** @tier sub-component — renders inside charts; excluded from the public catalog. */
export class SherpaChartLegend extends SherpaElement {
  static override tier = 'sub-component' as const;
  static override css = new URL('./sherpa-chart-legend.css', import.meta.url);
  static override html = new URL('./sherpa-chart-legend.html', import.meta.url);

  #items: LegendItem[] = [];
  /** Whether the tail was rolled into an "Other" row (see #cap). */
  #rolledUp = false;
  /**
   * The categories folded into the "Other" row, with their ORIGINAL indices.
   *
   * TRAP T-rollup-row-has-its-own-prototype — the row itself only knows a total.
   */
  #rolled: Array<{ index: number; item: LegendItem }> = [];
  /** Which rolled-up categories are currently ON. Indices into the SOURCE list. */
  #rolledActive = new Set<number>();

  override onRender(): void {
    this.$('.legend')?.addEventListener('click', this.#onClick);
    if (this.#items.length) this.#render();
  }

  /** populate([{ label, value?, colorIndex }]) — the legend entries. */
  protected override renderData(data: unknown): void {
    this.#items = this.#cap(Array.isArray(data) ? (data as LegendItem[]) : []);
    this.#render();
  }

  /**
   * Cap the legend at MAX_ITEMS, rolling the tail into a single "Other" row.
   *
   * TRAP T-legend-caps-at-six-and-rolls-up — why six, why the roll-up only
   * happens past MAX_ITEMS + 1, and why only numeric values are summed.
   */
  #cap(items: LegendItem[]): LegendItem[] {
    this.#rolledUp = items.length > MAX_ITEMS;
    if (items.length <= MAX_ITEMS) {
      this.#rolled = [];
      this.#rolledActive.clear();
      return items;
    }

    const kept = items.slice(0, MAX_ITEMS - 1);
    const rest = items.slice(MAX_ITEMS - 1);
    // The folded categories AND their original indices — TRAP
    // T-legend-caps-at-six-and-rolls-up.
    this.#rolled = rest.map((item, k) => ({ index: MAX_ITEMS - 1 + k, item }));
    this.#rolledActive = new Set(this.#rolled.map((r) => r.index));
    const numeric = rest
      .map((i) => (typeof i.value === 'number' ? i.value : Number(i.value)))
      .filter((n) => Number.isFinite(n));
    const total = numeric.length === rest.length
      ? numeric.reduce((sum, n) => sum + n, 0)
      : undefined;

    return [
      ...kept,
      {
        label: 'Other',
        // The next hue after the named ones, so it reuses no meaning.
        colorIndex: MAX_ITEMS,
        ...(total != null ? { value: total } : {}),
      },
    ];
  }

  #render(): void {
    const list = this.$('.legend');
    const tpl = this.$<HTMLTemplateElement>('template.item-tpl');
    if (!list || !tpl) return;

    const readonly = this.hasAttribute('data-readonly');
    list.replaceChildren();
    this.#items.forEach((item, i) => {
      // TRAP T-rollup-row-has-its-own-prototype — the "Other" row comes from a
      // different template, so this clones per row rather than via renderList.
      const isRollup = this.#rolledUp && !readonly && i === this.#items.length - 1;
      const wrapper = isRollup ? this.clone('template.rollup-tpl') : this.clone('template.item-tpl');
      if (!wrapper) return;
      // In a roll-up the toggle is a CHILD of the wrapper; otherwise it IS one.
      const entry = isRollup
        ? wrapper.querySelector<HTMLElement>('.rollup-toggle')!
        : wrapper;
      entry.dataset['index'] = String(i);
      const swatch = entry.querySelector<HTMLElement>('.swatch')!;
      if (item.status) {
        // TRAP T-legend-status-swatch-shares-the-band-tokens — the same pair the
        // band paints from, never the `--_status-*` cascade.
        entry.dataset['status'] = item.status;
        swatch.style.setProperty('--_hue', `var(--sherpa-status-${item.status}-fill)`);
        swatch.style.setProperty('--_border', `var(--sherpa-status-${item.status})`);
      } else {
        // The series hue by 1-based index, wrapping at the palette size.
        swatch.style.setProperty('--_hue', seriesVar(i, item.colorIndex));
        swatch.style.setProperty('--_border', seriesBorderVar(i, item.colorIndex));
      }
      entry.querySelector('.label')!.textContent = item.label;
      entry.querySelector('.value')!.textContent = item.value != null ? String(item.value) : '';
      // TRAP T-readonly-legend-is-a-key-not-a-filter — strip the button
      // semantics; `disabled` would be the wrong statement.
      if (readonly) {
        entry.setAttribute('role', 'presentation');
        entry.setAttribute('tabindex', '-1');
        entry.removeAttribute('aria-pressed');
      }
      if (isRollup) this.#buildBreakdown(wrapper);
      list.appendChild(wrapper);
    });
  }

  /**
   * Fill the roll-up row's breakdown menu with one CHECKBOX row per folded
   * category, and wire its Apply.
   *
   * TRAP T-rollup-row-has-its-own-prototype — checkboxes plus `data-commit`,
   * and why the menu button's click must not reach the toggle.
   */
  #buildBreakdown(wrapper: HTMLElement): void {
    const menu = wrapper.querySelector<HTMLElement & {
      toggle?: (t?: HTMLElement) => void;
    }>('.rollup-menu');
    const button = wrapper.querySelector<HTMLElement>('.rollup-menu-btn');
    const rowTpl = this.$<HTMLTemplateElement>('template.rollup-row-tpl');
    if (!menu || !button || !rowTpl) return;

    for (const { index, item } of this.#rolled) {
      const row = rowTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const input = row.querySelector('input')!;
      // The SOURCE index — TRAP T-rollup-row-has-its-own-prototype.
      input.value = String(index);
      input.checked = this.#rolledActive.has(index);
      row.querySelector('.rollup-row-label')!.textContent = item.label;
      menu.appendChild(row);
    }

    button.addEventListener('click', (event) => {
      // A SIBLING of the toggle — TRAP T-rollup-row-has-its-own-prototype.
      event.stopPropagation();
      menu.toggle?.(button);
    });
    menu.addEventListener('menu-open', () => button.setAttribute('aria-expanded', 'true'));
    menu.addEventListener('menu-close', () => button.setAttribute('aria-expanded', 'false'));
    menu.addEventListener('menu-apply', ((event: CustomEvent) => {
      const values = (event.detail?.values ?? []) as string[];
      const on = new Set(values.map(Number));
      this.#rolledActive = on;
      // Applying a SUSPENDED group's breakdown turns the row back on —
      // TRAP T-legend-suspend-remembers-the-set.
      const row = wrapper.querySelector('.rollup-toggle');
      row?.setAttribute('aria-pressed', String(on.size > 0));
      // Every rolled-up index with whether it survived, so a chart applies the
      // whole set in one pass rather than diffing.
      this.emit('legend-breakdown-change', {
        active: [...on].sort((a, b) => a - b),
        hidden: this.#rolled.map((r) => r.index).filter((i) => !on.has(i)),
      });
    }) as EventListener);
  }

  #onClick = (event: Event): void => {
    // Guarded here, not only in CSS, so pointer and keyboard agree —
    // TRAP T-readonly-legend-is-a-key-not-a-filter.
    if (this.hasAttribute('data-readonly')) return;
    const item = (event.target as HTMLElement).closest<HTMLElement>('.item');
    const raw = item?.dataset['index'];
    if (raw == null || !item) return;
    // aria-pressed is BOTH the accessible state and the CSS hook for the dimmed
    // look — TRAP T-legend-suspend-remembers-the-set.
    const active = item.getAttribute('aria-pressed') !== 'true';
    item.setAttribute('aria-pressed', String(active));
    const index = Number(raw);
    const isRollup = this.#rolledUp && index === this.#items.length - 1;

    // The "Other" row's toggle SUSPENDS its whole group, and suspend ≠ clear —
    // TRAP T-legend-suspend-remembers-the-set.
    if (isRollup) this.#syncBreakdownBoxes(active);

    this.emit('legend-item-click', {
      index,
      label: this.#items[index]?.label ?? '',
      active,
      // The indices this row stands for in the data the CALLER passed in —
      // TRAP T-legend-caps-at-six-and-rolls-up. Normally just [index].
      indices: isRollup
        ? (active
            ? [...this.#rolledActive].sort((a, b) => a - b)
            : this.#rolled.map((r) => r.index))
        : [index],
    });
  };

  /**
   * Tick or untick the breakdown's checkboxes to match the "Other" row's state.
   *
   * TRAP T-legend-suspend-remembers-the-set — #rolledActive is never touched
   * here, which is what makes the round trip lossless.
   */
  #syncBreakdownBoxes(active: boolean): void {
    for (const box of this.$$<HTMLInputElement>('.rollup-menu input')) {
      box.checked = active && this.#rolledActive.has(Number(box.value));
    }
  }

}

customElements.define('sherpa-chart-legend', SherpaChartLegend);
