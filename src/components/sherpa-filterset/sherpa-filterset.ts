/**
 * sherpa-filterset — filters drawn as ONE group, as a fieldset groups fields: a
 * heading, its filters joined, and a chain mark when each offers what the ones
 * before it leave. The bar and the panel stamp it from a scope's sets.
 * TODO 99 · TRAP T-a-filter-set-groups-or-chains
 */
import { SHARED_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';

export class SherpaFilterset extends SherpaElement {
  static override css = new URL('./sherpa-filterset.css', import.meta.url);
  static override html = new URL('./sherpa-filterset.html', import.meta.url);

  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.heading' },
    'data-mode': { type: 'enum', kind: 'style', values: ['serial', 'parallel'] },
    'data-orientation': SHARED_PROPS['data-orientation'],
  } as const;
}

define('sherpa-filterset', SherpaFilterset);
