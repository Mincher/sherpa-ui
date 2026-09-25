/**
 * bind-selection.ts — one control, one field, both ways.
 *
 * The WIRING half of the filter state: a control reports what a reader picked
 * and redraws when anything else changes the same field. `filter-state.ts` is
 * the model it reads; `filter-face.ts` is what it draws.
 *
 * DOM-free, like everything in this folder — a `Selector` is an EventTarget,
 * never an element.
 *
 * TRAP T-one-field-one-filter-menu
 */
import type { FilterClause } from './store.js';
import type { FilterState } from './filter-state.js';

/**
 * Enough of a DataSource to own a FIELD's selection. Not `contribute`: keyed
 * by WRITER, two controls over one field both reach the query.
 * TRAP T-one-field-one-filter-menu
 */
export interface Selector extends EventTarget {
  select: (field: string, picked: readonly unknown[]) => void;
  selection: (field: string) => FilterState;
  declareValues: (field: string, values: readonly unknown[]) => void;
  /** A COMPONENT-reach control needs this; a VIEW-reach one does not.
   *  `reach`, not `scope`: TRAP T-three-things-called-scope */
  contribute?: (key: string, filter: FilterClause | undefined) => void;
}

/** How one control reads and draws a field. */
export interface SelectionBinding<T> {
  /** The field the control is over. */
  field: string;
  /** Every value it offers, in the order it draws them. */
  values: readonly string[];
  /** What the CONTROL currently says is picked. Read it, never the event —
   *  a roll-up row stands for several values and its label is a value of none. */
  read: (control: T) => readonly string[];
  /** Put the source's answer on the control. */
  draw: (control: T, picked: readonly string[]) => void;
  /** The control's own event, when it wants a change. */
  event: string;
  /**
   * How far this control's answer reaches. `view` (the default) writes the
   * FIELD's one selection, which every control over that field then shows.
   * `component` narrows only what this control draws: it is ANDed under the
   * view's answer, so it can never widen past it and never touches the view's
   * own state. A legend, a chart's segment mode and a grid column filter are
   * all `component`. TRAP T-a-filter-applies-down-its-scope
   */
  reach?: 'view' | 'component';
  /**
   * The part name a `component` binding owns. Two components over one field
   * need two names, or the second silently replaces the first. Defaults to
   * `scope:<field>`, which is right only when there is ONE such control.
   */
  key?: string;
  /** Drop the wiring when this aborts. TRAP T-signal-not-a-teardown-list */
  signal?: AbortSignal;
}

/** What a binding hands back. */
export interface BoundSelection {
  /** This field, as every other control reports it. */
  readonly state: FilterState;
  /** Drive it from elsewhere — a saved view, a preset. */
  set: (picked: Iterable<string>) => void;
  destroy: () => void;
}

/**
 * Join a control to a FIELD on a source — the loop every control needs, once:
 * declare the values, draw what the source says, write what the reader does,
 * re-draw when anyone else changes the field. No control hears about another.
 * TRAP T-one-field-one-filter-menu
 */
export function bindSelection<T extends EventTarget>(
  control: T,
  source: Selector,
  options: SelectionBinding<T>,
): BoundSelection {
  const { field, values, read, draw, event, signal } = options;
  const known = new Set(values);
  const reach = options.reach ?? 'view';
  const key = options.key ?? `reach:${field}`;
  source.declareValues(field, values);

  /* A component-scope binding needs a source that can hold a named part. The
     alternative — falling back to select() — is the exact clobber this scope
     exists to prevent, so it fails loudly instead.
     TRAP T-a-filter-applies-down-its-scope */
  if (reach === 'component' && typeof source.contribute !== 'function') {
    throw new TypeError(
      `bindSelection: reach "component" needs a source with contribute(); "${field}" got one without.`,
    );
  }

  /** This binding's OWN answer, for a component scope. Empty is no constraint. */
  let own: string[] = [];

  /**
   * What this control draws. A VIEW binding shows the field's one selection, so
   * every control over it agrees. A COMPONENT binding shows its OWN answer —
   * the view's is a different, wider question and drawing it here would say the
   * reader had picked something they did not.
   */
  const picked = (): string[] => (reach === 'component'
    ? own
    : source.selection(field).values.filter((v) => v.state === 'picked').map((v) => v.value));

  const redraw = (): void => { draw(control, picked()); };

  /** Write what the control now says. One that REFUSES a change never reports
   *  it — its own floors are the component's concern. */
  const write = (next: readonly string[]): void => {
    const want = next.filter((v) => known.has(v));
    // EVERYTHING picked is no constraint. TRAP T-everything-on-is-no-filter
    const answer = want.length === values.length ? [] : want;
    if (reach === 'component') {
      own = [...answer];
      // ANDed under the view's, so it can only narrow further.
      source.contribute!(key, answer.length ? [field, 'in', answer] : undefined);
      /* Draw its OWN answer back. `selection-change` never fires for a part —
         it is not a field selection — so without this a control driven by
         `set()` keeps showing whatever it was last drawn with. */
      redraw();
      return;
    }
    source.select(field, answer);
  };

  const onControlChange = (): void => { write(read(control)); };
  const onSelectionChange = (e: Event): void => {
    if ((e as CustomEvent<{ field: string }>).detail?.field !== field) return;
    redraw();
  };


  control.addEventListener(event, onControlChange);
  source.addEventListener('selection-change', onSelectionChange);
  redraw();

  const destroy = (): void => {
    control.removeEventListener(event, onControlChange);
    source.removeEventListener('selection-change', onSelectionChange);
    // A part outlives its control otherwise, and nothing else can name it.
    if (reach === 'component') source.contribute!(key, undefined);
  };
  signal?.addEventListener('abort', destroy, { once: true });

  return {
    get state(): FilterState { return source.selection(field); },
    set(next: Iterable<string>): void { write([...next]); },
    destroy,
  };
}
