/**
 * input-picks.ts — a SELECT that picks several (`multiple`): the same dropdown face a single pick has, opening the tags
 * field's menu of ticks; its face says what is ticked. A module of sherpa-input-text, not an element. Will, 2026-11-13
 * TRAP T-a-multi-select-is-one-row
 *
 * Map:
 * - PicksHost — What the picks ask of their field.
 * - InputPicks — One select's picks: its values, its face, and its menu of ticks.
 * - .values — The values ticked, in the order its choices list them.
 * - .set — Take new picks silently: a host's write says nothing.
 * - .face — Say the picks on the select's face, as one option; every one ticked, "All".
 * - .wire — Listen to the select and the menu: the native list never opens, the menu of ticks does.
 */

type Menu = HTMLElement & {
  open?: boolean;
  show(trigger?: HTMLElement): void;
  hide(): void;
  items(items: readonly { value: string; label?: string; selected?: boolean }[]): void;
};

/** What the picks ask of their field. */
export interface PicksHost {
  $<T extends Element = HTMLElement>(selector: string): T | null;
  on(target: EventTarget, type: string, handler: (event: Event) => void): void;
  /** The choices it picks from, in order. */
  options(): readonly { value: string; label?: string }[];
  /** One empty option, from the field's own template. */
  option(): HTMLOptionElement | null;
  /** The word its face says with every choice ticked. */
  all(): string;
  readOnly(): boolean;
  off(): boolean;
  /** A tick changed the picks: the form, Clear and the events follow. */
  changed(): void;
}

/** One select's picks: its values, its face, and its menu of ticks. */
export class InputPicks {
  /** The values ticked. */
  #values: string[] = [];
  /** The field it belongs to. */
  readonly #host: PicksHost;

  constructor(host: PicksHost) {
    this.#host = host;
  }

  /** The values ticked, in the order its choices list them. */
  get values(): string[] {
    return [...this.#values];
  }

  /** Take new picks silently: a host's write says nothing. */
  set(values: readonly string[]): void {
    this.#values = [...new Set(values.map(String))];
    this.face();
  }

  /** Say the picks on the select's face, as ONE option: it reads as a single pick reads, "trial, At risk"; every one of two
   *  or more ticked, "All", as a chip's Select all (TODO 969). */
  face(): void {
    const select = this.#host.$<HTMLSelectElement>('select.control');
    const option = this.#host.option();
    if (!select || !option) return;
    const options = this.#host.options();
    const label = (value: string): string => options.find((o) => o.value === value)?.label ?? value;
    const every = options.length > 1 && options.every((o) => this.#values.includes(o.value));
    option.value = this.#values.join(',');
    option.textContent = every ? this.#host.all() : this.#values.map(label).join(', ');
    select.replaceChildren(option);
    select.value = option.value;
  }

  /** Listen to the select and the menu: the native list never opens, the menu of ticks does. */
  wire(): void {
    const select = this.#host.$<HTMLSelectElement>('select.control');
    const menu = this.#host.$<Menu>('.picks-menu');
    if (!select || !menu) return;
    this.#host.on(select, 'mousedown', (event) => {
      event.preventDefault();
      this.#toggle();
    });
    this.#host.on(select, 'keydown', (event) => {
      if (!['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes((event as KeyboardEvent).key)) return;
      event.preventDefault();
      this.#toggle();
    });
    this.#host.on(menu, 'menu-change', (event) => this.#ticked(event));
    for (const type of ['menu-select', 'menu-items', 'input', 'change']) this.#host.on(menu, type, (event) => event.stopPropagation());
  }

  /** Open the menu of ticks, each choice ticked as it is held; a held one that is no choice stays, ticked, to be seen. */
  #toggle(): void {
    const menu = this.#host.$<Menu>('.picks-menu');
    if (!menu || this.#host.off()) return;
    if (menu.open) {
      menu.hide();
      return;
    }
    const choices = this.#host.options();
    const strangers = this.#values.filter((value) => !choices.some((c) => c.value === value));
    menu.items([
      ...choices.map((c) => ({ value: c.value, label: c.label ?? c.value, selected: this.#values.includes(c.value) })),
      ...strangers.map((value) => ({ value, label: value, selected: true })),
    ]);
    // Read only: the menu SHOWS the picks and takes no tick.
    menu.toggleAttribute('data-readonly', this.#host.readOnly());
    menu.show(this.#host.$('.control-row') ?? undefined);
  }

  /** A tick or an untick: the picks in the order the choices list them, a held stranger kept while it stays ticked. */
  #ticked(event: Event): void {
    event.stopPropagation();
    const ticked = new Set((event as CustomEvent<{ values: string[] }>).detail.values);
    const choices = this.#host.options().map((c) => c.value);
    const next = [...choices.filter((v) => ticked.has(v)), ...this.#values.filter((v) => !choices.includes(v) && ticked.has(v))];
    if (next.join('\n') === this.#values.join('\n')) return;
    this.#values = next;
    this.face();
    this.#host.changed();
  }
}
