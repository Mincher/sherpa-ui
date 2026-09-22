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
 * view MOVES it — carrying whatever the reader had picked.
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

/** One field a reader may filter on, in whichever scope holds it. */
export interface ScopedFilter {
  /** The chip id, which is also the field unless `field` says otherwise. */
  id: string;
  label: string;
  /** The row field, when it differs from the id. */
  field?: string;
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
    view: all.filter((f) => !inView.has(f.id)),
    // The component may take only what the view has left alone.
    component: all.filter((f) => !inView.has(f.id) && !inComponent.has(f.id)),
  };
}

/** What a promotion does: the id that moved, and the value it carried. */
export interface Promotion {
  id: string;
  values: string[];
}

/**
 * Work out what must move when the VIEW gains filters.
 *
 * Anything the component already held is a PROMOTION: it leaves the component
 * toolbar and arrives in the view's, carrying its value. Adding a filter the
 * component does not hold is a plain add, and returns nothing.
 *
 * The caller does the moving — this says what, not how.
 */
export function promotions(
  added: readonly string[],
  componentValues: Readonly<Record<string, readonly string[]>>,
): Promotion[] {
  return added
    .filter((id) => id in componentValues)
    .map((id) => ({ id, values: [...(componentValues[id] ?? [])] }));
}
