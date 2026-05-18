/**
 * @element sherpa-breadcrumbs
 * @category control
 * @description Navigation breadcrumb trail. The default template renders a
 *   <nav><ol> of crumbs (anchors + a current-page span).
 *
 *   Three authoring modes (no slots — HTML-first):
 *     1. Defaults: drop in <sherpa-breadcrumbs></sherpa-breadcrumbs> and use
 *        the example crumbs from the default template.
 *     2. Static override: point data-src at an HTML file exporting a
 *        <template id="default"> with the same shape — the entire breadcrumb
 *        markup is replaced.
 *     3. Dynamic data: set data-items to a JSON array of {label, href?}
 *        objects. The last entry is rendered as the current page
 *        (aria-current="page", no link, no separator).
 *
 *   JS only delegates clicks and emits a normalized event.
 *
 * @attr {string} [data-src]   — URL of an alternative breadcrumbs template HTML
 * @attr {json}   [data-items] — JSON array of {label: string, href?: string}
 *
 * @fires breadcrumb-click
 *   bubbles: true, composed: true
 *   detail: { index: number, href: string, label: string, current: boolean }
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaBreadcrumbs extends SherpaElement {

  static get cssUrl()  { return new URL('./sherpa-breadcrumbs.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-breadcrumbs.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-src', 'data-items'];
  }

  #ready = false;

  onRender() {
    this.#ready = true;
    this.shadowRoot.addEventListener('click', this.#onClick);
    if (this.dataset.items) this.#syncItems(this.dataset.items);
  }

  onAttributeChanged(name, _old, newValue) {
    if (!this.#ready) return;
    if (name === 'data-src' && newValue) {
      this.renderFromUrl(newValue);
    } else if (name === 'data-items') {
      this.#syncItems(newValue);
    }
  }

  /* ── Dynamic items ───────────────────────────────────────────── */

  #syncItems(raw) {
    const list = this.$('.breadcrumb-list');
    if (!list) return;

    let items = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) items = parsed;
      } catch {
        // Malformed JSON — leave default template content in place.
        return;
      }
    }
    if (!items.length) return;

    list.replaceChildren();
    const lastIndex = items.length - 1;
    items.forEach((item, i) => {
      if (!item || typeof item !== 'object') return;
      const label = String(item.label ?? '').trim();
      if (!label) return;

      const li = document.createElement('li');
      li.className = 'crumb';

      const isCurrent = i === lastIndex;
      const text = document.createElement(isCurrent ? 'span' : 'a');
      text.className = 'crumb-text';
      text.textContent = label;
      if (isCurrent) {
        text.setAttribute('aria-current', 'page');
      } else if (item.href) {
        text.setAttribute('href', String(item.href));
      } else {
        text.setAttribute('href', '#');
      }
      li.appendChild(text);

      if (!isCurrent) {
        const sep = document.createElement('span');
        sep.className = 'separator';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '/';
        li.appendChild(sep);
      }

      list.appendChild(li);
    });
  }

  /* ── Click delegation ────────────────────────────────────────── */

  #onClick = (e) => {
    const text = e.composedPath().find(
      n => n instanceof HTMLElement && n.classList?.contains('crumb-text')
    );
    if (!text) return;

    const list = this.$('.breadcrumb-list');
    const crumbs = list ? Array.from(list.querySelectorAll('.crumb-text')) : [];
    const index = crumbs.indexOf(text);
    const isCurrent = text.getAttribute('aria-current') === 'page';

    this.dispatchEvent(new CustomEvent('breadcrumb-click', {
      bubbles: true,
      composed: true,
      detail: {
        index,
        href: text.getAttribute('href') || '',
        label: text.textContent.trim(),
        current: isCurrent,
      },
    }));
  };
}

customElements.define('sherpa-breadcrumbs', SherpaBreadcrumbs);
