/**
 * sherpa-toolbar — a horizontal strip of controls: a leading slot that stretches
 * and a trailing slot that hugs its content. Left and Right move between them.
 * TRAP T-a-toolbar-moves-by-arrow-and-keeps-its-tabs
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { toolbarKeys } from '../../core/ui/roving-focus.js';

export class SherpaToolbar extends SherpaElement {
  static override css = new URL('./sherpa-toolbar.css', import.meta.url);
  static override html = new URL('./sherpa-toolbar.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-type': { type: 'enum', kind: 'style', values: ['plain', 'bordered'] },
  } as const;

  override onRender(): void {
    const bar = this.$('.bar');
    if (bar) toolbarKeys(bar);
  }
}

define('sherpa-toolbar', SherpaToolbar);
