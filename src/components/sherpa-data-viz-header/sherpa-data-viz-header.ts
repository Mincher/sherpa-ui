/**
 * sherpa-data-viz-header — the header strip of a metric or a chart's card:
 * Figma's Data Viz Header (1456:30467). CSS owns every part's presence.
 */
import { PRESENTATION_KINDS } from '../../core/data/query.js';
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';
import type { SherpaMenu } from '../sherpa-menu/sherpa-menu.js';

/** What Show as offers: its definition's, then each other way. TODO 548 */
const SHOW_AS = ['default', ...PRESENTATION_KINDS.filter((k) => k !== 'grid')] as const;

/** The card's title, its line under it, its actions and its Show as menu. */
export class SherpaDataVizHeader extends SherpaElement {
  static override css = new URL('./sherpa-data-viz-header.css', import.meta.url);
  static override html = new URL('./sherpa-data-viz-header.html', import.meta.url);
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
    const menu = this.$<SherpaMenu>('.presentation-menu');
    if (!menu) return;
    const on = this.dataset['presentation'] ?? 'default';
    menu.items?.(SHOW_AS.map((kind) => ({ value: kind, label: this.word(kind), selected: kind === on })));
    menu.addEventListener('menu-change', this.#onPick);
  }

  override onChange(name: string): void {
    const menu = this.$<SherpaMenu>('.presentation-menu');
    if (name === 'data-presentation' && menu) menu.values = [this.dataset['presentation'] ?? 'default'];
  }

  /** A way picked: asked for, never shown here first; the menu's job is done. */
  #onPick = (event: Event): void => {
    const [kind] = (event as CustomEvent<{ values?: string[] }>).detail?.values ?? [];
    this.$<SherpaMenu>('.presentation-menu')?.hide();
    if (kind && kind !== this.dataset['presentation']) this.emit('presentation-change', { kind });
  };
}

define('sherpa-data-viz-header', SherpaDataVizHeader);
