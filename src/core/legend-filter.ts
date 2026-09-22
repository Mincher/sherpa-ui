/**
 * legend-filter.ts — turning a legend row OFF is a FILTER, not a drawing trick.
 *
 * A legend used to call `setSliceHidden()` on one chart: that bar vanished and
 * nothing else on the page knew. Here the same click writes `notin` into the
 * DataSource, so every bound component re-reads — the other charts, the tiles,
 * the grid and its pager.
 *
 * A chip over the same field is the SAME state wearing a menu, so the two
 * follow each other.
 *
 * TRAP T-a-legend-toggle-is-a-filter
 */
import type { Filter } from './store.js';

/** A legend: it reports clicks and remembers which labels are off. */
interface LegendEl extends EventTarget {
  off: string[];
}

/** Enough of a DataSource to own one named part of the filter. */
interface Contributor {
  contribute: (key: string, filter: Filter | undefined) => void;
}

/** A quick-filter toolbar, seen through the one property this needs. */
interface ChipHost extends EventTarget {
  values: Record<string, readonly string[]>;
}

export interface LegendFilterOptions {
  /** The row field the legend's labels are values of — `countBy`'s field. */
  field: string;
  /** Every value, in order. A label outside this list is ignored. */
  values: readonly string[];
  /**
   * The named filter part. Defaults to `legend:<field>`, so two legends over
   * different fields never overwrite one another.
   */
  key?: string;
  /** Mirror the set into this chip, and follow it back. */
  chip?: { el: ChipHost; id: string };
  /** Drop the wiring when this aborts. TRAP T-signal-not-a-teardown-list */
  signal?: AbortSignal;
}

/**
 * The filter for a set of hidden values. An empty set gives `undefined`, which
 * REMOVES the part rather than adding a clause nothing fails.
 */
export function hiddenFilter(field: string, hidden: ReadonlySet<string>): Filter | undefined {
  if (!hidden.size) return undefined;
  const out = [...hidden];
  // One value reads better as `ne`; the grammar treats the two the same.
  return out.length === 1 ? [field, 'ne', out[0]!] : [field, 'notin', out];
}

/** What `bindLegendFilter` hands back. */
export interface LegendFilterBinding {
  /** The labels currently hidden. */
  readonly hidden: string[];
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
  source: Contributor,
  options: LegendFilterOptions,
): LegendFilterBinding {
  const { field, values, chip, signal } = options;
  const key = options.key ?? `legend:${field}`;
  const known = new Set(values);
  let hidden = new Set<string>();

  /** Write the filter, and show the same set on the chip. */
  const apply = (): void => {
    source.contribute(key, hiddenFilter(field, hidden));
    // The chip lists what is still ON: a filter names what it KEEPS.
    if (chip) chip.el.values = { [chip.id]: values.filter((v) => !hidden.has(v)) };
  };

  const onLegendClick = (): void => {
    /* Read the LEGEND, not the event. `detail` carries one row, but a roll-up
       row stands for several and its label ("Other") is a value of nothing.
       The legend already resolved both into its own off-set. */
    hidden = new Set(legend.off.filter((label) => known.has(label)));
    apply();
  };

  const onChipChange = (event: Event): void => {
    const detail = (event as CustomEvent).detail as {
      values?: Record<string, readonly string[]>;
    };
    const picks = detail.values?.[chip!.id];
    /* NOTHING ticked means "no constraint", not "hide everything" — the same
       reading the rest of the toolbar uses. */
    const on = picks?.length ? new Set(picks) : known;
    hidden = new Set(values.filter((v) => !on.has(v)));
    source.contribute(key, hiddenFilter(field, hidden));
    legend.off = [...hidden];
  };

  legend.addEventListener('legend-item-click', onLegendClick);
  if (chip) chip.el.addEventListener('quick-filter-change', onChipChange);

  const destroy = (): void => {
    legend.removeEventListener('legend-item-click', onLegendClick);
    if (chip) chip.el.removeEventListener('quick-filter-change', onChipChange);
  };
  signal?.addEventListener('abort', destroy, { once: true });

  return {
    get hidden(): string[] {
      return [...hidden];
    },
    set(next: Iterable<string>): void {
      hidden = new Set([...next].filter((v) => known.has(v)));
      legend.off = [...hidden];
      apply();
    },
    destroy,
  };
}
