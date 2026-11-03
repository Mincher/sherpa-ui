/**
 * source-view.ts — what a DataSource's controls are drawn: each scope whole, each
 * field's filter and state, the view every bound component is pushed, and each
 * reading told to the controls over its home. A DataSource holds one. DOM-free.
 * TRAP T-a-panel-asks-for-its-scopes
 *
 * Map:
 * - ViewHost — What the view-model reads of its source, live.
 * - SourceView — A source's view-model: each scope, field and reading as a control draws it.
 * - .describe — One scope, whole: its filters and answers, what it may add, how it is arranged.
 * - .partsIn — The parts a scope's bar draws: a chart's legend, in its card's toolbar.
 * - .declareOwn — A scope's own fields, as its page definition holds them: never dragged.
 * - .declareUnused — What a scope's bar draws after its own, that this page has no field for. True when it changed.
 * - .filterDef — A field's filter, as every bar, panel and heading draws it.
 * - .addable — What a scope may still add, each noting where it lives now.
 * - .arrangedIn — The scope whose Group or Sort set the rows' arrangement, while it still arranges.
 * - .selection — One field's whole state, ready for any control to draw.
 * - .fieldStatus — What a field is now, seen from a scope: the one answer for every control.
 * - .pickedFor — A field's picks in force on one component, by its bind id: its own part's, else the View's.
 * - .draw — Tell each bar over a field's home — or the one named — what it now holds.
 * - .syncHeld — Each control below the View is told what the View holds.
 * - .syncPending — Each bound control over a scope is told its pending fields, whether it is dirty or waits, and what failed.
 * - .boundView — The view state every bound component is pushed.
 */
import { DEFAULT_OP, filterFields, filterNeedles, valueKey, type Filter } from './store.js';
import { modeOf, type FieldReading, type FilterState } from './filter-state.js';
import { answerOf, emptyScope, offerAxis, VIEW, type Arrangement, type Query } from './query.js';
import { cameFrom, homeOf, readingOf, viewHeldReadings } from './query-edits.js';
import { answerOrder } from './source-counts.js';
import { fieldStatus, type FieldStatus } from './field-status.js';
import type { SourceBinding } from './source-binding.js';
import type { FieldCatalogue } from './field-catalogue.js';
import type { QueryContext } from './query-context.js';
import type { QueryPart } from './query-declarations.js';
import type { BoundView, FieldFilter, FilterSet, HeldFilter, ScopeDescription } from './data-source-types.js';

/** What the view-model reads of its source, live. */
export interface ViewHost {
  readonly context: QueryContext;
  readonly catalogue: FieldCatalogue;
  readonly binding: SourceBinding;
  /** What the reader edits, and what the rows are under. */
  draft(): Query;
  applied(): Query;
  /** Each part, by its scope; each component scope's own fields; each scope's sets. */
  parts(): ReadonlyMap<string, QueryPart>;
  offers(): ReadonlyMap<string, string[]>;
  sets(scope: string): readonly FilterSet[];
  /** How the rows are arranged. */
  arrangement(): Arrangement;
  /** The compiled filter, and the field a server field's clause stands for. */
  filter(): Filter | undefined;
  fetchedField(clause: Filter): string | undefined;
  /** The page, its size and the page count, where it pages. */
  paging(): { page: number; pageSize: number | null; totalPages: number };
  /** The fields a search reads, or every field. */
  readonly searchFields: readonly string[] | undefined;
  /** Is a field's values still to be read? Has its own read failed? */
  unread(field: string): boolean;
  failed(): ReadonlySet<string>;
  /** The tag of the component bound by this id, by any source over the Query. */
  tagOf(id: string): string | undefined;
}

/** A source's view-model: each scope, field and reading as a control draws it. */
export class SourceView {
  /** The source it draws for. */
  readonly #host: ViewHost;

  constructor(host: ViewHost) {
    this.#host = host;
  }

