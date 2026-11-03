/**
 * menu-date.ts — a date's Simple body in the menu: its own calendar, stamped
 * into the menu's light DOM, one day or two ends. A module of sherpa-menu, not
 * an element. TRAP T-a-menu-owns-its-own-bodies
 *
 * Map:
 * - DateHost — What the date body asks of its menu.
 * - DateBody — One menu's date body.
 * - .stamp — Stamp the calendar once, into the menu's light DOM.
 * - .values — The day picked, or both ends of a range; null with no calendar.
 * - .set — Show one day or two ends; false while there is no calendar to show them.
 * - .setShape — One day or two ends, and the commit rule that follows it.
 * - .flip — The Range switch: the calendar picks one day, or two.
 * - .reading — Its answer: two ends, or one day under the menu's op.
 * - .sync — The calendar's shape and the days it may pick.
 * - .today — Drive the calendar to today.
 * - .clear — Take every day off the calendar.
 */
import { DEFAULT_OP, type FilterOp } from '../../core/data/store.js';
import type { FieldReading } from '../../core/data/filter-state.js';
import type { SherpaCalendar } from '../sherpa-calendar/sherpa-calendar.js';

/** What the date body asks of its menu. */
export interface DateHost {
  /** The menu element: its attributes say the shape and the days. */
  readonly el: HTMLElement;
  /** Clone a prototype from the menu's template. */
  clone<T extends Element = HTMLElement>(from: string): T | null;
  /** This menu's own light-DOM nodes. */
  own<T extends Element>(selector: string): T[];
  /** Write one of the menu's own attributes. */
  set(attr: string, value: string | boolean | null): void;
  /** The menu's operator. */
  op(): FilterOp;
}

/** The attributes a calendar holds its days in. */
const DAYS = ['value', 'data-value-start', 'data-value-end'];

/** One menu's date body. */
export class DateBody {
  /** The menu it is part of. */
  readonly #host: DateHost;

  constructor(host: DateHost) {
    this.#host = host;
  }

  /** The calendar, once stamped. */
  #calendar(): HTMLElement | null {
    return this.#host.own<HTMLElement>('sherpa-calendar')[0] ?? null;
  }

  /** Stamp the calendar once, into the light DOM — never beside a page's own. */
  stamp(): void {
    if (this.#host.el.dataset['body'] !== 'date' || this.#calendar()) return;
    const cal = this.#host.clone('template.menu-calendar-tpl');
    if (cal) this.#host.el.append(cal);
  }

  /** The day picked, or both ends — a range only once BOTH are picked. */
  values(): string[] | null {
    const cal = this.#calendar();
    if (!cal) return null;
    const start = cal.dataset['valueStart'];
    const end = cal.dataset['valueEnd'];
    if (start && end) return [start, end];
    const single = cal.getAttribute('value') ?? undefined;
    return single ? [single] : [];
  }

  /** Two days are two ends and one is one day; NONE names no shape, so the shape
   *  in force stays. False while there is no calendar: the caller holds them. */
  set(next: readonly string[]): boolean {
    const el = this.#host.el;
    const range = next.length > 1 || (next.length === 0 && el.hasAttribute('data-range'));
    this.setShape(range);
    const cal = this.#calendar();
    if (!cal) return false;
    for (const a of DAYS) cal.removeAttribute(a);
    cal.setAttribute('data-type', range ? 'range' : 'single');
    // A range kept with NO ends holds none: `undefined` was written as a day.
    if (range && next.length > 1) {
      cal.setAttribute('data-value-start', next[0]!);
      cal.setAttribute('data-value-end', next[1]!);
    } else if (!range && next[0]) cal.setAttribute('value', next[0]);
    return true;
  }

  /** One day or two ends, and the commit rule that follows it. TRAP T-commit-follows-select-mode */
  setShape(range: boolean): void {
    const el = this.#host.el;
    if (range === el.hasAttribute('data-range')) return;
    this.#host.set('data-range', range);
    if (!el.hasAttribute('data-commit-fixed')) this.#host.set('data-commit', range);
  }

  /** The Range switch: a FLIP names both sides. A single pick is left alone —
   *  re-picking starts a range anyway. */
  flip(on: boolean): void {
    this.#calendar()?.setAttribute('data-type', on ? 'range' : 'single');
  }

  /** Two ENDS are the answer; the operator is the single side's, left behind. */
  reading(values: readonly string[]): FieldReading {
    if (this.#host.el.hasAttribute('data-range')) return { picked: [...values], op: DEFAULT_OP, range: true };
    return { picked: [...values], op: this.#host.op(), range: false };
  }

  /** The calendar's shape and the days it may pick. */
  sync(): void {
    // SLOTTED, not in the menu's shadow root — see its template.
    const cal = this.#calendar();
    if (!cal) return;
    /* ONLY when RANGED. A fresh calendar has no `data-type` at all, and
       writing `single` onto it would be this menu answering a question
       nobody asked. The FLIP says `single`, because that is a change. */
    const el = this.#host.el;
    if (el.hasAttribute('data-range')) cal.setAttribute('data-type', 'range');
    const days = el.dataset['available'];
    if (days) cal.setAttribute('data-available', days);
  }

  /** Drive the calendar to today; the menu stays open. TRAP T-today-and-remove-are-menu-chrome */
  today(): void {
    for (const cal of this.#host.own<SherpaCalendar>('sherpa-calendar')) cal.today?.();
  }

  /** Take every day off the calendar. TRAP T-clear-empties-both-body-shapes */
  clear(): void {
    for (const cal of this.#host.own<HTMLElement>('sherpa-calendar')) {
      for (const a of DAYS) cal.removeAttribute(a);
    }
  }
}
