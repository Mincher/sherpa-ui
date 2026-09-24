/**
 * sherpa-filter-panel — the filter toolbars, as a column.
 *
 * A SIBLING of sherpa-quick-filter-toolbar over the same DataSource: it takes
 * the same filter definitions and emits the same `quick-filter-change`.
 * TRAP T-the-panel-is-the-toolbar-in-a-column
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
// TRAP T-menu-composes-real-components — the page may not have imported these.
import '../sherpa-panel/sherpa-panel.js';
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-container-footer/sherpa-container-footer.js';
import '../sherpa-accordion/sherpa-accordion.js';
import '../sherpa-section-header/sherpa-section-header.js';
import '../sherpa-stack/sherpa-stack.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-input-text/sherpa-input-text.js';
import '../sherpa-quick-filter/sherpa-quick-filter.js';

/** One value a field offers. */
export interface PanelValue {
  value: string;
  label?: string;
  selected?: boolean;
}

/** One field the panel draws. The shape a quick-filter toolbar takes. */
export interface PanelFilter {
  id: string;
  label: string;
  options?: PanelValue[];
  select?: 'single' | 'multiple';
  /** Offer Remove in this field's header. */
  removable?: boolean;
  /** Offer the CONDITION switch. TRAP T-conditions-are-opt-in-per-field */
  conditions?: boolean;
  /** A chip with no field behind it — one question, answered yes or no.
   *  TRAP T-a-chip-with-no-field-is-a-preset */
  preset?: boolean;
  /** ON, with nothing picked — a preset's whole state. */
  active?: boolean;
  /**
   * The field's OWN `<sherpa-menu>`, for a field the panel cannot draw as a
   * run of chips — a condition, a number, a range.
   *
   * The panel draws it INLINE and gives it back untouched, so the condition
   * rows, the number input and the range switch are the same controls a chip
   * menu shows rather than a second copy of each.
   * TRAP T-an-inline-menu-is-the-same-menu
   */
  menu?: HTMLElement;
}

/** A column Group or Sort may arrange by. */
export interface PanelColumn {
  field: string;
  label: string;
}

/** One scope: a named group of fields, plus what its Add button offers. */
export interface PanelScope {
  scope: string;
  /** The CONTENT's own name. TRAP T-a-scope-is-named-for-its-content */
  label: string;
  filters?: PanelFilter[];
  /** Fields this scope may still add. */
  available?: PanelFilter[];
  /**
   * How this component ARRANGES its rows — not which rows it shows.
   *
   * They lead the scope, above the presets, and only a component scope has
   * them: "sorted by name" is a property of a table, not of a population.
   * TRAP T-organise-chips-lead-the-bar
   * TRAP T-group-and-sort-are-component-scope
   */
  group?: PanelColumn[];
  sort?: PanelColumn[];
  /** Which column each is on now, and which way the sort runs. */
  groupField?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

/** What one drawn field holds. */
interface Held {
  def: PanelFilter;
  scope: string;
  box: HTMLElement;
  values: HTMLElement;
  /** A borrowed menu, and where it came from, so it can go home. */
  menu?: HTMLElement;
  menuHome?: { parent: Node; slot: string | null };
}

export class SherpaFilterPanel extends SherpaElement {
  static override css = new URL('./sherpa-filter-panel.css', import.meta.url);
  static override html = new URL('./sherpa-filter-panel.html', import.meta.url);

  static override props = {
    /* NOT `kind: content`. The header is a COMPOSED component with its own
       children — a slotted search among them — and writing text into it
       replaces every one. `#syncHeading` passes the attribute along instead.
       TRAP T-a-composed-child-takes-an-attribute-not-text */
    'data-heading': { type: 'string', kind: 'style' },
    'data-open': { type: 'boolean', kind: 'style' },
    'data-locked': { type: 'boolean', kind: 'style' },
    'data-min-width': { type: 'string', kind: 'style' },
  } as const;

  static override observed = ['data-heading', 'data-open'];

