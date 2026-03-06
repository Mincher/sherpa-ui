/**
 * sherpa-progress-tracker.js
 * SherpaProgressTracker — Vertical timeline with status-coloured milestone nodes.
 *
 * Usage:
 *   <sherpa-progress-tracker data-heading="Application Progress"
 *     data-percentage="60% Complete">
 *   </sherpa-progress-tracker>
 *
 *   // Then in JS:
 *   tracker.setMilestones([
 *     { label: 'Application submitted', status: 'success', timestamp: '10 Jan 2025' },
 *     { label: 'Under review', status: 'in-progress', description: 'Being reviewed by team' },
 *     { label: 'Approved', status: 'default' },
 *   ]);
 *
 * Attributes:
 *   data-heading    — Tracker heading text
 *   data-percentage — Completion text, e.g. "60% Complete"
 *
 * Methods:
 *   setMilestones([{ label, status, description, timestamp }])
 *
 * Milestone statuses:
 *   default | in-progress | success | warning | critical
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaProgressTracker extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-progress-tracker.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-progress-tracker.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'data-heading',
      'data-percentage',
    ];
  }

  /* ── State ────────────────────────────────────────────────────── */

  #milestones = [];
  #headingEl;
  #percentageEl;
  #listEl;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#headingEl    = this.$('.heading-text');
    this.#percentageEl = this.$('.percentage-text');
    this.#listEl       = this.$('.milestone-list');

    this.#syncHeading();
    this.#syncPercentage();
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-heading':    this.#syncHeading(); break;
      case 'data-percentage': this.#syncPercentage(); break;
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  /**
   * Set milestone data and render the list.
   * @param {Array<{label: string, status?: string, description?: string, timestamp?: string}>} milestones
   */
  setMilestones(milestones) {
    this.#milestones = milestones || [];
    this.#renderMilestones();
  }

  /** Get the current milestones array. */
  get milestones() {
    return [...this.#milestones];
  }

  /* ── Private: sync ────────────────────────────────────────────── */

  #syncHeading() {
    if (this.#headingEl) {
      this.#headingEl.textContent = this.dataset.heading || '';
    }
  }

  #syncPercentage() {
    if (this.#percentageEl) {
      this.#percentageEl.textContent = this.dataset.percentage || '';
    }
  }

  /* ── Private: milestone rendering ─────────────────────────────── */

  #renderMilestones() {
    if (!this.#listEl) return;

    const tpl = this.$('template.milestone-tpl');
    if (!tpl) return;

    this.#listEl.replaceChildren();

    this.#milestones.forEach((m) => {
      const frag = tpl.content.cloneNode(true);
      const el   = frag.querySelector('.milestone');

      // Status
      el.dataset.status = m.status || 'default';

      // Label
      const labelEl = el.querySelector('.milestone-label');
      if (labelEl) labelEl.textContent = m.label || '';

      // Description
      if (m.description) {
        el.dataset.hasDescription = '';
        const descEl = el.querySelector('.milestone-description');
        if (descEl) descEl.textContent = m.description;
      }

      // Timestamp
      if (m.timestamp) {
        el.dataset.hasTimestamp = '';
        const tsEl = el.querySelector('.milestone-timestamp');
        if (tsEl) tsEl.textContent = m.timestamp;
      }

      this.#listEl.appendChild(frag);
    });
  }
}

customElements.define('sherpa-progress-tracker', SherpaProgressTracker);
