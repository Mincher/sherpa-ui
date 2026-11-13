/**
 * query-context.ts — the Query of one app Context, and what its page declares
 * about it. Every source over the page joins it, so there is one Query.
 * DOM-free. TRAP T-one-query-one-owner · TRAP T-a-context-holds-the-only-query
 *
 * Its parts: query-declarations (what the page declares), query-members (the
 * sources that share it, and what each hears), query-edits (each edit, pure).
 *
 * Map:
 * - QueryChangeDetail — What `query-change` says: the fields whose answers moved, and the scopes whose holds or arrangement did.
 * - QueryContext — The Query of one app Context, shared by every source in it. Fires `query-change`.
 * - .applied — The Query the rows are under. A copy.
 * - .draft — What the reader is editing. A copy.
 * - .ask — THE door every edit to the Query goes through, whoever asks; a list is one change.
 * - .remote — Does any member's store wait for Apply?
 * - .members — How many sources share this Query.
 * - .reading — One scope's reading of one field, or undefined. The Query's own, frozen.
 * - .scope — The fields a scope holds, in order — hold()'s read-back.
 * - .scopes — Every scope that holds a field, by id.
 * - .holds — Is this field held HERE?
 * - .scopeOf — Which scope holds this field, or null.
 * - .fields — The fields a scope may hold.
 * - .canHold — May this scope hold this field?
 * - .declareStart — declareStart(scope, readings) — a scope's answers at the start, as its page defines them: in force now, what…
 * - .defaultFor — A component's own default, as `declareDefault` left it — not its answer now.
 * - .partFacts — What `declarePart` was told for this scope, or undefined.
 * - .scopeFacts — What `declareScope` was told — not the fallbacks `scopeLabel()` and `arranges()` answer with.
 * - .scopeLabel — A scope's name as a reader sees it, or its id.
 * - .arranges — Does Group and Sort arrange this scope's rows?
 * - .sets — A scope's filter sets, as declared.
 * - .waiting — Does this scope — or, naming none, any — wait for Apply?
 * - .wait — This scope's answers wait for Apply, local or remote.
 * - .named — Did `wait()` name this scope? Its bar holds ONE Apply for it.
 * - .pending — Has this field been changed and not yet applied?
 * - .dirty — Has anything in this scope — or any scope — been changed and not applied?
 * - .declarePart — Declare a PART: one field that narrows one component — a chart's legend field.
 * - .declareScope — Name a scope as a reader sees it, and say if it arranges.
 * - .declareSets — A scope's filter sets, in order.
 * - .declareFixed — The fields of a scope a reader cannot remove, and those a reader cannot switch off, by any door.
 * - .fixed — A scope's fixed fields, in order — `declareFixed()`'s read-back.
 * - .alwaysOn — A scope's fields always on — `declareFixed()`'s read-back.
 * - .offer — Say which fields a component scope HAS.
 * - .declareDefault — A component's OWN default filter — readings that narrow `only` it — as its scope in the Query.
 * - .soloed — The filter soloed in this tab, if one is.
 * - .declarePresets — A scope's presets: the app's own named conditions, each a boolean chip.
 * - .presets — A scope's presets, in order: each its id, its name and the readings it writes.
 * - .presetOn — Is this preset on: every row it writes still in its field's answer, in force?
 * - .presetsOver — The scopes whose presets write this field: its answer moving moves their on.
 * - .presentation — A slot's presentation, as kept: a copy; none, an empty one.
 * - .declarePresentation — What its page DEFINES a slot shows — a chart's two fields — under what is kept.
 * - .presented — A slot's presentation as shown: what is kept, over its definition; or its definition alone.
 * - .declareAxes — What each axis's chip offers — the page's, or a scope's over it.
 * - .axesOf — What each axis offers in a scope's view: the page's, its view's, the scope's, then the scope's view's.
 * - .honour — Which picks are in force: `kind` (Show as), `axes` (Primary, Secondary). Off, kept, not shown.
 * - .honours — Is that kind of pick in force?
 * - .setQuery — Restore a whole Query — a reload, a View, a saved filter.
 * - .resolved — The Query a given one would be once put in, applying nothing: one door for every put-in.
 * - .restoreDraft — Put a draft back as an Undo leaves it, and leave what is applied.
 * - .startWith — The answer a field opens on where nothing answers it — a fetching list's first value.
 * - .export — The whole question as JSON — the Query as applied.
 * - .import — Take a question back in, exactly.
 * - .join — A source joins: it gets its handle.
 */
