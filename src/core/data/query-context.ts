/**
 * query-context.ts — the Query of one app Context, and what its page declares
 * about it. Every source over the page joins it, so there is one Query.
 * DOM-free. TRAP T-one-query-one-owner · TRAP T-a-context-holds-the-only-query
 *
 * Its parts: query-declarations (what the page declares), query-members (the
 * sources that share it, and what each hears), query-edits (the edits).
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
 * - .startWith — The answer a field opens on where nothing answers it — a fetching list's first value.
 * - .export — The whole question as JSON — the Query as applied.
 * - .import — Take a question back in, exactly.
 * - .join — A source joins: it gets its handle.
 */
import type { BoundControl, FilterSet, QueryState } from './data-source-types.js';
import {
  answerOf, arrangementOf, copyQuery, copyReading, eachScope, emptyScope, freezeReading, readingAnswered, sameAnswer, sameReading, VIEW,
  type AxesDefinition, type AxisOffers, type Presentation, type PresentationDefinition, type Query, type QueryDefaults,
  type QueryRequest, type ScopeQuery,
} from './query.js';
import { QueryDeclarations, type QueryPart } from './query-declarations.js';
import { QueryMembers, type MemberBind, type QueryChange, type QueryHandle, type QueryLive, type QueryMember } from './query-members.js';
import {
  answerIn, copyField, copyScope, definitionOf, editQuery, holderOf, holdsField, homes, isPureEdit, prune, readingOf, rehome,
  copyHolds, sameField, sameScope, scopeEntry, setCameFrom, setReading, slotted, type EditFacts, type PureEdit,
} from './query-edits.js';
import { readingsOf, type Where } from './where.js';
import { valueKey } from './store.js';
import { answerTree, modeOf, withPreset, type FieldReading } from './filter-state.js';
import { report } from './report.js';

/** What `query-change` says: the fields whose answers moved, and the scopes
 *  whose holds or arrangement did — and, for a whole Query put on, who put it:
 *  `by` is the caller's own tag, which a keeper reads. 366 step 24 */
export interface QueryChangeDetail {
  fields: string[];
  scopes: string[];
  by?: string;
}

/** Where an Apply or a Discard reaches: one field, one scope, or every scope. */
function applyAt(at: { scope?: string; field?: string }): { scope?: string; field?: string } {
  return at.field ? { field: at.field } : at.scope ? { scope: at.scope } : {};
}

/** A scope keeps no answer for this field now. */
function forget(scope: ScopeQuery, field: string): void {
  if (!scope.superseded?.[field]) return;
  Reflect.deleteProperty(scope.superseded, field);
  if (!Object.keys(scope.superseded).length) delete scope.superseded;
}

/**
 * The Query of one app Context, shared by every source in it. After each
 * change, once every member has heard it, it fires ONE `query-change`.
 * 366 step 17 · TRAP T-one-query-one-owner
 */
export class QueryContext extends EventTarget {
  /** The one Query, and the declarations a member reads. */
  readonly #live: QueryLive;
  /** What the page declares about its Query. */
  readonly #decl = new QueryDeclarations();
  /** Every source that joined. */
  readonly #members = new QueryMembers();
  /** What a batch has to tell, until it ends. */
  #batched: QueryChangeDetail | null = null;
  /** The Applies a batch asked for: sent at its end, after every edit in it. */
  #applies: Array<{ scope?: string; field?: string }> = [];

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
   * node editor's, an agent's. A list is ONE change: one `query-change`, one Apply.
   * A hover is the page's, never the Query's: it is passed by.
   * TRAP T-one-command-one-door · TRAP T-one-query-one-owner
   */
  ask(request: QueryRequest): void {
    if (Array.isArray(request)) {
      this.#batch(() => { for (const one of request as readonly QueryRequest[]) this.ask(one); });
      return;
    }
    const one = request as Exclude<QueryRequest, readonly QueryRequest[]>;
    const at = one.scope ?? VIEW;
    if ('preview' in one) return;
    if (isPureEdit(one)) this.#edit(one);
    else if ('reset' in one) this.#reset([at], one.reset);
    else if ('preset' in one) this.#setPreset(at, one.preset, one.on, !!one.commit);
    else if ('reading' in one) this.#setReading(at, one.field, one.reading, one.only ? { only: one.only } : {});
    else if ('solo' in one) this.#solo(at, one.solo, { across: !!one.across });
    else if ('unsolo' in one) this.#batch(() => this.#unsolo());
    else if ('page' in one || 'pageSize' in one) this.#members.page(one);
    else if ('hold' in one) this.#hold(at, one.hold);
    else if ('take' in one) this.#take(at, one.take, one.from);
    else if ('release' in one) this.#release(at, one.release);
    else if ('letGo' in one) this.#letGo(at, one.field, one.letGo);
    else if ('discard' in one) this.#discard(applyAt(one));
    else if ('suspended' in one) this.#suspend(at, 'field' in one ? one.field : null, one.suspended);
    // Alone, `commit` is an Apply: one field, one scope, or every scope.
    else {
      this.#commit(applyAt(one));
      return;
    }
    // A preset's own commit applies the fields it moved, and no more.
    if ('commit' in one && one.commit && !('preset' in one)) this.#commit('field' in one ? { field: one.field } : { scope: at });
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

  /** May this scope hold this field? Up is open; down is closed. */
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
    for (const [field, reading] of Object.entries(readings)) this.#write(scope, field, reading);
    const written = this.#live.draft.scopes[scope];
    if (!written) return;
    const start = structuredClone(written);
    for (const r of Object.values(start.readings)) freezeReading(r);
    this.#decl.starts.set(scope, Object.freeze(start));
  }

