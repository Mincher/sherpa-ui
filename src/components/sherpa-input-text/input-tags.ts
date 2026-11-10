/**
 * input-tags.ts — a `data-type="tags"` field's job: the comma string and its array, a typed
 * word becoming a tag, the keys between tags, the count of tags that do not fit, and the
 * menu of every value. A module of sherpa-input-text, not an element. Plan 749 P2
 * TRAP T-a-tag-field-counts-what-css-clips
 *
 * Map:
 * - splitTags — Cut text at commas and line breaks, trimmed, empties dropped.
 * - TagsHost — What the tags ask of their field.
 * - InputTags — One tag field's tags, keys, overflow count and menu.
 * - .tags — The tags, as an array.
 * - .text — The tags, as the comma string a form holds.
 * - .refused — The word a closed field last refused, while it is still typed; null, none.
 * - .suggest — The values the menu offers beside the tags; a closed field takes only these.
 * - .set — Take new tags silently: a host's write says nothing.
 * - .add — Commit words as tags; duplicates are ignored, a closed field's strangers refused. Reports what was added.
 * - .remove — Remove one tag and say so.
 * - .draw — Stamp the tags, and write what CSS shows from them.
 * - .wire — Listen to the field's own parts.
 * - .commit — Commit the typed word as a tag.
 * - .focusLast — Focus the last tag that shows.
 * - .count — Count the tags wrapped out of sight; mark them inert.
 */

/** Cut text at commas and line breaks: trimmed, no empties. */
export function splitTags(text: string): string[] {
  return text.split(/[,\r\n]+/).map((word) => word.trim()).filter(Boolean);
}

type Popover = HTMLElement & {
  open?: boolean;
  show(trigger?: HTMLElement): void;
  hide(): void;
  items(items: readonly { value: string; label?: string; selected?: boolean }[]): void;
  values: string[];
};

/** What the tags ask of their field. */
export interface TagsHost {
  $<T extends Element = HTMLElement>(selector: string): T | null;
  $$<T extends Element = HTMLElement>(selector: string): T[];
  on(target: EventTarget, type: string, handler: (event: Event) => void): void;
  set(attr: string, value: string | boolean | null): void;
  toggleState(name: string, on?: boolean): boolean;
  /** The typed word. */
  control(): HTMLInputElement | null;
  /** It takes only its suggestions (`data-closed`). */
  closed(): boolean;
  /** A word was refused, or the refusal is over: the field checks itself again. */
  refusal(): void;
  /** The field's words, from its markup. */
  word(key: string): string;
  /** Something changed: the form, the Clear flag and the events follow. */
  changed(detail: { tags: string[]; added: string[]; removed: string[] }): void;
  readOnly(): boolean;
  off(): boolean;
}

export class InputTags {
  /** The tags, in order. */
  #tags: string[] = [];
  /** The field this belongs to. */
  readonly #host: TagsHost;
  /** The values the open menu lists: a tag unticked stays a row, so it can be ticked back. */
  #listed: string[] = [];
  /** Which of the two buttons opened the menu. */
  #opener: HTMLElement | null = null;
  /** What the menu offers beside the tags, each with its words. */
  #suggestions: { value: string; label?: string }[] = [];
  /** The word a closed field last refused, kept in the text for the reader to mend. */
  #refused: string | null = null;

  constructor(host: TagsHost) {
    this.#host = host;
  }