import type { FilterSet, QueryState } from './data-source-types.js';
import {
  arrangementOf, copyQuery, emptyScope, freezeReading, namedArrangement, sameAnswer, VIEW,
  type AxesDefinition, type AxisOffers, type Presentation, type PresentationDefinition, type Query, type QueryDefaults,
  type QueryRequest,
} from './query.js';
import { QueryDeclarations, type QueryPart } from './query-declarations.js';
import { QueryMembers, type QueryChange, type QueryHandle, type QueryLive, type QueryMember } from './query-members.js';
import {
  answerIn, commitScope, definitionOf, editCopies, holderOf, holdsField, keepOff, presetIn, rehome, writeScope,
  type Copies, type CopyFacts, type Edited, type Solo,
} from './query-edits.js';
import { readingsOf, type Where } from './where.js';
import type { FieldReading } from './filter-state.js';
import { report } from './report.js';

/** What `query-change` says: the fields whose answers moved, and the scopes
 *  whose holds or arrangement did — and, for a whole Query put on, who put it:
 *  `by` is the caller's own tag, which a keeper reads. 366 step 24 */
export interface QueryChangeDetail {
  fields: string[];
  scopes: string[];
  by?: string;
}

/** The page requests in a request, in order: no edit, they go to the source that pages. */
function pagesOf(request: QueryRequest): Array<{ scope?: string } & ({ page: number } | { pageSize: number })> {
  if (Array.isArray(request)) return (request as readonly QueryRequest[]).flatMap(pagesOf);
  const one = request as Exclude<QueryRequest, readonly QueryRequest[]> | null;
  // No object is no page: the edit reports it. TODO 718
  return one && typeof one === 'object' && ('page' in one || 'pageSize' in one) ? [one] : [];
}

/** Every reading in a copy, frozen: what a control is handed cannot change it.
 *  TRAP T-a-reading-is-frozen-in-the-query */
function frozen(query: Query): void {
  for (const scope of Object.values(query.scopes)) for (const r of Object.values(scope.readings)) freezeReading(r);
}

/**
 * The Query of one app Context, shared by every source in it. Each edit is
 * made on copies; the new Query is put in place, every member is told once,
 * and ONE `query-change` fires. 366 step 17 · TRAP T-one-query-one-owner
 */
export class QueryContext extends EventTarget {
  /** The one Query, and the declarations a member reads. */
  readonly #live: QueryLive;
  /** What the page declares about its Query. */
  readonly #decl = new QueryDeclarations();
  /** Every source that joined. */
  readonly #members = new QueryMembers();

  constructor() {
    super();
    const applied: Query = { v: 1, scopes: {} };
    const { defaults, starts, sets, offers, parts } = this.#decl;
    this.#live = { applied, draft: applied, defaults, starts, sets, offers, parts };
  }

