/**
 * legend-filter.ts — turning a legend row OFF is a FILTER, not a drawing trick.
 *
 * A legend used to call `setSliceHidden()` on one chart: that bar vanished and
 * nothing else on the page knew. Here the same click writes the FIELD's
 * selection on the DataSource, so every bound component re-reads — the other
 * charts, the tiles, the grid and its pager.
 *
 * A chip over the same field is the SAME state wearing a menu, so there is
 * nothing to keep in step: both read `source.selection(field)`.
 *
 * TRAP T-a-legend-toggle-is-a-filter
 */
import { picksClause, type Filter } from './store.js';
import { type FilterState } from './filter-state.js';

/** A legend: it reports clicks and remembers which labels are off. */
interface LegendEl extends EventTarget {
  off: string[];
}

/**
 * Enough of a DataSource to own a FIELD's selection.
 *
 * Not `contribute` any more: a legend row and a filter chip over one field are
 * the same fact stored two ways, and a separate `legend:<field>` part meant
 * both could be in the filter at once — `plan ne Free` AND `plan eq Free`,
 * which matches nothing. TRAP T-one-field-one-filter-menu
 */
interface Selector extends EventTarget {
  select: (field: string, picked: readonly string[]) => void;
  selection: (field: string) => FilterState;
  declareValues: (field: string, values: readonly unknown[]) => void;
}

export interface LegendFilterOptions {
  /** The row field the legend's labels are values of — `countBy`'s field. */
  field: string;
  /** Every value, in order. A label outside this list is ignored. */
  values: readonly string[];
  /** Drop the wiring when this aborts. TRAP T-signal-not-a-teardown-list */
  signal?: AbortSignal;
}

/**
 * The filter for a set of hidden values. An empty set gives `undefined`, which
 * REMOVES the part rather than adding a clause nothing fails.
 */
export function hiddenFilter(field: string, hidden: ReadonlySet<string>): Filter | undefined {
  /* The SAME rule every other filter uses, inverted: one value is `ne`,
     several are `notin`. It was written out here as well, which is a second
     answer to a question store.ts had already settled.
     TRAP T-one-state-per-filtered-field */
  return picksClause(field, [...hidden], 'ne');
}

/** What `bindLegendFilter` hands back. */
export interface LegendFilterBinding {
  /** The labels currently hidden. */
  readonly hidden: string[];
  /**
   * This field as every other control reports it.
   *
   * A legend's "hidden" is the inverse of "picked" — the same fact stored the
   * other way round — so it answers the same question as a chip, a column
   * heading or a tab strip. TRAP T-one-state-per-filtered-field
   */
  readonly state: FilterState;
  /** Drive the same state from elsewhere — a saved view, a preset. */
  set: (hidden: Iterable<string>) => void;
  destroy: () => void;
}

/**
 * Join a legend to a source, and optionally to a chip showing the same field.
 *
 * ```js
 * bindLegendFilter(legend, source, {
 *   field: 'status', values: states, chip: { el: qft, id: 'status' }, signal,
 * });
 * ```
 */
export function bindLegendFilter(
  legend: LegendEl,
  source: Selector,
  options: LegendFilterOptions,
): LegendFilterBinding {
  const { field, values, signal } = options;
  const known = new Set(values);
  source.declareValues(field, values);

  /** What the SOURCE says is shown. `hidden` is the same fact inverted. */
  const shown = (): Set<string> => {
    const state = source.selection(field);
    const picked = state.values.filter((v) => v.state === 'picked').map((v) => v.value);
    // Nothing picked is NO CONSTRAINT — every row is shown, none hidden.
    return picked.length ? new Set(picked) : new Set(values);
  };
  const hiddenNow = (): string[] => values.filter((v) => !shown().has(v));

  /** Draw the legend from the source. Every control over this field re-reads
   *  the same way, so a chip and a legend cannot disagree. */
  const redraw = (): void => { legend.off = hiddenNow(); };

  const onLegendClick = (): void => {
    /* Read the LEGEND, not the event. `detail` carries one row, but a roll-up
       row stands for several and its label ("Other") is a value of nothing. */
    const off = new Set(legend.off.filter((label) => known.has(label)));
    /* AT LEAST ONE stays on. Hiding the last leaves an empty chart beside an
       empty grid and no obvious way back. The click is REFUSED.
       TRAP T-a-legend-keeps-one-row-on */
    if (off.size >= values.length) {
      redraw();
      return;
    }
    /* EVERYTHING ON is no constraint, so an empty selection — not every value
       ticked, which says the same thing in a way that looks like a filter.
       TRAP T-everything-on-is-no-filter */
    source.select(field, off.size ? values.filter((v) => !off.has(v)) : []);
  };

  const onSelectionChange = (event: Event): void => {
    if ((event as CustomEvent<{ field: string }>).detail?.field !== field) return;
    redraw();
  };

  legend.addEventListener('legend-item-click', onLegendClick);
  source.addEventListener('selection-change', onSelectionChange);
  redraw();

  const destroy = (): void => {
    legend.removeEventListener('legend-item-click', onLegendClick);
    source.removeEventListener('selection-change', onSelectionChange);
  };
  signal?.addEventListener('abort', destroy, { once: true });

  return {
    get hidden(): string[] {
      return hiddenNow();
    },
    get state(): FilterState {
      return source.selection(field);
    },
    set(next: Iterable<string>): void {
      const off = new Set([...next].filter((v) => known.has(v)));
      // The same floor — TRAP T-a-legend-keeps-one-row-on.
      if (off.size >= values.length) { redraw(); return; }
      source.select(field, off.size ? values.filter((v) => !off.has(v)) : []);
    },
    destroy,
  };
}
