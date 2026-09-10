/**
 * sherpa-quick-filter-toolbar — a row of filter chips above a grid or list.
 *
 * Give it chips with populate([{ id, label, type?, active?, count? }]). When you
 * click a chip it toggles on or off, and the toolbar fires quick-filter-change
 * with the ids of every chip that's currently on. There's a slot for your own
 * extra buttons — the old add/edit/save-view features are left out on purpose.
 *
 * FIGMA DIVERGENCE (intentional): Figma "Filter Toolbar" (node 150:3688) is a
 * fuller toolbar — it bakes in a leading view chip / Switch, divider-separated
 * preset chips, and a trailing action cluster (Add, AI filter, undo, refresh,
 * favourite/star, Save-view split menu, overflow ⋮), plus view-scope events
 * (view-menu-open / view-change / view-save / view-favorite / data-refresh /
 * ai-filter-request). This component is a deliberately SIMPLER 3-zone slot bar:
 * the action cluster and save-view controls are DELEGATED to slotted content
 * (the `actions` and `view` slots), not built in, and those extra events are
 * the host's responsibility, not fired here. Do not expand to match Figma
 * without a deliberate decision. Recorded in the component's .thin.yaml
 * `_divergence` block; the .component.yaml is generated so the prose lives here.
 * @fires quick-filter-change — the active filter set changes. bubbles + composed. detail: { active: string[] }
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import '../sherpa-quick-filter/sherpa-quick-filter.js';
// Chips with `options` stamp a <sherpa-menu>, so it must be defined.
import '../sherpa-menu/sherpa-menu.js';

/** One value a filter chip's menu can offer. */
export interface QuickFilterOption {
  value: string;
  label: string;
  selected?: boolean;
}

export interface QuickFilterDef {
  id: string;
  label: string;
  type?: string;
  active?: boolean;
  count?: number;
  /** A leading Font Awesome icon class list. */
  icon?: string;
  /**
   * Values this chip filters by. Given options, the chip gets a caret and a
   * <sherpa-menu> of rows: checkboxes when `select` is 'multiple' (the default),
   * radios when it is 'single'.
   */
  options?: QuickFilterOption[];
  select?: 'single' | 'multiple';
}

interface ChipEl extends HTMLElement {
  current: boolean;
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
    return this.#chips().filter((c) => c.current).map((c) => c.dataset['id'] ?? '');
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
      if (f.active) chip.setAttribute('data-current', '');
      if (f.count != null) chip.setAttribute('data-count', String(f.count));
      if (f.icon) chip.setAttribute('data-icon-start', f.icon);
      if (f.options?.length) this.#addMenu(chip, f);
      list.appendChild(chip);
    }
  }

  /**
   * Give a chip its value menu: a <sherpa-menu> of real checkbox/radio rows in the
   * chip's light DOM. Cloned from the menu prototypes in the template, so no
   * structural innerHTML is written.
   */
  #addMenu(chip: HTMLElement, def: QuickFilterDef): void {
    const menuTpl = this.$<HTMLTemplateElement>('template.qf-menu-tpl');
    const rowTpl = this.$<HTMLTemplateElement>('template.qf-row-tpl');
    if (!menuTpl || !rowTpl) return;

    const single = def.select === 'single';
    const menu = menuTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
    menu.setAttribute('data-heading', def.label);
    menu.setAttribute('data-select', single ? 'single' : 'multiple');

    for (const option of def.options ?? []) {
      const row = rowTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const input = row.querySelector('input')!;
      input.type = single ? 'radio' : 'checkbox';
      input.value = option.value;
      if (single) input.name = `qf-${def.id}`;
      input.checked = !!option.selected;
      row.querySelector('.qf-row-label')!.textContent = option.label;
      menu.appendChild(row);
    }

    chip.setAttribute('data-menu', '');
    chip.appendChild(menu);
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
