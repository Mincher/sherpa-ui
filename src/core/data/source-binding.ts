/**
 * source-binding.ts — every component a DataSource is bound to, how each is
 * bound, and what each is pushed and drawn. A DataSource holds one, and is its
 * host. DOM-free: a component is only a key and the methods it has.
 *
 * Map:
 * - Bound — One bound component: how it is bound, and what it was last pushed.
 * - BindHost — What the binding asks its source, live, at each push and draw.
 * - SourceBinding — Every bound component, by element.
 * - .add — Bind a component, with the id a scope's `narrows` names it by.
 * - .remove — Let a component go, and tell its sink.
 * - .get — One component's bind, live, or undefined.
 * - .elements — Every bound component, as a copy.
 * - .entries — Every bind, live, in the order they were made.
 * - .componentScopes — The scopes a bound component answers — every other one is the page's.
 * - .wantsAllRows — Is any bind asking for the unpaged set?
 * - .showsOf — What the first component bound into a scope says it shows.
 * - .showsRows — Is a grid or a list bound into this scope?
 * - .publish — Push rows and state to every bound component.
 * - .push — Give one component the rows and the view state.
 * - .pushTo — Push to the components bound by these ids.
 * - .drawPanelReading — Tell each control over several scopes one field's reading in a scope.
 * - .drawReading — Tell each control over a field's home its reading.
 * - .drawBars — Draw every bar over one scope, as the panel draws it.
 * - .drawEveryBar — Draw every bar over one scope each; settles when all have drawn.
 * - .drawScopesSoon — Draw each control over several scopes WHOLE, once per moment.
 * - .supersedeColumns — Tell each grid below the View the fields the View holds.
 * - .supersede — Tell each bar below the View which of its fields the View holds now.
 * - .syncPending — Tell each control over a scope its pending fields and whether it is dirty.
 * - .debug — Each bind, for a bug report.
 */
import { VIEW } from './query.js';
import { andFilter, filterRows, type Filter, type Row } from './store.js';
import { coalesce } from './timing.js';
import type { AttachFacts, BindSink, BoundControl, BoundView, ScopeDescription } from './data-source-types.js';
import type { FieldReading } from './filter-state.js';

/** One bound component: how it is bound, and what it was last pushed. */
export interface Bound {
  readonly: boolean;
  steerOnly: boolean;
  /** See AttachFacts.rows. */
  rows: 'page' | 'all';
  /** The rows array last handed to this component — see `push`. */
  lastRows?: readonly Row[];
  /** See AttachFacts.id. */
  id: string;
  /** The filter narrowing ONLY this component it was last pushed with — see `push`. */
  lastOwn?: string;
  scope?: string | readonly string[];
  shows?: AttachFacts['shows'];
  /** Where its view, rows and pending fields go. */
  sink: BindSink;
}

/** What the binding asks its source, live, at each push and draw. */
export interface BindHost {
  /** One scope, as a bar or panel draws it. */
  describe(scope: string): ScopeDescription;
  /** A scope's reader-facing name. */
  scopeLabel(scope: string): string;
  /** Each declared part's scope. */
  partScopes(): Iterable<string>;
  /** The view state every bound component is pushed. */
  view(): BoundView;
  /** The rows a bind is under: the page, or every row. */
  rows(which: 'page' | 'all'): readonly Row[];
  /** What narrows one bound component alone, by its id. */
  only(id: string): Filter | undefined;
  /** A component scope's own answer. */
  scoped(scope: string): Filter | undefined;
  /** A bind id no other bind in its context has. */
  mintId(): string;
}

/** Every bound component, by element. */
export class SourceBinding {
  /** Every bound component, and how it is bound. */
  #bound = new Map<BoundControl, Bound>();
  /** The source this binding draws from. */
  readonly #host: BindHost;

  constructor(host: BindHost) {
    this.#host = host;
  }

