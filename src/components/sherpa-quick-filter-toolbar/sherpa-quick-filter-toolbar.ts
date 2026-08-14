/**
 * sherpa-quick-filter-toolbar — a strip of quick-filter chips above a grid/list.
 *
 * populate([{ id, label, type?, active?, count? }]) stamps sherpa-quick-filter
 * chips. A delegated listener catches each chip's composed quick-filter-click
 * (via composedPath — the event retargets to this host at the shadow boundary),
 * updates the active set, and emits quick-filter-change with all active ids. The
 * heavy add/edit/save-view machinery of the old toolbar is dropped; consumers wire
 * their own controls into the actions slot.
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import '../sherpa-quick-filter/sherpa-quick-filter.js';

export interface QuickFilterDef {
  id: string;
  label: string;
  type?: string;
  active?: boolean;
  count?: number;
}

interface ChipEl extends HTMLElement {
  active: boolean;
}

export class SherpaQuickFilterToolbar extends SherpaElement {
  static override css = new URL('./sherpa-quick-filter-toolbar.css', import.meta.url);
  static override html = new URL('./sherpa-quick-filter-toolbar.html', import.meta.url);

  #filters: QuickFilterDef[] = [];

  override onRender(): void {
    this.addEventListener('quick-filter-click', this.#onChipClick);
    if (this.#filters.length) this.#render();
  }

  /** populate([{ id, label, type?, active?, count? }]) — the filter chips. */
  protected override renderData(data: unknown): void {
    this.#filters = Array.isArray(data) ? (data as QuickFilterDef[]) : [];
    this.#render();
  }

  /** The ids of the currently-active chips, in order. */
  get active(): string[] {
    return this.#chips().filter((c) => c.active).map((c) => c.dataset['id'] ?? '');
  }

  #chips(): ChipEl[] {
    return this.$$<ChipEl>('.chips > .chip');
  }

  #render(): void {
    const list = this.$('.chips');
    const tpl = this.$<HTMLTemplateElement>('template.qf-tpl');
    if (!list || !tpl) return;

    list.replaceChildren();
    for (const f of this.#filters) {
      const chip = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      chip.dataset['id'] = f.id;
      chip.setAttribute('data-label', f.label);
      if (f.type) chip.setAttribute('data-type', f.type);
      if (f.active) chip.setAttribute('data-active', '');
      if (f.count != null) chip.setAttribute('data-count', String(f.count));
      list.appendChild(chip);
    }
  }

  #onChipClick = (event: Event): void => {
    // quick-filter-click is composed → find the originating chip on the path.
    const chip = event
      .composedPath()
      .find((n): n is ChipEl => n instanceof HTMLElement && n.classList.contains('chip'));
    if (!chip) return;
    this.emit('quick-filter-change', { active: this.active });
  };
}

customElements.define('sherpa-quick-filter-toolbar', SherpaQuickFilterToolbar);
