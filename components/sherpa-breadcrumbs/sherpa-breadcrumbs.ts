/**
 * @element sherpa-breadcrumbs
 * @category control
 * @description Navigation trail showing the user's current position in a hierarchy. Place in the
 *   view header or page-level layout. Supply items as a JSON array via data-items, as a remote
 *   JSON URL via data-src-json, or as a full custom HTML template via data-src-html. The last
 *   item is always rendered as the current page — no link, aria-current="page". JS only
 *   delegates clicks and emits a normalised breadcrumb-click event.
 *
 * @attr {string} data-src-html — URL of an HTML template file to replace the shadow DOM
 * @attr {string} data-src-json — URL of a JSON file: [{label: string, href?: string}]
 * @attr {json}   data-items    — Inline JSON array: [{label: string, href?: string}]
 *
 * @fires breadcrumb-click
 *   bubbles: true, composed: true
 *   detail: { index: number, href: string, label: string, current: boolean }
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaBreadcrumbs extends SherpaElement {

  static override get cssUrl(): string  { return new URL('./sherpa-breadcrumbs.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-breadcrumbs.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-items'];
  }

  override onRender(): void {
    this.shadowRoot?.addEventListener('click', this.#onClick);
    this.#applyDataItems();
  }

  override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === 'data-items' && newValue !== oldValue) {
      this.#applyDataItems();
    }
  }

  override onJsonData(items: unknown): void {
    if (Array.isArray(items)) this.#syncItems(items);
  }

  #applyDataItems(): void {
    const raw = this.dataset["items"];
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) this.#syncItems(parsed);
    } catch {
      /* ignore malformed JSON; keep static default */
    }
  }

  /* ── Dynamic items ───────────────────────────────────────────── */

  #syncItems(items: unknown[]): void {
    const trail = this.$('.breadcrumb-trail');
    if (!trail) return;

    const objects = items.filter(
      (item): item is { label?: unknown; href?: unknown } =>
        item != null && typeof item === 'object',
    );
    const crumbs = objects
      .map((item, i, arr) => {
        const label = String(item.label ?? '').trim();
        if (!label) return null;
        const isCurrent = i === arr.length - 1;
        const el = document.createElement(isCurrent ? 'span' : 'a');
        el.className = 'crumb-text';
        el.textContent = label;
        if (isCurrent) el.setAttribute('aria-current', 'page');
        else el.setAttribute('href', item.href ? String(item.href) : '#');
        return el;
      })
      .filter((el): el is HTMLElement => el !== null);

    if (!crumbs.length) return;

    trail.replaceChildren(...crumbs.flatMap((el, i, arr) => {
      if (i === arr.length - 1) return [el];
      const sep = document.createElement('span');
      sep.className = 'separator';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '/';
      return [el, sep];
    }));
  }

  /* ── Click delegation ────────────────────────────────────────── */

  #onClick = (e: Event): void => {
    const text = e.composedPath().find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.classList?.contains('crumb-text'),
    );
    if (!text) return;

    const crumbs = Array.from(this.$$('.crumb-text'));
    const index = crumbs.indexOf(text);
    const isCurrent = text.getAttribute('aria-current') === 'page';

    this.emit('breadcrumb-click', {
      index,
      href: text.getAttribute('href') || '',
      label: text.textContent?.trim() ?? '',
      current: isCurrent,
    });
  };
}

customElements.define('sherpa-breadcrumbs', SherpaBreadcrumbs);