  /** Every drawn field, by `${scope}:${id}`. */
  #held = new Map<string, Held>();
  /** What Apply last committed, so Discard can restore it. */
  #baseline = new Map<string, string[]>();
  /** The scopes as last given. */
  #scopes: PanelScope[] = [];

  override onRender(): void {
    this.$('.head')?.addEventListener('header-dismiss', this.#onClose);
    this.$('.search')?.addEventListener('input', this.#onSearch);
    this.$('.apply')?.addEventListener('button-click', this.#onApply);
    this.$('.discard')?.addEventListener('button-click', this.#onDiscard);
    // ONE listener for every drawn control — a field added later needs no wiring.
    this.$('.scopes')?.addEventListener('button-click', this.#onAction);
    this.$('.scopes')?.addEventListener('quick-filter-click', this.#onValueClick);
    this.$('.scopes')?.addEventListener('menu-change', this.#onAddCommit);
    this.#syncHeading();
    if (this.#scopes.length) this.#draw();
  }

  override onChange(name: string): void {
    if (name === 'data-heading') this.#syncHeading();
    else if (name === 'data-open') this.#enforceWidth();
  }

  override onConnect(): void {
    this.#media()?.addEventListener('change', this.#enforceWidth);
    this.#enforceWidth();
  }

  /* ── The public API ───────────────────────────────────────────────── */

  /** populate([{ scope, label, filters, available }]). */
  protected override renderData(data: unknown): void {
    this.#scopes = Array.isArray(data) ? (data as PanelScope[]) : [];
    this.#draw();
  }

  /** What every field holds now, by scope then field id. */
  get values(): Record<string, Record<string, string[]>> {
    const out: Record<string, Record<string, string[]>> = {};
    for (const [, held] of this.#held) {
      // GROUP and SORT arrange rows; they are not part of WHICH rows.
      if (held.def.id === 'group' || held.def.id === 'sort') continue;
      (out[held.scope] ??= {})[held.def.id] = this.#picked(held);
    }
    return out;
  }

  /** Show the panel, unless the window is too narrow.
   *  TRAP T-the-panel-is-desktop-only */
  open(): void {
    if (!this.#wideEnough()) return;
    this.toggleAttribute('data-open', true);
  }

  close(): void {
    this.removeAttribute('data-open');
  }

  override onDisconnect(): void {
    this.#media()?.removeEventListener('change', this.#enforceWidth);
    this.#giveBack();
  }

  toggle(): void {
    if (this.hasAttribute('data-open')) this.close();
    else this.open();
  }

  /* ── Drawing ──────────────────────────────────────────────────────── */

  #syncHeading(): void {
    this.$('.head')?.setAttribute('data-heading', this.dataset['heading'] ?? 'Filters');
  }

  /** Redraw every scope from `#scopes`. */
  #draw(): void {
    const region = this.$('.scopes');
    if (!region) return;
    // Every borrowed menu goes home BEFORE the boxes holding them are dropped.
    this.#giveBack();
    this.#held.clear();
    region.replaceChildren();

    /* ONE FIELD, ONE SCOPE. A field in two scopes would draw twice, and a
       reader cannot tell which of the two is in force. The FIRST scope wins:
       a view filter sets the population the ones below narrow within.
       TRAP T-a-panel-adds-through-the-bar-that-owns-the-list */
    const taken = new Set<string>();

    for (const scope of this.#scopes) {
      const box = this.clone('template.scope-tpl');
      if (!box) continue;
      box.setAttribute('data-heading', scope.label);
      box.setAttribute('data-scope', scope.scope);

      const mine = (scope.filters ?? []).filter((f) => {
        if (taken.has(f.id)) return false;
        taken.add(f.id);
        return true;
      });

      // PRESETS lead: one tap each, and the fields below them are the work.
      const presets = mine.filter((f) => f.preset);
      const fields = mine.filter((f) => !f.preset);

      /* GROUP and SORT lead everything — they are HOW the rows are arranged,
         and a reader reaches for them before narrowing.
         TRAP T-organise-chips-lead-the-bar */
      for (const [kind, cols] of [['group', scope.group], ['sort', scope.sort]] as const) {
        if (!cols?.length) continue;
        const on = kind === 'group' ? scope.groupField : scope.sortField;
        const drawn = this.#drawField({
          id: kind, label: kind === 'group' ? 'Group by' : 'Sort by',
          select: 'single',
          options: cols.map((c) => ({
            value: c.field, label: c.label, selected: c.field === on,
          })),
        }, scope.scope, true);
        if (drawn) box.append(drawn);
      }

      if (presets.length) {
        box.append(this.#drawField({
          id: 'presets', label: 'Presets', options: presets.map((p) => ({
            value: p.id, label: p.label, selected: !!p.active,
          })),
          select: 'multiple',
        }, scope.scope, true)!);
      }
      for (const def of fields) {
        const drawn = this.#drawField(def, scope.scope, false);
        if (drawn) box.append(drawn);
      }

      const add = box.querySelector('.scope-add');
      const offers = scope.available ?? [];
      box.toggleAttribute('data-can-add', offers.length > 0);
      if (offers.length && add) this.#fillAdd(add as HTMLElement, offers);

      /* An empty scope SAYS SO. Absent, it reads as a bug rather than as an
         answer — and a scope can legitimately be empty. */
      if (!presets.length && !fields.length) {
        const empty = this.clone('template.empty-tpl');
        if (empty) box.append(empty);
      }

      region.append(box);
    }
    this.#snapshot();
  }

  /** One field: its header, its actions, and its run of value chips. */
  #drawField(def: PanelFilter, scope: string, isPresets: boolean): HTMLElement | null {
    const options = def.options ?? [];
    /* A field with NO VALUES and NO MENU has nothing to draw at all.
       TRAP T-the-panel-is-the-toolbar-in-a-column */
    if (!options.length && !def.menu) return null;

    const box = this.clone('template.field-tpl');
    if (!box) return null;
    const key = `${scope}:${def.id}`;
    box.setAttribute('data-field', def.id);
    box.setAttribute('data-scope', scope);
    // A PRESETS section has no field to clear or remove.
    box.toggleAttribute('data-clearable', !isPresets);
    box.toggleAttribute('data-removable', !isPresets && !!def.removable);
    box.toggleAttribute('data-conditional-ok', !isPresets && !!def.conditions);

    const head = box.querySelector('.field-head');
    head?.setAttribute('data-heading', def.label);
    const name = def.label;
    head?.querySelector('.field-clear')?.setAttribute('aria-label', `Clear ${name}`);
    head?.querySelector('.field-remove')?.setAttribute('aria-label', `Remove ${name}`);
    head?.querySelector('.field-conditional')
      ?.setAttribute('aria-label', `Use a condition for ${name}`);

    const values = box.querySelector('.field-values') as HTMLElement | null;
    const proto = this.$<HTMLTemplateElement>('template.value-tpl');
    if (values && proto?.content.firstElementChild) {
      for (const option of options) {
        const one = proto.content.firstElementChild.cloneNode(true) as HTMLElement;
        one.dataset['value'] = option.value;
        const text = option.label ?? option.value;
        one.setAttribute('data-label', text);
        /* The SEARCH reads this, not `data-label`: a chip rewrites its own
           label to "Field: Value" the moment one value is picked, so a picked
           chip stopped matching its own name.
           TRAP T-a-chip-rewrites-its-own-label */
        one.dataset['search'] = text.toLowerCase();
        one.toggleAttribute('data-current', !!option.selected);
        values.append(one);
      }
    }

    const held: Held = { def, scope, box, values: values ?? box };

    /* A field ANSWERED BY ITS MENU — a number, a range, a condition-only field
       — borrows that menu and draws it inline. The panel gives it back
       untouched. TRAP T-an-inline-menu-is-the-same-menu */
    if (def.menu && !options.length) {
      box.setAttribute('data-body', '');
      this.#borrow(held, def.menu, box);
    }

    this.#held.set(key, held);
    return box;
  }

  /** Move a menu into this field's body, remembering where it came from. */
  #borrow(held: Held, menu: HTMLElement, box: HTMLElement): void {
    const body = box.querySelector('.field-body');
    if (!body) return;
    held.menu = menu;
    held.menuHome = { parent: menu.parentNode!, slot: menu.getAttribute('slot') };
    menu.removeAttribute('slot');
    menu.setAttribute('data-inline', '');
    body.append(menu);
  }

  /** Put every borrowed menu back exactly as it was. */
  #giveBack(): void {
    for (const [, held] of this.#held) {
      if (!held.menu || !held.menuHome) continue;
      held.menu.removeAttribute('data-inline');
      if (held.menuHome.slot) held.menu.setAttribute('slot', held.menuHome.slot);
      held.menuHome.parent.appendChild(held.menu);
      delete held.menu;
      delete held.menuHome;
    }
  }

