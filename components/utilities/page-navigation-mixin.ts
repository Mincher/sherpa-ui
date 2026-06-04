/**
 * PageNavigationMixin — Adds paged/wizard navigation to a SherpaElement subclass.
 *
 * Provides:
 *   • `page` getter — current page index (reads `data-page` dataset attr)
 *   • `pages` getter — total page count (explicit `data-pages` attr or counted `section[data-page]` children)
 *   • `setPage(index)` — clamp and navigate to a page
 *   • `nextPage()` / `prevPage()` — convenience wrappers
 *
 * Usage:
 *   import { PageNavigationMixin } from '../utilities/page-navigation-mixin.js';
 *
 *   class SherpaDialog extends PageNavigationMixin(StatusMixin(SherpaElement)) { ... }
 */

type Constructor<T = {}> = new (...args: any[]) => T;

export function PageNavigationMixin<T extends Constructor<HTMLElement>>(Base: T) {
  return class PageNavigationMixinClass extends Base {
    get page(): number {
      return parseInt(this.dataset['page'] || '0', 10) || 0;
    }

    get pages(): number {
      const explicit = parseInt(this.dataset['pages'] || '', 10);
      if (Number.isFinite(explicit) && explicit > 0) return explicit;
      return this.querySelectorAll('section[data-page]').length || 1;
    }

    setPage(index: number): void {
      const total = this.pages;
      const next = Math.max(0, Math.min(total - 1, Number(index) || 0));
      this.dataset['page'] = String(next);
    }

    nextPage(): void { this.setPage(this.page + 1); }
    prevPage(): void { this.setPage(this.page - 1); }
  };
}
