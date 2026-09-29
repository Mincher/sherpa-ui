/**
 * sherpa-chart-legend — the colour key beside a chart.
 *
 * It hides nothing itself: the PAGE listens for legend-item-click and calls the
 * chart. Read `detail.indices`, not `detail.index` — "Other" stands for several.
 *
 * TRAP T-readonly-legend-is-a-key-not-a-filter
 * TRAP T-legend-status-swatch-shares-the-band-tokens
 * TRAP T-legend-caps-at-six-and-rolls-up
 * TRAP T-rollup-row-has-its-own-prototype
 *
 * Map:
 * - LegendItem — One legend row —
 */
import { datumTotal, type LegendDatum } from '../../core/data/chart-datum.js';
import { SHARED_PROPS, SUMMARY_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import type { DataAsk } from '../../core/ui/context.js';
import { paintSeries } from '../../core/ui/chart-parts.js';
// The roll-up row composes a real button + menu; the page may not have imported them.
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';

const MAX_ITEMS = 6;

/** The roll-up row's name, before its `(n)` count is appended. */
const ROLLUP_LABEL = 'Other';

/** One legend row — TRAP T-chart-datum-aliases-are-not-copies. */
export type LegendItem = LegendDatum;

/** @tier sub-component — renders inside charts; excluded from the public catalog. */
export class SherpaChartLegend extends SherpaElement {
  static override css = new URL('./sherpa-chart-legend.css', import.meta.url);
  static override html = new URL('./sherpa-chart-legend.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  /* A row goes inactive, never vanishes; a pick narrows its chart alone.
     TRAP T-a-legend-toggle-is-a-filter */
  static override asks: DataAsk = {
    shape: 'segments', keepEmpty: true, picks: { event: 'legend-item-click', narrows: 'host' },
  };

  static override props = {
    ...SUMMARY_PROPS,
    'data-orientation': SHARED_PROPS['data-orientation'],
    /* Report clicks, never toggle a series — the host owns the selection. */
    'data-readonly': { type: 'boolean', kind: 'style' },
  } as const;

  /** The legend rows, as populated. */
  #items: LegendItem[] = [];
  /**
   * The rows toggled OFF, by LABEL. By label and not by index because a
   * re-populate re-orders and re-counts: a filter that removed a category
   * would otherwise shift every index and turn off the wrong row.
   * TRAP T-a-legend-remembers-its-off-set-by-label
   */
  #off = new Set<string>();
  /**
   * The last row seen for each label, kept so a SUSPENDED one survives.
   * An off row is filtered out of the data, so the next push omits it — and
   * a row that vanishes cannot be switched back on.
   * TRAP T-a-suspended-legend-row-keeps-its-place
   */
  #seen = new Map<string, LegendItem>();
  /** Are the smallest rows rolled up into one "Other" row. */
  #rolledUp = false;
  /** Folded categories and the on-set, both keyed by SOURCE index. */
  #rolled: Array<{ index: number; item: LegendItem }> = [];
  /** Which of the rolled-up rows are still on. */
  #rolledActive = new Set<number>();

  override onRender(): void {
    this.$('.legend')?.addEventListener('click', this.#onClick);
    if (this.#items.length) this.#render();
  }

  /** populate([{ label, value?, colorIndex }]). Keeps the off-set. */
  protected override renderData(data: unknown): void {
    const incoming = Array.isArray(data) ? (data as LegendItem[]) : [];
    for (const item of incoming) this.#seen.set(item.label, item);
    this.#items = this.#cap(this.#withSuspended(incoming));
    this.#render();
  }

  /**
   * Put every suspended row back, at the value it last held.
   *
   * OFF is a state, not a delete — the twin of a filter chip, which keeps its
   * value when you switch it off. The row is missing because the filter it
   * wrote removed its rows, so re-adding it here is the only place that knows.
   * Order follows the last full set, so a row does not jump on its way back.
   * TRAP T-a-suspended-legend-row-keeps-its-place
   */
  #withSuspended(incoming: LegendItem[]): LegendItem[] {
    if (!this.#off.size) return incoming;
    const present = new Set(incoming.map((i) => i.label));
    const missing = [...this.#off].filter((l) => !present.has(l) && this.#seen.has(l));
    if (!missing.length) return incoming;

    const order = [...this.#seen.keys()];
    return [...incoming, ...missing.map((l) => this.#seen.get(l)!)]
      .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  }

  /**
   * Every REAL value label this legend stands for — a roll-up row's own
   * "Other" is a value of nothing, so its folded categories count instead.
   */
  #everyLabel(): string[] {
    const out = this.#items
      .filter((_, i) => !(this.#rolledUp && i === this.#items.length - 1))
      .map((i) => i.label);
    return [...out, ...this.#rolled.map((r) => r.item.label)];
  }

  /**
   * The labels currently toggled OFF. A host that SET them needs to ask what
   * the legend now holds. TRAP T-a-legend-remembers-its-off-set-by-label
   */
  get off(): string[] {
    return [...this.#off];
  }

  /** Set them from outside — a chip over the same field, or a saved view. */
  set off(next: readonly string[]) {
    const every = this.#everyLabel();
    const want = new Set(next);
    /* The same floor as a click, because a caller can reach the same state.
       Every row off is refused; the legend keeps what it had.
       TRAP T-a-legend-keeps-one-row-on */
    if (every.length && every.every((l) => want.has(l))) return;
    this.#off = want;
    this.#render();
  }

  /** The labels ON — the door a provider reads and draws a pick through.
   *  Everything on is no pick. TRAP T-everything-on-is-no-filter */
  get picked(): string[] {
    const on = this.#everyLabel().filter((l) => !this.#off.has(l));
    return this.#off.size ? on : [];
  }

  set picked(next: readonly string[]) {
    this.off = next.length ? this.#everyLabel().filter((l) => !next.includes(l)) : [];
  }

  /** Cap at MAX_ITEMS, rolling the tail into one "Other" row. */
  #cap(items: LegendItem[]): LegendItem[] {
    this.#rolledUp = items.length > MAX_ITEMS;
    if (items.length <= MAX_ITEMS) {
      this.#rolled = [];
      this.#rolledActive.clear();
      return items;
    }

    const kept = items.slice(0, MAX_ITEMS - 1);
    const rest = items.slice(MAX_ITEMS - 1);
    this.#rolled = rest.map((item, k) => ({ index: MAX_ITEMS - 1 + k, item }));
    this.#rolledActive = new Set(this.#rolled.map((r) => r.index));
    /* A roll-up counts only when EVERY folded row is a number: "Other 12" over
       a row reading "n/a" is a lie. Not clamped — a printed total says what the
       data says. TRAP T-one-total-for-the-ring-and-the-label */
    const countable = rest.every((i) => Number.isFinite(
      typeof i.value === 'number' ? i.value : Number(i.value),
    ));
    const total = countable ? datumTotal(rest, { clamp: false }) : undefined;

    return [
      ...kept,
      {
        /* HOW MANY it folded, in the label: "Other (3)" says what the row
           stands for, where a bare "Other" could be one category or twenty.
           TRAP T-legend-caps-at-six-and-rolls-up */
        label: `${ROLLUP_LABEL} (${rest.length})`,
        colorIndex: MAX_ITEMS,
        ...(total != null ? { value: total } : {}),
      },
    ];
  }

  /** Draw a row per item — swatch, label and value. */
  #render(): void {
    const list = this.$('.legend');
    const tpl = this.$<HTMLTemplateElement>('template.item-tpl');
    if (!list || !tpl) return;

    const readonly = this.hasAttribute('data-readonly');
    list.replaceChildren();
    this.#items.forEach((item, i) => {
      // "Other" is a different template, so clone per row, not via renderList.
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
        // The band's own pair, never the `--_status-*` cascade.
        entry.dataset['status'] = item.status;
        swatch.style.setProperty('--_hue', `var(--sherpa-status-${item.status}-fill)`);
        swatch.style.setProperty('--_border', `var(--sherpa-status-${item.status})`);
      } else {
        paintSeries(swatch, i, item.colorIndex);
      }
      entry.querySelector('.label')!.textContent = item.label;
      /* Remembered across a re-populate, so a source push does not clear it.
         A roll-up row is ON while ANY of its folded categories is. */
      if (!readonly) {
        const on = isRollup
          ? this.#rolled.some((r) => !this.#off.has(r.item.label))
          : !this.#off.has(item.label);
        entry.setAttribute('aria-pressed', String(on));
      }
      entry.querySelector('.value')!.textContent = item.value != null ? String(item.value) : '';
      /* A category a FILTER emptied: still there, still toggleable, but drawn
         inactive so a reader can see it is contributing nothing. Removing the
         row instead loses the way back — the legend IS how it comes on again.
         TRAP T-a-legend-row-goes-inactive-it-never-vanishes */
      entry.toggleAttribute('data-empty', Number(item.value) === 0);
      // Strip the button semantics; `disabled` would say the wrong thing.
      if (readonly) {
        entry.setAttribute('role', 'presentation');
        entry.setAttribute('tabindex', '-1');
        entry.removeAttribute('aria-pressed');
      }
      if (isRollup) this.#buildBreakdown(wrapper);
      list.appendChild(wrapper);
    });
  }

  /** One checkbox row per folded category, plus its Apply. */
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
      // The SOURCE index, not the row's position.
      input.value = String(index);
      input.checked = this.#rolledActive.has(index);
      row.querySelector('.rollup-row-label')!.textContent = item.label;
      menu.appendChild(row);
    }

    /* sherpa-button OPENS its own slotted menu and keeps aria-expanded —
       the click listener here only stops the press reaching the toggle beside
       it. Hand-rolling the open lost the light-dismiss race: the menu opened
       once and no later click could shut it.
       TRAP T-a-trigger-click-follows-light-dismiss */
    button.addEventListener('click', (event) => event.stopPropagation());
    menu.addEventListener('menu-apply', ((event: CustomEvent) => {
      const values = (event.detail?.values ?? []) as string[];
      const on = new Set(values.map(Number));
      this.#rolledActive = on;
      // Applying a suspended group's breakdown turns the row back on.
      const row = wrapper.querySelector('.rollup-toggle');
      row?.setAttribute('aria-pressed', String(on.size > 0));

      /* THE OFF-SET IS THE ONE ANSWER. Unticking a folded row used to emit and
         nothing else — `off` never learnt about it, so the binding reading it
         saw no change and the view kept every row.
         TRAP T-a-breakdown-pick-is-a-legend-pick */
      for (const { index, item } of this.#rolled) {
        if (on.has(index)) this.#off.delete(item.label);
        else this.#off.add(item.label);
      }

      /* SAY SO in the language every other control speaks: one event, not
         two. `indices` is what a roll-up row always reports. */
      this.emit('legend-item-click', {
        index: this.#items.length - 1,
        label: this.#items.at(-1)?.label ?? 'Other',
        active: on.size > 0,
        indices: [...on].sort((a, b) => a - b),
      });
    }) as EventListener);
  }

  /** A row was clicked: switch its series on or off. */
  #onClick = (event: Event): void => {
    // Guarded here, not only in CSS, so pointer and keyboard agree.
    if (this.hasAttribute('data-readonly')) return;
    const item = (event.target as HTMLElement).closest<HTMLElement>('.item');
    const raw = item?.dataset['index'];
    if (raw == null || !item) return;
    const active = item.getAttribute('aria-pressed') !== 'true';
    const index = Number(raw);
    const isRollup = this.#rolledUp && index === this.#items.length - 1;

    /* The off-set holds REAL labels. A roll-up row is named "Other", which is
       a value of nothing — record the categories it folded instead, or a
       caller filtering on the set would dim the row and narrow nothing.
       TRAP T-a-legend-remembers-its-off-set-by-label */
    const labels = isRollup
      ? this.#rolled.map((r) => r.item.label)
      : [this.#items[index]?.label];

    /* AT LEAST ONE ROW STAYS ON, and the LEGEND refuses it — visibility is
       this component's own state, not the caller's. Switching off the last
       leaves an empty chart beside an empty grid and no obvious way back.
       TRAP T-a-legend-keeps-one-row-on */
    if (!active) {
      const going = new Set(labels.filter((l): l is string => l != null));
      const left = this.#everyLabel().filter((l) => !this.#off.has(l) && !going.has(l));
      if (!left.length) return;
    }

    // aria-pressed is both the accessible state and the CSS hook for dimming.
    item.setAttribute('aria-pressed', String(active));
    for (const label of labels) {
      if (label == null) continue;
      if (active) this.#off.delete(label);
      else this.#off.add(label);
    }

    // "Other" SUSPENDS its whole group — TRAP T-legend-suspend-remembers-the-set.
    if (isRollup) this.#syncBreakdownBoxes(active);

    this.emit('legend-item-click', {
      index,
      label: this.#items[index]?.label ?? '',
      active,
      // What this row stands for in the CALLER's data; normally just [index].
      indices: isRollup
        ? (active
            ? [...this.#rolledActive].sort((a, b) => a - b)
            : this.#rolled.map((r) => r.index))
        : [index],
    });
  };

  /**
   * Match the breakdown's boxes to the "Other" row's state.
   *
   * #rolledActive is untouched here — that is what keeps the round trip lossless.
   */
  #syncBreakdownBoxes(active: boolean): void {
    for (const box of this.$$<HTMLInputElement>('.rollup-menu input')) {
      box.checked = active && this.#rolledActive.has(Number(box.value));
    }
  }

}

customElements.define('sherpa-chart-legend', SherpaChartLegend);
