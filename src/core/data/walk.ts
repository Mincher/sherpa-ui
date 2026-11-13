/**
 * walk.ts — ONE ordered pass over the rows for each scope: every count, value
 * count, grey, set-aside and serial offer, in the order the reader sees the
 * filters. A row stops at the first filter in force it fails. Pure and DOM-free.
 * TRAP T-one-walk-counts-and-limits-in-order
 *
 * Map:
 * - WalkTier — A tiered field's child, and each path's parent key.
 * - WalkStep — One filter in a scope's order: its answer, and what it counts and limits.
 * - WalkTap — A list field no filter holds, tallied where it would stand.
 * - WalkScope — One scope's walk: where it starts, its steps and its taps.
 * - WalkPlan — Every scope's walk, the View first, and the moment its dates are read at.
 * - Walk — What a walk gives, by scope.
 * - holdsKey — Does a tally hold a value key, compared as a filter compares — case aside?
 * - emptyWalk — A walk that found nothing.
 * - WalkReads — The fields one scope's walk reads: those it tests, and those it tallies.
 * - walkReads — The fields each scope's walk reads — a change to no other leaves the walk as it is.
 * - Scan — One scope's scan: its tests, and what it gathers at each step.
 * - passOver — One scan of rows through a scope's steps, from one step on.
 * - walkInOrder — Walk the rows, scope by scope.
 */
import { absoluteDates, filterFields, filterTest, readField, valueKey, type Filter, type Row } from './store.js';

/** A tiered field's child, and each path's parent key: a tally holds both tiers. TODO 369 */
export interface WalkTier {
  child: string;
  parentOf: ReadonlyMap<string, string>;
}

/** One filter in a scope's order: its answer, and what it counts and limits. */
export interface WalkStep {
  /** The field, or the saved filter's id; '' for the scope's own base. */
  id: string;
  /** A field step's field. */
  field?: string;
  /** Its whole answer, as if it were on. */
  clause?: Filter;
  /** It narrows the steps after it. */
  on: boolean;
  /** It wears a badge: the rows that reach it and match its answer. */
  counts: boolean;
  /** A list field: what greys its values and sets its picks aside — the rows at its place, or at the scope's start. */
  ruler?: 'here' | 'start';
  /** A serial set's lower field: it offers only what the rows at its place hold, once something before it narrows. */
  offers?: boolean;
  /** The value keys a plain pick in force may set aside. */
  picks?: readonly string[];
  /** Its answer less the picks set aside; undefined when none is left. */
  less?: (aside: readonly string[]) => Filter | undefined;
  /** Each pick's own clause, by value key: a count of its own. */
  each?: ReadonlyArray<readonly [key: string, clause: Filter]>;
  /** Count EVERY value of its field, by key, over the rows that reach it — only
   *  where the rows are held: a store is never asked once per value. Will, TODO 466 */
  countAll?: boolean;
  /** A tiered field: its tally holds each row's path too. */
  tier?: WalkTier;
}

/** A list field no filter holds, tallied where it would stand: before step `at`. */
export interface WalkTap {
  at: number;
  field: string;
  ruler: 'here' | 'start';
  tier?: WalkTier;
  /** Count every value, by key, over the rows that reach `at`. TODO 466 */
  countAll?: boolean;
}

/** One scope's walk: it starts from the rows `after` ends with — every row for null. */
export interface WalkScope {
  scope: string;
  after: string | null;
  steps: readonly WalkStep[];
  taps: readonly WalkTap[];
  /** A pick may be set aside — never a chart part's (Q1 A). */
  setsAside: boolean;
}

/** Every scope's walk, the View first, and the moment its dates are read at. */
export interface WalkPlan {
  scopes: readonly WalkScope[];
  now: Date;
}

/** What a walk gives, by scope. */
export interface Walk {
  /** Each counted step's rows, by its id. */
  results: Record<string, Record<string, number>>;
  /** Each pick's own rows, by field then value key. */
  values: Record<string, Record<string, Record<string, number>>>;
  /** The value keys each list field's ruler leaves. */
  present: Record<string, Record<string, string[]>>;
  /** What each lower field of a serial set offers. */
  offered: Record<string, Record<string, string[]>>;
  /** The picks set aside, by field. */
  aside: Record<string, Record<string, string[]>>;
  /** The tapped fields with no value left. */
  spent: Record<string, string[]>;
  /** The rows each scope ends with. Step by step, its last step in force's count — none in force, the one before's. */
  ends: Record<string, number>;
}

/** Does a tally hold a value key, compared as a filter compares — case aside?
 *  A pick that matches rows is never ruled out. TRAP T-loose-equal-is-case-insensitive */
