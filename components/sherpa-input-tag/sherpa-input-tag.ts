/**
 * sherpa-input-tag.js
 * SherpaInputTag — Multi-tag input. Replaces DevExtreme DxTagBox for
 * free-text tag entry.
 *
 * Behaviour:
 *   • Type, then press Enter (or the configured separator) to commit a chip.
 *   • Press Backspace in an empty field to remove the last chip.
 *   • Click ✕ on a chip to remove it.
 *   • `data-value` reflects the current array of tag values as JSON.
 *
 * @element sherpa-input-tag
 * @category input
 * @description Multi-value chip input for entering a variable-length list of free-text values.
 *   Use for keyword tagging, email recipients, topic labels, or any field where the user
 *   provides an open-ended set of strings. Press Enter or the configured separator character
 *   to commit a chip. The current set is exposed as a JSON array via data-value and the value
 *   property.
 *
 * @attr {string}  data-label
 * @attr {string}  data-description
 * @attr {string}  data-helper
 * @attr {enum}    data-layout            — vertical (default) | horizontal
 * @attr {string}  name
 * @attr {string}  placeholder
 * @attr {boolean} disabled
 * @attr {boolean} readonly
 * @attr {boolean} required               — Empty array fails validation
 * @attr {json}    data-value             — Array of current tag strings
 * @attr {string}  data-separator=","     — Extra character that commits a chip
 * @attr {boolean} data-allow-duplicates  — Allow repeated values
 * @attr {number}  data-max-tags          — Hard cap on tag count
 *
 * @fires change — Tag list changed (add or remove).
 *   bubbles: true, composed: true
 *   detail: { value: string[], action: 'add'|'remove'|'set', tag?: string }
 *
 * @prop {string[]} value — Current tag list (read/write)
 *
 * @method add(tag)    — Programmatically add a tag.
 * @method remove(tag) — Programmatically remove a tag.
 * @method clear()     — Remove all tags.
 */

import { SherpaInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';

export class SherpaInputTag extends SherpaInputBase<string[]> {

  static override get cssUrl(): string  { return new URL('./sherpa-input-tag.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-input-tag.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-value', 'data-separator', 'data-allow-duplicates', 'data-max-tags',
    ];
  }

  /* ── Subclass hooks ────────────────────────────────────────────── */

  override getInputElement(): HTMLInputElement | null { return this.$<HTMLInputElement>('.tag-typeahead'); }

  override async onInputRender(): Promise<void> {
    this.#renderChips();
  }

  override onInputConnect(): void {
    const input = this.getInputElement();
    if (!input) return;
    input.addEventListener('keydown', this.#onKeyDown);
    // Suppress default input/change re-dispatch for the typeahead since
    // it isn't the component's true value.
    input.addEventListener('input', (e) => e.stopImmediatePropagation(), true);
  }

  override onInputDisconnect(): void {
    const input = this.getInputElement();
    if (!input) return;
    input.removeEventListener('keydown', this.#onKeyDown);
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null): void {
    super.onAttributeChanged(name, oldValue, newValue);
    if (name === 'data-value') this.#renderChips();
  }

  /* ── Public API ────────────────────────────────────────────────── */

  // Intentional API divergence: this multi-value control exposes value as
  // a string[] (the tag list), unlike the base's single string value.
  override get value(): string[] { return this.#readValue(); }
  override set value(arr: string[]) {
    const list = Array.isArray(arr) ? arr.map(String) : [];
    this.dataset["value"] = JSON.stringify(list);
    this.#emit('set');
  }

  public add(tag: string): boolean {
    const v = String(tag ?? '').trim();
    if (!v) return false;
    const current = this.#readValue();
    if (!this.hasAttribute('data-allow-duplicates') && current.includes(v)) return false;
    const max = parseInt(this.dataset["maxTags"] ?? '', 10);
    if (Number.isFinite(max) && current.length >= max) return false;
    current.push(v);
    this.dataset["value"] = JSON.stringify(current);
    this.#emit('add', v);
    return true;
  }

  // Intentional API divergence: shadows Element.remove() to remove a tag
  // from the value list rather than detaching the element.
  override remove(): void;
  override remove(tag: string): boolean;
  override remove(tag?: string): boolean | void {
    if (tag === undefined) return;
    const current = this.#readValue();
    const i = current.indexOf(String(tag));
    if (i < 0) return false;
    current.splice(i, 1);
    this.dataset["value"] = JSON.stringify(current);
    this.#emit('remove', String(tag));
    return true;
  }

  public clear(): void {
    this.dataset["value"] = '[]';
    this.#emit('set');
  }

  /* ── Private ───────────────────────────────────────────────────── */

  #readValue(): string[] {
    try {
      const v = JSON.parse(this.dataset["value"] || '[]');
      return Array.isArray(v) ? v.map(String) : [];
    } catch { return []; }
  }

  #renderChips(): void {
    const wrapper = this.$('.tag-wrapper');
    const input = this.getInputElement();
    if (!wrapper || !input) return;

    // Remove existing chips (keep the typeahead input)
    [...wrapper.querySelectorAll('.tag-chip')].forEach((c) => c.remove());

    const frag = document.createDocumentFragment();
    for (const v of this.#readValue()) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.dataset["value"] = v;
      chip.innerHTML = `
        <span class="tag-chip-label"></span>
        <button type="button" class="tag-chip-remove" tabindex="-1" aria-label="Remove tag">
          <i class="fa-solid fa-xmark sherpa-icon" data-size="2xs" aria-hidden="true"></i>
        </button>`;
      const labelEl = chip.querySelector('.tag-chip-label');
      if (labelEl) labelEl.textContent = v;
      chip.querySelector('.tag-chip-remove')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.remove(v);
      });
      frag.appendChild(chip);
    }
    wrapper.insertBefore(frag, input);
  }

  #onKeyDown = (e: KeyboardEvent): void => {
    const input = this.getInputElement();
    if (!input) return;
    const sep = (this.dataset["separator"] ?? ',').slice(0, 1);

    if (e.key === 'Enter' || (sep && e.key === sep)) {
      const raw = input.value.trim();
      if (raw) {
        e.preventDefault();
        if (this.add(raw)) input.value = '';
      } else if (e.key === 'Enter') {
        // Allow the form to submit if the field is empty
      }
      return;
    }

    if (e.key === 'Backspace' && input.value === '') {
      const list = this.#readValue();
      if (list.length) {
        e.preventDefault();
        const last = list[list.length - 1];
        if (last !== undefined) this.remove(last);
      }
    }
  };

  #emit(action: string, tag?: string): void {
    this.emit('change', { value: this.#readValue(), action, tag });
  }
}

// Cast required: SherpaInputTag intentionally diverges from the standard
// element shape (string[] value, remove(tag)), so it isn't structurally a
// plain CustomElementConstructor.
customElements.define('sherpa-input-tag', SherpaInputTag as unknown as CustomElementConstructor);
