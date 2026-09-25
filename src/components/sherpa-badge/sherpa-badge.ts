/**
 * sherpa-badge — a small count, Figma "Indicator (atom)/Type=count". CSS owns
 * the whole look; its text is the default slot.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

export class SherpaBadge extends SherpaElement {
  static override css = new URL('./sherpa-badge.css', import.meta.url);
  static override html = new URL('./sherpa-badge.html', import.meta.url);
}

customElements.define('sherpa-badge', SherpaBadge);
