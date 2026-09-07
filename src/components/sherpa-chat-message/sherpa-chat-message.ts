/**
 * sherpa-chat-message — one chat bubble in a thread.
 *
 * data-type (assistant, user, or system) sets the layout and colour, all in CSS.
 * JS only writes the text — author, time, and message. If you slot in your own
 * body content, it replaces the data-content text.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaChatMessage extends SherpaElement {
  static override css = new URL('./sherpa-chat-message.css', import.meta.url);
  static override html = new URL('./sherpa-chat-message.html', import.meta.url);
  static override observed = ['data-author', 'data-time', 'data-content'];

  override onRender(): void {
    if (!this.dataset['type']) this.dataset['type'] = 'assistant';
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  #sync(): void {
    this.#text('.author', this.dataset['author']);
    this.#text('.time', this.dataset['time']);
    this.#text('.content', this.dataset['content']);
  }

  #text(sel: string, value: string | undefined): void {
    const el = this.$(sel);
    if (el) el.textContent = value ?? '';
  }
}

customElements.define('sherpa-chat-message', SherpaChatMessage);
