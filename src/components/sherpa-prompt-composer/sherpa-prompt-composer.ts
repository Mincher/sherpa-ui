/**
 * sherpa-prompt-composer — an AI prompt input.
 *
 * An auto-growing textarea with a brand-accent send button. Submitting (the send
 * button, or Enter without Shift) emits `prompt-submit` with { text } when the
 * trimmed value is non-empty, then clears the field. Optional attachment / action
 * slots flank the send button. JS carries the value and the growth; the look is CSS.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

const MAX_HEIGHT = 160;

export class SherpaPromptComposer extends SherpaElement {
  static override css = new URL('./sherpa-prompt-composer.css', import.meta.url);
  static override html = new URL('./sherpa-prompt-composer.html', import.meta.url);
  static override observed = ['data-placeholder', 'disabled'];

  #input: HTMLTextAreaElement | null = null;

  override onRender(): void {
    this.#input = this.$<HTMLTextAreaElement>('.input');
    this.#syncPlaceholder();
    this.#syncDisabled();
    this.$('.form')?.addEventListener('submit', this.#onSubmit);
    this.#input?.addEventListener('input', this.#autoresize);
    this.#input?.addEventListener('keydown', this.#onKeyDown);
    this.$('.send')?.addEventListener('click', this.#onSend);
  }

  override onChange(name: string): void {
    if (name === 'data-placeholder') this.#syncPlaceholder();
    else if (name === 'disabled') this.#syncDisabled();
  }

  /* ── Value API ─────────────────────────────────────────────────────── */

  get value(): string {
    return this.#input?.value ?? '';
  }
  set value(v: string) {
    if (this.#input) {
      this.#input.value = v ?? '';
      this.#autoresize();
    }
  }

  override focus(): void {
    this.#input?.focus();
  }

  clear(): void {
    this.value = '';
  }

  /* ── Sync ──────────────────────────────────────────────────────────── */

  #syncPlaceholder(): void {
    if (this.#input) this.#input.placeholder = this.dataset['placeholder'] ?? '';
  }

  #syncDisabled(): void {
    const off = this.hasAttribute('disabled');
    if (this.#input) this.#input.disabled = off;
    this.$<HTMLButtonElement>('.send')?.toggleAttribute('disabled', off);
  }

  /* ── Behaviour ─────────────────────────────────────────────────────── */

  #onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.#submit();
    }
  };

  #onSend = (): void => this.#submit();

  #onSubmit = (e: Event): void => {
    e.preventDefault();
    this.#submit();
  };

  /** Emit prompt-submit with the trimmed text, then clear. No-op when empty/disabled. */
  #submit(): void {
    if (this.hasAttribute('disabled')) return;
    const text = this.value.trim();
    if (!text) return;
    this.emit('prompt-submit', { text });
    this.clear();
  }

  /** Grow the textarea to fit its content, up to MAX_HEIGHT, then scroll. */
  #autoresize = (): void => {
    const input = this.#input;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, MAX_HEIGHT)}px`;
  };
}

customElements.define('sherpa-prompt-composer', SherpaPromptComposer);