  /** The Query the rows are under. A copy. */
  get applied(): Query {
    return structuredClone(this.#live.applied);
  }

  /** What the reader is editing. A copy. */
  get draft(): Query {
    return structuredClone(this.#live.draft);
  }

  /**
   * ask(request) — THE door every edit to the Query goes through: a control's, the
   * node editor's, an agent's. The edit is pure (`editCopies`); its Query is put
   * in place and every member told once. A list is ONE change: one `query-change`,
   * one Apply. A hover is the page's, never the Query's: it is passed by.
   * TRAP T-one-command-one-door · TRAP T-one-query-one-owner
   */
  ask(request: QueryRequest): void {
    const pages = pagesOf(request);
    if (!Array.isArray(request) && pages.length) {
      this.#members.page(pages[0]!);
      return;
    }
    this.#apply(editCopies(this.#copies(), request, this.#facts()));
    for (const page of pages) this.#members.page(page);
  }

  /** The copies an edit starts from: the Query, and this tab's solo. */
  #copies(): Copies {
    return { applied: this.#live.applied, draft: this.#live.draft, solo: this.#soloing };
  }

  /** What an edit needs that the copies do not say: the members and the declarations. */
  #facts(): CopyFacts {
    return {
      remote: this.remote, named: this.#waiting, parts: this.#decl.parts, offers: this.#decl.offers,
      presets: (scope) => this.#decl.presets(scope),
      opens: (scope) => this.#decl.opens(scope),
      fixed: (scope) => this.#decl.fixed(scope),
      alwaysOn: (scope) => this.#decl.alwaysOn(scope),
      knows: (field) => this.#members.knows(field),
      bound: (id) => this.#members.bound(id),
      presents: (scope) => this.#members.presentsIn(scope),
      theirs: (scope) => this.#members.theirs(scope),
    };
  }

  /** Put an edit's Query in place — its readings frozen — then tell every member
   *  what it said, once, and the page in one `query-change`. */
  #apply(edited: Edited): void {
    frozen(edited.applied);
    if (edited.draft !== edited.applied) frozen(edited.draft);
    this.#live.applied = edited.applied;
    this.#live.draft = edited.draft;
    this.#soloing = edited.solo;
    this.#tell(edited.said);
  }

  /** Does any member's store wait for Apply? */
  get remote(): boolean {
    return this.#members.remote;
  }

  /** How many sources share this Query. */
  get members(): number {
    return this.#members.size;
  }

  /** One scope's reading of one field, or undefined. The Query's own, frozen.
   *  TRAP T-a-reading-is-frozen-in-the-query */
  reading(scope: string, field: string): FieldReading | undefined {
    const held = this.#live.draft.scopes[scope]?.readings[field];
    return held ? freezeReading(held) : undefined;
  }

