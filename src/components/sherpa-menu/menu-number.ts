/**
 * menu-number.ts — a number's Simple body in the menu: ONE value, and the
 * operator where a host offers a choice. Its range is an Advanced row (Will,
 * TODO 375). A module of sherpa-menu, not an element.
 * TRAP T-a-menu-owns-its-own-bodies · TRAP T-one-number-is-a-pick-under-equals
 *
 * Map:
 * - NumberHost — What the number body asks of its menu.
 * - NumberBody — One menu's number body.
 * - .op — The body's own operator, where its select names one.
 * - .setOp — Show this operator, in the select and the attribute that echoes it.
 * - .values — Its one value, or none.
 * - .set — Write its one value.
 * - .reading — Its answer: a pick under `=`, typed text under an op that takes it.
 * - .sync — Its operators, its ends and its step, from the menu's attributes.
 * - .fill — A single value held in `data-value` goes in the empty field.
 */
import { DEFAULT_OP, OP_LABELS, OP_TAKES, type FilterOp } from '../../core/data/store.js';
import type { FieldReading } from '../../core/data/filter-state.js';
import type { SherpaInputText } from '../sherpa-input-text/sherpa-input-text.js';

/** What the number body asks of its menu. */
export interface NumberHost {
  /** The menu element: its attributes say the body's ends and ops. */
  readonly el: HTMLElement;
  /** A shadow query. */
  $<T extends Element = HTMLElement>(sel: string): T | null;
  /** Write one of the menu's own attributes. */
  set(attr: string, value: string | null): void;
  /** The ops the menu offers. */
  ops(): FilterOp[];
  /** The menu's operator. */
  op(): FilterOp;
}

/** One menu's number body. */
export class NumberBody {
  /** The menu it is part of. */
  readonly #host: NumberHost;
  /** Drawn once — a re-populate would lose what the reader picked. */
  #opsDrawn = false;

  constructor(host: NumberHost) {
    this.#host = host;
  }

  /** The body's own operator — its select is the LIVE answer, not the attribute
   *  that echoes it. TRAP T-a-menu-owns-its-own-bodies */
  op(): FilterOp | undefined {
    const picked = this.#host.$<SherpaInputText>('.body-op')?.value;
    return picked && picked in OP_LABELS ? picked as FilterOp : undefined;
  }

  /** Show this operator: its select, and the attribute that echoes it. */
  setOp(op: FilterOp): void {
    this.#host.set('data-op', op);
    const select = this.#host.$<SherpaInputText>('.body-op');
    if (select && select.value !== op) select.value = op;
  }

  /** Its one value, or null before it is drawn. */
  values(): string[] | null {
    const field = this.#host.$<SherpaInputText>('.body-number-one');
    if (!field) return null;
    const raw = field.value.trim();
    return raw === '' ? [] : [raw];
  }

  /** Write its one value. */
  set(one: string): void {
    const field = this.#host.$<SherpaInputText>('.body-number-one');
    if (field && field.value !== one) field.value = one;
  }

  /** ONE value: a pick under `=`, typed text under an op that takes text ("> 2").
   *  Will, TODO 375. TRAP T-one-number-is-a-pick-under-equals */
  reading(): FieldReading {
    const one = this.#host.$<SherpaInputText>('.body-number-one')?.value.trim() ?? '';
    // The number body's own select is the live operator. TRAP T-a-menu-owns-its-own-bodies
    const op = this.#host.op();
    if (OP_TAKES[op] === 'text') return { picked: [], op, text: one };
    return { picked: one ? [one] : [], op };
  }

  /** Its operators, its ends and its step, and a value held in `data-value`. */
  sync(): void {
    const el = this.#host.el;
    /* THE OPERATOR, from the ONE vocabulary — the same list the condition rows
       read. A host names the set; the menu draws it.
       TRAP T-ops-follow-the-column-type */
    const picker = this.#host.$<SherpaInputText>('.body-op');
    // A FILTER menu's conditions are its rows; its Simple body has no operator.
    if (picker && el.hasAttribute('data-conditions') && el.dataset['type'] !== 'filter') {
      const ops = this.#host.ops();
      if (!this.#opsDrawn) {
        this.#opsDrawn = true;
        void picker.populate?.(ops.map((op) => ({ value: op, label: OP_LABELS[op] })));
      }
      const current = this.#host.op();
      const op = ops.includes(current) ? current : (ops[0] ?? DEFAULT_OP);
      if (el.dataset['op'] !== op) this.#host.set('data-op', op);
      if (picker.value !== op) picker.value = op;
    }
    const field = this.#host.$<HTMLElement>('.body-number-one');
    if (field) {
      field.setAttribute('min', el.dataset['min'] ?? '0');
      field.setAttribute('max', el.dataset['max'] ?? '100');
      if (el.dataset['step']) field.setAttribute('step', el.dataset['step']);
    }
  }

  /** A single held value goes in the field — after the rows' sliders are told. */
  fill(): void {
    const field = this.#host.$<HTMLElement>('.body-number-one');
    const one = this.#host.el.dataset['value'];
    if (one && field instanceof HTMLInputElement && field.value === '') field.value = one;
  }
}
