/**
 * filter-host-controller.ts — what a filter host is TOLD, field by field, kept
 * once, and each draw answered once: a bar, its column and a grid's headings
 * only place chips and menus, and ask it. Plan 695 P2
 *
 * Map:
 * - FieldPlace — Where a host draws one field: the field, and its chip.
 * - FilterHost — What the controller asks of its host.
 * - FilterHostController — What a host is told, by field, and each draw answered once.
 * - .drawPresent — What the filters before each field leave: every place limited again.
 * - .drawOffered — What each chained field offers: every place limited again.
 * - .present — What the filters before a field leave, or null: not limited.
 * - .limits — Both, whole, as last told.
 * - .spent — Was a field told it has no value left?
 * - .limit — One place's menu and value chips told its field's limits; none held above.
 * - .limitAll — Every place limited again.
 * - .supersede — The fields a scope above holds, each with its answer there: false when nothing moved.
 * - .heldAbove — Does a scope above hold a field: itself, or as a tiered child its parent?
 * - .holds — Does a scope above hold this very field?
 * - .heldReading — A scope above's answer for a field.
 * - .heldAt — The scope above's name.
 * - .held — Every field a scope above holds, with its answer there.
 * - .heldFields — The fields a scope above holds.
 * - .hold — Mark one chip held above, or free; the one writer of that mark.
 * - .holdAll — Every place marked as a scope above holds its field, and that scope's presets on it.
 * - .pend — One place told whether its field waits for Apply, and whether its read failed.
 * - .pendAll — Every place told it.
 * - .drawApplied — What each field that waits holds applied: a section marks only what its draft changed.
 * - .drawResults — Each field's results, and the rows the scope's filters leave: every chip's badge.
 * - .resultAll — Every chip's badge again, from what it was told.
 * - .results — A field's results, as shown: none while its host shows none.
 * - .end — The rows the scope's filters leave, while one is in force.
 * - .drawValueResults — Each picked value's results, by field.
 * - .drawCounts — A legend's own numbers for one field; null lets them go.
 * - .countAll — Every chip that lays out its values given its counts.
 * - .drawReading — One field's answer, told: drawn now, or once its place has drawn itself.
 * - .drawWaiting — A field's answer still waiting for its place, drawn now.
 * - .draw — One answer drawn now, unless it is what the field holds.
 * - .reading — What a field holds, as drawn or set.
 * - .drawn — What a field was last drawn: undefined, never; null, empty.
 * - .keep — A field's reading set here, as it was drawn.
 * - .forget — Forget one field's reading, or every one; true when it held an answer.
 * - .fields — The fields that hold an answer.
 */
import { readingAnswered, sameReading } from '../data/query.js';
import type { FieldReading } from '../data/filter-state.js';
import { limitField, markField, markHeld, pendingFields } from './filter-host.js';
import { hidesUnmatched } from './more-menu.js';
import type { SherpaQuickFilter } from '../../components/sherpa-quick-filter/sherpa-quick-filter.js';

type Limits = Readonly<Record<string, readonly string[]>>;
type Counts = Readonly<Record<string, number>>;

/** Where a host draws one field: the field, and its chip — its menu and value chips inside. */
export interface FieldPlace {
  readonly field: string;
  readonly chip: SherpaQuickFilter;
}

/** What the controller asks of its host. */
export interface FilterHost {
  /** The host: its `data-pending`, `data-failed`, Limit, Hide unmatched and counts. */
  readonly el: HTMLElement;
  /** Each field it draws now, where. */
  places(): Iterable<FieldPlace>;
  /** The tiered field a field is the CHILD of: held above with it. TODO 577 */
  parentOf?(field: string): string | undefined;
  /** A place that draws several fields says its own limits, from the whole. TODO 490 */
  limitsOf?(place: FieldPlace, limits: { present: Limits; offered: Limits }): { present: readonly string[] | null; offered: readonly string[] | null } | undefined;
  /** Draw a field's told answer on its control. */
  paint?(field: string, reading: FieldReading): void;
  /** Is the reader working in this field's menu, a draft not applied? */
  drafting?(field: string): boolean;
  /** Has this field's place drawn itself, to take an answer? */
  ready?(field: string): boolean;
  /** …once every place has. */
  settled?(): Promise<void>;
}

