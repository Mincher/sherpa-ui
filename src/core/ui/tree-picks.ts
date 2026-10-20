/**
 * tree-picks.ts — what a menu's tree of tiered values has ticked, as DATA: the
 * boxes are drawn from it. DOM-free. TRAP T-a-tree-menu-keeps-its-ticks-as-data
 *
 * Map:
 * - TreeBox — What one box shows: ticked, some of its children, or not.
 * - TreePicks — A tiered list's ticks, as data: a parent, or some of its children.
 * - .kids — A parent's children, in order.
 * - .parentOf — A child's parent.
 * - .values — The picks, in the items' order: a child under a picked parent says nothing more.
 * - .set — Take these picks, as the values give them.
 * - .box — What one box shows.
 * - .tick — Tick or untick one box, as a reader does.
 * - .all — Every parent ticked, or none — of those `can` allows.
 * - .allBox — What Select all shows.
 */

/** What one box shows: ticked, some of its children, or not. */
export type TreeBox = 'on' | 'some' | 'off';

/**
 * A tiered list's ticks, as DATA, and the boxes drawn from it. A parent is
 * picked whole, or some of its children are, as paths. Ticking every child
 * does not pick the parent (Will, 369 Q1 A); unticking one child of a picked
 * parent picks the others. TRAP T-a-tree-menu-keeps-its-ticks-as-data
 */
export class TreePicks {
  /** Every value, in the items' order. */
  readonly #order: readonly string[];
  /** Each child's parent. */
  readonly #parent = new Map<string, string>();
  /** Each parent's children, in order. */
  readonly #kids = new Map<string, string[]>();
  /** The values with no parent. */
  readonly #tops: readonly string[];
  /** The picks: a parent whole, or a child whose parent is not picked. */
  #picked = new Set<string>();

  constructor(items: ReadonlyArray<{ value: string; parent?: string }>, picked: Iterable<string> = []) {
    this.#order = items.map((i) => i.value);
    for (const { value, parent } of items) {
      if (parent === undefined) continue;
      this.#parent.set(value, parent);
      this.#kids.set(parent, [...(this.#kids.get(parent) ?? []), value]);
    }
    this.#tops = this.#order.filter((v) => !this.#parent.has(v));
    this.set(picked);
  }

  /** A parent's children, in order. */
  kids(parent: string): readonly string[] {
    return this.#kids.get(parent) ?? [];
  }

  /** A child's parent. */
  parentOf(value: string): string | undefined {
    return this.#parent.get(value);
  }

  /** The picks, in the items' order: a child under a picked parent says nothing more. */
  get values(): string[] {
    return this.#order.filter((v) => this.#picked.has(v));
  }

  /** Take these picks, as the values give them. */
  set(values: Iterable<string>): void {
    const next = new Set(values);
    for (const v of next) {
      const p = this.#parent.get(v);
      if (p !== undefined && next.has(p)) next.delete(v);
    }
    this.#picked = next;
  }

  /** What one box shows. */
  box(value: string): TreeBox {
    if (this.#picked.has(value)) return 'on';
    const p = this.#parent.get(value);
    if (p !== undefined) return this.#picked.has(p) ? 'on' : 'off';
    return this.kids(value).some((k) => this.#picked.has(k)) ? 'some' : 'off';
  }

  /** Tick or untick one box, as a reader does. */
  tick(value: string, on: boolean): void {
    const p = this.#parent.get(value);
    if (p === undefined) {
      for (const k of this.kids(value)) this.#picked.delete(k);
      if (on) this.#picked.add(value);
      else this.#picked.delete(value);
    } else if (this.#picked.has(p)) {
      if (on) return;
      this.#picked.delete(p);
      for (const k of this.kids(p)) if (k !== value) this.#picked.add(k);
    } else if (on) this.#picked.add(value);
    else this.#picked.delete(value);
  }

  /** Every parent ticked, or none — of those `can` allows. */
  all(on: boolean, can: (value: string) => boolean = () => true): void {
    for (const t of this.#tops) if (can(t)) this.tick(t, on);
  }

  /** What Select all shows. */
  allBox(can: (value: string) => boolean = () => true): TreeBox {
    if (!this.#picked.size) return 'off';
    return this.#tops.every((t) => this.#picked.has(t) || !can(t)) ? 'on' : 'some';
  }
}
