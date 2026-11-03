/**
 * provider-highlight.ts — what the pointer rests on, and every component that
 * draws its matches: lit again from what it last drew, so nothing loads.
 * Will, TODOs 449, 655 · TRAP T-a-hovered-chip-previews-the-highlight
 *
 * Map:
 * - Hovered — What the pointer rests on: a chip, one value of it, or a legend row.
 * - ProviderHighlight — The hover of one provider's subtree, and what draws it.
 * - .hovered — What the pointer rests on, or null.
 * - .hover — Light what a field of a scope matches, or one value of it; `on: false` stops.
 * - .forget — The page went: so does a rest on it.
 * - .light — Every component that draws the hover, drawn again where its test changed.
 * - .test — The hover's test for one component, where it reaches it — kept as what it draws.
 * - .follow — A component draws the hover: drawn again from what it has, where its test changed.
 * - .leave — A component no longer draws the hover.
 */
import { VIEW } from '../../core/data/query.js';
import type { Row } from '../../core/data/store.js';
import type { DataSource } from '../../core/data/data-source.js';

/** What the pointer rests on while it lights its matches: a chip, one value of it, or a legend row. */
export interface Hovered {
  scope: string;
  field: string;
  value?: string;
}

/** A hover's test: which rows it matches. */
type Test = ((row: Row) => boolean) | null;

/** The hover of one provider's subtree, and what draws it. */
export class ProviderHighlight {
  /** The app's choice: the highlight reaches every scope. */
  readonly #across: () => boolean;
  /** What the pointer rests on. The page's, never the Query's: nothing loads, nothing is saved. */
  #hovered: Hovered | null = null;
  /** This hover's test, asked once of each source. */
  readonly #tests = new Map<DataSource, Test>();
  /** Each component that draws a hover's matches, and how it draws them again. */
  readonly #lights = new Map<Element, () => void>();
  /** The test each of them was last drawn with. */
  readonly #shown = new WeakMap<Element, Test>();

  constructor(across: () => boolean) {
    this.#across = across;
  }

  /** What the pointer rests on, or null. */
  get hovered(): Hovered | null {
    return this.#hovered ? { ...this.#hovered } : null;
  }

  /** Light what a field of a scope matches — or one value of it — as a rest on its
   *  chip or legend row does; `on: false` stops. Will, TODO 655 */
  hover(scope: string, field: string, on = true, value?: string): void {
    const was = this.#hovered;
    if (on ? was?.scope === scope && was.field === field && was.value === value : !was || was.scope !== scope || was.field !== field) return;
    this.#hovered = on ? { scope, field, ...(value != null ? { value } : {}) } : null;
    this.#tests.clear();
    this.light();
  }

  /** The page went: so does a rest on it. */
  forget(): void {
    this.#hovered = null;
    this.#tests.clear();
  }

  /** Every component that draws the hover, drawn again where its test changed. */
  light(): void {
    for (const relight of this.#lights.values()) relight();
  }

  /** The hover's test for one component, where it reaches it: across every scope,
   *  from the View, in its own scope, or a chart's own part — kept as what it draws.
   *  TODOs 467, 520, 529. TRAP T-the-highlight-reaches-the-whole-page */
  test(el: Element, scope: string | readonly string[] | undefined, source: DataSource): Test {
    const test = this.#lit(el, scope, source);
    this.#shown.set(el, test);
    return test;
  }

  /** The hover's test for one component, where it reaches it. */
  #lit(el: Element, scope: string | readonly string[] | undefined, source: DataSource): Test {
    const hovered = this.#hovered;
    if (!hovered) return null;
    const reaches = this.#across() || hovered.scope === VIEW || source.query.partFacts(hovered.scope)?.only === el
      || (typeof scope === 'string' ? scope === hovered.scope : !!scope?.includes(hovered.scope));
    if (!reaches) return null;
    if (!this.#tests.has(source)) this.#tests.set(source, source.highlightTest(hovered));
    return this.#tests.get(source) ?? null;
  }

  /** A component draws the hover: a hover draws it again from what it has, where
   *  its test changed — nothing loads. TODO 655 */
  follow(el: Element, scope: string | readonly string[] | undefined, source: DataSource, redraw: (test: Test) => void): void {
    this.#lights.set(el, () => {
      const test = this.#lit(el, scope, source);
      if (test === (this.#shown.get(el) ?? null)) return;
      this.#shown.set(el, test);
      redraw(test);
    });
  }

  /** A component no longer draws the hover. */
  leave(el: Element): void {
    this.#lights.delete(el);
  }
}
