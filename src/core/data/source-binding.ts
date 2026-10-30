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
 * - .fieldsRead — The fields the bound components read from a row, or null — every field.
 * - .freeSets — Each set of fields a bind is free of, once.
 * - .wantsAllRows — Is any bind asking for the unpaged set?
 * - .componentOf — The tag of the first component drawn rows in a scope.
 * - .pagedIn — Is a page of rows drawn in this scope — or a pivot of them?
 * - .presentsIn — Does a chart draw a summary in this scope — is it a SLOT? Not a grid's pivot.
 * - .publish — Push rows and state to every bound component.
 * - .push — Give one component the rows and the view state.
 * - .pushTo — Push to the components bound by these ids.
 * - .drawPanelReading — Tell each control over several scopes one field's reading in a scope.
 * - .drawReading — Tell each control over a field's home its reading.
 * - .drawBars — Draw every bar over one scope, as the panel draws it.
 * - .stacksIn — Does a slot's chart stack by a Secondary — a bar chart?
 * - .shownIn — What a slot's chart shows by its own attributes.
 * - .tellView — Tell each component in one scope its view again, and nothing more.
 * - .drawBarsBehind — Draw each bar over one scope that does not hold what the scope holds now: a scope two bars draw — a strip and…
 * - .drawEveryBar — Draw every bar over one scope each; settles when all have drawn.
 * - .drawScopesSoon — Draw each control over several scopes WHOLE, once per moment.
 * - .supersede — Tell each control below the View the fields the View holds, each with its answer there.
 * - .syncPending — Tell each control over a scope its pending fields and whether it is dirty.
 * - .debug — Each bind, for a bug report.
 * - tagOf — A bound control's tag, where it is an element.
 */
import { VIEW, type Presentation } from './query.js';
import { andFilter, filterRows, filterWithout, type Filter, type Row } from './store.js';
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
  /** See AttachFacts.fields. */
  fields?: readonly string[];
  /** See AttachFacts.free. */
  free?: readonly string[];
  /** See AttachFacts.shows. */
  shows?: Presentation;
  /** See AttachFacts.stacks. */
  stacks?: boolean;
  /** See AttachFacts.arranges. */
  arranges?: boolean;
  /** Where its view, rows and pending fields go. */
  sink: BindSink;
}

/** What the binding asks its source, live, at each push and draw. */
export interface BindHost {
  /** One scope, as a bar or panel draws it. */
  describe(scope: string): ScopeDescription;
  /** A scope's reader-facing name. */
  scopeLabel(scope: string): string;
  /** The clock its relative dates read. */
  now(): Date;
  /** Each declared part's scope. */
  partScopes(): Iterable<string>;
  /** The view state every bound component is pushed. */
  view(): BoundView;
  /** The rows a bind is under: the page, or every row. */
  rows(which: 'page' | 'all'): readonly Row[];
  /** Every row under the View less its clauses on these fields. TODO 479 */
  freeRows(fields: readonly string[]): readonly Row[];
  /** A field's picks in force on one component. TODO 479 */
  pickedFor(el: BoundControl, field: string): string[];
  /** What narrows one bound component alone, by its id. */
  only(id: string): Filter | undefined;
  /** A component scope's own answer. */
  scoped(scope: string): Filter | undefined;
  /** What the highlight's driver matches, where it reaches a component `el` in `scope`. */
  highlight(scope?: string | readonly string[], el?: object): Filter | undefined;
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
      ...(facts.fields ? { fields: [...facts.fields] } : {}),
      ...(facts.free?.length ? { free: [...facts.free].sort() } : {}),
      ...(facts.shows ? { shows: facts.shows } : {}),
      ...(facts.stacks ? { stacks: true } : {}),
      ...(facts.arranges ? { arranges: true } : {}),
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

  /** The fields the bound components read from a row, or null — one given rows
   *  names none, so it reads every field. TRAP T-a-held-set-reads-the-pages-fields */
  fieldsRead(): Set<string> | null {
    const out = new Set<string>();
    for (const { steerOnly, fields } of this.#bound.values()) {
      if (steerOnly) continue;
      if (!fields) return null;
      for (const f of fields) out.add(f);
    }
    return out;
  }