  /** A component's own default, as `declareDefault` left it, or undefined — not
   *  its answer now, which `reading()` reads. Frozen. TRAP T-a-reading-is-frozen-in-the-query */
  defaultFor(scope: string): Readonly<Record<string, FieldReading>> | undefined {
    return this.#decl.defaults.get(scope)?.readings;
  }

  /** What `declarePart` was told for this scope, or undefined. `only` is the element itself. */
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
      this.#commit({ scope });
      this.#waiting.delete(scope);
      if (!this.#waiting.size && !this.remote) this.#live.draft = this.#live.applied;
      // Told AFTER: the commit's drawing still said it waits. TODO 436
      this.#tell({ kind: 'drawn', fields: [], pending: true });
      return;
    }
    this.#waiting.add(scope);
    if (this.#live.draft === this.#live.applied) this.#live.draft = copyQuery(this.#live.applied);
    this.#tell({ kind: 'drawn', fields: [], pending: true });
  }

  /** Did `wait()` name this scope? Its bar holds ONE Apply for it; a remote
   *  scope it did not name keeps each menu's own. TODO 406 */
  named(scope: string): boolean {
    return this.#waiting.has(scope);
  }

  /** The scopes `wait()` named. */
  readonly #waiting = new Set<string>();

  /** A LOCAL draft: a scope that does not wait is in force at once, and so is
   *  what each scope holds. A remote one keeps its own rule. TODO 406 */
  #settle(): void {
    const { draft, applied } = this.#live;
    if (this.remote || draft === applied) return;
    for (const id of new Set([...Object.keys(draft.scopes), ...Object.keys(applied.scopes)])) {
      if (!this.#waiting.has(id)) copyScope(draft, applied, id);
    }
    copyHolds(draft, applied);
  }

  /** Fields that MOVED scope carry their answer at once, waiting or not.
   *  TRAP T-up-is-open-down-is-closed */
  #carry(fields: readonly string[]): void {
    if (this.remote || this.#live.draft === this.#live.applied) return;
    for (const field of fields) copyField(this.#live.draft, this.#live.applied, field);
  }

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
    this.#tell({ kind: 'part', scope, ...(part ? { field: part.field } : {}), ...(left ? { left } : {}) });
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
    this.#tell({ kind: 'sets', scope });
  }

