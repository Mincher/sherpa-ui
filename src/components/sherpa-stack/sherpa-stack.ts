/**
 * sherpa-stack — a run of items in one direction, with a token gap.
 *
 * No JS: direction, gap, alignment and wrapping are all [data-*] selectors in
 * the CSS. The class exists only to give the element a shadow root and sheet.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaStack extends SherpaElement {
  static override css = new URL('./sherpa-stack.css', import.meta.url);
  static override html = new URL('./sherpa-stack.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-align': { type: 'enum', kind: 'style', values: ['between', 'center', 'end', 'start', 'stretch'] },
    'data-direction': { type: 'enum', kind: 'style', values: ['inline'] },
    'data-fill': { type: 'boolean', kind: 'style' },
    'data-gap': { type: 'enum', kind: 'style', values: ['2xl', 'lg', 'md', 'none', 'sm', 'xl'] },
    'data-measure': { type: 'boolean', kind: 'style' },
    'data-min-item': { type: 'enum', kind: 'style', values: ['hug', 'sm', 'md', 'lg', 'xl'] },
    'data-scroll': { type: 'boolean', kind: 'style' },
    'data-wrap': { type: 'boolean', kind: 'style' },
  } as const;
}

customElements.define('sherpa-stack', SherpaStack);