  /** The fields a scope HOLDS, in order — `hold()`'s read-back. A copy. A scope is
   *  a named place a filter lives. TRAP T-a-scope-is-a-place-not-a-reach */
  scope(name: string): string[] {
    return [...(this.#live.draft.scopes[name]?.holds ?? [])];
  }

  /** Every scope that holds a field, by id — `scope()` reads one of them. */
  get scopes(): string[] {
    return Object.keys(this.#live.draft.scopes).filter((id) => this.#live.draft.scopes[id]!.holds.length);
  }

  /** Is this field held HERE? */
  holds(name: string, field: string): boolean {
    return holdsField(this.#live.draft, name, field);
  }

  /**
   * Which scope holds this field, or null — the View first, when it does.
   *
   * This is what SUPERSEDING is: a field the view scope holds is not the data
   * bar's to narrow, and neither bar has to know the other is there.
   */
  scopeOf(field: string): string | null {
    return holderOf(this.#live.draft, field);
  }

  /**
   * The fields a scope may hold. A COMPONENT's are its own; the VIEW's are
   * every component's, because any field may be raised to narrow everything.
   */
  fields(name: string): string[] {
    return this.#decl.fields(name);
  }

  /** May this scope hold this field? Up is open; down is closed. TRAP T-up-is-open-down-is-closed */
  canHold(name: string, field: string): boolean {
    return this.#decl.canHold(name, field);
  }

  /**
   * declareStart(scope, readings) — a scope's answers at the start, as its page
   * defines them: in force now, what Reset to default puts back, and where a View
   * or a restore that does not name the scope starts it. Unlike a component's
   * own default, the scope stays the reader's. Will, TODO 464.
   * TRAP T-a-page-scope-starts-with-its-answers
   */
  declareStart(scope: string, readings: Readonly<Record<string, FieldReading>>): void {
    const edited = writeScope(this.#copies(), scope, readings, this.#facts());
    const written = edited.draft.scopes[scope];
    if (written) {
      const start = structuredClone(written);
      for (const r of Object.values(start.readings)) freezeReading(r);
      this.#decl.starts.set(scope, Object.freeze(start));
    }
    this.#apply(edited);
  }

  /** A component's own default, as `declareDefault` left it, or undefined — not
   *  its answer now, which `reading()` reads. Frozen. TRAP T-a-reading-is-frozen-in-the-query */
  defaultFor(scope: string): Readonly<Record<string, FieldReading>> | undefined {
    return this.#decl.defaults.get(scope)?.readings;
  }

  /** What `declarePart` was told for this scope, or undefined. `only` is the bind id of its component. */
  partFacts(scope: string): QueryPart | undefined {
    const part = this.#decl.parts.get(scope);
    return part ? { ...part } : undefined;
  }

  /** What `declareScope` was told — not the fallbacks `scopeLabel()` and `arranges()` answer with. */
  scopeFacts(scope: string): { label?: string; arranges?: boolean } {
    const label = this.#decl.labels.get(scope);
    const arranges = this.#decl.arranges.get(scope);
    return { ...(label != null ? { label } : {}), ...(arranges != null ? { arranges } : {}) };
  }

  /** A scope's name as a reader sees it, or its id. */
  scopeLabel(scope: string): string {
    return this.#decl.labels.get(scope) ?? scope;
  }

  /** Does Group and Sort arrange this scope's rows? As declared — else a
   *  component scope a page of rows is drawn in does, and the View does not.
   *  Will, TODO 99. TRAP T-group-and-sort-are-component-scope */
  arranges(scope: string): boolean {
    return this.#decl.arranges.get(scope) ?? (scope !== VIEW && this.#members.pagedIn(scope));
  }

  /** A scope's filter sets, as declared. */
  sets(scope: string): FilterSet[] {
    return structuredClone(this.#decl.sets.get(scope) ?? []);
  }

  /** Does this scope — or, naming none, any — wait for Apply? A remote member's
   *  do; a local one's, once `wait()` named it. TODO 406 */
  waiting(scope?: string): boolean {
    return this.remote || (scope ? this.#waiting.has(scope) : this.#waiting.size > 0);
  }

  /**
   * wait(scope) — this scope's answers wait for Apply, local or remote: a write
   * lands in the draft, and `commit()` sends it. The app waits its View, so no
   * pick fetches until the reader asks. `false` sends what waits. TODO 406
   * TRAP T-apply-and-discard-wait-for-a-change
   */
  wait(scope: string, on = true): void {
    if (on === this.#waiting.has(scope)) return;
    if (!on) {
      this.#apply(commitScope(this.#copies(), scope, this.#facts()));
      this.#waiting.delete(scope);
      if (!this.#waiting.size && !this.remote) this.#live.draft = this.#live.applied;
      // Told AFTER: the commit's drawing still said it waits. TODO 436
      this.#tell([{ kind: 'drawn', fields: [], pending: true }]);
      return;
    }
    this.#waiting.add(scope);
    if (this.#live.draft === this.#live.applied) this.#split();
    this.#tell([{ kind: 'drawn', fields: [], pending: true }]);
  }

  /** The draft becomes a copy of what is applied: an Apply sends it. */
  #split(): void {
    this.#live.draft = copyQuery(this.#live.applied);
    frozen(this.#live.draft);
  }

  /** Did `wait()` name this scope? Its bar holds ONE Apply for it; a remote
   *  scope it did not name keeps each menu's own. TODO 406 */
  named(scope: string): boolean {
    return this.#waiting.has(scope);
  }

  /** The scopes `wait()` named. */
  readonly #waiting = new Set<string>();

  /** Has this field been changed and not yet applied? Never, where nothing waits. */
  pending(field: string): boolean {
    if (!this.waiting()) return false;
    return !sameAnswer(answerIn(this.#live.applied, field), answerIn(this.#live.draft, field));
  }

  /** Has anything in this scope — or in any scope — been changed and not applied?
   *  Field by field, as `pending` reads: the order they were written in is no change. */
  dirty(scope?: string): boolean {
    if (!this.waiting()) return false;
    const { applied, draft } = this.#live;
    const ids = scope ? [scope] : [...new Set([...Object.keys(applied.scopes), ...Object.keys(draft.scopes)])];
    return ids.some((id) => {
      const was = applied.scopes[id]?.readings ?? {};
      const now = draft.scopes[id]?.readings ?? {};
      return [...new Set([...Object.keys(was), ...Object.keys(now)])].some((f) => !sameAnswer(was[f], now[f]));
    });
  }

  /**
   * Declare a PART — the scope of ONE field that narrows ONE component, a
   * chart's legend field — so a panel draws it before it is answered, and a
   * write to it from anywhere narrows that component. `undefined` forgets it.
   * TRAP T-a-chart-scope-is-its-legend-field
   */
  declarePart(scope: string, part: QueryPart | undefined): void {
    const left = this.#decl.part(scope, part);
    this.#tell([{ kind: 'part', scope, ...(part ? { field: part.field } : {}), ...(left ? { left } : {}) }]);
  }

  /** Name a scope as a reader sees it — a panel's section, an Add list's note — and say if it arranges. */
  declareScope(scope: string, facts: { label?: string; arranges?: boolean }): void {
    if (facts.label != null) this.#decl.labels.set(scope, facts.label);
    if (facts.arranges != null) this.#decl.arranges.set(scope, facts.arranges);
  }

  /** A scope's filter sets, in order. A field is in one set at most; a second
   *  is left out, and said. TRAP T-a-filter-set-groups-or-chains */
  declareSets(scope: string, sets: readonly FilterSet[]): void {
    this.#decl.setSets(scope, sets);
    this.#tell([{ kind: 'sets', scope }]);
  }

  /**
   * declareFixed(scope, { fixed, alwaysOn }) — the fields of a scope a reader cannot
   * REMOVE, and those a reader cannot switch OFF, by any door: each refused is said.
   * Declared before the scope holds them. Will, TODO 703 · TRAP T-a-fixed-field-stays-held
   */
  declareFixed(scope: string, facts: { fixed?: readonly string[]; alwaysOn?: readonly string[] }): void {
    this.#decl.setFixed(scope, facts);
  }

  /** A scope's fixed fields, in order — `declareFixed()`'s read-back. */
  fixed(scope: string): string[] {
    return [...this.#decl.fixed(scope)];
  }

  /** A scope's fields always on — `declareFixed()`'s read-back. */
  alwaysOn(scope: string): string[] {
    return [...this.#decl.alwaysOn(scope)];
  }

  /** Say which fields a component scope HAS. The view needs none: up is open. */
  offer(name: string, fields: readonly string[]): void {
    if (this.#decl.offer(name, fields)) this.#tell([{ kind: 'offer', scope: name }]);
  }

  /**
   * A component's OWN default filter — readings that narrow `only`, its bind id — as its
   * scope in the Query. It is put back under any Query that does not name that
   * scope, so a View pick keeps it; `undefined` forgets it and its scope.
   * TRAP T-a-component-default-outlives-a-view
   */
  declareDefault(
    scope: string,
    readings: Readonly<Record<string, FieldReading>> | undefined,
    at: { only?: string } = {},
  ): void {
    const was = this.#live.draft.scopes[scope]?.readings ?? {};
    const gone = Object.fromEntries(Object.keys(was).filter((f) => !readings || !(f in readings)).map((f) => [f, undefined]));
    if (!readings) {
      this.#decl.defaults.delete(scope);
      this.#apply(writeScope(this.#copies(), scope, gone, this.#facts()));
      return;
    }
    // Its OWN before its members compile, so a View-held field cannot set it aside.
    this.#decl.defaults.set(scope, emptyScope());
    const edited = writeScope(this.#copies(), scope, { ...gone, ...readings }, this.#facts(), at);
    const written = edited.draft.scopes[scope];
    if (written) {
      const own = structuredClone(written);
      for (const r of Object.values(own.readings)) freezeReading(r);
      this.#decl.defaults.set(scope, Object.freeze(own));
    } else this.#decl.defaults.delete(scope);
    this.#apply(edited);
  }

  /** The filter soloed in this tab, and every answer the solo switched off. Never
   *  saved, never exported. Will, TODO 690 */
  #soloing: Solo | null = null;

  /** The filter soloed in this tab, if one is. */
  get soloed(): { scope: string; field: string } | null {
    return this.#soloing ? { scope: this.#soloing.scope, field: this.#soloing.field } : null;
  }

  /**
   * declarePresets(scope, presets) — a scope's PRESETS: the app's own named
   * conditions, each a boolean chip that writes them into the fields. TODO 493, 510
   */
  declarePresets(scope: string, presets: readonly { id: string; label: string; readings: Readonly<Record<string, FieldReading>>; on?: boolean }[]): void {
    this.#decl.setPresets(scope, presets);
    this.#tell([{ kind: 'preset', scope }]);
  }

  /** A scope's presets, in order: each its id, its name and the readings it writes. */
  presets(scope: string): { id: string; label: string; readings: Readonly<Record<string, FieldReading>> }[] {
    return [...this.#decl.presets(scope)].map(([id, p]) => ({ id, label: p.label, readings: p.readings }));
  }

  /** Is this preset ON: its rows held on every field it names, in force — the
   *  draft's, or with `applied`, what the rows are under. TODOs 510, 521 */
  presetOn(scope: string, id: string, applied = false): boolean {
    return presetIn(applied ? this.#live.applied : this.#live.draft, scope, id, this.#decl.presets(scope).get(id));
  }

  /** The scopes whose presets write this field: its answer moving moves their on. */
  presetsOver(field: string): string[] {
    return this.#decl.presetsOver(field);
  }

  /** A slot's presentation, as kept: a copy; none, an empty one. TODO 548 */
  presentation(scope: string): Presentation {
    return { ...this.#live.applied.scopes[scope]?.presentation };
  }

  /** What its page DEFINES a slot shows — and a default per view, its grid's and
   *  its charts' — under what is kept. Not in the Query: only what the reader
   *  changed is. Will, TODO 548 */
  declarePresentation(scope: string, presentation: PresentationDefinition): void {
    this.#decl.define(scope, presentation);
  }

  /** A slot's presentation as shown in a view: what is kept, over that view's
   *  definition, over the slot's. The reader's pick wins. `kept` false: the
   *  definition alone, what Default picks. Will, TODOs 548, 572 */
  presented(scope: string, view?: 'grid' | 'chart', kept = true): Presentation {
    return this.#decl.presented(scope, view, kept ? this.presentation(scope) : null);
  }

  /** What each axis's chip offers — the page's, or a scope's over it. Not in the
   *  Query: no reader changes it. Will, TODO 660 */
  declareAxes(axes: AxesDefinition, scope?: string): void {
    this.#decl.setAxes(axes, scope);
  }

  /** What each axis offers in a scope's view: the page's, its view's, the scope's,
   *  then the scope's view's — the last to name an axis wins it whole. Will, TODO 660 */
  axesOf(scope: string, view: 'grid' | 'chart'): AxisOffers {
    return this.#decl.axesOf(scope, view);
  }

  /** Which of the reader's picks are in force — off, one is KEPT and not shown:
   *  `kind` Show as's, `axes` the Primary and Secondary chips'. The app's setting.
   *  Will, TODOs 582, 583 */
  honour(picks: 'kind' | 'axes', on: boolean): void {
    if (!this.#decl.honour(picks, on)) return;
    const shown = Object.entries(this.#live.applied.scopes).flatMap(([scope, entry]) => (entry?.presentation ? [scope] : []));
    if (shown.length) this.#tell(shown.map((scope) => ({ kind: 'presented', scope })));
  }

  /** Is that kind of pick in force? */
  honours(picks: 'kind' | 'axes'): boolean {
    return this.#decl.honours(picks);
  }

  /**
   * Restore a whole Query — a reload, a trip away and back, a View's own
   * defaults. Resolves once every member has drawn it.
   *
   * `holds: 'keep'` — a View: a scope the definition gives no `holds` keeps
   * the chips it has, and every answer is a clean slate. `by` rides on the
   * `query-change` it fires. `lay` edits the whole Query before it goes on: the
   * App Context's answer over the View (TODO 453).
   * TRAP T-one-query-one-owner · TRAP T-a-reload-replays-the-readers-answers · TRAP T-a-view-is-json
   */
  async setQuery(
    query: Query | QueryDefaults, options: { holds?: 'keep'; by?: string; lay?: (query: Query) => void } = {},
  ): Promise<void> {
    if (query?.v !== 1 || typeof query.scopes !== 'object') {
      report({ code: 'unknown-query', message: 'setQuery: not a v1 Query, so nothing was restored.' });
      return;
    }
    // A whole Query put in — a View, a draft — ends a solo. TODO 690
    this.#soloing = null;
    const next = this.resolved(query, options.holds === 'keep', this.#live.draft, options.lay);
    const was = arrangementOf(this.#live.applied);
    const before = this.#answered();
    this.#live.applied = next;
    if (this.waiting()) this.#split();
    else this.#live.draft = next;
    await this.#members.hear([{ kind: 'query', was, before }]);
    this.#announce({
      fields: [...new Set([...before, ...this.#answered()])], scopes: this.scopes, ...(options.by ? { by: options.by } : {}),
    });
  }

  /**
   * The Query a given one would be once put in, applying nothing: its definition (`keep`, a View's), `lay`'s edit, a
   * fixed field kept (TODO 703), the opens filled, each answer at its home (TODO 612), and an answer in a scope switched
   * off kept off; frozen. ONE door for a restore, a View, an Undo and a Reset's test, so they cannot drift.
   * TRAP T-reset-to-default-is-the-views-own · TRAP T-the-filter-switch-keeps-what-it-turned-off
   */
  resolved(given: Query | QueryDefaults, keep: boolean, base: Query = this.#live.draft, lay?: (query: Query) => void): Query {
    const next = definitionOf(given, keep, base, {
      defaults: this.#decl.defaults,
      starts: this.#decl.starts,
      readingsOf: (where) => this.#readingsOf(where),
      carriesOver: (f) => this.#members.knows(f)?.carriesOver(f) ?? false,
    });
    lay?.(next);
    this.#decl.keepFixed(next);
    this.#decl.fillOpens(next);
    rehome(next);
    keepOff(next, (scope) => this.#decl.alwaysOn(scope));
    frozen(next);
    return next;
  }

  /**
   * Put a DRAFT back as an Undo or Redo leaves it, and leave what is applied: where a scope waits
   * for Apply, the pending difference moves and the rows do not. Resolves once every member has
   * drawn it. Where nothing waits the draft is the Query, so it is `setQuery`.
   */
  async restoreDraft(draft: Query, options: { by?: string } = {}): Promise<void> {
    if (!this.waiting()) return this.setQuery(draft, options);
    if (draft?.v !== 1 || typeof draft.scopes !== 'object') {
      report({ code: 'unknown-query', message: 'restoreDraft: not a v1 Query, so nothing was restored.' });
      return;
    }
    const next = this.resolved(draft, false, this.#live.draft);
    const was = this.#live.draft;
    const fields = new Set([...this.#answered()]);
    this.#live.draft = next;
    for (const f of this.#answered()) fields.add(f);
    const scopes = new Set([...Object.keys(was.scopes), ...Object.keys(next.scopes)]);
    this.#tell([
      { kind: 'drawn', fields: [...fields], pending: true },
      ...[...scopes].flatMap((scope): QueryChange[] => [{ kind: 'hold', scope, moved: [...new Set([...(was.scopes[scope]?.holds ?? []), ...(next.scopes[scope]?.holds ?? [])])] }, { kind: 'bars', scope }]),
    ]);
  }

  /**
   * The answer a field OPENS on where nothing answers it — a fetching list's
   * first value. A restore, a View or a Reset that leaves it unanswered puts it
   * back. Will, TODO 403 · TRAP T-a-fetching-list-opens-on-its-first-value
   */
  startWith(scope: string, field: string, reading: FieldReading): void {
    this.#decl.setOpen(scope, field, reading);
    // Taken now, in place: it is how the page opens, not a change to it.
    for (const query of new Set([this.#live.applied, this.#live.draft])) {
      this.#decl.fillOpens(query);
      keepOff(query, (scope) => this.#decl.alwaysOn(scope));
      frozen(query);
    }
  }

  /** The whole question as JSON — the Query as applied, with its arrangement.
   *  TRAP T-a-page-goes-out-as-json */
  export(): QueryState {
    const query = structuredClone(this.#live.applied);
    // A solo is this tab's draft: what it switched off is saved on. TODO 690
    for (const { scope, field } of this.#soloing?.off ?? []) {
      const reading = query.scopes[scope]?.readings[field];
      if (reading?.suspended) delete reading.suspended;
    }
    return { v: 1, query: namedArrangement(query) };
  }

  /** Take a question back in, exactly. */
  async import(state: QueryState): Promise<void> {
    if (state?.v !== 1) {
      report({ code: 'unknown-state', message: 'import: not a v1 query state, so nothing was taken in.' });
      return;
    }
    await this.setQuery(state.query);
  }

  /** A View's plain conditions as readings: each field by the member that knows it. */
  #readingsOf(where: Where): Record<string, FieldReading> {
    const out: Record<string, FieldReading> = {};
    for (const [field, condition] of Object.entries(where)) {
      Object.assign(out, this.#members.knows(field)?.readingsOf({ [field]: condition }) ?? readingsOf({ [field]: condition }));
    }
    return out;
  }

  /** Every field the draft answers. */
  #answered(): string[] {
    return Object.values(this.#live.draft.scopes).flatMap((s) => Object.keys(s.readings));
  }

  /** Each member hears what the context did, at once, in the order they joined;
   *  then, if a field's answer or a scope's holds moved, the page is told ONCE. */
  #tell(changes: readonly QueryChange[]): void {
    if (!changes.length) return;
    this.#members.tell(changes);
    const said = changes.map((change) => this.#said(change)).filter((d): d is QueryChangeDetail => !!d);
    const fields = [...new Set(said.flatMap((d) => d.fields))];
    const scopes = [...new Set(said.flatMap((d) => d.scopes))];
    // One change says what it says, empty too; several, only what moved.
    if ((said.length && changes.length === 1) || fields.length || scopes.length) this.#announce({ fields, scopes });
  }

  /** What one change tells the page: the fields whose answers moved, the scopes whose holds did. */
  #said(change: QueryChange): QueryChangeDetail | null {
    switch (change.kind) {
      case 'write': case 'select': return { fields: [change.field], scopes: [] };
      case 'drawn': return { fields: change.fields, scopes: [] };
      case 'offer': case 'hold': case 'order': case 'presented': return { fields: [], scopes: [change.scope] };
      case 'move': return { fields: [], scopes: change.scopes };
      case 'arranged': return { fields: [], scopes: this.scopes };
      // An Apply is a change to the page too: what keeps the Query hears it. TODO 406
      case 'commit': return {
        fields: [...new Set([...this.#answered(), ...Object.values(this.#live.applied.scopes).flatMap((sc) => Object.keys(sc.readings))])],
        scopes: [],
      };
      default: return null;
    }
  }

  /** ONE event for anything listening to the Query. */
  #announce(detail: QueryChangeDetail): void {
    this.dispatchEvent(new CustomEvent('query-change', { detail }));
  }

  /** A source joins: it gets its handle. A remote one splits the draft from
   *  `applied` once; a draft that exists is kept. */
  join(member: QueryMember): QueryHandle {
    this.#members.add(member);
    if ((member.remote || this.#waiting.size) && this.#live.draft === this.#live.applied) this.#split();
    return {
      live: () => this.#live,
      walkVersion: () => this.#decl.version,
      pagedIn: (scope) => this.#members.pagedIn(scope),
      bound: (id) => this.#members.bound(id),
      leave: () => { this.#members.delete(member); },
    };
  }
}
