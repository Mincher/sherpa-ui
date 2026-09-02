/**
 * sherpa-code-block — a block of code with a copy button.
 *
 * It shows code and lets you copy it — that's all. There's no syntax
 * highlighting; the code shows exactly as given, with spacing kept intact.
 * The code comes from data-code or the default slot. The copy button copies it
 * to the clipboard, fires code-copy, and briefly shows a "Copied" message.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaCodeBlock extends SherpaElement {
  static override css = new URL('./sherpa-code-block.css', import.meta.url);
  static override html = new URL('./sherpa-code-block.html', import.meta.url);
  static override observed = ['data-code', 'data-language'];

  #code: HTMLElement | null = null;
  #resetTimer = 0;

  override onRender(): void {
    this.#code = this.$('.code');
    this.#syncCode();
    this.#syncLanguage();
    this.$('.copy')?.addEventListener('click', this.#onCopy);
  }

  override onChange(name: string): void {
    if (name === 'data-code') this.#syncCode();
    else if (name === 'data-language') this.#syncLanguage();
  }

  override onDisconnect(): void {
    if (this.#resetTimer) clearTimeout(this.#resetTimer);
  }

  /** The code text — data-code wins; otherwise the slotted/textContent source. */
  get code(): string {
    return this.dataset['code'] ?? this.#code?.textContent ?? this.textContent?.trim() ?? '';
  }

  /** data-code renders into the <code> node; slotted content falls through untouched. */
  #syncCode(): void {
    const value = this.dataset['code'];
    if (this.#code && value != null) this.#code.textContent = value;
  }

  #syncLanguage(): void {
    const label = this.$('.language');
    if (label) label.textContent = this.dataset['language'] ?? '';
  }

  #onCopy = (): void => {
    const text = this.code;
    if (!text) return;
    void navigator.clipboard?.writeText(text).then(() => {
      this.emit('code-copy', { code: text });
      this.setAttribute('data-copied', '');
      if (this.#resetTimer) clearTimeout(this.#resetTimer);
      this.#resetTimer = window.setTimeout(() => this.removeAttribute('data-copied'), 1600);
    });
  };
}

customElements.define('sherpa-code-block', SherpaCodeBlock);
