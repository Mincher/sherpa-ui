/** sherpa-container — the base card. CSS owns style, padding and state. */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import '../sherpa-loader/sherpa-loader.js';
import '../sherpa-empty-state/sherpa-empty-state.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-callout/sherpa-callout.js';
import '../sherpa-progress-bar/sherpa-progress-bar.js';

/** What its data is doing. TRAP T-a-container-shows-its-datas-state */
type DataState = 'loading' | 'empty' | 'no-matches' | 'error';

interface ContainerState {
  state?: DataState | null;
  /** An error's own words. */
  message?: string;
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
    /* Its data's state — written by the provider. TRAP T-a-container-shows-its-datas-state */
    'data-state': { type: 'enum', kind: 'visibility', values: ['empty', 'no-matches', 'error'] },
    'data-error-message': { type: 'string', kind: 'content', to: '.error-message', all: true },
    // A state is a bar or a banner, never IN PLACE of the body. Will, TODO 59.
    'data-keep-content': { type: 'boolean', kind: 'style' },
  } as const;

  override onRender(): void {
    // Retry and Clear filters are REQUESTS: the data layer answers them.
    for (const b of this.$$('.retry')) b.addEventListener('button-click', () => this.emit('data-refresh'));
    for (const b of this.$$('.clear-filters')) b.addEventListener('button-click', () => this.emit('filters-clear'));
    // Dismiss is this card's own: the overlay goes, the last data stays.
    for (const b of this.$$('.dismiss')) {
      b.addEventListener('button-click', () => {
        this.removeAttribute('data-state');
        this.emit('state-dismiss');
      });
    }
  }

  /** populate({ state, message }) — a host with no provider sets the state by hand. */
  protected override renderData(data: unknown): void {
    const { state, message } = (data ?? {}) as ContainerState;
    this.toggleAttribute('data-loading', state === 'loading');
    if (state && state !== 'loading') this.dataset['state'] = state;
    else delete this.dataset['state'];
    if (message) this.dataset['errorMessage'] = message;
    else delete this.dataset['errorMessage'];
  }
}

customElements.define('sherpa-container', SherpaContainer);
