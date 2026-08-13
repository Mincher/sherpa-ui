/**
 * sherpa-key-value-list — a semantic definition list.
 *
 * Renders label/value pairs into a native <dl> from populate([{ key, value }])
 * by cloning the <template class="pair-tpl"> prototype (the only structural DOM
 * it creates — data-driven rows, which the golden rules allow). Layout
 * (side-by-side vs. stacked) is pure CSS off data-layout on the host.
 *
 * Public API:
 *   data-layout  horizontal | stacked (default: horizontal)
 *
 * No events — this is a display-only component.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface KeyValuePair {
  key: string;
  value: string;
}

export class SherpaKeyValueList extends SherpaElement {
  static override css = new URL('./sherpa-key-value-list.css', import.meta.url);
  static override html = new URL('./sherpa-key-value-list.html', import.meta.url);

  #pairs: KeyValuePair[] = [];

  override onRender(): void {
    if (this.#pairs.length) this.#render();
  }

  /** populate([{ key, value }]) — the label/value pairs to render. */
  protected override renderData(data: unknown): void {
    const list = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    this.#pairs = list
      .filter((p): p is Record<string, unknown> => p != null && typeof p === 'object')
      .map((p): KeyValuePair => ({
        key: String(p['key'] ?? ''),
        value: p['value'] == null ? '' : String(p['value']),
      }));
    this.#render();
  }

  #render(): void {
    const dl = this.$('.list');
    const tpl = this.$<HTMLTemplateElement>('template.pair-tpl');
    if (!dl || !tpl) return;

    dl.replaceChildren();
    for (const pair of this.#pairs) {
      const frag = tpl.content.cloneNode(true) as DocumentFragment;
      frag.querySelector('.key')!.textContent = pair.key;
      frag.querySelector('.value')!.textContent = pair.value;
      dl.appendChild(frag);
    }
  }
}

customElements.define('sherpa-key-value-list', SherpaKeyValueList);
