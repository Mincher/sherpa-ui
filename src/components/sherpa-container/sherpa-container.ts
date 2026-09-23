/** sherpa-container — the base card. CSS owns style, padding and state. */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

interface ContainerState {
  /** Only loading is settable. empty/error are slot-driven, not state. */
  state?: 'loading' | null;
}

export class SherpaContainer extends SherpaElement {
  static override css = new URL('./sherpa-container.css', import.meta.url);
  static override html = new URL('./sherpa-container.html', import.meta.url);

  /* DECLARED, not hand-synced: CSS-only, so the base class writes nothing. */
  static override props = {
    'data-fill': { type: 'boolean', kind: 'style' },
    'data-padding': { type: 'enum', kind: 'style', values: ['lg', 'none', 'sm'] },
    'data-row-span': { type: 'enum', kind: 'style', values: ['1', '10', '12', '2', '3', '4', '5', '6', '8'] },
    'data-padding-inline': { type: 'enum', kind: 'style', values: ['none', 'sm', 'md', 'lg'] },
  } as const;

  /** Toggles the loading overlay. 'empty'/'error' are a NO-OP — slot them instead. */
  protected override renderData(data: unknown): void {
    const { state } = (data ?? {}) as ContainerState;
    this.removeAttribute('data-loading');
    if (state === 'loading') this.setAttribute('data-loading', '');
  }
}

customElements.define('sherpa-container', SherpaContainer);