/** What a host is told, by field, and each draw answered once: `BoundControl`'s, which the host's doors hand it. */
export class FilterHostController {
  /** Its host. */
  readonly #host: FilterHost;
  /** What the filters before each field leave, as last told. */
  #present: Limits = {};
  /** What each chained field offers, as last told. */
  #offered: Limits = {};
  /** The fields a scope above holds, each with its answer there. */
  #above = new Map<string, FieldReading>();
  /** That scope's name. */
  #at: string | undefined;
  /** Each field's results. */
  #results: Counts = {};
  /** The rows the scope's filters leave. */
  #end: number | undefined;
  /** Each picked value's results, by field. */
  #valueResults: Readonly<Record<string, Counts>> = {};
  /** A legend's own numbers, by field. */
  #counts = new Map<string, Counts>();
  /** What each field holds, as last drawn or set: null, drawn empty. */
  #readings = new Map<string, FieldReading | null>();
  /** Answers told before their place drew itself: only the latest lands. */
  #waiting = new Map<string, { reading: FieldReading }>();

  constructor(host: FilterHost) {
    this.#host = host;
  }

  /* ── Limits ── TRAP T-a-ruled-out-value-is-greyed */

  /** drawPresent(present) — what the filters before each field leave: every place limited again. */
  drawPresent(present: Limits): void {
    this.#present = present;
    this.limitAll();
  }

  /** drawOffered(offered) — what each chained field offers: every place limited again. */
  drawOffered(offered: Limits): void {
    this.#offered = offered;
    this.limitAll();
  }

  /** What the filters before a field leave, as value keys, or null: not limited. */
  present(field: string): readonly string[] | null {
    return this.#present[field] ?? null;
  }

