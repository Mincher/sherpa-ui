/**
 * sherpa-pagination — results-size + page navigation control.
 *
 * A "results" zone (a "Rows per page" label + a native <select> for the page
 * size) sits beside a "controls" zone: first (««) + prev (‹) buttons, a native
 * number <input> for the current page, "of N" total text, and next (›) + last
 * (»») buttons. Both native controls work without JS; JS only stamps the select
 * options, clamps values, reflects state, and emits events. First/prev disable
 * at page 1 and next/last at the last page (native `disabled` → inactive tokens).
 *
 * @element sherpa-pagination
 * @attr {number} data-page          — current 1-based page (default 1)
 * @attr {number} data-total-pages   — total page count (default 1)
 * @attr {number} data-page-size     — active rows-per-page value (default 25)
 * @attr {string} data-rows-options  — comma list of rows choices, e.g. "10,25,50"
 *
 * @fires page-change      — bubbles + composed. detail: { page }
 * @fires page-size-change — bubbles + composed. detail: { pageSize }
 *
 * @prop {number} page        — current page (read/write)
 * @prop {number} totalPages  — total page count (read/write)
 * @prop {number} pageSize    — rows per page (read/write)
 * @method goToPage(n) — navigate to a page (clamped), emitting page-change
 */
import { SherpaElement } from '../../core/sherpa-element.js';
// The four page controls are composed sherpa-buttons, as Figma instances them.
import '../sherpa-button/sherpa-button.js';

export class SherpaPagination extends SherpaElement {
  static override css = new URL('./sherpa-pagination.css', import.meta.url);
  static override html = new URL('./sherpa-pagination.html', import.meta.url);
  static override observed = ['data-page', 'data-total-pages', 'data-page-size', 'data-rows-options'];

  override onRender(): void {
    // Delegated click for the four nav buttons — they live in our own shadow tree.
    this.$('.controls')?.addEventListener('click', this.#onClick);
    this.$('.rows')?.addEventListener('change', this.#onRowsChange);
    this.$('.page-input')?.addEventListener('change', this.#onPageInput);
    this.#renderOptions();
    this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-rows-options') this.#renderOptions();
    this.#render();
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  // Pages are 1-BASED, so 1 is both the default and the floor: 0 and a negative
  // are not "a page" at all, and clamping them up is the only sane reading.
  get totalPages(): number {
    return this.num('data-total-pages', 1, { min: 1, int: true });
  }
  set totalPages(value: number) {
    this.setAttribute('data-total-pages', String(Math.max(1, Math.trunc(value) || 1)));
  }

  get page(): number {
    return this.num('data-page', 1, { min: 1, max: this.totalPages, int: true });
  }
  set page(value: number) {
    this.setAttribute('data-page', String(this.#clamp(value)));
  }

  /** The default rows-per-page when a host does not name one. */
  static readonly DEFAULT_PAGE_SIZE = 25;

  get pageSize(): number {
    const opts = this.#rowsOptions();
    // NaN is the "not given" sentinel — an absent size is chosen from the options
    // below, so there is no static default to hand num(). min: 1 because a page
    // of 0 rows is not a page: `data-page-size="0"` used to read back as 0 and
    // hand the caller a divide-by-zero.
    const raw = this.num('data-page-size', NaN, { min: 1, int: true });
    if (Number.isFinite(raw)) return raw;
    // 25 by default, not the first option. 10 rows is a thin slice of a real
    // table — it fills less than half a panel and makes paging the main way to
    // read the data. A host can still name any size with data-page-size, and a
    // set that does not offer 25 falls back to its own first option.
    const preferred = SherpaPagination.DEFAULT_PAGE_SIZE;
    return opts.includes(preferred) ? preferred : (opts[0] ?? preferred);
  }
  set pageSize(value: number) {
    this.setAttribute('data-page-size', String(Math.max(1, Math.trunc(value) || 1)));
  }

  /** Navigate to a page (clamped) and emit page-change if it changed. */
  goToPage(n: number): void {
    const next = this.#clamp(n);
    if (next === this.page) {
      this.#render(); // snap the input back if the user typed an out-of-range value
      return;
    }
    this.setAttribute('data-page', String(next));
    this.emit('page-change', { page: next });
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  #clamp(n: number): number {
    return Math.min(this.totalPages, Math.max(1, Math.trunc(n) || 1));
  }

  /** Parse data-rows-options into a numeric list; default to a sensible set. */
  #rowsOptions(): number[] {
    const raw = this.dataset['rowsOptions'] ?? '';
    const parsed = raw
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    return parsed.length ? parsed : [10, 25, 50];
  }

  /** Stamp the rows-per-page <option>s from a cloning prototype. */
  #renderOptions(): void {
    this.renderList('.rows', 'template.rows-opt-tpl', this.#rowsOptions(), (node, n) => {
      const opt = node as HTMLOptionElement;
      opt.value = String(n);
      opt.textContent = String(n);
    });
  }

  #render(): void {
    const total = this.totalPages;
    const page = this.page;

    // Reflect the current page into the native input + its clamp range.
    const input = this.$<HTMLInputElement>('.page-input');
    if (input) {
      input.max = String(total);
      input.value = String(page);
    }

    // Reflect the total text.
    const totalEl = this.$('.total');
    if (totalEl) totalEl.textContent = `of ${total}`;

    // Reflect the active page size onto the select.
    const select = this.$<HTMLSelectElement>('.rows');
    if (select) select.value = String(this.pageSize);

    // Boundary disabling. The controls are composed <sherpa-button>s, which take
    // `disabled` as an ATTRIBUTE and mirror it onto their own inner <button> —
    // a `.disabled` PROPERTY on the host is not the native one and would set an
    // expando that nothing reads.
    for (const [sel, off] of [
      ['.first', page <= 1],
      ['.prev', page <= 1],
      ['.next', page >= total],
      ['.last', page >= total],
    ] as const) {
      this.$(sel)?.toggleAttribute('disabled', off);
    }
  }

  #onClick = (event: Event): void => {
    // composedPath, not closest: the click starts inside the sherpa-button's OWN
    // shadow root, so `event.target` is its inner <button> and `closest` from
    // there never reaches this component's `.btn` host.
    const btn = event
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('btn'));
    if (!btn || btn.hasAttribute('disabled')) return;

    switch (btn.dataset['action']) {
      case 'first':
        this.goToPage(1);
        break;
      case 'prev':
        this.goToPage(this.page - 1);
        break;
      case 'next':
        this.goToPage(this.page + 1);
        break;
      case 'last':
        this.goToPage(this.totalPages);
        break;
    }
  };

  #onPageInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.goToPage(parseInt(input.value, 10));
  };

  #onRowsChange = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    const size = parseInt(select.value, 10);
    if (Number.isNaN(size)) return;
    this.setAttribute('data-page-size', String(size));
    this.emit('page-size-change', { pageSize: size });
  };
}

customElements.define('sherpa-pagination', SherpaPagination);
