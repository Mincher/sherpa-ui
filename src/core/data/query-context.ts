/**
 * query-context.ts — the Query of one app Context, and what its page declares
 * about it. Every source over the page joins it, so there is one Query.
 * 366 step 12: a context of one — each source still makes its own.
 * DOM-free. TRAP T-one-query-one-owner
 *
 * Map:
 * - QueryChange — What the context did, as each member hears it.
 * - QueryMember — What a source tells the context it joins.
 * - MemberBind — How a member bound a control.
 * - QueryLive — The Query and the declarations, live: written in place, never copied.
 * - QueryHandle — What a member holds of its context.
 * - QueryContext — The Query of one app Context, shared by every source in it.
 * - .applied — The Query the rows are under. A copy.
 * - .draft — What the reader is editing. A copy.
 * - .remote — Does any member's store wait for Apply?
 * - .reading — One scope's reading of one field, or undefined. The Query's own, frozen.
 * - .scope — The fields a scope holds, in order — hold()'s read-back.
 * - .scopes — Every scope that holds a field, by id.
 * - .holds — Is this field held HERE?
 * - .scopeOf — Which scope holds this field, or null.
 * - .fields — The fields a scope may hold.
 * - .canHold — May this scope hold this field?
 * - .defaultFor — A component's own default, as `declareDefault` left it — not its answer now.
 * - .partFacts — What `declarePart` was told for this scope, or undefined.
 * - .scopeFacts — What `declareScope` was told — not the fallbacks `scopeLabel()` and `arranges()` answer with.
 * - .scopeLabel — A scope's name as a reader sees it, or its id.
 * - .arranges — Does Group and Sort arrange this scope's rows?
 * - .sets — A scope's filter sets, as declared.
 * - .pending — Has this field been changed and not yet applied?
 * - .dirty — Has anything in this scope — or any scope — been changed and not applied?
 * - .declarePart — Declare a PART: one field that narrows one component — a chart's legend field.
 * - .declareScope — Name a scope as a reader sees it, and say if it arranges.
 * - .declareSets — A scope's filter sets, in order.
 * - .offer — Say which fields a component scope HAS.
 * - .write — Write ONE scope's reading of ONE field — a component's own answer.
 * - .declareDefault — A component's OWN default filter — readings that narrow `only` it — as its scope in the Query.
 * - .select — Select values for a FIELD — at its home scope.
 * - .suspendScope — A bar's filter Switch: OFF stops every filter in force in a scope, keeping each; ON brings them back.
 * - .suspendSelection — Stop applying a field without forgetting it.
 * - .hold — Say what a scope holds now.
 * - .move — Move a filter between scopes — ONE call, because the removal is not optional.
 * - .release — A scope lets ONE field go.
 * - .request — Move fields into a scope: down from the View, or up from a chart with its answer.
 * - .commit — SEND the draft — Apply, with a remote member.
 * - .discard — Put the applied answers back over the draft — Discard, with a remote member.
 * - .join — A source joins: it gets its handle.
 */
import type { BoundControl, FilterSet } from './data-source-types.js';
import {
  answerOf, copyQuery, copyReading, eachScope, emptyScope, freezeReading, readingAnswered, sameReading, VIEW,
  type Query, type ScopeQuery,
} from './query.js';
import {
  answerIn, answersOf, copyField, copyScope, holderOf, holdsField, homes, moveHold, prune, readingOf, rehome, scopeEntry,
  setCameFrom, setReading,
} from './query-edits.js';
import type { FieldReading } from './filter-state.js';
import { report } from './report.js';

