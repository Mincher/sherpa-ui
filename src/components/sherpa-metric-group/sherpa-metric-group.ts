/**
 * sherpa-metric-group — one row of up to four metrics, across every column of the layout grid.
 * TRAP T-a-metric-group-knows-it-is-stuck
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';

export class SherpaMetricGroup extends SherpaElement {
  static override css = new URL('./sherpa-metric-group.css', import.meta.url);
  static override html = new URL('./sherpa-metric-group.html', import.meta.url);
  static override pageCss = new URL('./sherpa-metric-group-page.css', import.meta.url);

  static override props = {
    'data-sticky': { type: 'boolean', kind: 'style' },
  } as const;
}

define('sherpa-metric-group', SherpaMetricGroup);
