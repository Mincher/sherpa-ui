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
 * @method populate(source) — Render from a crumb array [{label, href?}] OR a
 *   precompiled HTML string. The single data → HTML entry point (see the
 *   Sherpa template binder). The last crumb becomes the current page.
 *
 * @fires breadcrumb-click
 *   bubbles: true, composed: true
 *   detail: { index: number, href: string, label: string, current: boolean }
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { isHtmlString } from '../utilities/sherpa-template/sherpa-template.js';

interface CrumbInput { label?: unknown; href?: unknown; }

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
    if (Array.isArray(items)) this.populate(items as CrumbInput[]);
  }

  #applyDataItems(): void {
    const raw = this.dataset["items"];
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) this.populate(parsed);
    } catch {
      /* ignore malformed JSON; keep static default */
    }
  }

  /* ── Data → HTML population (via the template binder) ─────────── */

  /**
   * Populate the trail from a crumb array or precompiled HTML. Each crumb
   * object is expanded into the render-flags the template's data-bind-if
   * branches consume (link / current / separator), then rendered per-item from
   * the surviving `.crumb-tpl` prototype into the trail.
   */
  public populate(source: CrumbInput[] | string): void {
    // Precompiled HTML fast-path: inject straight into the trail.
    if (isHtmlString(source)) {
      const trail = this.$('.breadcrumb-trail');
      if (trail) trail.innerHTML = source;
      return;
    }

    const crumbs = source
      .filter((c): c is CrumbInput => c != null && typeof c === 'object')
      .map((c) => ({ label: String(c.label ?? '').trim(), href: c.href ? String(c.href) : '#' }))
      .filter((c) => c.label);
    if (!crumbs.length) return;

    const items = crumbs.map((c, i) => {
      const current = i === crumbs.length - 1;
      return { label: c.label, href: c.href, link: !current, current, separator: !current };
    });

    // renderInto clones the `.crumb-tpl` prototype once per item and places the
    // results into the trail — the single data → HTML path.
    this.renderInto('.breadcrumb-trail', '.crumb-tpl', items);
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