  /** Bind a component, with the id a scope's `narrows` names it by. */
  add(el: BoundControl, facts: AttachFacts, sink: BindSink): void {
    this.#bound.set(el, {
      id: facts.id ?? (el.id || this.#host.mintId()),
      readonly: facts.readonly ?? false,
      steerOnly: facts.steerOnly ?? false,
      rows: facts.rows ?? 'page',
      sink,
      ...(facts.scope ? { scope: facts.scope } : {}),
      ...(facts.shows ? { shows: facts.shows } : {}),
    });
  }

  /** Let a component go, and tell its sink. */
  remove(el: BoundControl): void {
    this.#bound.get(el)?.sink.off();
    this.#bound.delete(el);
  }

  /** One component's bind, live, or undefined. */
  get(el: BoundControl): Bound | undefined {
    return this.#bound.get(el);
  }

  /** Every bound component, as a copy. */
  get elements(): BoundControl[] {
    return [...this.#bound.keys()];
  }

  /** Every bind, live, in the order they were made. */
  entries(): IterableIterator<[BoundControl, Bound]> {
    return this.#bound.entries();
  }

  /** The scopes a bound component answers — every other one is the page's. */
  componentScopes(): Set<string> {
    const out = new Set<string>();
    for (const { scope } of this.#bound.values()) {
      for (const s of Array.isArray(scope) ? scope : scope ? [scope] : []) if (s !== VIEW) out.add(s);
    }
    return out;
  }

  /** Is any bind asking for the unpaged set? TRAP T-a-summary-binds-to-all-the-rows */
  wantsAllRows(): boolean {
    for (const entry of this.#bound.values()) if (entry.rows === 'all') return true;
    return false;
  }

  /** What the first component bound into a scope says it shows. */
  showsOf(scope: string): AttachFacts['shows'] {
    return [...this.#bound.values()].find((b) => b.scope === scope && b.shows)?.shows;
  }

  /** Is a grid or a list bound into this scope? */
  showsRows(scope: string): boolean {
    return [...this.#bound.values()].some((b) => b.scope === scope && (b.shows === 'grid' || b.shows === 'list'));
  }

  /** Push rows and state to every bound component. */
  publish(): void {
    for (const [el] of this.#bound) this.push(el);
  }

  /** Give one component the rows and the view state. TRAP T-push-writes-state-as-attributes */
  push(el: BoundControl): void {
    const entry = this.#bound.get(el);
    if (!entry) return;
    entry.sink.view(this.#host.view());

    // …but the ROWS go only where they mean something. TRAP T-steer-only-populate-means-chips
    if (entry.steerOnly) return;

    // Skip a push that would hand over the same rows again.
    // TRAP T-no-op-load-guard
    // TRAP T-adapter-lives-at-the-binding — guard the ROWS ARRAY, not a payload.
    const base = this.#host.rows(entry.rows);
    /* What narrows THIS component alone, on top of the shared query — and, for
       a summary bound INTO a component scope, that scope's answer.
       TRAP T-a-component-part-narrows-one-component */
    const into = entry.rows === 'all' && typeof entry.scope === 'string' ? this.#host.scoped(entry.scope) : undefined;
    const own = andFilter([this.#host.only(entry.id), into].filter((f): f is Filter => !!f));
    const ownKey = JSON.stringify(own ?? null);
    if (entry.lastRows === base && entry.lastOwn === ownKey) return;
    entry.lastRows = base;
    entry.lastOwn = ownKey;
    entry.sink.rows(own ? filterRows(base, own) : base);
  }

  /** Push to the components bound by these ids. */
  pushTo(ids: readonly string[]): void {
    for (const [el, b] of this.#bound) if (ids.includes(b.id)) this.push(el);
  }

  /** Tell each control over several scopes one field's reading in a scope. */
  drawPanelReading(field: string, reading: FieldReading, scope: string): void {
    for (const [el, b] of this.#bound) if (Array.isArray(b.scope)) el.drawReading?.(field, reading, scope);
  }

  /** Tell each control over a field's home its reading. */
  drawReading(field: string, reading: FieldReading, home: string): void {
    for (const [el, { scope }] of this.#bound) {
      if (scope === home || (Array.isArray(scope) && scope.includes(home))) {
        el.drawReading?.(field, reading, home);
      }
    }
  }

  /** Draw every bar over one scope, as the panel draws it — after a request
   *  that came from somewhere else (the panel) changed what it holds. */
  drawBars(scope: string): void {
    for (const [el, { scope: s }] of this.#bound) if (s === scope && el.drawScope) void el.drawScope(...this.#slice(scope));
  }

  /** Draw every bar over one scope each; settles when all have drawn. */
  drawEveryBar(): Promise<unknown> {
    const drawn: Array<void | Promise<void>> = [];
    for (const [el, { scope }] of this.#bound) {
      if (typeof scope === 'string' && el.drawScope) drawn.push(el.drawScope(...this.#slice(scope)));
    }
    return Promise.all(drawn);
  }

  /** A scope as a bar is drawn it: described now, and LIVE — read again after the
   *  bar's waits, so a change made meanwhile is in what it paints. 366 step 22 */
  #slice(scope: string): [ScopeDescription, () => ScopeDescription] {
    return [this.#host.describe(scope), () => this.#host.describe(scope)];
  }

  /** A control over several scopes — the panel — is drawn each WHOLE, once
   *  per moment, when what a scope holds changes. TRAP T-an-open-panel-follows-the-data-layer */
  readonly drawScopesSoon = coalesce((): void => {
    for (const [el, { scope }] of this.#bound) {
      // A scope this page does not have — nothing held, nothing to offer — is not drawn.
      if (Array.isArray(scope) && el.drawScopes) {
        // Each chart's own, between the View and the rest. Will, TODO 52.
        const [first, ...rest] = scope as string[];
        const asked = first === VIEW ? [VIEW, ...this.#host.partScopes(), ...rest] : [...this.#host.partScopes(), ...scope];
        void el.drawScopes(asked.map((s) => this.#host.describe(s))
          .filter((d) => d.scope === VIEW || d.filters.length || d.available.length));
      }
    }
  });

  /**
   * Each grid below the View is told the fields the View holds, each with its
   * answer as APPLIED — shown in its heading, read-only, so a heading cannot
   * contradict it. TRAP T-a-view-held-heading-shows-and-refuses
   */
  supersedeColumns(held: Readonly<Record<string, FieldReading>>): void {
    for (const [el, { scope }] of this.#bound) {
      if (typeof scope === 'string' && scope !== VIEW) el.supersedeColumns?.(held, this.#host.scopeLabel(VIEW));
    }
  }

  /**
   * Tell each bar below the View which of its fields the View holds now — it
   * keeps the chip, suspended, and says where it went. One whose set changed
   * reports again: without the field raised, or with its own kept answer back.
   * TRAP T-a-superseded-chip-suspends-it-is-never-removed
   * TRAP T-an-inactive-chip-says-where-its-filter-went
   */
  supersede(above: readonly string[]): void {
    for (const [el, { scope }] of this.#bound) {
      if (typeof scope !== 'string' || scope === VIEW || !el.supersede) continue;
      el.supersede(above, this.#host.scopeLabel(VIEW));
    }
  }

  /**
   * Tell each bound control over a scope which of its fields are PENDING
   * (`data-pending`, a field list) and whether its scope is DIRTY
   * (`data-dirty`). Attributes, as the rest of its state arrives.
   * TRAP T-push-writes-state-as-attributes
   */
  syncPending(fieldsOf: (scopes: string[]) => string[], dirty: (scope: string) => boolean): void {
    for (const [, { scope, sink }] of this.#bound) {
      if (!scope) continue;
      const scopes = typeof scope === 'string' ? [scope] : [...scope];
      sink.pending(fieldsOf(scopes), scopes.some((id) => dirty(id)));
    }
  }

  /** Each bind, for a bug report. */
  debug(): Array<{ id: string; rows: 'page' | 'all'; readonly: boolean; steerOnly: boolean }> {
    return [...this.#bound.values()].map((e) => ({
      id: e.id, rows: e.rows, readonly: e.readonly, steerOnly: e.steerOnly,
    }));
  }
}
