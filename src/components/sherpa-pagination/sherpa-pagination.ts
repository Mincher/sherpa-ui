/**
 * sherpa-pagination — page navigation.
 *
 * data-total-pages and data-current-page drive a prev button, a windowed run of
 * numbered page buttons (first, last, and a ±1 window around the current page,
 * with ellipsis gaps bridging the jumps), and a next button. Numbers and gaps are
 * stamped from cloning prototypes (the only structural DOM this creates —
 * data-driven rows, which the golden rules allow). The current page is marked
 * data-current (CSS styles it as the accent, non-interactive); prev/next carry the
 * native `disabled` attribute at the boundaries. Clicking a page sets
 * data-current-page and emits page-change.
 *
 * @element sherpa-pagination
 * @attr {number} data-total-pages  — total page count (default 1)
 * @attr {number} data-current-page — active 1-based page (default 1)
 *
 * @fires page-change — bubbles + composed. detail: { page }
 *
 * @prop {number} page       — current page (read/write)
 * @prop {number} totalPages — total page count (read/write)
 * @method goToPage(n) — navigate to a page (clamped), emitting page-change
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaPagination extends SherpaElement {
  static override css = new URL('./sherpa-pagination.css', import.meta.url);
  static override html = new URL('./sherpa-pagination.html', import.meta.url);
  static override observed = ['data-total-pages', 'data-current-page'];

  override onRender(): void {
    // One delegated listener for the whole pager — buttons come and go, this stays.
    this.$('.pager')?.addEventListener('click', this.#onClick);
    this.#render();
  }

  override onChange(): void {
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
    const raw = parseInt(this.dataset['currentPage'] ?? '', 10) || 1;
    return Math.min(this.totalPages, Math.max(1, raw));
  }
  set page(value: number) {
    this.setAttribute('data-current-page', String(this.#clamp(value)));
  }

  /** Navigate to a page (clamped) and emit page-change if it changed. */
  goToPage(n: number): void {
    const next = this.#clamp(n);
    if (next === this.page) return;
    this.setAttribute('data-current-page', String(next));
    this.emit('page-change', { page: next });
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  #clamp(n: number): number {
    return Math.min(this.totalPages, Math.max(1, Math.trunc(n) || 1));
  }

  /** Build a windowed page list: 1 … p-1 [p] p+1 … N, gaps marked as null. */
  #window(page: number, total: number): (number | null)[] {
    const wanted = new Set<number>([1, total, page - 1, page, page + 1]);
    const sorted = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    const out: (number | null)[] = [];
    let prev = 0;
    for (const n of sorted) {
      if (prev) {
        // A gap of exactly one missing page: show that page rather than an
        // ellipsis (an ellipsis hiding a single number wastes space + misleads).
        if (n - prev === 2) out.push(prev + 1);
        else if (n - prev > 1) out.push(null);
      }
      out.push(n);
      prev = n;
    }
    return out;
  }

  #render(): void {
    const numbers = this.$('.numbers');
    const numTpl = this.$<HTMLTemplateElement>('template.num-tpl');
    const gapTpl = this.$<HTMLTemplateElement>('template.gap-tpl');
    if (!numbers || !numTpl || !gapTpl) return;

    const page = this.page;
    const total = this.totalPages;

    numbers.replaceChildren();
    for (const n of this.#window(page, total)) {
      if (n === null) {
        numbers.appendChild(gapTpl.content.firstElementChild!.cloneNode(true));
        continue;
      }
      const btn = numTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      btn.dataset['page'] = String(n);
      btn.textContent = String(n);
      btn.setAttribute('aria-label', `Page ${n}`);
      if (n === page) {
        btn.toggleAttribute('data-current', true);
        btn.setAttribute('aria-current', 'page');
      }
      numbers.appendChild(btn);
    }

    // Boundary disabling on prev/next (native disabled → inactive tokens).
    this.$<HTMLButtonElement>('.prev')!.disabled = page <= 1;
    this.$<HTMLButtonElement>('.next')!.disabled = page >= total;
  }

  #onClick = (event: Event): void => {
    // The pager's buttons live in our OWN shadow tree, so event.target is not
    // retargeted — closest() finds the button (or its inner glyph's button).
    // This is the safe case; a child *custom element* emitting a composed event
    // would need composedPath() instead.
    const btn = (event.target as HTMLElement).closest<HTMLElement & { disabled?: boolean }>('.btn');
    if (!btn || btn.disabled) return;

    const action = btn.dataset['action'];
    if (action === 'prev') this.goToPage(this.page - 1);
    else if (action === 'next') this.goToPage(this.page + 1);
    else if (action === 'page') {
      const n = parseInt(btn.dataset['page'] ?? '', 10);
      if (!Number.isNaN(n)) this.goToPage(n);
    }
  };
}

customElements.define('sherpa-pagination', SherpaPagination);
