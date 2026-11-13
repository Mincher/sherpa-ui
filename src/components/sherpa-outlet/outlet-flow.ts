/**
 * outlet-flow.ts — the dialog a pressed act opens to ask its input: its flow's page lens (plan 964 N4). A field per step
 * that holds (`stepsOf`), each answer checked as the act checks it (`answerStep`), the confirm's words, and a button that
 * runs the act as a press does. The outlet owns the answers; a field only reports. Loaded the first time a flow opens.
 *
 * Map:
 * - FlowHost — What the dialog asks of its outlet: its parts, the context and the door an act runs through.
 * - OutletFlow — The dialog a pressed act opens to ask its input, a field per step of its flow.
 * - .open — Ask a flow's steps for these keys: a field per step that holds, the act's words heading it.
 */
import '../sherpa-button/sherpa-button.js';
import '../sherpa-dialog/sherpa-dialog.js';
import '../sherpa-input-text/sherpa-input-text.js';
import '../sherpa-switch/sherpa-switch.js';
import type { Act, ActAnswer, ActCall, ActContext } from '../../core/data/acts.js';
import { answerStep, nextStep, stepsOf, type Ask, type Flow, type FlowAnswers, type NextStep } from '../../core/data/flows.js';

/** What the dialog asks of its outlet: its parts, a field cloned from its prototype, a listener, the context an act runs
 *  over, the door it runs through, and the toast a press says. */
export interface FlowHost {
  $<T extends Element = HTMLElement>(sel: string): T | null;
  cloneItem<T extends Element = HTMLElement>(from: string, item: unknown): T | null;
  on(target: EventTarget, type: string, handler: (event: Event) => void): void;
  actContext(): ActContext | null;
  act(id: string, call: ActCall): Promise<ActAnswer>;
  said(answer: ActAnswer): Promise<void>;
}

/** A field as the dialog reads it: a text, a pick of one or several, or a switch. */
type Field = HTMLElement & { value: string; values?: string[]; checked?: boolean; populate(data: unknown): Promise<void> };

/** The flow open now: its act, the keys it runs on, the answers so far, and each step's field and Ask. */
interface Open {
  flow: Flow;
  act: Act;
  keys: readonly unknown[];
  answers: FlowAnswers;
  fields: Map<string, { el: Field; ask: Ask }>;
  /** The fields whose value was refused: each holds the button back until it is answered well. */
  refused: Set<string>;
}

/** Each kind's prototype: a date is typed as text until the input has a date of its own. */
const PROTOTYPE: Record<Ask['kind'], string> = {
  text: 'template.flow-text', date: 'template.flow-text', number: 'template.flow-number',
  one: 'template.flow-one', many: 'template.flow-many', boolean: 'template.flow-boolean',
};

/** The dialog a pressed act opens to ask its input, a field per step of its flow. */
export class OutletFlow {
  /** The outlet it asks for its parts, its context and its door. */
  readonly #host: FlowHost;
  /** The flow open now; none while the dialog is shut. */
  #open: Open | null = null;
  /** Each answer's turn: an answer checked after a newer one is dropped. */
  #turn = 0;

