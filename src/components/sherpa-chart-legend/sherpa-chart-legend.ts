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
 * calls the chart's setSeriesHidden / setSliceHidden / setBarHidden.
 *
 * `data-readonly` makes it a pure KEY: no toggling, no button semantics. A gauge's
 * rows name THRESHOLDS rather than a series, so there is nothing to hide.
 *
 * An item's swatch is a categorical hue by `colorIndex`, or a STATUS colour when
 * it carries `status` — a threshold's colour means healthy/warning/critical, not
 * "the third series".
 *
 * A legend draws at most six rows. Past that the tail is rolled into a single
 * "Other" row whose value is the sum of the rest, so the numbers still add up to
 * the whole. Prefer `detail.indices` over `detail.index` when toggling a chart —
 * the "Other" row stands for several series.
 *
 * That roll-up row also carries an xsmall menu button opening an ITEMISED
 * breakdown of the folded categories: checkbox rows with an Apply/Cancel footer,
 * so several can be edited without the menu closing after each click. Applying
 * fires legend-breakdown-change with the categories that are now on and off.
 *
 * @fires legend-item-click — a legend entry is clicked. bubbles + composed. detail: { index: number, indices: number[], label: string, active: boolean }
 * @fires legend-breakdown-change — the "Other" breakdown was applied. bubbles + composed. detail: { active: number[], hidden: number[] }
 */
import { SherpaElement } from '../../core/sherpa-element.js';
// The roll-up row composes a real button + a committing menu, so the legend must
// register them — it cannot rely on the page having imported them.
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';

/**
 * The most rows a legend will ever draw.
 *
 * Beyond six a legend stops being a key — nobody matches the eleventh shade of
 * purple to its label, and beside a chart it grows taller than the chart. The
 * sixth row is an "Other" total covering everything past the fifth, so the values
 * still add up to the whole.
 */
const MAX_ITEMS = 6;

export interface LegendItem {
  label: string;
  value?: string | number;
  colorIndex?: number;
  /**
   * A STATUS swatch instead of a categorical one.
   *
   * A gauge's bands are thresholds, not a data series — their colour means
   * "healthy / warning / critical", so the swatch must come from the status
   * ramp rather than the next hue in the categorical wheel. Set this OR
   * colorIndex, not both.
   */
  status?: 'success' | 'warning' | 'critical' | 'info' | 'urgent';
}

/** @tier sub-component — renders inside charts; excluded from the public catalog. */
export class SherpaChartLegend extends SherpaElement {
  static override tier = 'sub-component' as const;
  static override css = new URL('./sherpa-chart-legend.css', import.meta.url);
  static override html = new URL('./sherpa-chart-legend.html', import.meta.url);

  #items: LegendItem[] = [];
  /** Whether the tail was rolled into an "Other" row (see #cap). */
  #rolledUp = false;
  /** How many entries the CALLER passed in, before any capping. */
  #sourceCount = 0;
  /**
   * The categories folded into the "Other" row, with their ORIGINAL indices.
   *
   * Kept so the roll-up's breakdown menu can itemise them and report which ones
   * the reader ticked — the row itself only knows a total.
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
   * A legend with a dozen rows stops being a key: nobody matches the 11th shade of
   * purple to its label, and beside a chart it grows taller than the chart itself.
   * Five named categories plus an "Other" total keeps the shape readable and still
   * accounts for every value — the numbers add up to the same whole.
   *
   * The roll-up only happens when it BUYS something: with exactly MAX_ITEMS + 1
   * entries, "Other" would stand for one category, so the sixth is left named.
   */
  #cap(items: LegendItem[]): LegendItem[] {
    this.#sourceCount = items.length;
    this.#rolledUp = items.length > MAX_ITEMS;
    if (items.length <= MAX_ITEMS) {
      this.#rolled = [];
      this.#rolledActive.clear();
      return items;
    }

