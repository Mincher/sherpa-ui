/**
 * grid-host.ts — what each module of sherpa-data-grid asks of its grid: the grid's
 * own shadow queries, prototypes, words and icons, and the record each drawn row
 * stands for. A type each module takes, not a base class. Plan 695 P4
 *
 * Map:
 * - GridHost — The grid's own helpers, as its modules call them.
 */
import type { Row } from '../../core/data/store.js';

/** The grid's own helpers, as its modules call them. */
export interface GridHost {
  /** The grid. */
  readonly el: HTMLElement;
  $<T extends Element = HTMLElement>(sel: string): T | null;
  $$<T extends Element = HTMLElement>(sel: string): T[];
  clone<T extends Element = HTMLElement>(from: string | HTMLTemplateElement | null | undefined): T | null;
  /** A word from its markup. */
  word(key: string): string;
  writeIcon(el: Element, value: string): void;
  /** Set or clear one of its own states. */
  toggleState(name: string, on?: boolean): boolean;
  /** The record a drawn row — or a control in it — stands for. */
  recordFor(el: Element): Row | undefined;
}
