/**
 * filter-scope.ts — two scopes for one screen.
 *
 * A VIEW filter narrows everything: the charts, the tiles, the grid. A
 * COMPONENT filter narrows one component and leaves the rest alone — a reader
 * hunting through the table does not want the charts beside it to move.
 *
 * Component EXTENDS view. It never alters it, so the two can never fight:
 *
 *     component rows = view filter AND component filter
 *
 * A field lives in exactly ONE scope at a time. It is offered in the component
 * toolbar only while the view does not already carry it, and adding it to the
 * view SUSPENDS the component's chip — greyed, still holding what the reader
 * picked, ready to come back.
 *
 * Nothing here knows what a VIEW or a COMPONENT is: they are two sources, one
 * following the other. A card extending a dashboard, or a panel extending a
 * card, is the same relationship with different words.
 *
 * DOM-free: this is the rule, not the wiring.
 *
 * TRAP T-component-extends-view-never-alters-it
 */
import type { DataSource } from './data-source.js';
import type { FieldFacts, FilterState } from './filter-state.js';

/** The named part a component source uses for its view's whole filter. */
const VIEW_PART = 'scope:view';

/**
 * Make `component` follow `view`, so it draws the view's rows narrowed by its
 * own filters.
 *
 * The view's WHOLE filter arrives as one named part, which keeps the component
 * source's own parts untouched and means a view change can never clear them.
 * Returns the teardown.
 */
export function followView(
  view: DataSource,
  component: DataSource,
  options: { signal?: AbortSignal } = {},
): () => void {
  const sync = (): void => {
    component.contribute(VIEW_PART, view.state.filter);
  };

  /* `change` fires after a load COMPLETES, which is when the view's filter is
     settled. Listening to a steering event instead would read it mid-flight. */
  view.addEventListener('change', sync);
  sync();

  const off = (): void => view.removeEventListener('change', sync);
  options.signal?.addEventListener('abort', off, { once: true });
  return off;
}

/**
 * One field a reader may filter on, in whichever scope holds it.
 *
 * `FieldFacts` is what the rest of the data layer already calls this — a
 * field, what a reader calls it, and its values — so a scope describes a field
 * the same way a state does. The extras are whatever a toolbar needs to draw
 * the chip: an icon, a select mode, options.
 * TRAP T-one-state-per-filtered-field
 */
export interface ScopedFilter extends FieldFacts {
  /** Anything else the toolbar needs — icon, select mode, options. */
  [key: string]: unknown;
}

/** Where a filter currently lives. */
export type Scope = 'view' | 'component';

/**
 * Which filters each toolbar should OFFER, given what each already carries.
 *
 * A field already in the view is not offered anywhere: the view's chip is the
 * one that holds it. A field in the component is not offered again there.
 *
 * TRAP T-component-extends-view-never-alters-it
 */
export function offerable(
  all: readonly ScopedFilter[],
  held: { view: readonly string[]; component: readonly string[] },
): { view: ScopedFilter[]; component: ScopedFilter[] } {
  const inView = new Set(held.view);
  const inComponent = new Set(held.component);
  return {
    // The view may take anything it does not already hold — including one the
    // component holds, which is what makes PROMOTION possible.
    view: all.filter((f) => !inView.has(f.field)),
    // The component may take only what the view has left alone.
    component: all.filter((f) => !inView.has(f.field) && !inComponent.has(f.field)),
  };
}

/**
 * Which component fields the VIEW has just taken over.
 *
 * Anything the component already held is a PROMOTION. The component chip is
 * SUSPENDED, not removed: it keeps its place and everything it holds, and
 * comes back when the view lets the field go.
 *
 * It returns the component's own `FilterState` for each — the op, the typed
 * text and every value's state, not just the picks. A promoted field that had
 * "Starts with Go" must arrive in the view still saying that, and a shape of
 * `{ id, values }` cannot carry it.
 *
 * The caller does the suspending — this says WHAT, not how.
 * TRAP T-a-superseded-chip-suspends-it-is-never-removed
 * TRAP T-one-state-per-filtered-field
 */
export function promotions(
  added: readonly string[],
  componentStates: Readonly<Record<string, FilterState>>,
): FilterState[] {
  return added
    .filter((field) => field in componentStates)
    .map((field) => componentStates[field]!);
}
