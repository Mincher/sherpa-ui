/**
 * sherpa-input-tag — a token/chip input.
 *
 * The user types free text and presses Enter to commit a chip; each chip renders
 * as a removable <sherpa-tag>. Clicking a chip's × removes it. The tag list is the
 * component's value — exposed as a string[] via `tags` / `value`, mirrored to
 * data-value as JSON, and broadcast on every change via tags-change.
 *
 * Chips are stamped from a cloning prototype (the one bit of structural DOM the
 * golden rules allow — data-driven rows). The tag-remove events the child
 * <sherpa-tag>s dispatch are COMPOSED, so they retarget to this host at the shadow
 * boundary: the delegated handler must locate the originating chip via
 * event.composedPath(), NOT event.target (which is always the host by then).
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import '../sherpa-tag/sherpa-tag.js';

/** A tag can be supplied as a bare string or an object with a label. */
type TagInput = string | { label?: string };

export class SherpaInputTag extends SherpaElement {
  static override css = new URL('./sherpa-input-tag.css', import.meta.url);
  static override html = new URL('./sherpa-input-tag.html', import.meta.url);
  static override observed = ['data-label', 'data-description', 'data-error', 'disabled'];

  #tags: string[] = [];
  #input: HTMLInputElement | null = null;

  override onRender(): void {
    this.#input = this.$<HTMLInputElement>('.control');
    this.#syncText();
    if (this.#input) this.#input.disabled = this.hasAttribute('disabled');
    this.#input?.addEventListener('keydown', this.#onKeyDown);
    // Delegated remove: tag-remove is composed, so it arrives retargeted to the
    // host — find the originating chip via composedPath, never event.target.
    this.$('.chips')?.addEventListener('tag-remove', this.#onTagRemove as EventListener);
    this.#renderChips();
  }

  override onChange(name: string): void {
    if (name === 'disabled') {
      if (this.#input) this.#input.disabled = this.hasAttribute('disabled');
      this.#renderChips();
    } else {
      this.#syncText();
    }
  }

  /** populate(['a', 'b']) or populate([{ label }]) — the initial tag list. */
  protected override renderData(data: unknown): void {
    const list = Array.isArray(data) ? (data as TagInput[]) : [];
    this.#tags = list.map((t) => (typeof t === 'string' ? t : t?.label ?? '')).filter(Boolean);
    this.#syncValueAttr();
    this.#renderChips();
  }

  /* ── Value surface — the tag list ──────────────────────────────────── */

  get tags(): string[] {
    return [...this.#tags];
  }
  set tags(list: string[]) {
    this.#tags = (Array.isArray(list) ? list : []).map(String).filter(Boolean);
    this.#syncValueAttr();
    this.#renderChips();
  }

  get value(): string[] {
    return this.tags;
  }
  set value(list: string[]) {
    this.tags = list;
  }

  override focus(): void {
    this.#input?.focus();
  }

  /* ── Internals ─────────────────────────────────────────────────────── */

  #addTag(raw: string): void {
    const v = raw.trim();
    if (!v || this.#tags.includes(v)) return;
    this.#tags.push(v);
    this.#syncValueAttr();
    this.#renderChips();
    this.emit('tags-change', { tags: this.tags });
  }

  #removeTag(value: string): void {
    const i = this.#tags.indexOf(value);
    if (i < 0) return;
    this.#tags.splice(i, 1);
    this.#syncValueAttr();
    this.#renderChips();
    this.emit('tags-change', { tags: this.tags });
  }

  #renderChips(): void {
    const list = this.$('.chips');
    const tpl = this.$<HTMLTemplateElement>('template.chip-tpl');
    if (!list || !tpl) return;
    list.replaceChildren();
    const disabled = this.hasAttribute('disabled');
    for (const tag of this.#tags) {
      const chip = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      chip.dataset['value'] = tag;
      chip.textContent = tag;
      if (disabled) chip.removeAttribute('data-removable');
      list.appendChild(chip);
    }
  }

  #syncText(): void {
    const set = (sel: string, value: string | undefined): void => {
      const el = this.$(sel);
      if (el) el.textContent = value ?? '';
    };
    set('.label', this.dataset['label']);
    set('.description', this.dataset['description']);
    set('.message', this.dataset['error']);
  }

  #syncValueAttr(): void {
    this.dataset['value'] = JSON.stringify(this.#tags);
  }

  #onKeyDown = (e: KeyboardEvent): void => {
    const input = this.#input;
    if (!input) return;
    if (e.key === 'Enter') {
      if (input.value.trim()) {
        e.preventDefault();
        this.#addTag(input.value);
        input.value = '';
      }
    } else if (e.key === 'Backspace' && input.value === '' && this.#tags.length) {
      e.preventDefault();
      this.#removeTag(this.#tags[this.#tags.length - 1]!);
    }
  };

  // tag-remove is composed → retargeted to this host. Walk composedPath() to the
  // sherpa-tag chip that fired it; event.target would just be the host.
  #onTagRemove = (e: Event): void => {
    const chip = e.composedPath().find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('chip'),
    );
    const value = chip?.dataset['value'];
    if (value !== undefined) this.#removeTag(value);
  };
}

customElements.define('sherpa-input-tag', SherpaInputTag);