  constructor(host: FlowHost) {
    this.#host = host;
    const steps = host.$('.flow-steps');
    if (steps) for (const type of ['input', 'change']) host.on(steps, type, this.#onField);
    const run = host.$('.flow-run');
    if (run) host.on(run, 'click', () => void this.#run());
    const cancel = host.$('.flow-cancel');
    if (cancel) host.on(cancel, 'click', () => this.#dialog?.hide());
    if (this.#dialog) host.on(this.#dialog, 'dialog-close', () => this.#close());
  }

  get #dialog(): (HTMLElement & { show(): void; hide(): void }) | null {
    return this.#host.$('.flow');
  }

  /** Ask a flow's steps for these keys: a field per step that holds, the act's words heading it. */
  async open(flow: Flow, act: Act, keys: readonly unknown[]): Promise<void> {
    const dialog = this.#dialog;
    if (!dialog) return;
    this.#close();
    this.#open = { flow, act, keys, answers: {}, fields: new Map(), refused: new Set() };
    dialog.setAttribute('data-heading', act.label);
    this.#text('.flow-about', act.description ?? '');
    this.#host.$('.flow-run')?.setAttribute('data-label', act.label);
    await this.#draw();
    dialog.show();
  }

  /** The context a step reads: the outlet's stores, and the keys. */
  get #ctx(): ActContext & { keys: readonly unknown[] } {
    return { ...(this.#host.actContext() ?? { stores: {} }), keys: this.#open?.keys ?? [] };
  }

  /** A part's words, written only when they move. */
  #text(sel: string, words: string): void {
    const el = this.#host.$(sel);
    if (el && el.textContent !== words) el.textContent = words;
  }

  /** Each step that holds has its field, in the flow's order; one that stops holding is put away, its answer kept. Then
   *  the confirm's words, and the button, live once every step is answered. */
  async #draw(): Promise<void> {
    const open = this.#open;
    const box = this.#host.$('.flow-steps');
    if (!open || !box) return;
    const asks = await stepsOf(open.flow, open.answers, this.#ctx);
    if (open !== this.#open) return;
    const order = open.flow.steps.map((s) => s.field);
    let defaulted = false;
    for (const ask of asks) {
      if (open.fields.has(ask.field)) continue;
      const el = this.#host.cloneItem<Field>(PROTOTYPE[ask.kind], ask);
      if (!el) continue;
      if (ask.choices) void el.populate(ask.choices.map((c) => ({ value: String(c.value), label: c.label })));
      const after = order.slice(order.indexOf(ask.field) + 1).map((f) => open.fields.get(f)?.el).find(Boolean);
      box.insertBefore(el, after ?? null);
      open.fields.set(ask.field, { el, ask });
      // A switch always says something: off, until it is turned on.
      if (ask.kind === 'boolean' && !(ask.field in open.answers)) {
        open.answers = { ...open.answers, [ask.field]: false };
        defaulted = true;
      }
    }
    if (defaulted) return this.#draw();
    const holding = new Set(asks.map((a) => a.field));
    for (const [field, { el }] of open.fields) el.toggleAttribute('data-off', !holding.has(field));
    const next = await this.#next(open, asks);
    if (open !== this.#open) return;
    this.#text('.flow-said', 'confirm' in next ? next.confirm : '');
    this.#host.$('.flow-run')?.toggleAttribute('disabled', !('confirm' in next || 'run' in next));
  }

  /** Where the dialog stands. Every field is in view at once, so an optional step left as it is counts as skipped —
   *  unless what it holds was refused, which holds the button back. The chat asks each, with Skip. */
  #next(open: Open, asks: readonly Ask[]): Promise<NextStep> {
    const skipped = asks.filter((a) => !a.required && !(a.field in open.answers) && !open.refused.has(a.field));
    return nextStep(open.flow, { ...open.answers, ...Object.fromEntries(skipped.map((a) => [a.field, null])) }, this.#ctx);
  }

  /** A field's value as its step's answer: a pick by its choice's own value, a number as a number, none as null. */
  #valueOf(el: Field, ask: Ask): unknown {
    const choice = (v: string): unknown => ask.choices?.find((c) => String(c.value) === v)?.value ?? v;
    if (ask.kind === 'boolean') return !!el.checked;
    if (ask.kind === 'many') return (el.values ?? []).map(choice);
    if (el.value === '') return null;
    if (ask.kind === 'one') return choice(el.value);
    return ask.kind === 'number' ? Number(el.value) : el.value;
  }

  /** A field reported: its answer checked. As it is typed a refusal is held back; once it is left, it is said under it. */
  #onField = (event: Event): void => {
    // The inner control's own `input` crosses out too: only a field's own event is read.
    if (!(event instanceof CustomEvent)) return;
    const open = this.#open;
    const field = (event.target as HTMLElement | null)?.dataset['field'];
    const at = field ? open?.fields.get(field) : undefined;
    if (!open || !field || !at) return;
    void this.#answer(field, this.#valueOf(at.el, at.ask), event.type === 'change');
  };

  /** One field's answer checked: kept, or dropped with its refusal said under it where `say`. Then drawn again. */
  async #answer(field: string, value: unknown, say: boolean): Promise<void> {
    const open = this.#open;
    const at = open?.fields.get(field);
    if (!open || !at) return;
    const turn = ++this.#turn;
    const got = await answerStep(open.flow, open.answers, field, value, this.#ctx);
    if (turn !== this.#turn || open !== this.#open) return;
    if ('answers' in got) {
      open.answers = got.answers;
      open.refused.delete(field);
      at.el.removeAttribute('data-error');
    } else {
      open.refused.add(field);
      // A refused answer is no answer: the step is open again, and the button waits.
      const { [field]: _gone, ...rest } = open.answers;
      open.answers = rest;
      if (say) at.el.setAttribute('data-error', 'error' in got ? got.error : got.refused);
    }
    await this.#draw();
  }

  /** Run the act with the answers, as a press does: its toast, with Undo. A refusal stays in the dialog, in its words. */
  async #run(): Promise<void> {
    const open = this.#open;
    if (!open) return;
    const next = await this.#next(open, await stepsOf(open.flow, open.answers, this.#ctx));
    if (!('confirm' in next || 'run' in next)) return;
    const answer = await this.#host.act(open.act.id, { keys: open.keys, input: 'confirm' in next ? next.input : next.run });
    if (open !== this.#open) return;
    if ('refused' in answer) {
      this.#text('.flow-refused-words', answer.refused);
      return;
    }
    this.#dialog?.hide();
    await this.#host.said(answer);
  }

  /** The flow put away: its fields gone, its words cleared. */
  #close(): void {
    this.#open = null;
    this.#host.$('.flow-steps')?.replaceChildren();
    for (const sel of ['.flow-said', '.flow-refused-words', '.flow-about']) this.#text(sel, '');
  }
}