/** What the context did, as each member hears it: the follow-ups are the member's. */
export type QueryChange =
  | { kind: 'part'; scope: string; field?: string }
  | { kind: 'sets'; scope: string }
  | { kind: 'offer'; scope: string }
  | { kind: 'write'; scope: string; field: string; narrows: string[] }
  | { kind: 'select'; field: string }
  | { kind: 'hold'; scope: string; moved: string[] }
  | { kind: 'move'; scopes: string[]; moved: boolean }
  /** The Query moved: compile it. */
  | { kind: 'recompose' }
  | { kind: 'commit' }
  /** Each field is drawn its answer; then a scope's bars, or each control's pending. */
  | { kind: 'drawn'; fields: string[]; bars?: string; pending?: true }
  | { kind: 'bars'; scope: string };

/** What a source tells the context it joins. */
export interface QueryMember {
  /** Its store waits for Apply. */
  readonly remote: boolean;
  /** Does it show rows — a grid, a list — in this scope? */
  showsRows(scope: string): boolean;
  /** How it bound this control, if it did. */
  bindOf(el: BoundControl): MemberBind | undefined;
  /** What the context did: its follow-ups. Called at once, in join order. */
  heard(change: QueryChange): void;
  /** Does it know this field? */
  has(field: string): boolean;
  /** The values its rows hold for these picks: a KEY maps to its value. TRAP T-a-value-can-be-an-object */
  raws(field: string, picked: readonly unknown[]): unknown[];
}

/** How a member bound a control. */
export interface MemberBind {
  id: string;
  rows: 'page' | 'all';
  scope?: string | readonly string[];
}

/** The Query and the declarations, live: written in place, never copied. */
export interface QueryLive {
  /**
   * THE QUERY — which scope holds each field, and each field's reading, in the
   * reader's terms. One reading per field, in the scope that holds it.
   * TRAP T-one-query-one-owner · TRAP T-one-field-one-filter-menu
   */
  applied: Query;
  /** What the reader is EDITING. With no remote member it IS `applied`; else a
   *  copy that Apply sends. TRAP T-apply-and-discard-wait-for-a-change */
  draft: Query;
  /** Each component's OWN default filter, by its scope.
   *  TRAP T-a-component-default-outlives-a-view */
  readonly defaults: Map<string, ScopeQuery>;
  /** Each scope's name as a reader sees it. */
  readonly labels: Map<string, string>;
  /** Each scope's own word on whether it arranges. */
  readonly arranges: Map<string, boolean>;
  /** Each scope's filter sets. */
  readonly sets: Map<string, FilterSet[]>;
  /** What each COMPONENT scope has — its own fields. */
  readonly offers: Map<string, string[]>;
  /** Each PART: the one field it answers, and the one component it narrows.
   *  TRAP T-a-chart-scope-is-its-legend-field */
  readonly parts: Map<string, { field: string; only: BoundControl; label?: string }>;
}

/** What a member holds of its context. */
export interface QueryHandle {
  /** The live Query and declarations. */
  live(): QueryLive;
  /** A bind id no other member has made. */
  mintId(): string;
  /** Does any member show rows in this scope? */
  showsRows(scope: string): boolean;
  /** How any member bound this control. */
  bindOf(el: BoundControl): MemberBind | undefined;
  /** Leave the context. */
  leave(): void;
}

/** The Query of one app Context, shared by every source in it. */
export class QueryContext {
  /** The one Query, and the declarations. */
  readonly #live: QueryLive;
  /** Every source that joined. */
  readonly #members = new Set<QueryMember>();
  /** Binds made, for an id when the element has none. */
  #binds = 0;