  /** Say which fields a component scope HAS. The view needs none: up is open. */
  offer(name: string, fields: readonly string[]): void {
    if (this.#decl.offer(name, fields)) this.#tell({ kind: 'offer', scope: name });
  }

  /**
   * Write ONE scope's reading of ONE field — a component's own answer, which no
   * other control shares. `only` makes the scope NARROW that one bound
   * component: a legend's switched-off series filter ITS chart, and nothing
   * else. Its rows must be EVERY matching row — one page would lie about the
   * total. `undefined` removes the reading.
   * TRAP T-a-component-part-narrows-one-component · TRAP T-one-query-one-owner
   */
  #write(scope: string, field: string, reading: FieldReading | undefined, at: { only?: BoundControl } = {}): void {
    // A declared part narrows its own component, whoever writes it — a panel too.
    const only = at.only ?? this.#decl.parts.get(scope)?.only;
    const bind = only ? this.#bindOf(only) : undefined;
    if (reading && only && bind?.rows !== 'all') {
      report({
        code: 'component-part-on-a-page',
        message: 'write: a scope that narrows one component needs a bound `rows: "all"` component.',
        at: { scope, field },
      });
      return;
    }
    const entry = scopeEntry(this.#live.draft, scope);
    if (bind) entry.narrows = [bind.id];
    if (reading && readingAnswered(reading)) {
      entry.readings[field] = copyReading(answerOf(reading));
      if (!entry.holds.includes(field)) entry.holds = [...entry.holds, field];
    } else {
      Reflect.deleteProperty(entry.readings, field);
      entry.holds = entry.holds.filter((f) => f !== field);
    }
    const narrows = entry.narrows ?? [];
    prune(this.#live.draft);
    /* A scope that narrows ONE component filters rows already here — no fetch,
       so no Apply, even with a remote member. */
    if (this.remote && narrows.length) copyScope(this.#live.draft, this.#live.applied, scope);
    this.#tell({ kind: 'write', scope, field, narrows });
  }

  /**
   * A component's OWN default filter — readings that narrow `only` it — as its
   * scope in the Query. It is put back under any Query that does not name that
   * scope, so a View pick keeps it; `undefined` forgets it and its scope.
   * TRAP T-a-component-default-outlives-a-view
   */
  declareDefault(
    scope: string,
    readings: Readonly<Record<string, FieldReading>> | undefined,
    at: { only?: BoundControl } = {},
  ): void {
    const was = this.#live.draft.scopes[scope]?.readings ?? {};
    if (!readings) {
      this.#decl.defaults.delete(scope);
      for (const field of Object.keys(was)) this.#write(scope, field, undefined);
      return;
    }
    // Its OWN before the first write compiles, so a View-held field cannot set it aside.
    this.#decl.defaults.set(scope, emptyScope());
    for (const field of Object.keys(was)) if (!(field in readings)) this.#write(scope, field, undefined);
    for (const [field, reading] of Object.entries(readings)) this.#write(scope, field, reading, at);
    const written = this.#live.draft.scopes[scope];
    if (written) {
      const own = structuredClone(written);
      for (const r of Object.values(own.readings)) freezeReading(r);
      this.#decl.defaults.set(scope, Object.freeze(own));
    } else this.#decl.defaults.delete(scope);
  }

  /**
   * Select values for a FIELD, at its home scope. Every control over that
   * field reads the same answer back; an empty list clears it. `reading`
   * carries the rest of the question — the condition and its text.
   *
   * ONE SLOT PER FIELD. A component that narrows only ITSELF must `write()` its
   * own scope instead: a second writer here does not narrow, it REPLACES.
   * TRAP T-a-filter-applies-down-its-scope
   */
  #select(field: string, picked: readonly unknown[], reading: FieldReading = {}): void {
    this.#put(field, picked, reading);
    this.#tell({ kind: 'select', field });
  }

  /** Write a field's answer, telling no one. */
  #put(field: string, picked: readonly unknown[], reading: FieldReading = {}): void {
    // Its OWN copy: a caller that edits its object after changes nothing here.
    const next: FieldReading = copyReading(this.#keepPresets(field, this.#raw(field, picked, reading)));
    /* CONDITIONS count. A field answered only by rows has no picked values and
       no typed text. TRAP T-many-conditions-are-one-reading */
    setReading(this.#live.draft, field, readingAnswered(next) ? next : undefined);
  }

  /**
   * A bar's filter Switch. OFF stops every answer in force in this scope,
   * keeping each; ON brings back exactly those. While it is off,
   * nothing comes into force there. TRAP T-the-filter-switch-keeps-what-it-turned-off
   */
  #suspendScope(scope: string, suspended = true): void {
    if (suspended === !!this.#live.draft.scopes[scope]?.suspended) return;
    const entry = scopeEntry(this.#live.draft, scope);
    let fields: string[];
    if (suspended) {
      // Each answer drops what the filters before it rule out, as one field's OFF does. TODO 523 F3
      const dropped: string[] = [];
      for (const [field, reading] of Object.entries(entry.readings)) {
        const kept = reading.suspended ? null : this.#standing(scope, field, reading);
        if (!kept || kept.length >= (reading.picked?.length ?? 0)) continue;
        this.#put(field, kept, kept.length ? reading : {});
        dropped.push(field);
      }
      entry.suspended = { fields: [] };
      // Compiling lists what the Switch turned off.
      this.#tell({ kind: 'recompose' });
      fields = [...new Set([...entry.suspended.fields, ...dropped])];
    } else {
      const off = entry.suspended!;
      delete entry.suspended;
      fields = off.fields.filter((f) => f in entry.readings);
      for (const f of fields) {
        const { suspended: _off, ...on } = entry.readings[f]!;
        entry.readings[f] = on;
      }
      prune(this.#live.draft);
      this.#tell({ kind: 'recompose' });
    }
    // The Switch is its scope's Apply, remote too.
    this.#commit({ scope });
    this.#tell({ kind: 'drawn', fields, bars: scope });
    // Its sort and group go off and on with it: the rows are arranged again. Will, TODO 398
    if (entry.sort?.length || entry.group) this.#tell({ kind: 'arranged', group: !!entry.group });
  }

  /**
   * Switch answers OFF and on, keeping each: one field's, at its home, or —
   * `null` — every answer in a scope, its bar's Switch. On gives the same
   * reading back; a field already so changes nothing.
   * TRAP T-the-filter-switch-keeps-what-it-turned-off · TRAP T-grid-suspend-is-not-clear
   */
  #suspend(scope: string, field: string | null, off: boolean): void {
    if (field === null) {
      this.#suspendScope(scope, off);
      return;
    }
    const held = readingOf(this.#live.draft, field);
    if (!held || !!held.suspended === off) return;
    const { suspended: _was, ...on } = held;
    if (!off) return this.#select(field, held.picked ?? [], on);
    const kept = this.#standing(homes(this.#live.draft).get(field) ?? scope, field, held);
    // None left, the field clears.
    if (held.picked?.length && !kept.length) this.#select(field, []);
    else this.#select(field, kept, { ...on, suspended: true });
  }

  /** A field's picks less those the filters before it rule out: going OFF, they go —
   *  they could never come back on (TODO 462). Conditions stay. Will, TODOs 465, 523 F3 */
  #standing(scope: string, field: string, reading: FieldReading): unknown[] {
    const picked = reading.picked ?? [];
    const out = modeOf(reading) === 'advanced' ? undefined : this.#members.knows(field)?.ruledOut?.(scope, field);
    return out ? picked.filter((v) => out(valueKey(v)) === null) : [...picked];
  }

  /** The filter soloed in this tab, and every answer the solo switched off. Never
   *  saved, never exported. Will, TODO 690 */
  #soloing: { scope: string; field: string; off: { scope: string; field: string }[] } | null = null;

  /** The filter soloed in this tab, if one is. */
  get soloed(): { scope: string; field: string } | null {
    return this.#soloing ? { scope: this.#soloing.scope, field: this.#soloing.field } : null;
  }

  /**
   * SOLO one filter: every other answer in force in its scope — every scope,
   * `across` — goes off, its value whole, and this one is on. Applied at once,
   * as the Switch is. A second solo moves it. Will, TODO 690
   * TRAP T-a-solo-is-a-draft-of-one-tab
   */
  #solo(scope: string, field: string, options: { across?: boolean } = {}): void {
    this.#batch(() => {
      this.#unsolo();
      const draft = this.#live.draft;
      const off: { scope: string; field: string }[] = [];
      const scopes = options.across ? eachScope(draft).map(([id]) => id) : [scope];
      for (const id of scopes) {
        const entry = draft.scopes[id];
        // A scope its Switch turned off is off already.
        if (!entry || entry.suspended) continue;
        for (const [other, reading] of Object.entries(entry.readings)) {
          if (other === field || reading.suspended || !readingAnswered(reading)) continue;
          // Raw: going off here prunes nothing, so it comes back as it was.
          this.#select(other, reading.picked ?? [], { ...reading, suspended: true });
          off.push({ scope: id, field: other });
        }
      }
      const own = readingOf(draft, field);
      if (own?.suspended) {
        const { suspended: _off, ...on } = own;
        this.#select(field, own.picked ?? [], on);
      }
      this.#soloing = { scope, field, off };
      this.#soloSaid(this.#soloing);
    });
  }

  /** End the solo: ONLY what it switched off comes back on — less any the reader
   *  turned on meanwhile. Inside a batch. Will, TODO 690 */
  #unsolo(): void {
    const solo = this.#soloing;
    if (!solo) return;
    this.#soloing = null;
    for (const { field } of solo.off) {
      const held = readingOf(this.#live.draft, field);
      if (!held?.suspended) continue;
      const { suspended: _off, ...on } = held;
      this.#select(field, held.picked ?? [], on);
    }
    this.#soloSaid(solo);
  }

  /** A solo applied, and every bar it reaches drawn again: each its own scope. */
  #soloSaid(solo: { scope: string; field: string; off: { scope: string; field: string }[] }): void {
    const scopes = new Set([solo.scope, ...solo.off.map((o) => o.scope)]);
    for (const id of scopes) this.#commit({ scope: id });
    this.#tell({ kind: 'drawn', fields: [solo.field, ...solo.off.map((o) => o.field)] });
    for (const id of scopes) this.#tell({ kind: 'bars', scope: id });
  }

