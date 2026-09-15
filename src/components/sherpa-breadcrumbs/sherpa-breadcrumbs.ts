/**
 * sherpa-breadcrumbs — the "you are here" trail of links.
 *
 * Give it a list with populate([{ label, href? }]) and it draws one crumb per
 * item. The separators between crumbs are drawn by CSS. The last crumb is the
 * current page, so it has no link. Clicking any crumb fires breadcrumb-select.
 *
 * @fires breadcrumb-select — detail: { index, label, href }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface Crumb {
  label: string;
  href?: string;
}

export class SherpaBreadcrumbs extends SherpaElement {
  static override css = new URL('./sherpa-breadcrumbs.css', import.meta.url);
  static override html = new URL('./sherpa-breadcrumbs.html', import.meta.url);

  #crumbs: Crumb[] = [];

  override onRender(): void {
    // One delegated listener for the whole trail — crumbs come and go, this stays.
    this.$('.crumbs')?.addEventListener('click', this.#onClick);
    if (this.#crumbs.length) this.#render();
  }

  /** populate([{ label, href? }]) — the crumb trail; the last becomes current. */
  protected override renderData(data: unknown): void {
    const list = Array.isArray(data) ? (data as Crumb[]) : [];
    this.#crumbs = list
      .filter((c): c is Crumb => c != null && typeof c === 'object')
      .map((c): Crumb => {
        const label = String(c.label ?? '').trim();
        return c.href ? { label, href: String(c.href) } : { label };
      })
      .filter((c) => c.label);
    this.#render();
  }

  #render(): void {
    this.renderList('.crumbs', 'template.crumb-tpl', this.#crumbs, (row, crumb, i) => {
      row.dataset['index'] = String(i);
      const link = row.querySelector<HTMLAnchorElement>('.link')!;
      link.textContent = crumb.label;

      const isCurrent = i === this.#crumbs.length - 1;
      if (isCurrent) {
        link.setAttribute('aria-current', 'page');
      } else if (crumb.href) {
        link.setAttribute('href', crumb.href);
      }
    });
  }

  #onClick = (event: Event): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.crumb');
    const raw = row?.dataset['index'];
    if (raw == null) return;
    const index = Number(raw);
    const crumb = this.#crumbs[index];
    if (!crumb) return;
    this.emit('breadcrumb-select', { index, label: crumb.label, href: crumb.href ?? '' });
  };
}

customElements.define('sherpa-breadcrumbs', SherpaBreadcrumbs);