export function holdsKey(keys: Iterable<string>, key: string): boolean {
  const low = key.toLowerCase();
  for (const k of keys) if (k === key || k.toLowerCase() === low) return true;
  return false;
}

/** A walk that found nothing. */
export function emptyWalk(): Walk {
  return { results: {}, values: {}, present: {}, offered: {}, aside: {}, spent: {}, ends: {} };
}

/** The fields one scope's walk reads: those it tests, and those it tallies. */
export interface WalkReads {
  tested: string[];
  tallied: string[];
}

/** The fields each scope's walk reads — a change to no other leaves the walk as
 *  it is. A step tests only while it is on or counts.
 *  TRAP T-one-walk-counts-and-limits-in-order · TRAP T-a-change-redoes-only-what-reads-it */
export function walkReads(plan: WalkPlan): Record<string, WalkReads> {
  const out: Record<string, WalkReads> = {};
  for (const sc of plan.scopes) {
    const tested = new Set<string>();
    const tallied = new Set<string>();
    for (const step of sc.steps) {
      if (step.clause && (step.on || step.counts)) for (const f of filterFields(step.clause)) tested.add(f);
      for (const [, clause] of step.each ?? []) for (const f of filterFields(clause)) tested.add(f);
      if (step.field && step.countAll) tallied.add(step.field);
      if (step.field && (step.ruler || step.offers)) {
        tallied.add(step.field);
        if (step.tier) tallied.add(step.tier.child);
      }
    }
    for (const tap of sc.taps) {
      tallied.add(tap.field);
      if (tap.tier) tallied.add(tap.tier.child);
    }
    out[sc.scope] = { tested: [...tested], tallied: [...tallied] };
  }
  return out;
}

/** One scope's scan: its tests, and what it gathers at each step. */
export interface Scan {
  steps: readonly WalkStep[];
  /** Each step's test now, its dates made absolute once. */
  tests: Array<Filter | undefined>;
  eachTests: Array<Filter[] | null>;
  /** Does step i tally its field? */
  tallied: boolean[];
  /** Fields tallied at each place, for a tap ruled where it stands. */
  tapsAt: Map<number, string[]>;
  /** Fields tallied over every row the scope starts with. */
  startFields: string[];
  /** A tiered field's child, by field. */
  childOf: Map<string, string>;
  tally: Array<Set<string>>;
  count: number[];
  each: number[][];
  /** Each value's count at a step that counts them all. TODO 466 */
  all: Array<Map<string, number> | null>;
  /** The taps that count every value, by place, and their counts. TODO 466 */
  countsAt: Map<number, string[]>;
  tapCounts: Map<number, Map<string, Map<string, number>>>;
  tapTally: Map<number, Map<string, Set<string>>>;
  start: Map<string, Set<string>>;
}

/** A row's value keys for a field — each item of a list cell alone (`cellValues`), none for an empty one, as
 *  `presentUnder` reads them — each handed to `take`, with no list made for a single value. */
function eachKey(row: Row, field: string, take: (key: string) => void): void {
  const v = readField(row, field);
  if (Array.isArray(v)) {
    for (const item of v) if (item != null && item !== '') take(valueKey(item));
  } else if (v != null && v !== '') take(valueKey(v));
}

/** A row's keys for a field: its values', and a tiered field's path's — as
 *  `valueKey` writes the pair, its names sorted, with no object made per row. */
function addKeys(keys: Set<string>, row: Row, field: string, child: string | undefined): void {
  eachKey(row, field, (key) => {
    keys.add(key);
    if (child) eachKey(row, child, (c) => keys.add(child < field ? `{${child}:${c},${field}:${key}}` : `{${field}:${key},${child}:${c}}`));
  });
}

function add(into: Map<string, Set<string>>, row: Row, field: string, child: string | undefined): void {
  let keys = into.get(field);
  if (!keys) into.set(field, (keys = new Set()));
  addKeys(keys, row, field, child);
}

/** The taps at a place: each tallies its field over the rows that reach it. */
function tapAt(scan: Scan, at: number, row: Row): void {
  const fields = scan.tapsAt.get(at);
  if (!fields) return;
  let tallies = scan.tapTally.get(at);
  if (!tallies) scan.tapTally.set(at, (tallies = new Map()));
  for (const f of fields) add(tallies, row, f, scan.childOf.get(f));
}

/** The taps at a place that count every value: each counts its row's. TODO 466 */
function countAt(scan: Scan, at: number, row: Row): void {
  const fields = scan.countsAt.get(at);
  if (!fields) return;
  let counts = scan.tapCounts.get(at);
  if (!counts) scan.tapCounts.set(at, (counts = new Map()));
  for (const f of fields) {
    let by = counts.get(f);
    if (!by) counts.set(f, (by = new Map()));
    const tally = by;
    eachKey(row, f, (key) => tally.set(key, (tally.get(key) ?? 0) + 1));
  }
}

