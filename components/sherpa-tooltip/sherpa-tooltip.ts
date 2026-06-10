/**
 * sherpa-tooltip.js
 * SherpaTooltip — Singleton tooltip with CSS anchor positioning fallback.
 *
 * Operates as a singleton: one tooltip instance shared across the page.
 * Use the exported Tooltip API or declarative data-tooltip attributes.
 *
 * @element sherpa-tooltip
 * @category overlay
 * @description Singleton hover tooltip for supplemental text on any element. One shared instance
 *   exists per page — do not create multiple instances. Activate declaratively via a data-tooltip
 *   attribute on any element, or programmatically via Tooltip.showFor(anchor, text). Use for
 *   icon-only buttons and abbreviated labels that need clarification on hover. Avoid placing
 *   required information in tooltips as they are not accessible to all keyboard users.
 *
 * @attr {boolean} data-visible   — Whether the tooltip is currently shown
 * @attr {enum}    data-position  — top | bottom | left | right
 *
 * @method setText(text) — Set tooltip content text
 *   @param {string} text — Text to display
 *   @returns {void}
 * @method getText() — Get current tooltip text
 *   @returns {string}
 * @method setPosition(pos) — Set preferred position
 *   @param {string} pos — Position value
 *   @returns {void}
 * @method getPosition() — Get current position
 *   @returns {string}
 * @method setVisible(visible) — Show or hide the tooltip
 *   @param {boolean} visible — Visibility flag
 *   @returns {void}
 * @method isVisible() — Check if tooltip is shown
 *   @returns {boolean}
 * @method showFor(anchor, text, options) — Position and show for an anchor element
 *   @param {Element} anchor — Target element
 *   @param {string} text — Tooltip text
 *   @param {object} [options] — { position: string }
 *   @returns {Promise<void>}
 * @method hide() — Hide the tooltip
 *   @returns {void}
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

const supportsAnchor = CSS.supports('position-anchor', '--test');

/** An anchor element, optionally tagged with a temporary generated anchor-name. */
type AnchorEl = HTMLElement & { _tooltipTempAnchor?: boolean };

let instance: SherpaTooltip | null = null;
let currentAnchor: AnchorEl | null = null;

class SherpaTooltip extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-tooltip.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-tooltip.html', import.meta.url).href; }

  static override get observedAttributes(): string[] { return [...super.observedAttributes, 'data-visible', 'data-position']; }

  /* ── Private state ────────────────────────────────────────────── */

  #text = '';
  #position = 'top';

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  override onRender(): void {
    this.dataset["position"] = this.#position;
  }

  /* ── Public API ───────────────────────────────────────────────── */

  setText(text: string) {
    this.#text = text;
    const content = this.$('.tooltip-content');
    if (content) content.textContent = text;
  }

  getText() { return this.#text; }

  setPosition(pos: string) { this.dataset["position"] = pos || 'top'; }
  getPosition()    { return this.dataset["position"] || 'top'; }

  setVisible(visible: boolean) { this.dataset["visible"] = visible ? 'true' : 'false'; }
  isVisible()         { return this.dataset["visible"] === 'true'; }

  async showFor(anchor: AnchorEl, text: string, { position = 'top' }: { position?: string } = {}) {
    if (!anchor) return;

    // Ensure rendered
    await this.rendered;

    // Clean up previous anchor
    if (currentAnchor && currentAnchor !== anchor) {
      currentAnchor = null;
    }

    this.setText(text);
    this.setPosition(position);
    this.#position = position;

    // Copy --_point-offset from anchor's context for positioning
    const pointOffset = getComputedStyle(anchor).getPropertyValue('--_point-offset').trim();
    this.style.setProperty('--_point-offset', pointOffset || '0px');

    // CSS anchor-name can't cross shadow boundaries, so fall back to
    // getBoundingClientRect when the anchor lives inside a shadow root.
    const inShadow = anchor.getRootNode() instanceof ShadowRoot;

    if (supportsAnchor && !inShadow) {
      let anchorName = anchor.style.getPropertyValue('anchor-name').trim().split(/\s+/)[0];
      if (!anchorName) {
        anchorName = `--sherpa-anchor-${Math.random().toString(36).slice(2, 9)}`;
        anchor.style.setProperty('anchor-name', anchorName);
        anchor._tooltipTempAnchor = true;
      }
      this.style.setProperty('position-anchor', anchorName);
      currentAnchor = anchor;
      this.style.left = '';
      this.style.top = '';
    } else {
      const rect = anchor.getBoundingClientRect();
      this.style.left = `${rect.left + rect.width / 2}px`;
      this.style.top = `${position === 'bottom' ? rect.bottom : rect.top}px`;
    }

    this.setVisible(true);
  }

  hide() {
    this.setVisible(false);
    if (currentAnchor) {
      if (currentAnchor._tooltipTempAnchor) {
        currentAnchor.style.removeProperty('anchor-name');
        delete currentAnchor._tooltipTempAnchor;
      }
      currentAnchor = null;
    }
    this.style.removeProperty('position-anchor');
  }
}

customElements.define('sherpa-tooltip', SherpaTooltip);

/* ── Singleton access ───────────────────────────────────────────── */

function getInstance(): SherpaTooltip {
  if (!instance) {
    instance = document.createElement('sherpa-tooltip') as SherpaTooltip;
    document.body.appendChild(instance);
  }
  return instance;
}

export const Tooltip = {
  show(anchor: AnchorEl, text: string, options: { position?: string } = {}) {
    return getInstance().showFor(anchor, text, options);
  },
  hide() { instance?.hide(); },
  destroy() {
    if (instance) {
      instance.remove();
      instance = null;
      currentAnchor = null;
    }
  },
};

/* ── Declarative data-tooltip support ───────────────────────────── */

function initDeclarative() {
  document.addEventListener('mouseenter', (e) => {
    const target = (e.target as Element | null)?.closest?.('[data-tooltip]');
    if (target instanceof HTMLElement) {
      Tooltip.show(target, target.dataset["tooltip"] || '', {
        position: target.dataset["tooltipPosition"] || 'top',
      });
    }
  }, true);

  document.addEventListener('mouseleave', (e) => {
    if ((e.target as Element | null)?.closest?.('[data-tooltip]')) Tooltip.hide();
  }, true);
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initDeclarative)
  : initDeclarative();