  get tags(): string[] {
    return [...this.#tags];
  }

  get text(): string {
    return this.#tags.join(',');
  }

  get refused(): string | null {
    return this.#refused;
  }

  suggest(list: readonly { value: string; label?: string }[]): void {
    const next = list.map((s) => ({ value: String(s.value), ...(s.label ? { label: s.label } : {}) }));
    // The same list again draws nothing: a draw measures the chips, a forced layout.
    if (JSON.stringify(next) === JSON.stringify(this.#suggestions)) return;
    this.#suggestions = next;
    this.draw();
  }

  /** A typed word as a suggestion's value, by its value or its words, in any case; none, it names none. */
  #choice(word: string): string | undefined {
    const typed = word.trim().toLowerCase();
    return this.#suggestions.find((s) => s.value.toLowerCase() === typed || s.label?.toLowerCase() === typed)?.value;
  }

  /** A tag's words: its suggestion's, else itself. */
  #label(tag: string): string {
    return this.#suggestions.find((s) => s.value === tag)?.label ?? tag;
  }

  /** Take new tags silently. A repeat is dropped. */
  set(tags: readonly string[]): void {
    const next = [...new Set(tags.map((tag) => tag.replace(/,/g, '').trim()).filter(Boolean))];
    // The same tags again draw nothing: a draw measures the chips, a forced layout.
    if (next.length === this.#tags.length && next.every((t, i) => t === this.#tags[i])) return;
    this.#tags = next;
    this.draw();
  }

  add(words: readonly string[]): string[] {
    // A suggestion is taken as its own value; a closed field refuses any other word, and keeps it typed.
    const typed = words.map((w) => w.trim()).filter(Boolean);
    const strangers = this.#host.closed() ? typed.filter((w) => this.#choice(w) === undefined) : [];
    const control = this.#host.control();
    if (strangers.length && control) control.value = strangers.join(', ');
    this.#refuse(strangers.length ? strangers.join(', ') : null);
    const added = [...new Set(typed.map((w) => this.#choice(w) ?? w))].filter((w) => !strangers.includes(w) && !this.#tags.includes(w));
    if (!added.length) return [];
    this.#tags.push(...added);
    this.draw();
    this.#host.changed({ tags: this.tags, added, removed: [] });
    this.#say('added', added.join(', '));
    return added;
  }

  remove(tag: string): void {
    if (this.#host.readOnly() || this.#host.off() || !this.#tags.includes(tag)) return;
    this.#tags = this.#tags.filter((t) => t !== tag);
    this.draw();
    this.#host.changed({ tags: this.tags, added: [], removed: [tag] });
    this.#say('removed', tag);
  }

  /** A refusal begun or over: the field says so in its message. */
  #refuse(word: string | null): void {
    if (word === this.#refused) return;
    this.#refused = word;
    this.#host.refusal();
  }

  /** Polite words for a screen reader: "Added Email. 3 values". */
  #say(key: 'added' | 'removed', what: string): void {
    const live = this.#host.$('.live');
    if (live) live.textContent = `${this.#host.word(key)} ${what}. ${this.#tags.length} ${this.#host.word('values')}`;
  }

  /** State first: the tags are data, the chips drawn from it, and CSS shows from the attributes. */
  draw(): void {
    const host = this.#host;
    const box = host.$('.tags');
    const tpl = host.$<HTMLTemplateElement>('template.tag-tpl');
    if (!box || !tpl?.content.firstElementChild) return;
    const kept = new Map(host.$$<HTMLElement>('.tags > .tag').map((chip) => [chip.dataset['tag'], chip]));
    // A chip kept is not rebuilt, so a focused one keeps its focus.
    for (const tag of this.#tags) {
      let chip = kept.get(tag);
      if (!chip) {
        chip = document.importNode(tpl.content.firstElementChild, true) as HTMLElement;
        chip.dataset['tag'] = tag;
        chip.setAttribute('tabindex', '-1');
      }
      chip.textContent = this.#label(tag);
      chip.setAttribute('aria-label', `${host.word('remove')} ${this.#label(tag)}`);
      kept.delete(tag);
      box.append(chip);
    }
    for (const gone of kept.values()) gone.remove();
    const locked = host.readOnly();
    for (const chip of host.$$<HTMLElement>('.tags > .tag')) {
      chip.toggleAttribute('data-dismissible', !locked);
      chip.toggleAttribute('disabled', host.off());
    }
    for (const button of host.$$<HTMLElement>('.more, .tags-button')) button.toggleAttribute('disabled', host.off());
    host.toggleState('has-tags', this.#tags.length > 0);
    this.count();
  }

  wire(): void {
    const host = this.#host;
    const control = host.control();
    const box = host.$('.tags');
    if (!control || !box) return;
    host.on(control, 'input', () => {
      // The refused word is being mended.
      if (this.#refused !== null && control.value !== this.#refused) this.#refuse(null);
      // A comma ends a word, typed or pasted.
      if (!control.value.includes(',')) return;
      const words = control.value.split(',');
      control.value = words.pop() ?? '';
      this.add(words);
    });
    host.on(control, 'paste', (event) => {
      const text = (event as ClipboardEvent).clipboardData?.getData('text') ?? '';
      if (!/[,\r\n]/.test(text) || host.readOnly()) return;
      event.preventDefault();
      const words = splitTags(`${control.value}${text}`);
      control.value = '';
      this.add(words);
    });
    host.on(control, 'keydown', (event) => this.#inputKey(event as KeyboardEvent, control));
    host.on(control, 'blur', () => this.commit());
    box.addEventListener('keydown', (event) => this.#tagKey(event as KeyboardEvent));
    box.addEventListener('chip-dismiss', (event) => {
      event.stopPropagation();
      const chip = (event.target as HTMLElement).closest<HTMLElement>('.tag');
      if (chip?.dataset['tag']) this.#removeFocusing(chip);
    });
    // A pointer on the row's plain space goes to the text, as in any field.
    host.on(host.$('.control-row')!, 'pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('.tag, .more, .tags-button, .control')) return;
      event.preventDefault();
      control.focus();
    });
    const menu = host.$<Popover>('.tags-menu');
    for (const button of host.$$('.more, .tags-button')) host.on(button, 'button-click', () => this.#toggleMenu(button));
    if (menu) {
      host.on(menu, 'menu-change', (event) => this.#ticked(event));
      for (const type of ['menu-open', 'menu-close']) host.on(menu, type, (event) => this.#menuToggled(event));
      for (const type of ['menu-select', 'menu-items', 'input', 'change']) host.on(menu, type, (event) => event.stopPropagation());
    }
    // CSS wraps what does not fit; this counts it, when the width moves.
    const watch = new ResizeObserver(() => this.count());
    watch.observe(box);
    watch.observe(host.$('.control-row')!);
  }

  /** The typed word becomes a tag. */
  commit(): void {
    const control = this.#host.control();
    if (!control || this.#host.readOnly() || !control.value.trim()) return;
    const word = control.value;
    control.value = '';
    // A repeat is dropped, and the word with it.
    this.add([word]);
  }

  /** Enter commits; Backspace on empty removes the last tag; ArrowLeft at the start goes to the tags. */
  #inputKey(event: KeyboardEvent, control: HTMLInputElement): void {
    if (event.key === 'Enter' && control.value.trim()) {
      event.preventDefault();
      this.commit();
    } else if (event.key === 'Backspace' && control.value === '' && !event.repeat) {
      const last = this.#tags.at(-1);
      if (last !== undefined) this.remove(last);
    } else if (event.key === 'ArrowLeft' && control.selectionStart === 0 && control.selectionEnd === 0) {
      event.preventDefault();
      this.focusLast();
    }
  }

  /** Arrows move between tags and the text. Delete and Backspace remove the one in focus. */
  #tagKey(event: KeyboardEvent): void {
    const chip = (event.target as HTMLElement).closest<HTMLElement>('.tag');
    if (!chip) return;
    const shown = this.#shown();
    const at = shown.indexOf(chip);
    if (event.key === 'ArrowLeft' && at > 0) shown[at - 1]!.focus();
    else if (event.key === 'ArrowRight') {
      if (at < shown.length - 1) shown[at + 1]!.focus();
      else this.#host.control()?.focus();
    } else if (event.key === 'Delete' || event.key === 'Backspace') this.#removeFocusing(chip);
    else if (event.key !== 'ArrowLeft') return;
    event.preventDefault();
  }

  /** Remove a tag, and put focus on its neighbour, or the text. */
  #removeFocusing(chip: HTMLElement): void {
    const shown = this.#shown();
    const next = shown[shown.indexOf(chip) + 1] ?? shown[shown.indexOf(chip) - 1];
    this.remove(chip.dataset['tag'] ?? '');
    (next?.isConnected ? next : this.#host.control())?.focus();
  }

  /** The tags a reader can see: the ones CSS has not wrapped out of sight. */
  #shown(): HTMLElement[] {
    return this.#host.$$<HTMLElement>('.tags > .tag:not([inert])');
  }

  focusLast(): void {
    this.#shown().at(-1)?.focus();
  }

  /** CSS clips what wraps; JS only counts it, and marks it out of the tab order: in the next frame, with every other
   *  tag field's — all read, then all written. A count straight after each draw is a layout each. TRAP T-a-redraw-keeps-what-it-can */
  count(): void {
    InputTags.#queued.add(this);
    if (!InputTags.#frame) InputTags.#frame = requestAnimationFrame(() => InputTags.#countQueued());
  }

  /** The tag fields waiting for the next frame's count. */
  static #queued = new Set<InputTags>();
  /** That frame, once asked for. */
  static #frame = 0;
  /** Count every waiting field: all read first, then all written — one layout. */
  static #countQueued(): void {
    InputTags.#frame = 0;
    const read = [...InputTags.#queued].map((tags) => [tags, tags.#wrapped()] as const);
    InputTags.#queued.clear();
    for (const [tags, wrapped] of read) tags.#mark(wrapped);
  }

  /** Its chips, and those wrapped below the first line. */
  #wrapped(): { chips: HTMLElement[]; hidden: Set<HTMLElement> } {
    const chips = this.#host.$$<HTMLElement>('.tags > .tag');
    const top = chips[0]?.offsetTop ?? 0;
    return { chips, hidden: new Set(chips.filter((chip) => chip.offsetTop > top)) };
  }

  /** Mark the wrapped chips inert, and say how many: only what changed is written. */
  #mark({ chips, hidden }: { chips: HTMLElement[]; hidden: Set<HTMLElement> }): void {
    const host = this.#host;
    for (const chip of chips) if (chip.hasAttribute('inert') !== hidden.has(chip)) chip.toggleAttribute('inert', hidden.has(chip));
    host.set('data-overflow', hidden.size ? String(hidden.size) : null);
    const more = host.$('.more');
    const label = `${hidden.size} ${host.word('more')}`;
    if (more && more.getAttribute('aria-label') !== label) {
      more.textContent = `+${hidden.size}`;
      more.setAttribute('aria-label', label);
    }
  }

  /** One menu, from the +N and from the button. */
  #toggleMenu(trigger: HTMLElement): void {
    const menu = this.#host.$<Popover>('.tags-menu');
    if (!menu) return;
    if (menu.open) {
      menu.hide();
      return;
    }
    // The tags, then each suggestion not yet one: a tick adds it.
    this.#listed = [...new Set([...this.#tags, ...this.#suggestions.map((s) => s.value)])];
    menu.items(this.#listed.map((value) => ({ value, label: this.#label(value), selected: this.#tags.includes(value) })));
    // Read only: the menu SHOWS the values and takes no tick.
    menu.toggleAttribute('data-readonly', this.#host.readOnly());
    this.#opener = trigger;
    menu.show(trigger);
  }

  /** A tick or an untick is an add or a remove, in the order the menu opened with. */
  #ticked(event: Event): void {
    event.stopPropagation();
    const ticked = new Set((event as CustomEvent<{ values: string[] }>).detail.values);
    const next = this.#listed.filter((value) => ticked.has(value));
    const added = next.filter((v) => !this.#tags.includes(v));
    const removed = this.#tags.filter((v) => !next.includes(v));
    if (!added.length && !removed.length) return;
    this.#tags = next;
    this.draw();
    this.#host.changed({ tags: this.tags, added, removed });
    this.#say(added.length ? 'added' : 'removed', (added.length ? added : removed).join(', '));
  }

  /** The menu opened or shut: both buttons say so, and focus goes back on close. */
  #menuToggled(event: Event): void {
    event.stopPropagation();
    const open = event.type === 'menu-open';
    for (const button of this.#host.$$('.more, .tags-button')) button.setAttribute('aria-expanded', String(open && button === this.#opener));
    // Escape or a pick: the focus goes back to what opened it.
    if (!open) this.#opener?.focus();
  }
}
