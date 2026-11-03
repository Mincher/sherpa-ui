/**
 * grid-find.ts — a grid's Find: the marks a search or a filter left in its
 * cells, the one it is on, the page it steps to, and the needles from outside
 * that mark them. A module of sherpa-data-grid, not an element. Will, TODO 136
 * TRAP T-a-find-asks-its-host-to-step
 *
 * Map:
 * - GridFind — Where a Find is among the marks, and what marks them from outside.
 * - .step — Move to the next or previous match; past this page's ends, the page to ask for.
 * - .land — The asked-for page is drawn: its first or last match.
 * - .read — `data-needles`, read: `field:op:value` per entry, newline separated.
 * - .needles — The needles from outside on one field, or every field's (`*`).
 */
import type { GridHost } from './grid-host.js';

/** One needle: what an outside filter matched on. */
type Needle = { op: string; text: string };

/** Where a Find is among the marks, and what marks them from outside. */
export class GridFind {
  /** Its grid. */
  readonly #host: Pick<GridHost, '$$'>;
  /** Where a Find lands once the page it asked for is drawn. */
  #landing: 'first' | 'last' | null = null;
  /** Needles from OUTSIDE, by field — see `data-needles`. */
  #needles = new Map<string, Needle[]>();

  constructor(host: Pick<GridHost, '$$'>) {
    this.#host = host;
  }

  /** Every mark on this page, in reading order. */
  #marks(): HTMLElement[] {
    return this.#host.$$<HTMLElement>('.cell mark.match');
  }

  /**
   * Move to the next or previous MATCH, and show it. Past this page's last it
   * names the next `page` to ask for, and lands on its first once drawn; before
   * the first, the previous page's last — round from the end, as a browser's own
   * find. `index` -1 while a page loads.
   */
  step(direction: 1 | -1, pages: number, page: number): { index: number; count: number; page?: number } {
    const marks = this.#marks();
    const at = marks.findIndex((m) => m.hasAttribute('data-current'));
    let next = at < 0 ? (direction > 0 ? 0 : marks.length - 1) : at + direction;
    if (marks.length && pages > 1 && (next < 0 || next >= marks.length)) {
      this.#landing = direction > 0 ? 'first' : 'last';
      return { index: -1, count: marks.length, page: ((page - 1 + direction + pages) % pages) + 1 };
    }
    if (!marks.length) return { index: -1, count: 0 };
    next = (next + marks.length) % marks.length;
    this.#show(marks, next);
    return { index: next, count: marks.length };
  }

  /** The asked-for page is drawn: its first or last match. */
  land(): void {
    if (!this.#landing) return;
    const marks = this.#marks();
    const to = this.#landing === 'last' ? marks.length - 1 : 0;
    this.#landing = null;
    if (marks.length) this.#show(marks, to);
  }

  /** Mark ONE match as the one a Find is on, and bring it into view. */
  #show(marks: readonly HTMLElement[], index: number): void {
    for (const [i, mark] of marks.entries()) mark.toggleAttribute('data-current', i === index);
    marks[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /** `data-needles`, read: `field:op:value` per entry, NEWLINE separated — a value
   *  may hold a comma or a space, and a typed filter is where that happens. */
  read(attr: string | undefined): void {
    this.#needles.clear();
    for (const entry of (attr ?? '').split('\n')) {
      const at = entry.indexOf(':');
      if (at < 1) continue;
      const rest = entry.slice(at + 1);
      const opAt = rest.indexOf(':');
      if (opAt < 1) continue;
      const field = entry.slice(0, at);
      this.#needles.set(field, [...this.#needles.get(field) ?? [], { op: rest.slice(0, opAt), text: rest.slice(opAt + 1) }]);
    }
  }

  /** The needles from outside on one field, or every field's (`*`). */
  needles(field: string): readonly Needle[] {
    return this.#needles.get(field) ?? [];
  }
}
