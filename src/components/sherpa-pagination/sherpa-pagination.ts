/**
 * sherpa-pagination — rows-per-page <select> plus first/prev/input/next/last.
 *
 * @prop {number} page        — current page (read/write)
 * @prop {number} totalPages  — total page count (read/write)
 * @prop {number} pageSize    — rows per page (read/write)
 * @method goToPage(n) — navigate to a page (clamped), emitting page-change
 */
import { DATA_PROPS, SherpaElement, clampNum } from '../../core/ui/sherpa-element.js';
import type { DataAsk } from '../../core/ui/context.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-group/sherpa-group.js';

export class SherpaPagination extends SherpaElement {
  static override css = new URL('./sherpa-pagination.css', import.meta.url);
  static override html = new URL('./sherpa-pagination.html', import.meta.url);
  static override props = {
    /* The HOST owns the page; report the intent, never write it. */
    'data-locked': DATA_PROPS['data-locked'],
  } as const;

  static override observed = ['data-page', 'data-total-pages', 'data-page-size', 'data-rows-options'];

  /* No rows — the view state only, as attributes. TRAP T-a-component-asks-its-provider */
  static override asks: DataAsk = { shape: 'state' };

  override onRender(): void {
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
    // TRAP T-nan-is-the-not-given-sentinel — min: 1 too, or `data-page-size="0"`
    // reads back as 0 and divides by zero.
    const raw = this.num('data-page-size', NaN, { min: 1, int: true });
    if (Number.isFinite(raw)) return raw;
    // 25, not the first option.
    const preferred = SherpaPagination.DEFAULT_PAGE_SIZE;
    return opts.includes(preferred) ? preferred : (opts[0] ?? preferred);
  }
  set pageSize(value: number) {
    this.setAttribute('data-page-size', String(Math.max(1, Math.trunc(value) || 1)));
  }

  /**
   * Navigate to a page (clamped) and emit page-change if it changed.
   *
   * Writes only when unlocked — TRAP T-bind-locks-what-it-owns.
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

  /** A page number: whole, within 1..totalPages; NaN means page 1. */
  #clamp(n: number): number {
    if (!Number.isFinite(n)) return 1;
    return clampNum(Math.trunc(n), { min: 1, max: this.totalPages });
  }

  /** Parse data-rows-options into a numeric list. */
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

  /** Draw the page field, the count and which buttons are live. */
  #render(): void {
    const total = this.totalPages;
    const page = this.page;

    const input = this.$<HTMLInputElement>('.page-input');
    if (input) {
      input.max = String(total);
      input.value = String(page);
    }

    const totalEl = this.$('.total');
    if (totalEl) totalEl.textContent = `of ${total}`;

    const select = this.$<HTMLSelectElement>('.rows');
    if (select) select.value = String(this.pageSize);

    // A composed <sherpa-button> takes `disabled` as an ATTRIBUTE; the property
    // is an expando nothing reads.
    for (const [sel, off] of [
      ['.first', page <= 1],
      ['.prev', page <= 1],
      ['.next', page >= total],
      ['.last', page >= total],
    ] as const) {
      this.$(sel)?.toggleAttribute('disabled', off);
    }
  }

  /** First, back, next or last. */
  #onClick = (event: Event): void => {
    // TRAP T-composed-path-not-target — the click starts in the button's own
    // shadow root, so `closest` never reaches our `.btn` host.
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

  /** A page typed into the field. */
  #onPageInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.goToPage(parseInt(input.value, 10));
  };

  /** The rows-per-page picker — writes only when unlocked. */
  #onRowsChange = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    const size = parseInt(select.value, 10);
    if (Number.isNaN(size)) return;
    if (!this.hasAttribute('data-locked')) this.setAttribute('data-page-size', String(size));
    this.emit('page-size-change', { pageSize: size });
  };
}

customElements.define('sherpa-pagination', SherpaPagination);