/** ONE scan: each row, from step `from`, is tallied and counted at each step it
 *  reaches, and stops at the first step in force it fails. Gives the step each
 *  row stopped at — the step count for a row that passed them all. */
export function passOver(rows: readonly Row[], scan: Scan, from: number): Uint32Array {
  const { steps } = scan;
  const n = steps.length;
  // Each test made once for the pass, not read again for each row. TODO 291
  const tests = scan.tests.map((t) => t && filterTest(t));
  const eachTests = scan.eachTests.map((e) => e?.map((f) => filterTest(f)) ?? null);
  const stopped = new Uint32Array(rows.length);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    if (from === 0) for (const f of scan.startFields) add(scan.start, row, f, scan.childOf.get(f));
    let i = from;
    for (; i < n; i++) {
      tapAt(scan, i, row);
      countAt(scan, i, row);
      const step = steps[i]!;
      if (scan.tallied[i]) addKeys(scan.tally[i]!, row, step.field!, step.tier?.child);
      const all = scan.all[i];
      if (all) eachKey(row, step.field!, (key) => all.set(key, (all.get(key) ?? 0) + 1));
      const each = eachTests[i];
      if (each) for (let k = 0; k < each.length; k++) if (each[k]!(row)) scan.each[i]![k]!++;
      const test = tests[i];
      if (!test) continue;
      const hit = test(row);
      if (hit && step.counts) scan.count[i]!++;
      if (step.on && !hit) break;
    }
    if (i === n) {
      tapAt(scan, n, row);
      countAt(scan, n, row);
    }
    stopped[r] = i;
  }
  return stopped;
}

/** A scope's scan, before any row. */
function scanOf(sc: WalkScope, now: Date): Scan {
  const steps = sc.steps;
  const tapsAt = new Map<number, string[]>();
  for (const tap of sc.taps) if (tap.ruler === 'here') tapsAt.set(tap.at, [...(tapsAt.get(tap.at) ?? []), tap.field]);
  const countsAt = new Map<number, string[]>();
  for (const tap of sc.taps) if (tap.countAll) countsAt.set(tap.at, [...(countsAt.get(tap.at) ?? []), tap.field]);
  const startFields = [...new Set([
    ...steps.filter((s) => s.field && s.ruler === 'start').map((s) => s.field!),
    ...sc.taps.filter((t) => t.ruler === 'start').map((t) => t.field),
  ])];
  return {
    steps,
    // A step neither on nor counted would test each row for nothing.
    tests: steps.map((s) => (s.clause && (s.on || s.counts) ? absoluteDates(s.clause, now) : undefined)),
    eachTests: steps.map((s) => (s.each?.length ? s.each.map(([, c]) => absoluteDates(c, now)) : null)),
    tallied: steps.map((s) => !!s.field && (s.ruler === 'here' || !!s.offers)),
    tapsAt,
    startFields,
    childOf: new Map([...steps, ...sc.taps].flatMap((s) => (s.field && s.tier ? [[s.field, s.tier.child] as const] : []))),
    tally: steps.map(() => new Set<string>()),
    count: steps.map(() => 0),
    each: steps.map((s) => (s.each ?? []).map(() => 0)),
    all: steps.map((s) => (s.countAll && s.field ? new Map() : null)),
    countsAt,
    tapCounts: new Map(),
    tapTally: new Map(),
    start: new Map(),
  };
}

/** Clear what steps from `j` on gathered: they are scanned again. */
function resetFrom(scan: Scan, j: number): void {
  for (let i = j; i < scan.steps.length; i++) {
    scan.tally[i] = new Set();
    scan.count[i] = 0;
    scan.each[i] = scan.each[i]!.map(() => 0);
    if (scan.all[i]) scan.all[i] = new Map();
  }
  for (const at of [...scan.tapTally.keys()]) if (at >= j) scan.tapTally.delete(at);
  for (const at of [...scan.tapCounts.keys()]) if (at >= j) scan.tapCounts.delete(at);
}

/** Does this scope gather anything, or narrow anything? If not, it ends where it starts. */
function needsScan(scan: Scan): boolean {
  return scan.tests.some(Boolean) || scan.tallied.some(Boolean) || scan.tapsAt.size > 0 || scan.countsAt.size > 0
    || scan.startFields.length > 0 || scan.eachTests.some(Boolean) || scan.all.some(Boolean);
}

/**
 * Walk the rows, scope by scope: the View from every row, a component scope
 * from the View's end, a part from its host's. A pick its ruler rules out is
 * set aside, and the rows from that step are scanned again with what is left —
 * so the end is exact, whatever loose matching the filter does.
 */