  /** Each set of fields a bind is free of, once. TRAP T-a-chart-is-free-of-its-own-field */
  freeSets(): string[][] {
    const sets = new Map<string, string[]>();
    for (const entry of this.#bound.values()) if (entry.free) sets.set(entry.free.join('\n'), [...entry.free]);
    return [...sets.values()];
  }

  /** Is any bind asking for the unpaged set? TRAP T-a-summary-binds-to-all-the-rows */
  wantsAllRows(): boolean {
    for (const entry of this.#bound.values()) if (entry.rows === 'all') return true;
    return false;
  }

  /** The tag of the first component drawn rows in a scope. TRAP T-a-scope-says-what-it-shows */
  componentOf(scope: string): string | undefined {
    return tagOf([...this.#bound].find(([, b]) => b.scope === scope && !b.steerOnly)?.[0]);
  }

  /** Is a page of rows drawn in this scope — or a pivot of them? TODOs 341, 574 */
  pagedIn(scope: string): boolean {
    return [...this.#bound.values()].some((b) => b.scope === scope && !b.steerOnly && (b.rows === 'page' || b.arranges));
  }

  /** Does a chart draw a summary in this scope — is it a SLOT? Not a grid's pivot. Will, TODOs 548, 574 */
  presentsIn(scope: string): boolean {
    return [...this.#bound.values()].some((b) => b.scope === scope && b.rows === 'all' && b.readonly && !b.arranges);
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
    // FREE of a field, its rows are the View's less that field's clauses. TRAP T-a-chart-is-free-of-its-own-field
    const free = entry.free ? new Set(entry.free) : undefined;
    const base = entry.free ? this.#host.freeRows(entry.free) : this.#host.rows(entry.rows);
    /* What narrows THIS component alone, on top of the shared query — and, for
       a summary bound INTO a component scope, that scope's answer.
       TRAP T-a-component-part-narrows-one-component */
    const into = entry.rows === 'all' && typeof entry.scope === 'string' ? this.#host.scoped(entry.scope) : undefined;
    const narrows = andFilter([this.#host.only(entry.id), into].filter((f): f is Filter => !!f));
    const own = free ? filterWithout(narrows, free) : narrows;
    // …and the highlight, which moves no row; and a free field's picks, which light it. TODO 441, 479
    const lit = entry.free?.map((f) => this.#host.pickedFor(el, f)) ?? null;
    const ownKey = JSON.stringify([own ?? null, this.#host.highlight(entry.scope, el) ?? null, lit]);
    if (entry.lastRows === base && entry.lastOwn === ownKey) return;
    entry.lastRows = base;
    entry.lastOwn = ownKey;
    entry.sink.rows(own ? filterRows(base, own, this.#host.now()) : base);
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

  /** Does a slot's chart stack by a Secondary — a bar chart? TODO 548 */
  stacksIn(scope: string): boolean {
    return [...this.#bound.values()].some((b) => b.scope === scope && b.stacks);
  }

  /** What a slot's chart shows by its own attributes. TODO 548 */
  shownIn(scope: string): Presentation {
    return [...this.#bound.values()].find((b) => b.scope === scope && b.shows)?.shows ?? {};
  }

  /** Tell each component in one scope its view again, and nothing more. TODO 548 */
  tellView(scope: string): void {
    for (const { scope: s, sink } of this.#bound.values()) if (s === scope) sink.view(this.#host.view());
  }

  /** Draw each bar over one scope that does not hold what the scope holds now:
   *  a scope two bars draw — a strip and a column's section — changed through
   *  one of them. TRAP T-two-bars-over-one-scope */
  drawBarsBehind(scope: string): void {
    const held = this.#host.describe(scope).filters.map((f) => f.id).join();
    for (const [el, { scope: s }] of this.#bound) {
      if (s !== scope || !el.drawScope || el.heldFields?.join() === held) continue;
      void el.drawScope(...this.#slice(scope));
    }
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
   * Tell each control below the View the fields the View holds now, each with its
   * answer there. A bar keeps its chip, suspended, and says where it went; a grid
   * shows the answer in its heading, read-only, so it cannot be contradicted.
   * TRAP T-a-view-held-heading-shows-and-refuses
   * TRAP T-a-superseded-chip-suspends-it-is-never-removed
   * TRAP T-an-inactive-chip-says-where-its-filter-went
   */
  supersede(held: Readonly<Record<string, FieldReading>>): void {
    for (const [el, { scope }] of this.#bound) {
      if (typeof scope === 'string' && scope !== VIEW) el.supersede?.(held, this.#host.scopeLabel(VIEW));
    }
  }

  /**
   * Tell each bound control over a scope which of its fields are PENDING
   * (`data-pending`, a field list), whether its scope is DIRTY (`data-dirty`),
   * whether it WAITS for Apply (`data-waits`), and which FAILED (`data-failed`). Attributes, as the rest of its state arrives.
   * TRAP T-push-writes-state-as-attributes
   */
  syncPending(
    fieldsOf: (scopes: string[]) => string[], dirty: (scope: string) => boolean, waits: (scope: string) => boolean,
    failed: (scopes: string[]) => string[], applied: (scopes: string[], fields: readonly string[]) => Record<string, FieldReading>,
  ): void {
    for (const [, { scope, sink }] of this.#bound) {
      if (!scope) continue;
      const scopes = typeof scope === 'string' ? [scope] : [...scope];
      const fields = fieldsOf(scopes);
      sink.pending(fields, scopes.some((id) => dirty(id)), scopes.some((id) => waits(id)), failed(scopes), applied(scopes, fields));
    }
  }

  /** Each bind, for a bug report. */
  debug(): Array<{ id: string; rows: 'page' | 'all'; readonly: boolean; steerOnly: boolean }> {
    return [...this.#bound.values()].map((e) => ({
      id: e.id, rows: e.rows, readonly: e.readonly, steerOnly: e.steerOnly,
    }));
  }
}

/** A bound control's tag, where it is an element, and its `data-type` where it
 *  has one — `sherpa-radial-chart:pie`, so a panel names a swapped chart. No DOM:
 *  it is only read. Will, TODO 548 */
export function tagOf(control: unknown): string | undefined {
  const el = control as { localName?: unknown; getAttribute?: (name: string) => string | null } | undefined;
  if (typeof el?.localName !== 'string') return undefined;
  const type = el.getAttribute?.('data-type');
  return type ? `${el.localName}:${type}` : el.localName;
}
