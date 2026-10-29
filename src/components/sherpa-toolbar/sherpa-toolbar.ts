/**
 * sherpa-toolbar — a horizontal strip of controls: a leading slot that stretches
 * and a trailing slot that hugs its content. Left and Right move between them.
 * TRAP T-a-toolbar-moves-by-arrow-and-keeps-its-tabs
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { toolbarKeys } from '../../core/ui/roving-focus.js';
import { SHOW_AS, SHOW_AS_HTML, showAs } from '../../core/ui/show-as.js';

export class SherpaToolbar extends SherpaElement {
  static override css = new URL('./sherpa-toolbar.css', import.meta.url);
  static override html = [SHOW_AS_HTML, new URL('./sherpa-toolbar.html', import.meta.url)];

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-type': { type: 'enum', kind: 'style', values: ['plain', 'bordered'] },
    // Show as, before the trailing controls — a grid card's. A pick is a REQUEST. Will, TODO 548
    'data-presentation': { type: 'enum', kind: 'behaviour', values: [...SHOW_AS] },
  } as const;

  override onRender(): void {
    const bar = this.$('.bar');
    if (bar) toolbarKeys(bar);
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

define('sherpa-toolbar', SherpaToolbar);
