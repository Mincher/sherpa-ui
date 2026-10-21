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
 *
 * Map:
 * - Selector — Enough of a DataSource to own a FIELD's selection.
 * - SelectionBinding — How one control reads and draws a field.
 * - BoundSelection — What a binding hands back.
 * - bindSelection — join a control to a FIELD on a source — declare, draw, report, redraw
 */
import { report } from './report.js';
import type { BoundControl } from './data-source-types.js';
import type { FieldReading, FilterState } from './filter-state.js';
import { VIEW } from './query.js';

/**
 * Enough of a DataSource to own a FIELD's selection, keyed by FIELD: two
 * controls over one field both reach the query. TRAP T-one-field-one-filter-menu
 */
export interface Selector extends EventTarget {
  select: (field: string, picked: readonly unknown[], reading?: FieldReading) => void;
  selection: (field: string) => FilterState;
  declareValues: (field: string, values: readonly unknown[]) => void;
  /** A control that narrows ONE component writes its own scope.
   *  `reach`, not `scope`: TRAP T-three-things-called-scope */
  write: (scope: string, field: string, reading: FieldReading | undefined, at?: { only?: BoundControl }) => void;
  reading: (scope: string, field: string) => FieldReading | undefined;
  /** Does a scope hold a field? A control that narrows one component asks of
   *  the View. TRAP T-a-legend-follows-the-view-when-it-holds-the-field */
  holds: (scope: string, field: string) => boolean;
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
   * `component` narrows only the ONE component it names in `only`: it is ANDed
   * under the view's answer, so it can never widen past it and never touches
   * the view's own state. TRAP T-a-filter-applies-down-its-scope
   */
  reach?: 'view' | 'component';
  /**
   * The scope a `component` binding writes. Two components over one field
   * need two names. Defaults to `reach:<field>`, right only when there is ONE.
   */
  key?: string;
  /**
   * The ONE bound component a `component` answer narrows — a legend's own
   * chart. A `component` reach needs it, or nothing is bound.
   * TRAP T-a-component-part-narrows-one-component
   */
  only?: BoundControl;
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
  const only = options.only;
  /* A component answer narrows ONE component; with none named it has nowhere
     to go, and falling back to select() is the clobber a scope prevents.
     TRAP T-a-filter-applies-down-its-scope */
  if (reach === 'component' && !only) {
    report({
      code: 'component-reach-without-only',
      message: `bindSelection: "${field}" asks for reach "component" with no \`only\`, so nothing is bound.`,
      at: { field },
    });
    return { get state(): FilterState { return source.selection(field); }, set(): void {}, destroy(): void {} };
  }
  source.declareValues(field, values);

  /** THE VIEW HOLDS THIS FIELD, so its answer is the one in force: a control
   *  over ONE component shows it and changes it, and keeps none of its own.
   *  TRAP T-a-legend-follows-the-view-when-it-holds-the-field */
  const raised = (): boolean => reach === 'component' && source.holds(VIEW, field);

  /**
   * What this control draws. A VIEW binding shows the field's one selection, so
   * every control over it agrees. A COMPONENT binding shows its OWN answer —
   * the view's is a different, wider question and drawing it here would say the
   * reader had picked something they did not.
   */
  const picked = (): string[] => {
    // ITS OWN SCOPE's answer, from the source — so a restored Query draws it.
    if (reach === 'component' && !raised()) return (source.reading(key, field)?.picked ?? []).map(String);
    return source.selection(field).values.filter((v) => v.state === 'picked').map((v) => v.value);
  };

  const redraw = (): void => { draw(control, picked()); };

  /** Write what the control now says. One that REFUSES a change never reports
   *  it — its own floors are the component's concern. */
  const write = (next: readonly string[]): void => {
    const want = next.filter((v) => known.has(v));
    // EVERYTHING picked is no constraint. TRAP T-everything-on-is-no-filter
    const answer = want.length === values.length ? [] : want;
    if (raised()) {
      // Its picks are Simple's: rows the View kept stay kept, and out of force.
      const held = source.reading(VIEW, field);
      source.select(field, answer, held?.conditions?.length ? { ...held, mode: 'simple' } : {});
      return;
    }
    if (reach === 'component') {
      // ANDed under the view's, so it can only narrow further.
      source.write(key, field, answer.length ? { picked: answer } : undefined, only ? { only } : {});
      /* Draw its OWN answer back. `selection-change` never fires for a scope's
         own answer, so a control driven by `set()` would keep its last draw. */
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


  /** The View took the field, or let it go: what this control shows changed.
   *  Taken, its own answer is dropped — the View's is the one in force. */
  const onScopeChange = (): void => {
    if (raised() && source.reading(key, field)) source.write(key, field, undefined, only ? { only } : {});
    redraw();
  };

  control.addEventListener(event, onControlChange);
  source.addEventListener('selection-change', onSelectionChange);
  if (reach === 'component') source.addEventListener('scope-change', onScopeChange);
  redraw();

  const destroy = (): void => {
    control.removeEventListener(event, onControlChange);
    source.removeEventListener('selection-change', onSelectionChange);
    source.removeEventListener('scope-change', onScopeChange);
    // Its scope outlives its control otherwise, and nothing else can name it.
    if (reach === 'component') source.write(key, field, undefined);
  };
  signal?.addEventListener('abort', destroy, { once: true });

  return {
    get state(): FilterState { return source.selection(field); },
    set(next: Iterable<string>): void { write([...next]); },
    destroy,
  };
}
