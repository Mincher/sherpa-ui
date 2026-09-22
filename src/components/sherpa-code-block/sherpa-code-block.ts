/**
 * sherpa-code-block — a block of code with a copy button.
 *
 * It shows code and lets you copy it — that's all. There's no syntax
 * highlighting; the code shows exactly as given, with spacing kept intact.
 * The code comes from data-code or the default slot. The copy button copies it
 * to the clipboard, fires code-copy, and briefly shows a "Copied" message.
 *
 * Set data-line-numbers to show a left gutter of line numbers; the numbers are
 * derived from the code's line count (CSS reveals the gutter — JS only fills it).
 *
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaCodeBlock extends SherpaElement {
  static override css = new URL('./sherpa-code-block.css', import.meta.url);
  static override html = new URL('./sherpa-code-block.html', import.meta.url);
  static override props = {
    'data-language': { type: 'string', kind: 'content', to: '.language' },
  } as const;

  static override observed = ['data-code', 'data-line-numbers'];

  #codeText: HTMLElement | null = null;
  #gutter: HTMLElement | null = null;
  #resetTimer = 0;

  override onRender(): void {
    this.#codeText = this.$('.code-text');
    this.#gutter = this.$('.gutter');
    this.#syncCode();
    this.#syncGutter();
    this.$('.copy')?.addEventListener('click', this.#onCopy);
    this.$('slot')?.addEventListener('slotchange', this.#syncGutter);
  }

  override onChange(name: string): void {
    if (name === 'data-code') { this.#syncCode(); this.#syncGutter(); }
    else if (name === 'data-line-numbers') this.#syncGutter();
  }

  override onDisconnect(): void {
    if (this.#resetTimer) clearTimeout(this.#resetTimer);
  }

  /** The code text — data-code wins; otherwise the slotted/textContent source. */
  get code(): string {
    return this.dataset['code'] ?? this.#codeText?.textContent ?? this.textContent?.trim() ?? '';
  }

  /** data-code renders into .code-text; slotted content falls through untouched. */
  #syncCode(): void {
    const value = this.dataset['code'];
    if (this.#codeText && value != null) this.#codeText.textContent = value;
  }

  /** One line number per line of code — CSS decides whether the gutter shows. */
  #syncGutter = (): void => {
    if (!this.#gutter) return;
    if (this.dataset['lineNumbers'] == null) { this.#gutter.textContent = ''; return; }
    const lines = this.code.replace(/\n$/, '').split('\n').length;
    let out = '';
    for (let i = 1; i <= lines; i++) out += (i > 1 ? '\n' : '') + i;
    this.#gutter.textContent = out;
  };

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
