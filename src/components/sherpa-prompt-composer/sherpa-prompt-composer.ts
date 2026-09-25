/**
 * sherpa-prompt-composer — a growing text box with a send button.
 *
 * Enter submits, Shift+Enter newlines. Empty text is never submitted.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';

const MAX_HEIGHT = 160;

export class SherpaPromptComposer extends SherpaElement {
  static override css = new URL('./sherpa-prompt-composer.css', import.meta.url);
  static override html = new URL('./sherpa-prompt-composer.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-no-leading-actions': { type: 'boolean', kind: 'style' },
  } as const;
  static override observed = ['data-placeholder', 'disabled'];

  /** The text box. */
  #input: HTMLTextAreaElement | null = null;

  override onRender(): void {
    this.#input = this.$<HTMLTextAreaElement>('.input');
    this.#syncPlaceholder();
    this.#syncDisabled();
    this.$('.form')?.addEventListener('submit', this.#onSubmit);
    this.#input?.addEventListener('input', this.#autoresize);
    this.#input?.addEventListener('keydown', this.#onKeyDown);
    this.$('.send')?.addEventListener('button-click', this.#onSend);
    this.$('.attach')?.addEventListener('button-click', () => this.#onLeading('composer-attach'));
    this.$('.lab')?.addEventListener('button-click', () => this.#onLeading('composer-lab'));
  }

  override onChange(name: string): void {
    if (name === 'data-placeholder') this.#syncPlaceholder();
    else if (name === 'disabled') this.#syncDisabled();
  }

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

  /** Mirror `data-placeholder` onto the text box. */
  #syncPlaceholder(): void {
    if (this.#input) this.#input.placeholder = this.dataset['placeholder'] ?? '';
  }

  /** Disable the text box and every button with the host. */
  #syncDisabled(): void {
    const off = this.hasAttribute('disabled');
    if (this.#input) this.#input.disabled = off;
    this.$<HTMLButtonElement>('.send')?.toggleAttribute('disabled', off);
    this.$$<HTMLButtonElement>('.lead-btn').forEach((b) => b.toggleAttribute('disabled', off));
  }

  /** Enter sends; Shift+Enter is a new line. */
  #onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.#submit();
    }
  };

  /** The send button. */
  #onSend = (): void => this.#submit();

  /** Emit a leading-button event unless disabled. */
  #onLeading(name: 'composer-attach' | 'composer-lab'): void {
    if (this.hasAttribute('disabled')) return;
    this.emit(name, {});
  }

  /** The form's own submit, so Enter in any field sends. */
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
