/**
 * sherpa-tooltip.js
 * SherpaTooltip — Singleton tooltip with CSS anchor positioning fallback.
 * Extends SherpaElement for shadow DOM setup and template/CSS loading.
 *
 * Usage (static API):
 *   Tooltip.show(anchor, 'Hello')
 *   Tooltip.hide()
 *
 * Declarative:
 *   <button data-tooltip="Help text">Hover me</button>
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

const supportsAnchor = CSS.supports('position-anchor', '--test');

let instance = null;
let currentAnchor = null;

class SherpaTooltip extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-tooltip.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-tooltip.html', import.meta.url).href; }

  static get observedAttributes() { return ['data-visible', 'data-position']; }

  /* ── Private state ────────────────────────────────────────────── */

  #text = '';
  #position = 'top';

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  onRender() {
    this.dataset.position = this.#position;
  }

  /* ── Public API ───────────────────────────────────────────────── */

  setText(text) {
    this.#text = text;
    const content = this.$('.tooltip-content');
    if (content) content.textContent = text;
  }

  getText() { return this.#text; }

  setPosition(pos) { this.dataset.position = pos || 'top'; }
  getPosition()    { return this.dataset.position || 'top'; }

  setVisible(visible) { this.dataset.visible = visible ? 'true' : 'false'; }
  isVisible()         { return this.dataset.visible === 'true'; }

  async showFor(anchor, text, { position = 'top' } = {}) {
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

function getInstance() {
  if (!instance) {
    instance = document.createElement('sherpa-tooltip');
    document.body.appendChild(instance);
  }
  return instance;
}

export const Tooltip = {
  show(anchor, text, options = {}) { return getInstance().showFor(anchor, text, options); },
  hide() { instance?.hide(); },
};

/* ── Declarative data-tooltip support ───────────────────────────── */

function initDeclarative() {
  document.addEventListener('mouseenter', (e) => {
    const target = e.target.closest?.('[data-tooltip]');
    if (target) {
      Tooltip.show(target, target.dataset.tooltip, {
        position: target.dataset.tooltipPosition || 'top',
      });
    }
  }, true);

  document.addEventListener('mouseleave', (e) => {
    if (e.target.closest?.('[data-tooltip]')) Tooltip.hide();
  }, true);
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initDeclarative)
  : initDeclarative();
