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
 * @data {array} [{ label, href? }] — Crumbs; the last becomes the current page. Also accepts a
 *   precompiled HTML string.
 * @method populate(source) — Render from a crumb array [{label, href?}] OR a
 *   precompiled HTML string. The single data → HTML entry point (see the
 *   Sherpa template binder). The last crumb becomes the current page.
 *
 * @slot brand-icon — Optional leading brand icon (Figma Classic / Apex 2.0). Hidden when empty.
 *
 * @fires breadcrumb-click
 *   bubbles: true, composed: true
 *   detail: { index: number, href: string, label: string, current: boolean }
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

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

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null): void {
    if (name === 'data-items' && newValue !== oldValue) {
      this.#applyDataItems();
    }
  }

  // data-src-json → populate() is handled by the base class (onJsonData default).

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

  /* ── Data → HTML population (via the unified populate() dispatcher) ───────
   * Populate the trail with `el.populate([{label, href?}])` or
   * `el.populate('<ol>…</ol>')`. The base-class dispatcher sniffs the kind and
   * routes arrays here (renderData) and HTML strings to renderTemplateSource.
   */

  /**
   * Render the crumb array. Each crumb object is expanded into the render-flags
   * the template's data-bind-if branches consume (link / current / separator),
   * then rendered per-item from the `.crumb-tpl` prototype into the trail.
   */
  protected override renderData(source: unknown): void {
    const list = Array.isArray(source) ? source : [];
    const crumbs = list
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

  /** Precompiled HTML fast-path: inject straight into the trail. */
  protected override renderTemplateSource(html: string): void {
    const trail = this.$('.breadcrumb-trail');
    if (trail) trail.innerHTML = html;
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
