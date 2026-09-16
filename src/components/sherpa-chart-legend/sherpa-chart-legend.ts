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
import type { LegendDatum } from '../../core/chart-datum.js';
import { SherpaElement } from '../../core/sherpa-element.js';
import { seriesBorderVar, seriesVar } from '../../core/format-tick.js';
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

/**
 * One legend row — an alias of the shared `LegendDatum`.
 *
 * A legend sits BESIDE a chart showing the same data, so a `ChartDatum` should
 * pass straight into one. It does now: `LegendDatum` is `ChartDatum` with the
 * two things only a legend has — a value it may PRINT rather than plot, and a
 * status swatch. See chart-datum.ts.
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
      // The prototype VARIES per row, so this one keeps its own clone rather than
      // going through renderList — the roll-up row comes from a different template.
      const wrapper = isRollup ? this.clone('template.rollup-tpl') : this.clone('template.item-tpl');
      if (!wrapper) return;
      // In a roll-up the toggle is a CHILD of the wrapper; otherwise it IS the
      // wrapper. Everything below writes to the button, so resolve it once.
      const entry = isRollup
        ? wrapper.querySelector<HTMLElement>('.rollup-toggle')!
        : wrapper;
      entry.dataset['index'] = String(i);
      const swatch = entry.querySelector<HTMLElement>('.swatch')!;
      if (item.status) {
        // A STATUS swatch reads the SAME pair its band does —
        // `--sherpa-status-<name>-fill` (the status sequence's mid step at 50%)
        // and `--sherpa-status-<name>` (that sequence's border). A key that does
        // not match the thing it labels is worse than no key.
        //
        // It used to light the `--_status-*` cascade via `data-status`, which is
        // a different token set: the swatch and the gauge band it named were
        // painted from two unrelated sources and drifted apart.
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
      // Ticking anything in the breakdown of a SUSPENDED group means the reader
      // wants it back — otherwise Apply would record a set that nothing displays.
      // An empty set leaves the row off, which is the same statement.
      const row = wrapper.querySelector('.rollup-toggle');
      row?.setAttribute('aria-pressed', String(on.size > 0));
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
    const isRollup = this.#rolledUp && index === this.#items.length - 1;

    // The "Other" row's own toggle SUSPENDS its whole group.
    //
    // Its breakdown checkboxes must follow it — leaving them ticked under a row
    // that says "off" is a lie. But the per-item choices are NOT cleared: they
    // live in #rolledActive, so switching the row back on restores exactly the
    // set the reader last applied rather than turning everything on. Same
    // suspend-but-remember rule the Sort chip and the value-filter chips use.
    if (isRollup) this.#syncBreakdownBoxes(active);

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
      //
      // When the row comes back ON it reports only the categories the reader had
      // left active, not every folded one — restoring the group must not silently
      // un-hide something they switched off in the breakdown.
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
   * Suspended → every box off. Restored → back to the remembered set. The
   * remembered set (#rolledActive) is never touched here, which is what makes the
   * round trip lossless.
   */
  #syncBreakdownBoxes(active: boolean): void {
    for (const box of this.$$<HTMLInputElement>('.rollup-menu input')) {
      box.checked = active && this.#rolledActive.has(Number(box.value));
    }
  }

}

customElements.define('sherpa-chart-legend', SherpaChartLegend);
