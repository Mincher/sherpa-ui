/**
 * sherpa-breadcrumbs — the "you are here" trail of links.
 *
 * Each crumb carries its separator; CSS hides the first. The last crumb is the current page, so no link.
 *
 * Map:
 * - Crumb — one step in the trail: a label, and an href to go back to it
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';

export interface Crumb {
  label: string;
  href?: string;
}

export class SherpaBreadcrumbs extends SherpaElement {
  static override css = new URL('./sherpa-breadcrumbs.css', import.meta.url);
  static override html = new URL('./sherpa-breadcrumbs.html', import.meta.url);

  /** The trail, as populated. */
  #crumbs: Crumb[] = [];

  override onRender(): void {
    // One delegated listener for the whole trail — crumbs come and go, this stays.
    this.$('.crumbs')?.addEventListener('click', this.#onClick);
    this.$('.crumbs')?.addEventListener('keydown', this.#onKey);
    if (this.#crumbs.length) this.#render();
  }

  /** Its `<a href>` children, as crumbs. */
  protected override childData(): Crumb[] | undefined {
    const links = [...this.querySelectorAll<HTMLAnchorElement>(':scope > a')];
    return links.length
      ? links.map((a) => ({ label: a.textContent?.trim() ?? '', ...(a.getAttribute('href') ? { href: a.getAttribute('href')! } : {}) }))
      : undefined;
  }

  /** populate([{ label, href? }]) — the crumb trail; the last becomes current. Or its `<a href>` children */
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

  // Label and index come from the prototype. "Is last" depends on the list's
  // length, and in an item prototype `data-icon` names a FIELD, so the fixed
  // separator glyph is written here. TRAP T-item-template-cannot-compute
  #render(): void {
    this.renderItems('.crumbs', 'template.crumb-tpl', this.#crumbs, {
      after: (row, crumb, i) => {
        this.writeIcon(row.querySelector('.separator')!, 'chevron-right');
        const link = row.querySelector<HTMLAnchorElement>('.link')!;
        if (i === this.#crumbs.length - 1) link.setAttribute('aria-current', 'page');
        else if (crumb.href) link.setAttribute('href', crumb.href);
        else {
          // No href, but still a step back: reachable, and Enter presses it. TODO 316
          link.setAttribute('role', 'link');
          link.setAttribute('tabindex', '0');
        }
      },
    });
  }

  /** Enter on a crumb with no href presses it, as on a real link. */
  #onKey = (event: KeyboardEvent): void => {
    const link = (event.target as HTMLElement).closest<HTMLElement>('.link[role="link"]');
    if (event.key !== 'Enter' || !link) return;
    event.preventDefault();
    link.click();
  };

  /** A crumb was clicked: report which. */
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

define('sherpa-breadcrumbs', SherpaBreadcrumbs);