  /** Say what a scope holds now. An empty list forgets the scope. */
  #hold(name: string, fields: readonly string[]): void {
    const next = [...fields];
    const before = this.#live.draft.scopes[name]?.holds ?? [];
    // A no-op must not wake every listener — a bar re-renders on this.
    if (before.length === next.length && before.every((f, i) => f === next[i])) return;
    /* LET GO, and held nowhere else: its answer goes with it. Removing a chip
       is a clear. Cleared FIRST, while this scope still holds it, so the
       controls over this scope are drawn the clear. TRAP T-one-query-one-owner */
    const elsewhere = (field: string): boolean => eachScope(this.#live.draft)
      .some(([id, s]) => id !== name && s.holds.includes(field));
    for (const field of before) {
      if (!next.includes(field) && !elsewhere(field) && readingOf(this.#live.draft, field)) this.#select(field, []);
    }
    const draft = this.#live.draft;
    const entry = scopeEntry(draft, name);
    const added = next.filter((f) => !before.includes(f));
    const dropped = before.filter((f) => !next.includes(f));
    /* THE VIEW TAKES a field a component scope holds: that scope keeps its own
       answer, not in force — `{}` for none. One that lets a field go keeps none.
       Will, D2 A. TRAP T-a-superseded-chip-suspends-it-is-never-removed */
    if (name === VIEW) {
      for (const [id, s] of eachScope(draft)) {
        if (id === VIEW) continue;
        for (const f of added) if (s.holds.includes(f)) (s.superseded ??= {})[f] = copyReading(s.readings[f] ?? {});
      }
    } else for (const f of dropped) forget(entry, f);
    const was = homes(draft);
    entry.holds = next;
    rehome(draft);
    // …and LETS GO: its home below gets back the answer it kept, or clears.
    if (name === VIEW) for (const f of dropped) this.#giveBack(f);
    /* RAISING CARRIES THE ANSWER, and lowering brings it back: an answer that
       moved scope narrows from where it lives now, at once, and is drawn there.
       TRAP T-up-is-open-down-is-closed */
    const now = homes(draft);
    const moved = [...now].filter(([field, home]) => was.get(field) !== home).map(([field]) => field);
    this.#carry(moved);
    this.#tell({ kind: 'hold', scope: name, moved });
  }

  /** The View let go of a field: its home below gets back the answer it kept
   *  — or clears, for `{}` — and no scope keeps one for it now. */
  #giveBack(field: string): void {
    const draft = this.#live.draft;
    const home = holderOf(draft, field);
    for (const [id, s] of eachScope(draft)) {
      const kept = s.superseded?.[field];
      if (!kept) continue;
      forget(s, field);
      if (id !== home) continue;
      if (Object.keys(kept).length) s.readings[field] = kept;
      else Reflect.deleteProperty(s.readings, field);
    }
  }

  /** A scope lets ONE field go. */
  #release(scope: string, id: string): void {
    this.#hold(scope, this.scope(scope).filter((f) => f !== id));
    this.#tell({ kind: 'bars', scope });
  }

