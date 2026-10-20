/**
 * field-catalogue.ts — what each field IS: its kind, its name, and the values
 * it may take. A DataSource holds one. DOM-free.
 *
 * Map:
 * - FieldCatalogue — Each field's declared kind and label, and every value it can take.
 * - .declareChildren — Keep a tiered field's child values per parent, from the rows' pairs.
 * - .pathOf — A child pick: its parent's value and its own, by field.
 * - .declareValues — Keep every value a field can take, as the data holds them, once per key.
 * - .declare — Add to a field's declared kind and label.
 * - .get — A field's declaration, live, or undefined.
 * - .has — Has this field been declared?
 * - .carriesOver — Does this field keep its answer across Views?
 * - .copyOf — A copy of a field's declaration.
 * - .declared — Every declared field, live.
 * - .facts — What a field's clause needs to know: its values, kind and label.
 * - .stateFor — One field's state from a reading.
 * - .filterDef — A field's filter, as any bar or panel draws it.
 * - .valuesFor — A copy of a field's declared values.
 * - .byKey — A field's declared values, by their string key.
 * - .isList — A field whose values are a list a control offers one by one.
 * - .fromRows — Declare each field its schema says nothing of from the values the rows hold.
 */
import { compareValues, valueKey } from './store.js';
import { fieldState, type FieldFacts, type FieldReading, type FilterState } from './filter-state.js';
import { report } from './report.js';
import type { FieldDeclaration, FieldFilter } from './data-source-types.js';

/** Steps a number slider may take. */
const NICE_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/** A step that gives a slider over this span about 200 stops. */
function niceStep(span: number): number {
  return span <= 1000 ? 1 : (NICE_STEPS.find((n) => n >= span / 200) ?? 1000);
}

/** Each field's declared kind and label, and every value it can take. */
export class FieldCatalogue {
  /** Every value a field can take, for the controls that draw its rows. */
  #domains = new Map<string, unknown[]>();
  /** A field's declared KIND and label. TRAP T-the-field-type-decides-the-clause */
  #fields = new Map<string, FieldDeclaration>();
  /** A tiered field's CHILD values, by its parent value's key — apart from its
   *  domain, so a chart or a legend never sees one. TODO 369 */
  #children = new Map<string, Map<string, unknown[]>>();

  /** Keep a tiered field's child values per parent, from the rows' [parent,
   *  child] pairs: once per key, in order. TODO 369 */
  declareChildren(field: string, pairs: Iterable<readonly [unknown, unknown]>): void {
    const by = new Map<string, Map<string, unknown>>();
    for (const [parent, child] of pairs) {
      if (parent == null || parent === '' || child == null || child === '') continue;
      const kids = by.get(valueKey(parent)) ?? new Map<string, unknown>();
      by.set(valueKey(parent), kids);
      if (!kids.has(valueKey(child))) kids.set(valueKey(child), child);
    }
    const sorted = (kids: Map<string, unknown>): unknown[] => [...kids.values()].sort((a, b) => compareValues(valueKey(a), valueKey(b)));
    this.#children.set(field, new Map([...by].map(([key, kids]) => [key, sorted(kids)])));
  }

  /** A child pick: its parent's value and its own, by field — keyed by `valueKey`. */
  pathOf(field: string, parent: unknown, child: unknown): Record<string, unknown> | null {
    const childField = this.#fields.get(field)?.child;
    return childField ? { [field]: parent, [childField]: child } : null;
  }