  /** Hand the Add button its menu of what is left to add. */
  #fillAdd(btn: HTMLElement, offers: PanelFilter[]): void {
    const menu = document.createElement('sherpa-menu');
    menu.setAttribute('slot', 'menu');
    menu.setAttribute('data-heading', 'Add filter');
    menu.setAttribute('data-select', 'multiple');
    menu.setAttribute('data-search', '');
    menu.setAttribute('data-commit', '');
    btn.append(menu);
    // `items()`, not populate(): a cloned menu has not upgraded.
    // TRAP T-custom-element-upgrade
    void Promise.resolve((menu as HTMLElement & { rendered?: Promise<void> }).rendered)
      .then(() => {
        (menu as HTMLElement & { items?: (i: unknown[]) => void }).items?.(
          offers.map((f) => ({ value: f.id, label: f.label })),
        );
      });
  }

  /* ── Reading ──────────────────────────────────────────────────────── */

  #picked(held: Held): string[] {
    return [...held.values.querySelectorAll<HTMLElement>('.value[data-current]')]
      .map((c) => c.dataset['value'] ?? '')
      .filter(Boolean);
  }

  #snapshot(): void {
    this.#baseline = new Map([...this.#held].map(([key, held]) => [key, this.#picked(held)]));
  }

  /* ── Acting ───────────────────────────────────────────────────────── */

  /** A single-select field unticks its siblings. */
  #onValueClick = (event: Event): void => {
    const one = this.#pathFind(event, '.value');
    if (!one) return;
    const held = [...this.#held.values()].find((h) => h.values.contains(one));
    if (!held) return;
    if (held.def.select === 'single') {
      for (const other of held.values.querySelectorAll('.value')) {
        if (other !== one) other.removeAttribute('data-current');
      }
    }
    /* GROUP and SORT are not filters, so they report at once and by their own
       names — a filter waits for Apply, an arrangement does not.
       TRAP T-group-and-sort-are-component-scope */
    if (held.def.id === 'group' || held.def.id === 'sort') {
      const picked = this.#picked(held);
      this.emit(`${held.def.id}-change`, {
        scope: held.scope, field: picked[0] ?? null,
      });
    }
  };

  #onAction = (event: Event): void => {
    const cond = this.#pathFind(event, '.field-conditional');
    if (cond) return this.#flipCondition(cond);
    const clear = this.#pathFind(event, '.field-clear');
    if (clear) return this.#clearField(clear);
    const remove = this.#pathFind(event, '.field-remove');
    if (remove) return this.#removeField(remove);
  };

  #fieldOf(node: HTMLElement): Held | undefined {
    return [...this.#held.values()].find((h) => h.box.contains(node));
  }

  /** CONDITION MODE replaces the value chips. The rows are the host's to draw:
   *  the panel reports the intent and flags the field.
   *  TRAP T-conditions-are-opt-in-per-field */
  #flipCondition(btn: HTMLElement): void {
    const held = this.#fieldOf(btn);
    if (!held) return;
    const on = !held.box.hasAttribute('data-conditional');
    held.box.toggleAttribute('data-conditional', on);
    btn.setAttribute('aria-pressed', String(on));

    /* The ROWS are the MENU's. The panel borrows the whole body and puts the
       menu into condition mode — one control, drawn in a second place.
       TRAP T-an-inline-menu-is-the-same-menu */
    const menu = held.def.menu;
    if (menu) {
      if (on) {
        menu.dataset['mode'] = 'condition';
        if (!held.menu) this.#borrow(held, menu, held.box);
      } else {
        menu.dataset['mode'] = 'select';
        if (held.menu && held.menuHome) {
          menu.removeAttribute('data-inline');
          if (held.menuHome.slot) menu.setAttribute('slot', held.menuHome.slot);
          held.menuHome.parent.appendChild(menu);
          delete held.menu;
          delete held.menuHome;
        }
      }
    }

    this.emit('filter-condition-change', {
      scope: held.scope, id: held.def.id, conditional: on,
    });
  }

  #clearField(btn: HTMLElement): void {
    const held = this.#fieldOf(btn);
    if (!held) return;
    for (const one of held.values.querySelectorAll('.value')) {
      one.removeAttribute('data-current');
    }
  }

  /** The HOST owns the list of fields, so a Remove is a request.
   *  TRAP T-a-panel-adds-through-the-bar-that-owns-the-list */
  #removeField(btn: HTMLElement): void {
    const held = this.#fieldOf(btn);
    if (!held) return;
    this.emit('filter-remove', { scope: held.scope, id: held.def.id });
  }

  /** The Add menu committed. The HOST owns the list; this is a request. */
  #onAddCommit = (event: Event): void => {
    const btn = this.#pathFind(event, '.scope-add');
    if (!btn) return;
    const ids = ((event as CustomEvent).detail?.values ?? []) as string[];
    if (!ids.length) return;
    const scope = btn.closest('.scope')?.getAttribute('data-scope') ?? '';
    this.emit('filter-add-request', { scope, ids });
  };

  /** ONE search, across every value in the panel. Field labels stay: a reader
   *  searching "gold" still needs to see that Gold is a Tier. */
  #onSearch = (): void => {
    const field = this.$<HTMLElement & { value?: string }>('.search');
    const q = (field?.value ?? '').trim().toLowerCase();
    for (const [, held] of this.#held) {
      let shown = 0;
      for (const one of held.values.querySelectorAll<HTMLElement>('.value')) {
        const hit = !q || (one.dataset['search'] ?? '').includes(q);
        one.toggleAttribute('data-filtered-out', !hit);
        if (hit) shown += 1;
      }
      held.box.toggleAttribute('data-no-matches', shown === 0);
    }
  };

  /** APPLY commits every field at once — one event, not one per field. */
  #onApply = (): void => {
    this.#snapshot();
    this.emit('quick-filter-change', {
      scope: 'panel',
      values: this.values,
      picked: this.values,
    });
  };

  /** DISCARD reverts to the last Apply, which is why it is not Cancel. */
  #onDiscard = (): void => {
    for (const [key, held] of this.#held) {
      const want = new Set(this.#baseline.get(key) ?? []);
      for (const one of held.values.querySelectorAll<HTMLElement>('.value')) {
        one.toggleAttribute('data-current', want.has(one.dataset['value'] ?? ''));
      }
    }
  };

  #onClose = (): void => {
    this.close();
    this.emit('filter-panel-close', {});
  };

  /* ── The breakpoint ───────────────────────────────────────────────── */

  #media(): MediaQueryList | null {
    if (typeof matchMedia !== 'function') return null;
    return matchMedia(`(min-width: ${this.dataset['minWidth'] ?? '1280'}px)`);
  }

  #wideEnough(): boolean {
    return this.#media()?.matches ?? true;
  }

  /** Below its width the panel closes itself: filtering goes back to the
   *  toolbars, which is what they are for. TRAP T-the-panel-is-desktop-only */
  #enforceWidth = (): void => {
    if (!this.#wideEnough() && this.hasAttribute('data-open')) this.close();
  };

  /** The first match on an event's composed path. */
  #pathFind(event: Event, selector: string): HTMLElement | null {
    for (const node of event.composedPath()) {
      if (node instanceof HTMLElement && node.matches(selector)) return node;
    }
    return null;
  }
}

customElements.define('sherpa-filter-panel', SherpaFilterPanel);
