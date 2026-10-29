/**
 * sherpa-data-viz-header — the header strip of a metric or a chart's card:
 * Figma's Data Viz Header (1456:30467). CSS owns every part's presence.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { SHOW_AS, SHOW_AS_HTML, showAs } from '../../core/ui/show-as.js';

/** The card's title, its line under it, its actions and its Show as menu. */
export class SherpaDataVizHeader extends SherpaElement {
  static override css = new URL('./sherpa-data-viz-header.css', import.meta.url);
  static override html = [SHOW_AS_HTML, new URL('./sherpa-data-viz-header.html', import.meta.url)];
  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.title' },
    'data-divider': { type: 'enum', kind: 'style', values: ['none'] },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
    // A slotted icon wins over the data-icon glyph.
    'data-icon': { type: 'string', kind: 'content', to: '.icon', as: 'icon' },
    // Show as, and what the card shows: a pick is a REQUEST, its provider writes this. Will, TODO 548
    'data-presentation': { type: 'enum', kind: 'behaviour', values: [...SHOW_AS] },
  } as const;

  override onRender(): void {
    this.#showAs();
  }

  override onChange(name: string): void {
    if (name === 'data-presentation') this.#showAs();
  }

  /** Show as: a pick is a request; its provider writes what the card shows. */
  #showAs(): void {
    showAs(this.root, this.dataset['presentation'], (kind) => {
      if (kind !== this.dataset['presentation']) this.emit('presentation-change', { kind });
    });
  }
}

define('sherpa-data-viz-header', SherpaDataVizHeader);