export function walkInOrder(rows: readonly Row[], plan: WalkPlan): Walk {
  const out = emptyWalk();
  const ends = new Map<string, { rows: readonly Row[]; narrowed: boolean }>();
  for (const sc of plan.scopes) {
    const from = sc.after !== null ? ends.get(sc.after) : undefined;
    const start = from?.rows ?? rows;
    const scan = scanOf(sc, plan.now);
    const steps = sc.steps;
    const n = steps.length;
    const inForce = (i: number): boolean => steps[i]!.on && !!scan.tests[i];
    const narrowedAt = (i: number): boolean => (from?.narrowed ?? false) || steps.slice(0, i).some((_, k) => inForce(k));
    const stopped = needsScan(scan) ? passOver(start, scan, 0) : null;
    const aside: Record<string, string[]> = {};
    if (stopped && sc.setsAside) {
      for (let j = 0; j < n; j++) {
        const step = steps[j]!;
        if (!inForce(j) || !step.picks?.length || !step.less || !step.field) continue;
        const ruled = step.ruler === 'here' ? scan.tally[j] : step.ruler === 'start' ? scan.start.get(step.field) ?? new Set() : null;
        const offered = step.offers && narrowedAt(j) ? scan.tally[j] : null;
        /* Over the rows that reach it, a pick matches by its OWN clause — the
           filter's own test, so a blank counts too; the key tally knows no blank.
           TODO 518 */
        const own = new Map((step.each ?? []).map(([key], k) => [key, scan.each[j]![k]!] as const));
        const holdsHere = (keys: Set<string>, k: string): boolean => (own.has(k) ? own.get(k)! > 0 : holdsKey(keys, k));
        const ruledOut = step.picks.filter((k) => (ruled && !(step.ruler === 'here' ? holdsHere(ruled, k) : holdsKey(ruled, k)))
          || (offered && !holdsHere(offered, k)));
        /* Every pick ruled out: the filter STAYS in force — its chip active, its
           count 0 — so the reader sees it, and clears it or turns it off.
           Will, 2026-10-20. TRAP T-a-ruled-out-value-is-greyed */
        if (!ruledOut.length || ruledOut.length === step.picks.length) continue;
        aside[step.field] = ruledOut;
        const less = step.less(ruledOut);
        scan.tests[j] = less && absoluteDates(less, plan.now);
        // The rows that reached step j are scanned again from it.
        const again: Row[] = [];
        const at: number[] = [];
        stopped.forEach((s, r) => {
          if (s >= j) {
            again.push(start[r]!);
            at.push(r);
          }
        });
        resetFrom(scan, j);
        const next = passOver(again, scan, j);
        at.forEach((r, k) => { stopped[r] = next[k]!; });
      }
    }
    const results: Record<string, number> = {};
    const values: Record<string, Record<string, number>> = {};
    const present: Record<string, string[]> = {};
    const offered: Record<string, string[]> = {};
    steps.forEach((step, i) => {
      if (step.counts && scan.tests[i]) results[step.id] = scan.count[i]!;
      if (!step.field) return;
      // Every value's count, then each pick's own, which a path or a parent may differ from.
      const all = scan.all[i] ? Object.fromEntries(scan.all[i]!) : {};
      if (step.each?.length || scan.all[i]) {
        values[step.field] = { ...all, ...Object.fromEntries((step.each ?? []).map(([key], k) => [key, scan.each[i]![k]!])) };
      }
      if (step.ruler) present[step.field] = [...(step.ruler === 'here' ? scan.tally[i]! : scan.start.get(step.field) ?? [])];
      if (step.offers && narrowedAt(i)) offered[step.field] = [...scan.tally[i]!];
    });
    const spent: string[] = [];
    for (const tap of sc.taps) {
      const keys = [...(tap.ruler === 'here' ? scan.tapTally.get(tap.at)?.get(tap.field) ?? [] : scan.start.get(tap.field) ?? [])];
      present[tap.field] = keys;
      if (tap.countAll) values[tap.field] = Object.fromEntries(scan.tapCounts.get(tap.at)?.get(tap.field) ?? []);
      if (!keys.length) spent.push(tap.field);
    }
    const endRows = stopped ? start.filter((_, r) => stopped[r] === n) : start;
    out.results[sc.scope] = results;
    out.values[sc.scope] = values;
    out.present[sc.scope] = present;
    out.offered[sc.scope] = offered;
    out.aside[sc.scope] = aside;
    out.spent[sc.scope] = spent;
    out.ends[sc.scope] = endRows.length;
    ends.set(sc.scope, { rows: endRows, narrowed: narrowedAt(n) });
  }
  return out;
}
