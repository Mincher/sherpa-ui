/**
 * @element sherpa-progress-tracker
 * @category content
 * @description Vertical timeline with status-coloured milestone nodes plus a
 *   header row (title + percentage). For a simpler atomic timeline without
 *   header chrome, use {@link SherpaStepper} with `data-template="timeline"`
 *   directly. This component composes that primitive's visual model and adds
 *   the tracker header.
 *
 * @see sherpa-stepper data-template="timeline"
 *
 * @attr {string}  data-heading    — Tracker heading text
 * @attr {string}  data-percentage — Completion text (e.g. "60% Complete")
 *
 * @method setMilestones(milestones) — Set milestones: [{ label, status, description?, timestamp? }]
 *
 * @prop {Array} milestones — Current milestones array (getter-only)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

/** A single milestone in the tracker. */
interface Milestone {
  label?: string;
  status?: string;
  description?: string;
  timestamp?: string;
}

export class SherpaProgressTracker extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-progress-tracker.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-progress-tracker.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-heading',
      'data-percentage',
    ];
  }

  /* ── State ────────────────────────────────────────────────────── */

  #milestones: Milestone[] = [];

  els = this.cacheElements({
    heading: '.heading-text',
    percentage: '.percentage-text',
    list: '.milestone-list'
  });

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {
    this.#syncHeading();
    this.#syncPercentage();
  }

  override onAttributeChanged(name: string) {
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
  setMilestones(milestones: Milestone[]) {
    this.#milestones = milestones || [];
    this.#renderMilestones();
  }

  /** Get the current milestones array. */
  get milestones() {
    return [...this.#milestones];
  }

  /* ── Private: sync ────────────────────────────────────────────── */

  #syncHeading() {
    if (this.els.heading) {
      this.els.heading.textContent = this.dataset["heading"] || '';
    }
  }

  #syncPercentage() {
    if (this.els.percentage) {
      this.els.percentage.textContent = this.dataset["percentage"] || '';
    }
  }

  /* ── Private: milestone rendering ─────────────────────────────── */

  #renderMilestones() {
    if (!this.els.list) return;

    const tpl = this.$<HTMLTemplateElement>('template.milestone-tpl');
    if (!tpl) return;

    this.els.list.replaceChildren();

    this.#milestones.forEach((m) => {
      const frag = tpl.content.cloneNode(true) as DocumentFragment;
      const el   = frag.querySelector<HTMLElement>('.milestone');
      if (!el) return;

      // Status
      el.dataset["status"] = m.status || 'default';

      // Label
      const labelEl = el.querySelector('.milestone-label');
      if (labelEl) labelEl.textContent = m.label || '';

      // Description
      if (m.description) {
        el.dataset["hasDescription"] = '';
        const descEl = el.querySelector('.milestone-description');
        if (descEl) descEl.textContent = m.description;
      }

      // Timestamp
      if (m.timestamp) {
        el.dataset["hasTimestamp"] = '';
        const tsEl = el.querySelector('.milestone-timestamp');
        if (tsEl) tsEl.textContent = m.timestamp;
      }

      this.els.list?.appendChild(frag);
    });
  }
}

customElements.define('sherpa-progress-tracker', SherpaProgressTracker);
