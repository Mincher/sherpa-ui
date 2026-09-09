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
 * @attr {number} data-page-size     — active rows-per-page value (default first option)
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

  get totalPages(): number {
    return Math.max(1, parseInt(this.dataset['totalPages'] ?? '', 10) || 1);
  }
  set totalPages(value: number) {
    this.setAttribute('data-total-pages', String(Math.max(1, Math.trunc(value) || 1)));
  }

  get page(): number {
    const raw = parseInt(this.dataset['page'] ?? '', 10) || 1;
    return Math.min(this.totalPages, Math.max(1, raw));
  }
  set page(value: number) {
    this.setAttribute('data-page', String(this.#clamp(value)));
  }

  get pageSize(): number {
    const opts = this.#rowsOptions();
    const raw = parseInt(this.dataset['pageSize'] ?? '', 10);
    if (!Number.isNaN(raw)) return raw;
    return opts[0] ?? 10;
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
    const select = this.$<HTMLSelectElement>('.rows');
    const optTpl = this.$<HTMLTemplateElement>('template.rows-opt-tpl');
    if (!select || !optTpl) return;

    select.replaceChildren();
    for (const n of this.#rowsOptions()) {
      const opt = optTpl.content.firstElementChild!.cloneNode(true) as HTMLOptionElement;
      opt.value = String(n);
      opt.textContent = String(n);
      select.appendChild(opt);
    }
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

    // Boundary disabling (native disabled → inactive tokens; CSS owns the look).
    this.$<HTMLButtonElement>('.first')!.disabled = page <= 1;
    this.$<HTMLButtonElement>('.prev')!.disabled = page <= 1;
    this.$<HTMLButtonElement>('.next')!.disabled = page >= total;
    this.$<HTMLButtonElement>('.last')!.disabled = page >= total;
  }

  #onClick = (event: Event): void => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('.btn');
    if (!btn || btn.disabled) return;

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
