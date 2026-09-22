/**
 * sherpa-key-value-list — a list of label-and-value pairs.
 *
 * Give it pairs with populate([{ key, value }]) and it draws one row each.
 * data-orientation sets whether the label and value sit side by side or stacked,
 * and CSS handles that.
 *
 * Public API:
 *   data-orientation  horizontal | vertical (default: horizontal)
 *
 * No events — this is a display-only component.
 */
import { SHARED_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';

export interface KeyValuePair {
  key: string;
  value: string;
}

export class SherpaKeyValueList extends SherpaElement {
  static override css = new URL('./sherpa-key-value-list.css', import.meta.url);
  static override html = new URL('./sherpa-key-value-list.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-orientation': SHARED_PROPS['data-orientation'],
  } as const;

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

  // The prototype's own data-text attributes name the fields; there is nothing
  // left to write by hand.
  #render(): void {
    this.renderItems('.list', 'template.pair-tpl', this.#pairs);
  }
}

customElements.define('sherpa-key-value-list', SherpaKeyValueList);