  /** A tiered field's paths, in tree order: each parent's own, after it. */
  #paths(field: string): { key: string; path: Record<string, unknown>; parent: string; child: unknown }[] {
    const kids = this.#children.get(field);
    if (!kids) return [];
    return this.valuesFor(field).flatMap((parent) => (kids.get(valueKey(parent)) ?? []).map((child) => {
      const path = this.pathOf(field, parent, child)!;
      return { key: valueKey(path), path, parent: valueKey(parent), child };
    }));
  }

  /** Keep every value a field can take, as the data holds them, once per key. */
  declareValues(field: string, values: readonly unknown[]): void {
    /* Kept AS THE DATA HOLDS THEM, de-duplicated by key.
       TRAP T-a-value-can-be-an-object */
    const seen = new Map<string, unknown>();
    for (const v of values) if (!seen.has(valueKey(v))) seen.set(valueKey(v), v);
    this.#domains.set(field, [...seen.values()]);
  }

  /** Add to a field's declared kind and label. */
  declare(field: string, facts: FieldDeclaration = {}): void {
    const held = this.#fields.get(field) ?? {};
    this.#fields.set(field, { ...held, ...facts });
  }

  /** A field's declaration, live, or undefined. */
  get(field: string): FieldDeclaration | undefined {
    return this.#fields.get(field);
  }

  /** Has this field been declared? */
  has(field: string): boolean {
    return this.#fields.has(field);
  }

  /** Does this field keep its answer across Views? */
  carriesOver(field: string): boolean {
    return !!this.#fields.get(field)?.carryOver;
  }

  /** A copy of a field's declaration. */
  copyOf(field: string): FieldDeclaration {
    return { ...(this.#fields.get(field) ?? {}) };
  }

  /** Every declared field, live. */
  declared(): Iterable<[string, FieldDeclaration]> {
    return this.#fields.entries();
  }

  /** What a field's clause needs to know: its values, kind and label.
   *  A RANGE field has no declared list, and passing an empty one would say
   *  it has no values at all. TRAP T-the-field-type-decides-the-clause */
  facts(field: string, label?: string): Omit<FieldFacts, 'field'> {
    const facts = this.#fields.get(field) ?? {};
    const values = this.#domains.get(field);
    const named = label ?? facts.label;
    // A tiered field's children: each path's parent and its own name. TODO 369
    const paths = this.#paths(field);
    const childLabels = facts.child ? this.#fields.get(facts.child)?.labels : undefined;
    return {
      ...(values ? { values } : {}),
      ...(paths.length ? {
        child: facts.child!,
        parentOf: new Map(paths.map((p) => [p.key, p.parent])),
        labels: Object.fromEntries(paths.map((p) => [p.key, childLabels?.[valueKey(p.child)] ?? valueKey(p.child)])),
      } : {}),
      ...(facts.type ? { type: facts.type } : {}),
      ...(facts.time ? { time: true } : {}),
      ...(facts.thresholds ? { thresholds: facts.thresholds } : {}),
      ...(named ? { label: named } : {}),
    };
  }

  /** One field's state from a reading. */
  stateFor(field: string, reading: FieldReading, label?: string): FilterState {
    return fieldState({ field, ...this.facts(field, label) }, reading);
  }

  /** A field's filter, as any bar or panel draws it. */
  filterDef(field: string): FieldFilter {
    const { type, label, labels, ...rest } = this.#fields.get(field) ?? {};
    const body = type === 'number' || type === 'date' ? type : undefined;
    const values = body || rest.advanced === 'only' ? [] : this.valuesFor(field).map(valueKey);
    // A date's declared values are the days a calendar may pick. TRAP T-a-date-chip-names-its-field
    const days = type === 'date' ? this.valuesFor(field).map(String) : [];
    // A tiered field lists each parent, then its children, each naming its parent. TODO 369
    const kids = new Map<string, { value: string; label: string; parent: string }[]>();
    const childLabels = rest.child ? this.#fields.get(rest.child)?.labels : undefined;
    for (const p of this.#paths(field)) {
      const list = kids.get(p.parent) ?? [];
      list.push({ value: p.key, label: childLabels?.[valueKey(p.child)] ?? valueKey(p.child), parent: p.parent });
      kids.set(p.parent, list);
    }
    const options = values.flatMap((v) => [{ value: v, label: labels?.[v] ?? v }, ...(kids.get(v) ?? [])]);
    return {
      id: field, label: label ?? field, ...rest,
      ...(body ? { kind: body } : {}),
      ...(options.length ? { options } : {}),
      ...(days.length ? { availableDates: days } : {}),
    };
  }

  /** A copy of a field's declared values. */
  valuesFor(field: string): unknown[] {
    return [...(this.#domains.get(field) ?? [])];
  }

  /** A field's declared values, by their string key — a tiered field's paths too. */
  byKey(field: string): Map<string, unknown> {
    const out = new Map<string, unknown>();
    for (const v of this.#domains.get(field) ?? []) out.set(valueKey(v), v);
    for (const p of this.#paths(field)) out.set(p.key, p.path);
    return out;
  }

  /** A field whose values are a list a control offers one by one. */
  isList(field: string): boolean {
    const facts = this.#fields.get(field) ?? {};
    return this.#domains.has(field) && facts.type !== 'number' && facts.type !== 'date'
      && facts.advanced !== 'only';
  }

  /** Declare each field its schema says nothing of from the values the rows hold. */
  async fromRows(fields: readonly string[], read: (open: readonly string[]) => Promise<Record<string, unknown[]>>): Promise<void> {
    const open = fields.filter((f) => {
      const facts = this.#fields.get(f) ?? {};
      if (facts.type === 'number') return facts.min == null || facts.max == null;
      return facts.advanced !== 'only' && !this.#domains.has(f);
    });
    let found: Record<string, unknown[]> = {};
    try {
      if (open.length) found = await read(open);
    } catch (error) {
      /* A store that cannot answer yet must not stop the page: its fields
         offer no values, and the first load shows the failure on its card.
         TRAP T-a-container-shows-its-datas-state */
      report({
        code: 'values-unread',
        message: 'declareFromRows: the rows could not be read, so these fields offer no values yet.',
        at: { fields: open.join(','), error: error instanceof Error ? error.message : String(error) },
      });
    }
    for (const field of fields) {
      const facts = this.#fields.get(field) ?? {};
      const held = open.includes(field) ? (found[field] ?? []).filter((v) => v != null && v !== '') : [];
      if (facts.type !== 'number') {
        const unique = [...new Map(held.map((v) => [valueKey(v), v])).values()];
        if (unique.length) this.declareValues(field, unique.sort((a, b) => compareValues(valueKey(a), valueKey(b))));
        continue;
      }
      const nums = held.map(Number).filter(Number.isFinite);
      const min = facts.min ?? (nums.length ? Math.floor(nums.reduce((a, b) => Math.min(a, b))) : undefined);
      const max = facts.max ?? (nums.length ? Math.ceil(nums.reduce((a, b) => Math.max(a, b))) : undefined);
      if (min == null || max == null) continue;
      this.declare(field, { min, max, step: facts.step ?? niceStep(max - min) });
    }
  }
}