  /** Both, whole, as last told. */
  get limits(): { present: Limits; offered: Limits } {
    return { present: this.#present, offered: this.#offered };
  }

  /** Was a field told it has no value left? (349) */
  spent(field: string): boolean {
    return this.#present[field]?.length === 0;
  }

  /** One place's menu and value chips told its field's limits; none held above. Its
   *  chip is never greyed for them: a filter whose every pick is ruled out stays in
   *  force (Will, 2026-10-20). What a preset holds is its own. TODO 521 */
  limit(place: FieldPlace): void {
    const { field, chip } = place;
    const menu = chip.menu;
    if (!menu || chip.hasAttribute('data-superseded')) return;
    const values = [...chip.querySelectorAll<HTMLElement>(':scope > .value:not([data-by-preset])')];
    const own = this.#host.limitsOf?.(place, this.limits) ?? { present: this.present(field), offered: this.#offered[field] ?? null };
    limitField(values, [menu], { ...own, hide: hidesUnmatched(this.#host.el) });
    // Every value hidden: the section says why, not an empty row. Will, TODO 517
    chip.toggleAttribute('data-spent', values.length > 0 && values.every((v) => v.hasAttribute('data-removed')));
  }

  /** Every place limited again. */
  limitAll(): void {
    for (const place of this.#host.places()) this.limit(place);
  }

  /* ── Held above ── TRAP T-one-field-one-status */

  /** supersede(readings, appliedAt) — the fields a scope above holds, each with its
   *  answer there, and that scope's name. The WHOLE set each time: one not named is
   *  free. False when nothing moved — a host sends it on every change. TODO 523 F8 */
  supersede(readings: Readonly<Record<string, FieldReading>>, appliedAt?: string): boolean {
    const fields = Object.entries(readings);
    if (appliedAt === this.#at && fields.length === this.#above.size
      && fields.every(([field, reading]) => this.#above.has(field) && sameReading(this.#above.get(field), reading))) return false;
    this.#above = new Map(fields);
    this.#at = appliedAt;
    return true;
  }

  /** Does a scope above hold a field: itself, or as a tiered child its parent? TODO 577 */
  heldAbove(field: string): boolean {
    const parent = this.#host.parentOf?.(field);
    return this.#above.has(field) || (!!parent && this.#above.has(parent));
  }

  /** Does a scope above hold this very field? */
  holds(field: string): boolean {
    return this.#above.has(field);
  }

  /** A scope above's answer for a field. */
  heldReading(field: string): FieldReading | undefined {
    return this.#above.get(field);
  }

  /** The scope above's name. */
  get heldAt(): string | undefined {
    return this.#at;
  }

  /** Every field a scope above holds, with its answer there. */
  get held(): Readonly<Record<string, FieldReading>> {
    return Object.fromEntries(this.#above);
  }

  /** The fields a scope above holds. */
  get heldFields(): string[] {
    return [...this.#above.keys()];
  }

  /** Mark one chip held above, or free — and, `named`, where it is held. */
  hold(chip: Element, held: boolean, named = true): void {
    markHeld(chip, held, named ? this.#at : undefined);
  }

  /** Every place marked as a scope above holds its field: SUSPENDED, never removed,
   *  each keeping its answer; and a preset's hold on it there shows here too. TODO 613 ·
   *  TRAP T-a-superseded-chip-suspends-it-is-never-removed */
  holdAll(): void {
    for (const { field, chip } of this.#host.places()) {
      const held = this.#above.get(field);
      const was = chip.hasAttribute('data-superseded');
      this.hold(chip, !!held);
      if (held) chip.presets = held.byPreset;
      else if (was) chip.presets = undefined;
    }
  }

  /* ── Pending ── TRAP T-a-pending-chip-reads-as-a-warning */

  /** One place told whether its field waits for Apply (`data-pending` on its host)
   *  and whether its read failed; `menu`, its menu too. A SECTION is marked by its
   *  values, never its heading: they know what changed. TODO 425 */
  pend(place: FieldPlace, menu = true): void {
    const { field, chip } = place;
    const section = chip.dataset['layout'] === 'section' ? { changed: new Set<Element>() } : {};
    markField([chip], menu ? [chip.menu] : [], {
      pending: pendingFields(this.#host.el).has(field), failed: pendingFields(this.#host.el, 'failed').has(field), ...section,
    });
  }

  /** Every place told it. */
  pendAll(): void {
    for (const place of this.#host.places()) this.pend(place);
  }

  /** drawApplied(applied) — what each field that waits holds applied: a section marks
   *  only the values its draft changed. TODO 425 */
  drawApplied(applied: Readonly<Record<string, FieldReading>>): void {
    for (const { field, chip } of this.#host.places()) {
      if (chip.dataset['layout'] === 'section') chip.applied = applied[field] ?? null;
    }
  }

  /* ── Results ── TRAP T-a-chip-counts-within-the-filters-before-it */

  /** drawResults(results, scope, end) — each field's results, the rows that reach it
   *  and match its answer; `end`, the rows the scope's filters leave. A chip with none
   *  shows no number. Will, TODO 60 */
  drawResults(results: Counts, _scope?: string, end?: number): void {
    this.#results = results;
    this.#end = end;
    this.resultAll();
  }

  /** Every chip's badge again, from what it was told. */
  resultAll(): void {
    for (const { field, chip } of this.#host.places()) chip.results = this.results(field) ?? this.results(chip.dataset['id'] ?? '') ?? null;
  }

  /** A field's results, as shown: none while its host shows none. TODO 436 */
  results(field: string): number | undefined {
    return this.#host.el.hasAttribute('data-no-results') ? undefined : this.#results[field];
  }

  /** The rows the scope's filters leave, while one is in force. */
  get end(): number | undefined {
    return this.#end;
  }

  /** drawValueResults(results) — each picked value's results, by field. TODO 425 */
  drawValueResults(results: Readonly<Record<string, Counts>>): void {
    this.#valueResults = results;
    this.countAll();
  }

  /** A chart's legend, drawn here: each value's number as its chart counts it; null
   *  lets it go. Will, TODO 670 */
  drawCounts(field: string, counts: Counts | null): void {
    if (counts) this.#counts.set(field, { ...counts });
    else this.#counts.delete(field);
    this.countAll();
  }

  /** Every chip that lays out its values given its counts — a legend's, its chart's
   *  numbers; any other, none, unless the host counts every value. TODO 466 */
  countAll(): void {
    const el = this.#host.el;
    const results = el.hasAttribute('data-no-results') ? {} : this.#valueResults;
    for (const { field, chip } of this.#host.places()) {
      const laid = chip.dataset['layout'] === 'section' || chip.dataset['layout'] === 'values';
      const legend = chip.dataset['layout'] === 'values' ? this.#counts.get(field) : undefined;
      chip.valueResults = laid || el.hasAttribute('data-every-count') ? legend ?? results[field] ?? null : null;
    }
  }

  /* ── Readings ── TRAP T-one-query-one-owner */

  /** drawReading(field, reading) — one field's answer, whoever set it: drawn SILENTLY.
   *  A place that has not drawn itself takes it once it has — the latest only, and
   *  none a scope above took meanwhile. TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
  drawReading(field: string, reading: FieldReading): void {
    if (this.#host.ready?.(field) === false) {
      const held = { reading };
      this.#waiting.set(field, held);
      void this.#host.settled?.().then(() => {
        if (this.#waiting.get(field) !== held) return;
        this.#waiting.delete(field);
        if (!this.heldAbove(field) && !this.#host.drafting?.(field)) this.draw(field, reading);
      });
      return;
    }
    this.#waiting.delete(field);
    this.draw(field, reading);
  }

  /** A field's answer still waiting for its place, drawn NOW — before the reader acts on it. TODO 426 */
  drawWaiting(field: string): void {
    const held = this.#waiting.get(field);
    if (!held) return;
    this.#waiting.delete(field);
    if (!this.heldAbove(field)) this.draw(field, held.reading);
  }

  /** One answer drawn now, unless it is what the field holds: its picks in any order
   *  are the same (TODO 523 F8). Never drawn, a draft in its open menu keeps it — or,
   *  with no menu to draft in, an empty answer draws nothing. TRAP T-grid-suspend-is-not-clear */
  draw(field: string, reading: FieldReading): void {
    const said = readingAnswered(reading) ? { ...reading } : null;
    const was = this.#readings.get(field);
    if (was === undefined ? this.#host.drafting?.(field) ?? !said : sameReading(was, said)) return;
    this.#readings.set(field, said);
    this.#host.paint?.(field, reading);
  }

  /** What a field holds, as drawn or set. */
  reading(field: string): FieldReading | undefined {
    return this.#readings.get(field) ?? undefined;
  }

  /** What a field was last drawn: undefined, never; null, empty. */
  drawn(field: string): FieldReading | null | undefined {
    return this.#readings.get(field);
  }

  /** A field's reading set here, as it was drawn: null, emptied. */
  keep(field: string, reading: FieldReading | null): void {
    this.#readings.set(field, reading);
  }

  /** Forget one field's reading, or every one — or every one but `kept`'s; true when it held an answer. */
  forget(field?: string, kept?: ReadonlySet<string>): boolean {
    if (field != null) {
      const had = !!this.#readings.get(field);
      this.#readings.delete(field);
      return had;
    }
    const had = this.fields().length > 0;
    for (const f of [...this.#readings.keys()]) if (!kept?.has(f)) this.#readings.delete(f);
    return had;
  }

  /** The fields that hold an answer. */
  fields(): string[] {
    return [...this.#readings].flatMap(([field, reading]) => (reading ? [field] : []));
  }
}
