/**
 * chip-host.ts — what each module of sherpa-quick-filter asks of its chip: the chip's
 * own protected doors. Its public ones they call on `el`. A type each module takes,
 * not a base class. Plan 695 P5
 *
 * Map:
 * - ChipHost — The chip's own helpers, as its modules call them.
 */
import type { SherpaQuickFilter } from './sherpa-quick-filter.js';

/** The chip's own helpers, as its modules call them. */
export interface ChipHost {
  /** The chip: its public doors. */
  readonly el: SherpaQuickFilter;
  $<T extends Element = HTMLElement>(sel: string): T | null;
  /** Write one of its attributes: null or false removes it. */
  set(attr: string, value: string | boolean | null): void;
  clone<T extends Element = HTMLElement>(sel: string): T | null;
  /** Everything it draws from its picks. */
  applySelection(values: string[]): void;
}
