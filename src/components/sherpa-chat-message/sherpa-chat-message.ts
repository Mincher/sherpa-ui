/**
 * sherpa-chat-message — a single chat bubble for AI / messaging threads.
 *
 * Layout and colour are pure CSS off data-role (assistant | user | system); the
 * base class reflects data-has-avatar for the avatar slot. JS only syncs the
 * text fields (author, time, content) into their shadow nodes — a slotted body
 * overrides data-content via CSS.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaChatMessage extends SherpaElement {
  static override css = new URL('./sherpa-chat-message.css', import.meta.url);
  static override html = new URL('./sherpa-chat-message.html', import.meta.url);
  static override observed = ['data-author', 'data-time', 'data-content'];

  override onRender(): void {
    if (!this.dataset['role']) this.dataset['role'] = 'assistant';
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
