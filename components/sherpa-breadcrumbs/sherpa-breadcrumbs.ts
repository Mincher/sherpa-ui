/**
 * @element sherpa-breadcrumbs
 * @category control
 * @description Navigation breadcrumb trail rendered as a flat flex row of
 *   crumb links and separator spans.
 *
 *   Three authoring modes (no slots — HTML-first):
 *     1. Defaults: drop in <sherpa-breadcrumbs></sherpa-breadcrumbs> and use
 *        the example crumbs from the default template.
 *     2. Template override: point data-src-html at an HTML file containing a
 *        <template id="default"> — the entire shadow DOM is replaced.
 *     3. Dynamic data: set data-src-json to a URL pointing to a JSON file that
 *        exports an array of {label, href?} objects. The last entry is
 *        rendered as the current page (aria-current="page", no link, no separator).
 *
 *   JS only delegates clicks and emits a normalized event.
 *
 * @attr {string} [data-src-html] — URL of an HTML template file to replace the shadow DOM
 * @attr {string} [data-src-json] — URL of a JSON file: [{label: string, href?: string}]
 *
 * @fires breadcrumb-click
 *   bubbles: true, composed: true
 *   detail: { index: number, href: string, label: string, current: boolean }
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaBreadcrumbs extends SherpaElement {

  static override get cssUrl(): string  { return new URL('./sherpa-breadcrumbs.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-breadcrumbs.html', import.meta.url).href; }

  override onRender(): void {
    // @ts-expect-error - TODO: Fix type
    this.shadowRoot.addEventListener('click', this.#onClick);
  }

  // @ts-expect-error - TODO: Fix type
  override onJsonData(items) {
    if (Array.isArray(items)) this.#syncItems(items);
  }

  /* ── Dynamic items ───────────────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #syncItems(items) {
    const trail = this.$('.breadcrumb-trail');
    if (!trail) return;

    const crumbs = items
      .filter((item: any) => item && typeof item === 'object')
      // @ts-expect-error - TODO: Fix type
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
      .filter(Boolean);

    if (!crumbs.length) return;

    // @ts-expect-error - TODO: Fix type
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

  #onClick = (e: Event) => {
    const text = e.composedPath().find(
      n => n instanceof HTMLElement && n.classList?.contains('crumb-text')
    );
    if (!text) return;

    const crumbs = Array.from(this.$$('.crumb-text'));
    // @ts-expect-error - TODO: Fix type
    const index = crumbs.indexOf(text);
    // @ts-expect-error - TODO: Fix type
    const isCurrent = text.getAttribute('aria-current') === 'page';

    this.dispatchEvent(new CustomEvent('breadcrumb-click', {
      bubbles: true,
      composed: true,
      detail: {
        index,
        // @ts-expect-error - TODO: Fix type
        href: text.getAttribute('href') || '',
        // @ts-expect-error - TODO: Fix type
        label: text.textContent.trim(),
        current: isCurrent,
      },
    }));
  };
}

customElements.define('sherpa-breadcrumbs', SherpaBreadcrumbs);