  /** A scope TAKES fields — sent DOWN from the View to the one scope named,
   *  or UP from a chart with its answer. TRAP T-send-to-view-filters */
  #take(scope: string, ids: readonly string[], from?: string): void {
    if (from === VIEW && scope !== VIEW) {
      for (const id of ids) this.#lower(id, scope);
      return;
    }
    if (scope === VIEW && from) for (const id of ids) this.#setCameFrom(id, from);
    const part = from ? this.#decl.parts.get(from) : undefined;
    const answer = part && from ? this.reading(from, part.field) : undefined;
    this.#holdEach(scope, [...ids]);
    // The chart lets go of it: the View narrows every component now.
    if (part && answer && from && ids.includes(part.field)) {
      this.#write(from, part.field, undefined);
      this.#select(part.field, answer.picked ?? [], answer);
      this.#commit();
      this.#tell({ kind: 'bars', scope });
    }
  }

  /** A scope holds each of these fields. */
  #holdEach(scope: string, ids: readonly string[]): void {
    const fields = ids.filter((id) => !this.holds(scope, id));
    if (fields.length) this.#hold(scope, [...this.scope(scope), ...fields]);
    this.#tell({ kind: 'bars', scope });
  }

  /** Remember, or forget, where a View field came up from, in both copies. */
  #setCameFrom(field: string, from: string | undefined): void {
    for (const query of new Set([this.#live.draft, this.#live.applied])) setCameFrom(query, field, from);
  }

  /** SEND a View field DOWN: the View lets go of it, and its answer goes to
   *  the one scope named. TRAP T-send-to-view-filters */
  #lower(field: string, to: string): void {
    if (!this.holds(VIEW, field)) return;
    const answer = this.reading(VIEW, field);
    const part = this.#decl.parts.get(to);
    if (!part && !this.canHold(to, field)) return;
    /* ONE SCOPE AT A TIME. A scope the field came up from still holds its
       place: each lets go first, while the View still holds the answer.
       Will, TODO 168. TRAP T-send-to-view-filters */
    for (const [id, scope] of eachScope(this.#live.draft)) {
      if (id === VIEW || id === to || !scope.holds.includes(field)) continue;
      this.#hold(id, scope.holds.filter((f) => f !== field));
      this.#tell({ kind: 'bars', scope: id });
    }
    // Held BELOW first, so the answer moves there and is not cleared.
    if (!part && !this.holds(to, field)) this.#hold(to, [...this.scope(to), field]);
    /* THE VIEW'S ANSWER WINS, whole — its mode and its rows: what a scope kept
       from before the field went up is dropped. TRAP T-send-to-view-filters */
    for (const [, s] of eachScope(this.#live.draft)) forget(s, field);
    this.#hold(VIEW, this.scope(VIEW).filter((f) => f !== field));
    // A chart's own scope takes the picks; the View's answer went with its hold.
    if (part) this.#write(to, field, answer?.picked?.length ? { picked: [...answer.picked] } : undefined);
    this.#setCameFrom(field, undefined);
    this.#commit();
    this.#tell({ kind: 'bars', scope: VIEW });
    if (!part) this.#tell({ kind: 'bars', scope: to });
  }

  /**
   * ONE FIELD'S ANSWER — what a control asks when the reader changes it. It
   * lands at the field's home. In a PART's scope, or with `only`, it is that
   * component's own answer, which narrows it alone. A field no scope holds is
   * first held in a component scope that may hold it; the View holds nothing
   * it is not given. The answer already in force changes nothing and tells no
   * one. `null` clears it. 366 step 18 · TRAP T-one-query-one-owner
   */
  #setReading(scope: string, field: string, reading: FieldReading | null, at: { only?: BoundControl } = {}): void {
    if (at.only || this.#decl.parts.has(scope) || this.#live.draft.scopes[scope]?.narrows?.length) {
      const next = reading && readingAnswered(reading) ? reading : undefined;
      if (sameReading(this.#live.draft.scopes[scope]?.readings[field], next)) return;
      this.#write(scope, field, next, at);
      return;
    }
    // A heading's answer to a field no scope holds is held in its grid's scope, and its bar draws the chip. TRAP T-a-heading-asks-through-the-source
    const fresh = !!reading && scope !== VIEW && !this.scopeOf(field) && this.canHold(scope, field);
    if (fresh) this.#hold(scope, [...this.scope(scope), field]);
    const picked = reading?.picked ?? [];
    const next = this.#keepPresets(field, this.#raw(field, picked, reading ?? {}));
    if (!sameReading(readingOf(this.#live.draft, field), readingAnswered(next) ? next : undefined)) this.#select(field, picked, reading ?? {});
    if (fresh) this.#tell({ kind: 'bars', scope });
  }

  /**
   * letGo(scope, field, keys) — the filters before a field rule these picks out:
   * they leave its APPLIED answer, and no Apply is asked — the rows had them out
   * already. A draft follows only while it is still the applied answer: one the
   * reader changed is theirs. Will, TODO 512 (A); 518 · TRAP T-a-ruled-out-value-is-greyed
   */
  #letGo(scope: string, field: string, keys: readonly string[]): void {
    const { applied, draft } = this.#live;
    const was = applied.scopes[scope]?.readings[field];
    const kept = was?.picked?.filter((v) => !keys.includes(valueKey(v)));
    if (!was || !kept || kept.length === was.picked!.length) return;
    if (draft !== applied && sameReading(draft.scopes[scope]?.readings[field], was)) {
      draft.scopes[scope]!.readings[field] = { ...was, picked: kept };
    }
    applied.scopes[scope]!.readings[field] = { ...was, picked: kept };
    // ONE compile: what is applied moved; then the field is drawn its answer.
    this.#tell({ kind: 'commit' });
    this.#tell({ kind: 'drawn', fields: [field] });
  }

  /**
   * declarePresets(scope, presets) — a scope's PRESETS: the app's own named
   * conditions, each a boolean chip that writes them into the fields. TODO 493, 510
   */
  declarePresets(scope: string, presets: readonly { id: string; label: string; readings: Readonly<Record<string, FieldReading>> }[]): void {
    this.#decl.setPresets(scope, presets);
    this.#tell({ kind: 'preset', scope });
  }

  /** A scope's presets, in order: each its id, its name and the readings it writes. */
  presets(scope: string): { id: string; label: string; readings: Readonly<Record<string, FieldReading>> }[] {
    return [...this.#decl.presets(scope)].map(([id, p]) => ({ id, label: p.label, readings: p.readings }));
  }

  /** Is this preset ON: its rows held on every field it names, in force — the
   *  draft's, or with `applied`, what the rows are under. TODOs 510, 521 */
  presetOn(scope: string, id: string, applied = false): boolean {
    const preset = this.#decl.presets(scope).get(id);
    if (!preset) return false;
    const query = applied ? this.#live.applied : this.#live.draft;
    const entries = Object.entries(preset.readings).filter(([, given]) => answerTree(given));
    // Each at its field's home, where setPreset writes it.
    return entries.length > 0 && entries.every(([field]) => {
      const held = query.scopes[holderOf(query, field) ?? scope]?.readings[field];
      return !!held?.byPreset?.[id] && !held.suspended;
    });
  }

  /** The scopes whose presets write this field: its answer moving moves their on. */
  presetsOver(field: string): string[] {
    return this.#decl.presetsOver(field);
  }

  /**
   * setPreset(scope, id, on) — a preset ON puts its conditions on each field, ANDed
   * with what it holds, where the field is held; where no scope holds it, in this
   * scope, and it adds no chip. The field's answer and mode stay the reader's. OFF
   * takes them off. Its on is read from the fields. With `commit`, the fields it
   * moved are applied at once. Will, TODOs 510 (A), 521, 526, 590 · TRAP T-a-preset-is-its-own-part
   */
  #setPreset(scope: string, id: string, on: boolean, commit = false): void {
    const preset = this.#decl.presets(scope).get(id);
    // Off goes on: a field suspended reads it off, and still holds its rows.
    if (!preset || (on && this.presetOn(scope, id))) return;
    this.#batch(() => {
      const moved: string[] = [];
      for (const [field, given] of Object.entries(preset.readings)) {
        const tree = answerTree(given);
        if (!tree) continue;
        const entry = scopeEntry(this.#live.draft, this.scopeOf(field) ?? scope);
        const now = entry.readings[field];
        if (!on && !now?.byPreset?.[id]) continue;
        const next = withPreset(now, id, on ? { label: preset.label, scope, tree } : null);
        if (readingAnswered(next)) entry.readings[field] = copyReading(next);
        else Reflect.deleteProperty(entry.readings, field);
        prune(this.#live.draft);
        this.#tell({ kind: 'select', field });
        moved.push(field);
      }
      if (commit) for (const field of moved) this.#commit({ field });
    });
    this.#tell({ kind: 'preset', scope });
  }

  /** Clear all, Reset all: every answer homed in these scopes goes — a
   *  carry-over field's stays, with `carry` — and what a Switch turned off is
   *  forgotten; `organise` clears their sort and group too. The one door that
   *  clears what it does not name. TRAP T-a-field-can-carry-over-views */
  #reset(scopes: readonly string[], options: { carry?: boolean; organise?: boolean } = {}): void {
    this.#batch(() => {
      // A Reset ends a solo: what it switched off is cleared with the rest.
      this.#soloing = null;
      for (const id of scopes) {
        const s = this.#live.draft.scopes[id];
        if (!s) continue;
        if (s.suspended) s.suspended = { fields: [] };
        // A preset goes with the rest. TODO 526
        for (const [field, reading] of Object.entries(s.readings)) {
          if (!reading.byPreset) continue;
          const { byPreset: _held, ...own } = reading;
          s.readings[field] = own;
        }
        for (const field of Object.keys(s.readings)) {
          if (options.carry && this.#members.knows(field)?.carriesOver(field)) continue;
          const start = this.#decl.opens(id)?.get(field);
          if (s.narrows?.length || this.#decl.parts.has(id)) this.#write(id, field, undefined);
          // A field with a start goes back to it, never to every row. TODO 403
          else if (start) this.#select(field, [...start.picked ?? []], start);
          else this.#select(field, []);
        }
      }
      // The arrangement in a scope it resets, never another source's. TODO 523 S3
      const { scope } = arrangementOf(this.#live.applied, (id) => scopes.includes(id));
      if (options.organise && scope) {
        // The rows' own, a slot's too: its chart's are below.
        this.#edit({ scope, sort: null, clear: true }, false);
        this.#edit({ scope, group: null }, false);
      }
      // …and a SLOT's own Group and Sort, its chart's. TODO 548
      for (const id of options.organise ? scopes : []) {
        const shown = this.presentation(id);
        if (shown.group || shown.sort) this.#edit({ scope: id, presentation: { group: undefined, sort: undefined } });
      }
    });
  }

  /** The doors one act calls are ONE change to the page: one `query-change`. */
  #batch(fn: () => void): void {
    if (this.#batched) {
      fn();
      return;
    }
    this.#batched = { fields: [], scopes: [] };
    try {
      fn();
    } finally {
      const said = this.#batched;
      this.#batched = null;
      // ONE Apply for the act, after every edit in it. 366 step 21
      const applies = this.#applies;
      this.#applies = [];
      if (applies.map((at) => this.#send(at)).some(Boolean)) this.#tell({ kind: 'commit' });
      if (said.fields.length || said.scopes.length) {
        this.#announce({ fields: [...new Set(said.fields)], scopes: [...new Set(said.scopes)] });
      }
    }
  }

  /** SEND the draft — Apply, where a scope waits. One field, one scope, or all. It loads. */
  #commit(at: { scope?: string; field?: string } = {}): void {
    if (!this.waiting()) return;
    if (this.#batched) this.#applies.push(at);
    else if (this.#send(at)) this.#tell({ kind: 'commit' });
  }

  /** Copy what an Apply sends onto `applied`. Nothing waiting: false, and the
   *  Apply tells no one. 366 step 21 */
  #send(at: { scope?: string; field?: string }): boolean {
    const { draft, applied } = this.#live;
    if (at.field ? sameField(draft, applied, at.field) : at.scope ? sameScope(draft, applied, at.scope) : false) return false;
    if (at.field) copyField(draft, applied, at.field);
    else if (at.scope) copyScope(draft, applied, at.scope);
    else this.#live.applied = structuredClone(draft);
    if (at.field || at.scope) copyHolds(draft, this.#live.applied);
    return true;
  }

  /** Put the applied answers back over the draft — Discard, where a scope waits.
   *  One field, one scope, or all. Every control over them is drawn the applied answer. */
  #discard(at: { scope?: string; field?: string } = {}): void {
    if (!this.waiting()) return;
    const before = new Set(this.#answered());
    if (at.field) copyField(this.#live.applied, this.#live.draft, at.field);
    else if (at.scope) copyScope(this.#live.applied, this.#live.draft, at.scope);
    else this.#live.draft = structuredClone(this.#live.applied);
    this.#tell({ kind: 'drawn', fields: [...new Set([...before, ...this.#answered()])], pending: true });
  }

  /**
   * A PURE edit — a Sort, Group or Search, a presentation, an order, a move —
   * written over the copies it reaches: the arrangement, a presentation and an
   * order in BOTH, since no Apply waits on them; a move in the draft. Every
   * re-arranging returns to page 1. TRAP T-one-command-one-door
   */
  #edit(edit: PureEdit, slots = true): void {
    const { applied, draft } = this.#live;
    const facts: EditFacts = { ...(slots ? { presents: (scope: string) => this.#members.presentsIn(scope) } : {}), theirs: this.#members.theirs(edit.scope), applied, draft };
    const routed = slotted(edit, facts.presents);
    if ('move' in routed) return this.#move(routed, facts);
    const next = editQuery(draft, routed, facts);
    const was = 'order' in routed ? draft.scopes[routed.scope ?? VIEW]?.holds ?? [] : null;
    const now = next.scopes[routed.scope ?? VIEW]?.holds ?? [];
    // An order that moves nothing must not wake every listener.
    if (was && was.length === now.length && was.every((f, i) => f === now[i])) return;
    this.#live.applied = draft === applied ? next : editQuery(applied, routed, facts);
    this.#live.draft = next;
    const scope = routed.scope ?? VIEW;
    this.#tell('presentation' in routed ? { kind: 'presented', scope }
      : 'order' in routed ? { kind: 'order', scope } : { kind: 'arranged', group: 'group' in routed });
  }

  /**
   * MOVE a filter between scopes — ONE edit, because the removal is not
   * optional. RAISED to the view, it leaves EVERY component; LOWERED, it leaves
   * the view and lands in one. A component that does not have the field refuses,
   * and says so. An answer that moved narrows from where it lives now, at once.
   * TRAP T-up-is-open-down-is-closed
   */
  #move(edit: Extract<PureEdit, { move: unknown }>, facts: EditFacts): void {
    const to = edit.scope ?? VIEW;
    const field = edit.move;
    if (!this.canHold(to, field)) {
      report({
        code: 'scope-refused',
        message: 'move: a component scope may hold only its own fields.',
        at: { field, from: edit.from, to, offers: (this.#decl.offers.get(to) ?? []).join(',') },
      });
      return;
    }
    const { draft, applied } = this.#live;
    const was = homes(draft);
    const next = editQuery(draft, edit, facts);
    const scopes = [...new Set([to, ...Object.keys({ ...draft.scopes, ...next.scopes }).filter((id) =>
      (draft.scopes[id]?.holds ?? []).join() !== (next.scopes[id]?.holds ?? []).join())])];
    this.#live.draft = next;
    if (draft === applied) this.#live.applied = next;
    const now = homes(next);
    const moved = [...now].filter(([f, home]) => was.get(f) !== home).map(([f]) => f);
    this.#carry(moved);
    this.#tell({ kind: 'move', scopes, moved: moved.length > 0 });
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
    for (const [scope, entry] of Object.entries(this.#live.applied.scopes)) {
      if (entry?.presentation) this.#tell({ kind: 'presented', scope });
    }
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
    const next = definitionOf(query, options.holds === 'keep', this.#live.draft, {
      defaults: this.#decl.defaults,
      starts: this.#decl.starts,
      readingsOf: (where) => this.#readingsOf(where),
      carriesOver: (f) => this.#members.knows(f)?.carriesOver(f) ?? false,
    });
    options.lay?.(next);
    this.#decl.fillOpens(next);
    const was = arrangementOf(this.#live.applied);
    const before = this.#answered();
    // Before the copy: a waiting scope's rows and chips read the same homes. TODO 612
    rehome(next);
    this.#live.applied = next;
    this.#live.draft = this.waiting() ? structuredClone(next) : next;
    await this.#members.hear({ kind: 'query', was, before });
    this.#announce({
      fields: [...new Set([...before, ...this.#answered()])], scopes: this.scopes, ...(options.by ? { by: options.by } : {}),
    });
  }

  /**
   * The answer a field OPENS on where nothing answers it — a fetching list's
   * first value. A restore, a View or a Reset that leaves it unanswered puts it
   * back. Will, TODO 403 · TRAP T-a-fetching-list-opens-on-its-first-value
   */
  startWith(scope: string, field: string, reading: FieldReading): void {
    this.#decl.setOpen(scope, field, reading);
    // Taken now, in place: it is how the page opens, not a change to it.
    this.#decl.fillOpens(this.#live.applied);
    if (this.#live.draft !== this.#live.applied) this.#decl.fillOpens(this.#live.draft);
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
    // It names its arrangement, none too: a View saved from it puts back the rows as they were.
    if (!arrangementOf(query).scope) query.scopes[VIEW] = { ...(query.scopes[VIEW] ?? emptyScope()), sort: [] };
    return { v: 1, query };
  }

  /** Take a question back in, exactly. */
  async import(state: QueryState): Promise<void> {
    if (state?.v !== 1) {
      report({ code: 'unknown-state', message: 'import: not a v1 query state, so nothing was taken in.' });
      return;
    }
    await this.setQuery(state.query);
  }

  /** A reader's answer replaces the answer, never what presets hold of the field. TODO 521 */
  #keepPresets(field: string, next: FieldReading): FieldReading {
    const byPreset = readingOf(this.#live.draft, field)?.byPreset;
    if (!byPreset) return next;
    // An answer emptied leaves the presets', in force.
    return { ...(readingAnswered(next) ? next : {}), byPreset };
  }

  /** A reading's answer, its picks as the values the rows hold: a control hands
   *  back the KEY it was given. Picks kept off too. TRAP T-a-value-can-be-an-object */
  #raw(field: string, picked: readonly unknown[], reading: FieldReading): FieldReading {
    const raws = (keys: readonly unknown[]): unknown[] => this.#members.knows(field)?.raws(field, keys) ?? [...keys];
    return { ...answerOf(reading), picked: raws(picked), ...(reading.off ? { off: raws(reading.off) } : {}) };
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

  /** How any member bound this control. */
  #bindOf(el: BoundControl): MemberBind | undefined {
    return this.#members.bindOf(el);
  }

  /** Each member hears what the context did, at once, in the order they joined;
   *  then, if a field's answer or a scope's holds moved, the page is told. */
  #tell(change: QueryChange): void {
    this.#settle();
    this.#members.tell(change);
    const said = ((): QueryChangeDetail | null => {
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
    })();
    if (said) this.#announce(said);
  }

  /** ONE event for anything listening to the Query — held to the end of a batch. */
  #announce(detail: QueryChangeDetail): void {
    if (this.#batched) {
      this.#batched.fields.push(...detail.fields);
      this.#batched.scopes.push(...detail.scopes);
      return;
    }
    this.dispatchEvent(new CustomEvent('query-change', { detail }));
  }

  /** A source joins: it gets its handle. A remote one splits the draft from
   *  `applied` once; a draft that exists is kept. */
  join(member: QueryMember): QueryHandle {
    this.#members.add(member);
    if ((member.remote || this.#waiting.size) && this.#live.draft === this.#live.applied) this.#live.draft = copyQuery(this.#live.applied);
    return {
      live: () => this.#live,
      mintId: () => this.#members.mintId(),
      walkVersion: () => this.#decl.version,
      pagedIn: (scope) => this.#members.pagedIn(scope),
      bindOf: (el) => this.#members.bindOf(el),
      leave: () => { this.#members.delete(member); },
    };
  }
}