  /**
   * One scope as a control draws it WHOLE: each field it holds — a field held
   * ABOVE keeps its place and says where it went — what it may add, and, below
   * the View, how its rows are arranged. TRAP T-a-panel-asks-for-its-scopes
   */
  describe(scope: string): ScopeDescription {
    const { context, catalogue, binding } = this.#host;
    const draft = this.#host.draft();
    const q = draft.scopes[scope] ?? emptyScope();
    const above = scope === VIEW ? [] : context.scope(VIEW);
    const part = this.#host.parts().get(scope);
    if (part) {
      /* ONE Simple filter: a chip per value, each with the series it is drawn
         in. No Advanced — Will, TODO 52. TRAP T-a-chart-scope-is-its-legend-field */
      const { advanced: _a, kind: _k, options, ...def } = this.filterDef(part.field);
      const reading = q.readings[part.field];
      return {
        scope, label: part.label ?? def.label, part: true, available: [],
        ...(this.#host.tagOf(part.only) ? { component: this.#host.tagOf(part.only)! } : {}),
        filters: options?.length ? [{
          ...def,
          // A band paints in its status; any other value, its series. TODO 477
          options: options.map((o, i) => ({ ...o, swatch: o.swatch ?? i + 1 })),
          ...(reading ? { state: structuredClone(reading) } : {}),
          ...(above.includes(part.field) ? { appliedAt: context.scopeLabel(VIEW) } : {}),
        }] : [],
      };
    }
    /* EVERY field it holds, declared or not: one left out still filters. In the
       ONE order — each set together (D2 A). TRAP T-a-broken-assumption-reports
       TRAP T-one-walk-counts-and-limits-in-order */
    const held = answerOrder(draft, this.#host.sets(scope), scope).flatMap((e) => (e.held ? [e.id] : []));
    // The app's presets lead the scope: a boolean chip each. TODO 493
    const presets: HeldFilter[] = context.presets(scope).map((p) => ({
      id: `preset:${p.id}`, label: p.label, preset: true, active: context.presetOn(scope, p.id),
    }));
    const fields: HeldFilter[] = held.map((f) => {
      // Held above, its state is its own kept answer. D2 A
      const kept = q.superseded?.[f];
      const reading = q.readings[f] ?? (kept && Object.keys(kept).length ? kept : undefined);
      const down = scope === VIEW ? this.#sendTo(f) : undefined;
      const from = cameFrom(draft, f);
      return {
        ...this.filterDef(f), removable: true,
        ...(this.#own.get(scope)?.has(f) ? { own: true } : {}),
        ...(reading ? { state: structuredClone(reading) } : {}),
        ...(above.includes(f) ? { appliedAt: context.scopeLabel(VIEW) } : {}),
        ...(down ? { sendTo: {
          scope: down, label: this.#host.parts().get(down)?.label ?? context.scopeLabel(down), ...(down === from ? { origin: true } : {}),
        } } : {}),
      };
    });
    const component = scope === VIEW ? undefined : binding.componentOf(scope);
    const sets = context.sets(scope);
    const out: ScopeDescription = {
      scope, label: context.scopeLabel(scope), ...(component ? { component } : {}),
      filters: [...presets, ...fields, ...(this.#unused.get(scope) ?? []).map((u) => ({ ...u, field: u.id, unused: true })),
        // A chart's legend its bar draws, answered in its own scope. Will, TODO 670
        ...this.partsIn(scope).flatMap((key) => this.describe(key).filters.map((f) => ({ ...f, answeredIn: key })))],
      available: this.addable(scope), ...(sets.length ? { sets } : {}),
      ...(q.suspended ? { suspended: true } : {}),
      ...(context.soloed?.scope === scope ? { soloed: context.soloed.field } : {}),
    };
    /* GROUP, PRIMARY and SECONDARY by any field that names things — by its
       declaration, so before its values come: never a number or a date. A typed
       field, a name, is one too. Will, TODOs 500, 523, 548 */
    const groupable = (c: { field: string }): boolean => {
      const facts = catalogue.get(c.field);
      return facts?.type !== 'number' && facts?.type !== 'date';
    };
    /* HOW its rows are arranged — only in a scope that arranges, and its own
       arrangement only. TRAP T-group-and-sort-are-component-scope */
    if (context.arranges(scope) && context.fields(scope).length) {
      const cols = context.fields(scope).filter((f) => catalogue.has(f))
        .map((f) => ({ field: f, label: catalogue.get(f)?.label ?? f }));
      // Each axis as the app offers it. Will, TODO 660
      const offers = context.axesOf(scope, 'grid');
      out.group = offerAxis(cols.filter(groupable), offers.group);
      out.sort = cols;
      const arranged = this.#host.arrangement();
      const mine = (this.arrangedIn() ?? scope) === scope;
      if (mine && arranged.group) out.groupField = arranged.group;
      const [first] = mine ? arranged.sort : [];
      if (first) {
        out.sortField = first.field;
        out.sortDirection = first.direction ?? 'asc';
      }
      /* …and a grid's Primary — its leading column, pinned — and Secondary: a pivot,
         each row opening on its own rows. Will, TODOs 548, 570 */
      const shown = context.presented(scope, 'grid');
      const lead = shown.primary ?? cols[0]?.field;
      const fallback = context.presented(scope, 'grid', false).primary ?? cols[0]?.field;
      const axes = context.honours('axes');
      const kept = context.presentation(scope);
      Object.assign(out, {
        // Off, no chip offers them; the chain stays, so Group loses its Primary. TODOs 583, 658
        chartFields: axes ? offerAxis(cols.filter(groupable), offers.primary) : [], stacks: true,
        ...(axes ? { secondaryFields: offerAxis(cols.filter(groupable), offers.secondary) } : {}),
        ...(lead ? { primaryField: lead } : {}),
        ...(fallback ? { primaryDefault: fallback } : {}),
        ...(shown.secondary ? { secondaryField: shown.secondary } : {}),
        // Switched off, its chip keeps the field. Will, TODO 666
        ...(kept.off === 'secondary' && kept.secondary ? { secondaryOff: kept.secondary } : {}),
      });
    } else if (binding.presentsIn(scope) && binding.wholeIn(scope)) {
      // A SLOT of one number: nothing to arrange. Its empty Group clears its bar's. Will, TODO 696
      Object.assign(out, { presents: true, whole: true, group: [] });
    } else if (binding.presentsIn(scope)) {
      /* A SLOT: its Primary, its Secondary where its chart stacks — a bar chart —
         its Group, by list fields, and its order: kept in the Query, never the
         rows'. Will, TODO 548 */
      const lists = catalogue.known().map((field) => ({ field, label: catalogue.get(field)?.label ?? field })).filter(groupable);
      // Its chart's own, under what the reader changed.
      const shown = { ...binding.shownIn(scope), ...context.presented(scope, 'chart') };
      const fallback = { ...binding.shownIn(scope), ...context.presented(scope, 'chart', false) }.primary;
      const stacks = binding.stacksIn(scope);
      const secondary = stacks ? shown.secondary : undefined;
      // Each axis as the app offers it. Will, TODO 660
      const offers = context.axesOf(scope, 'chart');
      const axes = context.honours('axes');
      Object.assign(out, {
        presents: true, group: offerAxis(lists, offers.group), chartFields: axes ? offerAxis(lists, offers.primary) : [],
        ...(axes ? { secondaryFields: offerAxis(lists, offers.secondary) } : {}),
        ...(stacks ? { stacks: true } : {}),
        ...(shown.group ? { groupField: shown.group } : {}),
        ...(shown.sort ? { sortDirection: shown.sort } : {}),
        ...(shown.primary ? { primaryField: shown.primary } : {}),
        ...(fallback ? { primaryDefault: fallback } : {}),
        ...(secondary ? { secondaryField: secondary } : {}),
      });
    }
    return out;
  }

  /** The parts a scope's bar draws: a chart's legend, in its card's toolbar. Will, TODO 670 */
  partsIn(scope: string): string[] {
    return [...this.#host.parts()].flatMap(([key, part]) => (part.shownIn === scope ? [key] : []));
  }

  /** The ONE scope a View field is sent down to: the one it came UP from,
   *  while that still has it, else the first that has it — a component's, in
   *  the page's order, then a chart's own. Will, TODO 346. TRAP T-send-to-view-filters */
  #sendTo(field: string): string | undefined {
    const { context } = this.#host;
    const parts = this.#host.parts();
    const has = (scope: string): boolean =>
      scope !== VIEW && (parts.get(scope)?.field === field || context.canHold(scope, field));
    const from = cameFrom(this.#host.draft(), field);
    if (from && has(from)) return from;
    return [...this.#host.offers().keys(), ...parts.keys()].find(has);
  }

  /** A scope's own fields, as its page definition holds them: they keep their
   *  place — a reader drags only what was added. Will, TODO 452 */
  declareOwn(scope: string, fields: readonly string[]): void {
    this.#own.set(scope, new Set(fields));
  }
  /** Each scope's own fields. */
  #own = new Map<string, ReadonlySet<string>>();

  /** What a scope's bar draws after its own, that this page has no field for: the
   *  App Context's. Never in the Query. True when it changed. TODO 453 */
  declareUnused(scope: string, filters: readonly { id: string; label: string; icon?: string }[]): boolean {
    // The same list draws nothing again: a page tells it on every reader act.
    if (JSON.stringify(filters) === JSON.stringify(this.#unused.get(scope) ?? [])) return false;
    if (filters.length) this.#unused.set(scope, filters);
    else this.#unused.delete(scope);
    return true;
  }
  /** Each scope's unused filters. */
  #unused = new Map<string, readonly { id: string; label: string; icon?: string }[]>();

  /** A field's filter, as any bar or panel draws it — ONE definition, so two
   *  controls over a field cannot offer it two ways. Its options are the values
   *  the rows HOLD, never a lower-cased copy a heading's menu would not share.
   *  TRAP T-a-field-is-declared-once · TRAP T-one-comparison-rule-for-query-and-ui */
  filterDef(field: string): FieldFilter {
    const def = this.#host.catalogue.filterDef(field);
    // Its values are on their way: a menu says so. 345 phase 5
    return this.#host.unread(field) ? { ...def, loading: true } : def;
  }

  /**
   * What a scope may still ADD: the declared fields it has, less those it
   * holds or `taken` names — each saying where it lives now, when that is
   * somewhere else, because adding it here MOVES it. Declared FIELDS only, so
   * Group and Sort — which arrange one component — are never offered.
   * TRAP T-a-bar-offers-only-what-its-scope-holds
   * TRAP T-group-and-sort-are-component-scope
   */
  addable(scope: string, taken: Iterable<string> = this.#host.context.scope(scope)): FieldFilter[] {
    const { context, catalogue } = this.#host;
    // UP IS OPEN, DOWN IS CLOSED: below the View, what it holds is not offered.
    // TRAP T-component-extends-view-never-alters-it
    const skip = new Set([...taken, ...(scope === VIEW ? [] : context.scope(VIEW))]);
    return context.fields(scope).filter((f) => !skip.has(f) && catalogue.has(f)).map((f) => {
      const at = context.scopeOf(f);
      return at && at !== scope ? { ...this.filterDef(f), note: context.scopeLabel(at) } : this.filterDef(f);
    });
  }

  /** The scope whose Group or Sort set the rows' arrangement — while it still
   *  arranges; else none, and every arranging scope shows it. */
  arrangedIn(): string | undefined {
    const { scope } = this.#host.arrangement();
    return scope && this.#host.context.arranges(scope) ? scope : undefined;
  }

  /**
   * One field's whole state — picked, unpicked, the condition — ready for a
   * chip, a column menu, a legend row or anything else that draws it.
   */
  selection(field: string, label?: string): FilterState {
    return this.#host.catalogue.stateFor(field, readingOf(this.#host.draft(), field) ?? {}, label);
  }

  /** What a field is now, seen from a scope: the one answer for every control. TRAP T-one-field-one-status */
  fieldStatus(field: string, scope: string = VIEW): FieldStatus {
    const { context, catalogue } = this.#host;
    const failed = this.#host.failed();
    return fieldStatus({
      draft: this.#host.draft(),
      applied: this.#host.applied(),
      state: (f, reading) => catalogue.stateFor(f, reading),
      pending: (f) => context.pending(f),
      failed: (f) => failed.has(f),
      label: (s) => context.scopeLabel(s),
    }, field, scope);
  }

  /** A field's picks in force on one component, by its bind id, as value keys: its
   *  own part's, else the View's — applied, not drafted. A chart FREE of its field
   *  lights them. Will, TODO 479. TRAP T-a-chart-is-free-of-its-own-field */
  pickedFor(id: string, field: string): string[] {
    const applied = this.#host.applied();
    // Only picks in FORCE: not while Advanced answers, nor under "is not". TODO 518
    const picks = (r: FieldReading | undefined): string[] =>
      (r && !r.suspended && modeOf(r) !== 'advanced' && (r.op ?? DEFAULT_OP) === DEFAULT_OP ? (r.picked ?? []).map(valueKey) : []);
    for (const [scope, part] of this.#host.parts()) {
      if (part.only === id && part.field === field) {
        const own = picks(applied.scopes[scope]?.readings[field]);
        if (own.length) return own;
      }
    }
    return picks(applied.scopes[VIEW]?.readings[field]);
  }

  /**
   * TELL EACH BAR over this field's scope what it now holds — a chip, a heading
   * or the panel changed it, and the bar is a VIEW of the Query, not a copy.
   * Its CONDITIONS go too, or a chip stays blank while its field filters.
   * A SUSPENDED answer is drawn too, and SAYS it is — `suspended: true` — so a
   * bar keeps its chip off and a panel does not show an answer that filters
   * nothing. TRAP T-one-query-one-owner · TRAP T-grid-suspend-is-not-clear
   * TRAP T-a-conditioned-chip-answers-with-its-clause
   * TRAP T-a-suspended-answer-is-drawn-as-off
   */
  draw(field: string, home: string = homeOf(this.#host.draft(), field)): void {
    const draft = this.#host.draft();
    // A View answer shows in every grid's heading too.
    if (home === VIEW) this.syncHeld();
    const state = this.selection(field);
    const off = state.fieldState === 'suspended';
    // Suspended, its values are not "picked" in the state: they are the reading's own.
    const picked = off ? (readingOf(draft, field)?.picked ?? []).map(valueKey)
      : state.values.filter((v) => v.state === 'picked').map((v) => v.value);
    /* The WHOLE answer — its operator and its typed text too: "is not churned"
       drawn as "churned" is the opposite answer, and "contains an" drawn
       without its text is none. */
    // Its tree as the STATE reads it — an empty condition is none.
    const { tree: _raw, ...held } = answerOf(readingOf(draft, field) ?? {});
    const reading = { ...held, picked, ...(state.tree ? { tree: state.tree } : {}) };
    this.#host.binding.drawReading(field, reading, home);
    // A preset's field no scope holds has no home once it goes: where it sat hears that. TODO 611
    const sat = this.#presetAt.get(field);
    if (sat && sat !== home) this.#host.binding.drawReading(field, reading, sat);
    if (held.byPreset && !this.#host.context.scopeOf(field)) this.#presetAt.set(field, home);
    else this.#presetAt.delete(field);
  }
  /** Where a preset put each field no scope holds. */
  #presetAt = new Map<string, string>();

  /** Each control below the View is told what the View holds: from the draft, as a
   *  raise shows at once, each with its answer in force. TRAP T-one-field-one-status */
  syncHeld(): void {
    this.#host.binding.supersede(viewHeldReadings(this.#host.draft(), this.#host.applied()));
  }

  /** Tell each bound control over a scope its PENDING fields, whether its scope
   *  is DIRTY or waits, and the fields that FAILED to fetch. */
  syncPending(): void {
    const { context } = this.#host;
    const applied = this.#host.applied();
    const draft = this.#host.draft();
    const failed = this.#host.failed();
    this.#host.binding.syncPending((scopes) => (context.waiting()
      ? [...new Set(scopes.flatMap((id) => Object.keys({
        ...applied.scopes[id]?.readings, ...draft.scopes[id]?.readings,
      })))].filter((f) => context.pending(f))
      : []), (id) => context.dirty(id), (id) => context.named(id),
    (scopes) => [...failed].filter((f) => scopes.some((id) => context.scope(id).includes(f))),
    // Each pending field's answer as APPLIED — none yet, an empty one — so a control marks only what its draft changed. TODO 424
    (scopes, fields) => Object.fromEntries(fields.map((f) => {
      const at = scopes.find((id) => applied.scopes[id]?.readings[f]);
      return [f, at ? applied.scopes[at]!.readings[f]! : { picked: [] }] as const;
    })));
  }

  /** The SEARCH as needles, so a view marks what it found: a `contains` on each
   *  field it searches, or on every field (`*`). TRAP T-a-find-asks-its-host-to-step */
  #searchNeedles(): string {
    const term = this.#host.arrangement().search.trim().replace(/\n/g, ' ');
    if (!term) return '';
    const fields = this.#host.searchFields;
    return (fields?.length ? fields : ['*']).map((f) => `${f}:contains:${term}`).join('\n');
  }

  /** The view state every bound component is pushed. */
  boundView(): BoundView {
    const { page, pageSize, totalPages } = this.#host.paging();
    const { sort, group, sortSuspended } = this.#host.arrangement();
    const filter = this.#host.filter();
    const first = sort[0];

    /* The FIELD survives a suspend; the DIRECTION says whether it is applied.
       TRAP T-a-suspended-sort-is-one-owners-job */
    const shown = first ?? sortSuspended;
    return {
      sortField: shown?.field,
      sortDirection: first ? (first.direction ?? 'asc') : (sortSuspended ? '' : undefined),
      groupField: group ?? undefined,
      arrangedIn: this.arrangedIn(),
      filterFields: filterFields(filter, (c) => this.#host.fetchedField(c)),
      /* …and WHAT it matched on, so a component can point at the hit, whichever
         control set the filter. TRAP T-a-needle-comes-from-either-direction */
      needles: [filterNeedles(filter), this.#searchNeedles()].filter(Boolean).join('\n'),
      paging: pageSize ? { page, totalPages, pageSize } : undefined,
    };
  }
}
