/**
 * sherpa-pagination — results-size + page navigation control.
 *
 * A "results" zone (a "Rows per page" label + a native <select>) sits beside a
 * "controls" zone: first / prev, a native number <input> for the current page,
 * "of N", then next / last. Both native controls work without JS; JS stamps the
 * options, clamps, reflects state, and emits. First/prev disable at page 1 and
 * next/last at the last page.
 *
 * @prop {number} page        — current page (read/write)
 * @prop {number} totalPages  — total page count (read/write)
 * @prop {number} pageSize    — rows per page (read/write)
 * @method goToPage(n) — navigate to a page (clamped), emitting page-change
 */
import { SherpaElement, clampNum } from '../../core/sherpa-element.js';
// The four page controls are composed sherpa-buttons, as Figma instances them.
import '../sherpa-button/sherpa-button.js';

export class SherpaPagination extends SherpaElement {
  static override css = new URL('./sherpa-pagination.css', import.meta.url);
  static override html = new URL('./sherpa-pagination.html', import.meta.url);
  static override observed = ['data-page', 'data-total-pages', 'data-page-size', 'data-rows-options'];

  override onRender(): void {
    // Delegated click for the four nav buttons.
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

  // TRAP T-pages-are-one-based-and-default-to-25 — 1 is the default AND the floor.
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
    // TRAP T-nan-is-the-not-given-sentinel — and min: 1, because a
    // `data-page-size="0"` used to read back as 0 and hand back a /0.
    const raw = this.num('data-page-size', NaN, { min: 1, int: true });
    if (Number.isFinite(raw)) return raw;
    // TRAP T-pages-are-one-based-and-default-to-25 — 25, not the first option.
    const preferred = SherpaPagination.DEFAULT_PAGE_SIZE;
    return opts.includes(preferred) ? preferred : (opts[0] ?? preferred);
  }
  set pageSize(value: number) {
    this.setAttribute('data-page-size', String(Math.max(1, Math.trunc(value) || 1)));
  }

  /**
   * Navigate to a page (clamped) and emit page-change if it changed.
   *
   * REPORTS, then writes only if nothing else will. A BOUND pager is
   * `data-locked`: the DataSource owns the page and broadcasts it back after
   * clamping against the real total, so writing here as well would make this
   * both reporter and owner of one value — and briefly show a page the query
   * has not reached.
   *
   * UNBOUND there is no other owner, and the pager must still work on its own.
   * TRAP T-bind-locks-what-it-owns.
   *
   * The SETTERS above are a different thing: `pager.page = 2` is a host
   * writing the value it owns, which is the state channel working as intended.
   */
  goToPage(n: number): void {
    const next = this.#clamp(n);
    if (next === this.page) {
      this.#render(); // snap the input back if the user typed an out-of-range value
      return;
    }
    if (!this.hasAttribute('data-locked')) this.setAttribute('data-page', String(next));
    this.emit('page-change', { page: next });
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  /**
   * A page number: whole, and within 1..totalPages.
   *
   * TRAP T-pages-are-one-based-and-default-to-25 — the NaN case is STATED, not
   * folded into a `|| 1`.
   */
  #clamp(n: number): number {
    if (!Number.isFinite(n)) return 1;
    return clampNum(Math.trunc(n), { min: 1, max: this.totalPages });
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

    // Boundary disabling. A composed <sherpa-button> takes `disabled` as an
    // ATTRIBUTE; a `.disabled` PROPERTY on the host is an expando nothing reads.
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
    // TRAP T-composed-path-not-target — the click starts inside the composed
    // button's OWN shadow root, so `closest` never reaches our `.btn` host.
    const btn = this.pathFind(event, '.btn');
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

  /**
   * The rows-per-page picker — the same shape as `goToPage`.
   *
   * Reports, and writes only when nothing else will: a bound pager is
   * `data-locked` and the source broadcasts the new size back after re-paging.
   * TRAP T-bind-locks-what-it-owns.
   */
  #onRowsChange = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    const size = parseInt(select.value, 10);
    if (Number.isNaN(size)) return;
    if (!this.hasAttribute('data-locked')) this.setAttribute('data-page-size', String(size));
    this.emit('page-size-change', { pageSize: size });
  };
}

customElements.define('sherpa-pagination', SherpaPagination);
