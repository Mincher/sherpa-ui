/**
 * @element sherpa-key-value-list
 * @category content
 * @description Semantic definition list (<dl>) for displaying label/value pairs — metadata
 *   panels, record details, configuration summaries. Author content as <dt>/<dd> pairs in
 *   the light DOM. Use the horizontal layout for side-by-side key/value pairs and vertical
 *   for stacked. The striped and bordered variants provide a table-like appearance without
 *   the complexity of a full data grid.
 *
 * @attr {enum}    data-layout    — horizontal | vertical (default: horizontal)
 * @attr {enum}    data-density   — compact | base | comfortable (default: base)
 * @attr {boolean} data-striped   — Alternate row backgrounds
 * @attr {boolean} data-bordered  — Show borders (default: true)
 * @attr {boolean} data-truncate  — Clip long values with ellipsis
 * @attr {string}  data-key-width — Key column width (default: auto)
 * @attr {enum}    data-type      — Template variant
 *
 * @method populate(source) — Render from a pairs array or precompiled HTML.
 *   Pair shape: { key, value, type?, status?, statusApply?, href?, html? }.
 *   Set html:true to treat `value` as trusted markup (links, tags). The single
 *   data → HTML entry point (see the Sherpa template binder).
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { isHtmlString } from '../utilities/sherpa-template/sherpa-template.js';
import '../sherpa-tag/sherpa-tag.js';

interface KvPair {
  key?: unknown;
  value?: unknown;
  type?: unknown;
  status?: unknown;
  statusApply?: unknown;
  html?: unknown;
}

export class SherpaKeyValueList extends SherpaElement {

  static override get cssUrl(): string  { return new URL('./sherpa-key-value-list.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-key-value-list.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "data-type"];
  }

  override get templateId(): string {
    return this.dataset["type"] || 'default';
  }

  override onRender(): void {
    const keyWidth = this.dataset["keyWidth"];
    if (keyWidth && keyWidth !== 'auto') {
      this.style.setProperty('--_key-width', keyWidth);
    }
  }

  /* ── Data → HTML population (via the template binder) ─────────── */

  /** Populate the <dl> from a pairs array or precompiled <dt>/<dd> HTML. */
  public populate(source: KvPair[] | string): void {
    if (isHtmlString(source)) {
      const dl = this.$('dl');
      if (dl) dl.innerHTML = source;
      return;
    }
    const items = source
      .filter((p): p is KvPair => p != null && typeof p === 'object')
      .map((p) => {
        const isHtml = !!p.html;
        return {
          key: String(p.key ?? ''),
          value: p.value == null ? '' : String(p.value),
          type: p.type ? String(p.type) : null,
          status: p.status ? String(p.status) : null,
          statusApply: p.status ? (p.statusApply ? String(p.statusApply) : 'text') : null,
          text: !isHtml,
          html: isHtml,
        };
      });
    this.renderInto('dl', '.pair-tpl', items);
  }
}

customElements.define('sherpa-key-value-list', SherpaKeyValueList);
