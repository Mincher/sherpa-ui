/**
 * sherpa-chat-message — one chat bubble in a thread.
 *
 * data-type (assistant/user/system) is CSS-only. JS writes the three texts.
 * data-author / data-time / data-content are back-compat aliases for
 * data-name / data-timestamp / data-message.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaChatMessage extends SherpaElement {
  static override css = new URL('./sherpa-chat-message.css', import.meta.url);
  static override html = new URL('./sherpa-chat-message.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-type': { type: 'enum', kind: 'style', values: ['assistant', 'system', 'user'] },
  } as const;
  static override observed = [
    'data-name', 'data-timestamp', 'data-message',
    'data-author', 'data-time', 'data-content',
  ];

  override onRender(): void {
    if (!this.dataset['type']) this.dataset['type'] = 'assistant';
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  #sync(): void {
    this.#text('.author', this.dataset['name'] ?? this.dataset['author']);
    this.#text('.time', this.dataset['timestamp'] ?? this.dataset['time']);
    this.#text('.content', this.dataset['message'] ?? this.dataset['content']);
  }

  #text(sel: string, value: string | undefined): void {
    const el = this.$(sel);
    if (el) el.textContent = value ?? '';
  }
}

customElements.define('sherpa-chat-message', SherpaChatMessage);