  constructor() {
    const applied: Query = { v: 1, scopes: {} };
    this.#live = {
      applied, draft: applied,
      defaults: new Map(), labels: new Map(), arranges: new Map(), sets: new Map(), offers: new Map(), parts: new Map(),
    };
  }

  /** The Query the rows are under. A copy. */
  get applied(): Query {
    return structuredClone(this.#live.applied);
  }

  /** What the reader is editing. A copy. */
  get draft(): Query {
    return structuredClone(this.#live.draft);
  }

  /** Does any member's store wait for Apply? */
  get remote(): boolean {
    return [...this.#members].some((m) => m.remote);
  }

  /** One scope's reading of one field, or undefined. The Query's own, frozen.
   *  TRAP T-a-reading-is-frozen-in-the-query */
  reading(scope: string, field: string): FieldReading | undefined {
    const held = this.#live.draft.scopes[scope]?.readings[field];
    return held ? freezeReading(held) : undefined;
  }

  /** The fields a scope HOLDS, in order — `hold()`'s read-back. A copy. */
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
    if (name === VIEW) return [...new Set([...this.#live.offers.values()].flat())];
    return [...(this.#live.offers.get(name) ?? [])];
  }

  /** May this scope hold this field? Up is open; down is closed. */
  canHold(name: string, field: string): boolean {
    return name === VIEW || (this.#live.offers.get(name) ?? []).includes(field);
  }

  /** A component's own default, as `declareDefault` left it, or undefined — not
   *  its answer now, which `reading()` reads. Frozen. TRAP T-a-reading-is-frozen-in-the-query */
  defaultFor(scope: string): Readonly<Record<string, FieldReading>> | undefined {
    return this.#live.defaults.get(scope)?.readings;
  }

  /** What `declarePart` was told for this scope, or undefined. `only` is the element itself. */
  partFacts(scope: string): { field: string; only: BoundControl; label?: string } | undefined {
    const part = this.#live.parts.get(scope);
    return part ? { ...part } : undefined;
  }

  /** What `declareScope` was told — not the fallbacks `scopeLabel()` and `arranges()` answer with. */
  scopeFacts(scope: string): { label?: string; arranges?: boolean } {
    const label = this.#live.labels.get(scope);
    const arranges = this.#live.arranges.get(scope);
    return { ...(label != null ? { label } : {}), ...(arranges != null ? { arranges } : {}) };
  }

  /** A scope's name as a reader sees it, or its id. */
  scopeLabel(scope: string): string {
    return this.#live.labels.get(scope) ?? scope;
  }

  /** Does Group and Sort arrange this scope's rows? As declared — else a
   *  component scope that shows a grid or a list does, and the View does not.
   *  Will, TODO 99. TRAP T-group-and-sort-are-component-scope */
  arranges(scope: string): boolean {
    return this.#live.arranges.get(scope)
      ?? (scope !== VIEW && [...this.#members].some((m) => m.showsRows(scope)));
  }

  /** A scope's filter sets, as declared. */
  sets(scope: string): FilterSet[] {
    return structuredClone(this.#live.sets.get(scope) ?? []);
  }

  /** Has this field been changed and not yet applied? Never, with no remote member. */
  pending(field: string): boolean {
    if (!this.remote) return false;
    return !sameReading(answerIn(this.#live.applied, field), answerIn(this.#live.draft, field));
  }

  /** Has anything in this scope — or in any scope — been changed and not applied? */
  dirty(scope?: string): boolean {
    if (!this.remote) return false;
    const ids = scope ? [scope]
      : [...new Set([...Object.keys(this.#live.applied.scopes), ...Object.keys(this.#live.draft.scopes)])];
    return ids.some((id) => JSON.stringify(answersOf(this.#live.applied.scopes[id]))
      !== JSON.stringify(answersOf(this.#live.draft.scopes[id])));
  }

  /**
   * Declare a PART — the scope of ONE field that narrows ONE component, a
   * chart's legend field — so a panel draws it before it is answered, and a
   * write to it from anywhere narrows that component. `undefined` forgets it.
   * TRAP T-a-chart-scope-is-its-legend-field
   */
  declarePart(scope: string, part: { field: string; only: BoundControl; label?: string } | undefined): void {
    if (part) this.#live.parts.set(scope, part);
    else this.#live.parts.delete(scope);
    this.#tell({ kind: 'part', scope, ...(part ? { field: part.field } : {}) });
  }

  /** Name a scope as a reader sees it — a panel's section, an Add list's note — and say if it arranges. */
  declareScope(scope: string, facts: { label?: string; arranges?: boolean }): void {
    if (facts.label != null) this.#live.labels.set(scope, facts.label);
    if (facts.arranges != null) this.#live.arranges.set(scope, facts.arranges);
  }

  /** A scope's filter sets, in order. A field is in one set at most; a second
   *  is left out, and said. TRAP T-a-filter-set-groups-or-chains */
  declareSets(scope: string, sets: readonly FilterSet[]): void {
    const taken = new Set<string>();
    this.#live.sets.set(scope, sets.map((set) => ({
      ...structuredClone(set),
      fields: set.fields.filter((field) => {
        if (!taken.has(field)) {
          taken.add(field);
          return true;
        }
        report({
          code: 'field-in-two-sets',
          message: `declareSets: "${field}" is in two of scope "${scope}"'s sets; it stays in the first.`,
          at: { scope, set: set.id, field },
        });
        return false;
      }),
    })));
    this.#tell({ kind: 'sets', scope });
  }

  /** Say which fields a component scope HAS. The view needs none: up is open. */
  offer(name: string, fields: readonly string[]): void {
    const next = [...new Set(fields)];
    const before = this.#live.offers.get(name);
    if (before && before.length === next.length && before.every((f, i) => f === next[i])) return;
    if (next.length) this.#live.offers.set(name, next);
    else this.#live.offers.delete(name);
    this.#tell({ kind: 'offer', scope: name });
  }

  /**
   * Write ONE scope's reading of ONE field — a component's own answer, which no
   * other control shares. `only` makes the scope NARROW that one bound
   * component: a legend's switched-off series filter ITS chart, and nothing
   * else. Its rows must be EVERY matching row — one page would lie about the
   * total. `undefined` removes the reading.
   * TRAP T-a-component-part-narrows-one-component · TRAP T-one-query-one-owner
   */
  write(scope: string, field: string, reading: FieldReading | undefined, at: { only?: BoundControl } = {}): void {
    // A declared part narrows its own component, whoever writes it — a panel too.
    const only = at.only ?? this.#live.parts.get(scope)?.only;
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
      this.#live.defaults.delete(scope);
      for (const field of Object.keys(was)) this.write(scope, field, undefined);
      return;
    }
    // Its OWN before the first write compiles, so a View-held field cannot set it aside.
    this.#live.defaults.set(scope, emptyScope());
    for (const field of Object.keys(was)) if (!(field in readings)) this.write(scope, field, undefined);
    for (const [field, reading] of Object.entries(readings)) this.write(scope, field, reading, at);
    const written = this.#live.draft.scopes[scope];
    if (written) {
      const own = structuredClone(written);
      for (const r of Object.values(own.readings)) freezeReading(r);
      this.#live.defaults.set(scope, Object.freeze(own));
    } else this.#live.defaults.delete(scope);
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
  select(field: string, picked: readonly unknown[], reading: FieldReading = {}): void {
    // A control hands back the KEY it was given, so it maps to the value the row holds. TRAP T-a-value-can-be-an-object
    const raws = this.#knows(field)?.raws(field, picked) ?? [...picked];
    // Its OWN copy: a caller that edits its object after changes nothing here.
    const next: FieldReading = copyReading({ ...answerOf(reading), picked: raws });
    /* CONDITIONS count. A field answered only by rows has no picked values and
       no typed text. TRAP T-many-conditions-are-one-reading */
    setReading(this.#live.draft, field, readingAnswered(next) ? next : undefined);
    this.#tell({ kind: 'select', field });
  }

  /**
   * A bar's filter Switch. OFF stops every answer in force in this scope,
   * keeping each; ON brings back exactly those. While it is off,
   * nothing comes into force there. TRAP T-the-filter-switch-keeps-what-it-turned-off
   */
  suspendScope(scope: string, suspended = true): void {
    if (suspended === !!this.#live.draft.scopes[scope]?.suspended) return;
    const entry = scopeEntry(this.#live.draft, scope);
    let fields: string[];
    if (suspended) {
      entry.suspended = { fields: [] };
      // Compiling lists what the Switch turned off.
      this.#tell({ kind: 'recompose' });
      fields = [...entry.suspended.fields];
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
    this.commit({ scope });
    this.#tell({ kind: 'drawn', fields, bars: scope });
  }

  /** Stop applying a field without forgetting it. TRAP T-grid-suspend-is-not-clear */
  suspendSelection(field: string, suspended = true): void {
    const held = readingOf(this.#live.draft, field);
    if (!held) return;
    this.select(field, held.picked ?? [], { ...held, suspended });
  }

  /** Say what a scope holds now. An empty list forgets the scope. */
  hold(name: string, fields: readonly string[]): void {
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
      if (!next.includes(field) && !elsewhere(field) && readingOf(this.#live.draft, field)) this.select(field, []);
    }
    const was = homes(this.#live.draft);
    scopeEntry(this.#live.draft, name).holds = next;
    rehome(this.#live.draft);
    /* RAISING CARRIES THE ANSWER, and lowering brings it back: an answer that
       moved scope narrows from where it lives now, at once, and is drawn there.
       TRAP T-up-is-open-down-is-closed */
    const now = homes(this.#live.draft);
    const moved = [...now].filter(([field, home]) => was.get(field) !== home).map(([field]) => field);
    this.#tell({ kind: 'hold', scope: name, moved });
  }

  /**
   * Move a filter between scopes — ONE call, because the removal is not
   * optional: two `hold()`s could be interrupted between them.
   * RAISED to the view, it leaves EVERY component; LOWERED, it leaves the view
   * and lands in one component. Returns whether it moved; a component that
   * does not have the field refuses, and says so.
   */
  move(field: string, from: string, to: string): boolean {
    if (!this.canHold(to, field)) {
      report({
        code: 'scope-refused',
        message: 'move: a component scope may hold only its own fields.',
        at: { field, from, to, offers: (this.#live.offers.get(to) ?? []).join(',') },
      });
      return false;
    }
    const was = homes(this.#live.draft);
    const scopes = moveHold(this.#live.draft, field, from, to);
    rehome(this.#live.draft);
    // An answer that moved narrows from where it lives now, at once. TRAP T-up-is-open-down-is-closed
    const now = homes(this.#live.draft);
    this.#tell({ kind: 'move', scopes, moved: [...now].some(([f, home]) => was.get(f) !== home) });
    return true;
  }

  /** A scope lets ONE field go. */
  release(scope: string, id: string): void {
    this.hold(scope, this.scope(scope).filter((f) => f !== id));
    this.#tell({ kind: 'bars', scope });
  }

  /** Move fields into a scope — sent DOWN from the View to the one scope
   *  named, or UP from a chart with its answer. TRAP T-send-to-view-filters */
  request(scope: string, ids: readonly string[], from?: string): void {
    if (from === VIEW && scope !== VIEW) {
      for (const id of ids) this.#lower(id, scope);
      return;
    }
    if (scope === VIEW && from) for (const id of ids) this.#setCameFrom(id, from);
    const part = from ? this.#live.parts.get(from) : undefined;
    const answer = part && from ? this.reading(from, part.field) : undefined;
    this.#take(scope, [...ids]);
    // The chart lets go of it: the View narrows every component now.
    if (part && answer && from && ids.includes(part.field)) {
      this.write(from, part.field, undefined);
      this.select(part.field, answer.picked ?? [], answer);
      this.commit();
      this.#tell({ kind: 'bars', scope });
    }
  }

  /** A scope TAKES fields: each is held. */
  #take(scope: string, ids: readonly string[]): void {
    const fields = ids.filter((id) => !this.holds(scope, id));
    if (fields.length) this.hold(scope, [...this.scope(scope), ...fields]);
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
    const part = this.#live.parts.get(to);
    if (!part && !this.canHold(to, field)) return;
    /* ONE SCOPE AT A TIME. A scope the field came up from still holds its
       place: each lets go first, while the View still holds the answer.
       Will, TODO 168. TRAP T-send-to-view-filters */
    for (const [id, scope] of eachScope(this.#live.draft)) {
      if (id === VIEW || id === to || !scope.holds.includes(field)) continue;
      this.hold(id, scope.holds.filter((f) => f !== field));
      this.#tell({ kind: 'bars', scope: id });
    }
    // Held BELOW first, so the answer moves there and is not cleared.
    if (!part && !this.holds(to, field)) this.hold(to, [...this.scope(to), field]);
    this.hold(VIEW, this.scope(VIEW).filter((f) => f !== field));
    // A chart's own scope takes the picks; the View's answer went with its hold.
    if (part) this.write(to, field, answer?.picked?.length ? { picked: [...answer.picked] } : undefined);
    /* THE VIEW'S ANSWER WINS, whole — its mode and its rows. TRAP T-send-to-view-filters */
    else if (answer) this.select(field, answer.picked ?? [], answer);
    this.#setCameFrom(field, undefined);
    this.commit();
    this.#tell({ kind: 'bars', scope: VIEW });
    if (!part) this.#tell({ kind: 'bars', scope: to });
  }

  /** SEND the draft — Apply, with a remote member. One field, one scope, or all. It loads. */
  commit(at: { scope?: string; field?: string } = {}): void {
    if (!this.remote) return;
    if (at.field) copyField(this.#live.draft, this.#live.applied, at.field);
    else if (at.scope) copyScope(this.#live.draft, this.#live.applied, at.scope);
    else this.#live.applied = structuredClone(this.#live.draft);
    this.#tell({ kind: 'commit' });
  }

  /** Put the applied answers back over the draft — Discard, with a remote member.
   *  One field, one scope, or all. Every control over them is drawn the applied answer. */
  discard(at: { scope?: string; field?: string } = {}): void {
    if (!this.remote) return;
    const before = new Set(this.#answered());
    if (at.field) copyField(this.#live.applied, this.#live.draft, at.field);
    else if (at.scope) copyScope(this.#live.applied, this.#live.draft, at.scope);
    else this.#live.draft = structuredClone(this.#live.applied);
    this.#tell({ kind: 'drawn', fields: [...new Set([...before, ...this.#answered()])], pending: true });
  }

  /** Every field the draft answers. */
  #answered(): string[] {
    return Object.values(this.#live.draft.scopes).flatMap((s) => Object.keys(s.readings));
  }

  /** The member that knows a field — else the first. */
  #knows(field: string): QueryMember | undefined {
    const members = [...this.#members];
    return members.find((m) => m.has(field)) ?? members[0];
  }

  /** How any member bound this control. */
  #bindOf(el: BoundControl): MemberBind | undefined {
    for (const m of this.#members) {
      const bind = m.bindOf(el);
      if (bind) return bind;
    }
    return undefined;
  }

  /** Each member hears what the context did, at once, in the order they joined. */
  #tell(change: QueryChange): void {
    for (const member of this.#members) member.heard(change);
  }

  /** A source joins: it gets its handle. A remote one splits the draft from
   *  `applied` once; a draft that exists is kept. */
  join(member: QueryMember): QueryHandle {
    this.#members.add(member);
    if (member.remote && this.#live.draft === this.#live.applied) this.#live.draft = copyQuery(this.#live.applied);
    return {
      live: () => this.#live,
      mintId: () => `bind-${++this.#binds}`,
      showsRows: (scope) => [...this.#members].some((m) => m.showsRows(scope)),
      bindOf: (el) => this.#bindOf(el),
      leave: () => { this.#members.delete(member); },
    };
  }
}
