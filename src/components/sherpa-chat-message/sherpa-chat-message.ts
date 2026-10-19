/**
 * sherpa-chat-message — one chat bubble in a thread.
 *
 * data-type (assistant/user/system) is CSS-only. JS writes the three texts.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';

export class SherpaChatMessage extends SherpaElement {
  static override css = new URL('./sherpa-chat-message.css', import.meta.url);
  static override html = new URL('./sherpa-chat-message.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-type': { type: 'enum', kind: 'style', values: ['assistant', 'system', 'user'] },
    'data-name': { type: 'string', kind: 'content' },
    'data-timestamp': { type: 'string', kind: 'content' },
    'data-message': { type: 'string', kind: 'content' },
  } as const;

  override onRender(): void {
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** Write the author, the time and the message. */
  #sync(): void {
    this.#text('.author', this.dataset['name']);
    this.#text('.time', this.dataset['timestamp']);
    this.#text('.content', this.dataset['message']);
  }

  /** Write text into one part, or empty it. */
  #text(sel: string, value: string | undefined): void {
    const el = this.$(sel);
    if (el) el.textContent = value ?? '';
  }
}

define('sherpa-chat-message', SherpaChatMessage);