    const kept = items.slice(0, MAX_ITEMS - 1);
    const rest = items.slice(MAX_ITEMS - 1);
    // Remember the folded categories AND their original indices, so the breakdown
    // menu can itemise them and name the right series back to the chart.
    this.#rolled = rest.map((item, k) => ({ index: MAX_ITEMS - 1 + k, item }));
    this.#rolledActive = new Set(this.#rolled.map((r) => r.index));
    // Only numeric values can be summed; a legend of labels with no values gets an
    // "Other" row with no value rather than a meaningless 0.
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
        // The next hue after the named ones, so "Other" does not reuse a colour
        // that already means something.
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
      // The LAST row of a capped legend is the "Other" roll-up, which needs a
      // second control beside its toggle — so it comes from its own prototype (a
      // wrapper, not a bare button: a menu button nested inside a button is
      // invalid HTML and the browser un-nests it).
      const isRollup = this.#rolledUp && !readonly && i === this.#items.length - 1;
      const proto = isRollup
        ? this.$<HTMLTemplateElement>('template.rollup-tpl')
        : tpl;
      const wrapper = proto!.content.firstElementChild!.cloneNode(true) as HTMLElement;
      // In a roll-up the toggle is a CHILD of the wrapper; otherwise it IS the
      // wrapper. Everything below writes to the button, so resolve it once.
      const entry = isRollup
        ? wrapper.querySelector<HTMLElement>('.rollup-toggle')!
        : wrapper;
      entry.dataset['index'] = String(i);
      const swatch = entry.querySelector<HTMLElement>('.swatch')!;
      if (item.status) {
        // A STATUS swatch. `data-status` on the entry lights the status cascade,
        // and the swatch reads --_status-border-strong from it — the same token a
        // sparkline's stroke uses, so a zone's key and its band agree.
        entry.dataset['status'] = item.status;
      } else {
        // Categorical hue by 1-based index (wraps at 11).
        const n = ((item.colorIndex ?? i + 1) - 1) % 11 + 1;
        swatch.style.setProperty('--_hue', `var(--sherpa-data-viz-series-${n})`);
      }
      entry.querySelector('.label')!.textContent = item.label;
      entry.querySelector('.value')!.textContent = item.value != null ? String(item.value) : '';
      // A read-only legend is a KEY, not a filter: strip the button semantics so a
      // keyboard user is not handed a control that does nothing. `disabled` would
      // be wrong — the row is not unavailable, it was never interactive.
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
   * Checkboxes plus `data-commit` are the point: the reader ticks several
   * categories and the menu stays open until Apply, rather than closing after
   * every click. sherpa-menu already holds the rows as a draft and restores them
   * on Cancel, so nothing here has to manage that.
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
      // The value is the SOURCE index, so Apply can name the right series back to
      // the chart without a second lookup.
      input.value = String(index);
      input.checked = this.#rolledActive.has(index);
      row.querySelector('.rollup-row-label')!.textContent = item.label;
      menu.appendChild(row);
    }

    button.addEventListener('click', (event) => {
      // The button is a sibling of the toggle, so its click must not also toggle
      // the row it sits in.
      event.stopPropagation();
      menu.toggle?.(button);
    });
    menu.addEventListener('menu-open', () => button.setAttribute('aria-expanded', 'true'));
    menu.addEventListener('menu-close', () => button.setAttribute('aria-expanded', 'false'));
    menu.addEventListener('menu-apply', ((event: CustomEvent) => {
      const values = (event.detail?.values ?? []) as string[];
      const on = new Set(values.map(Number));
      this.#rolledActive = on;
      // Report the FOLDED categories as they now stand: every rolled-up index,
      // each with whether it survived the edit. A chart can apply the whole set in
      // one pass rather than diffing.
      this.emit('legend-breakdown-change', {
        active: [...on].sort((a, b) => a - b),
        hidden: this.#rolled.map((r) => r.index).filter((i) => !on.has(i)),
      });
    }) as EventListener);
  }

  #onClick = (event: Event): void => {
    // A read-only legend never toggles — it is a key. Guarded here rather than
    // only in CSS so pointer and keyboard behave the same.
    if (this.hasAttribute('data-readonly')) return;
    const item = (event.target as HTMLElement).closest<HTMLElement>('.item');
    const raw = item?.dataset['index'];
    if (raw == null || !item) return;
    // aria-pressed is BOTH the accessible state and the CSS hook for the dimmed
    // look — one source of truth, so they cannot disagree. (It replaced a
    // data-current attribute that duplicated it.)
    const active = item.getAttribute('aria-pressed') !== 'true';
    item.setAttribute('aria-pressed', String(active));
    const index = Number(raw);
    this.emit('legend-item-click', {
      index,
      label: this.#items[index]?.label ?? '',
      active,
      // The indices this row stands for in the data the CALLER passed in.
      //
      // Normally that is just [index]. But a capped legend's last row is an
      // "Other" roll-up covering every category past the fifth, so toggling it
      // must hide ALL of them — `index` alone would hide one series and leave the
      // rest drawn under a row that says they are off.
      indices: this.#rolledUp && index === this.#items.length - 1
        ? Array.from({ length: this.#sourceCount - index }, (_, k) => index + k)
        : [index],
    });
  };
}

customElements.define('sherpa-chart-legend', SherpaChartLegend);
