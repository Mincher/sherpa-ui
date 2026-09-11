/**
 * sherpa-quick-filter-toolbar — a row of filter chips above a grid or list.
 *
 * Give it chips with populate([{ id, label, type?, active?, icon?, options? }]). When you
 * click a chip it toggles on or off, and the toolbar fires quick-filter-change
 * with the ids of every chip that's currently on. There's a slot for your own
 * extra buttons — the old add/edit/save-view features are left out on purpose.
 *
 * THE ACTION CLUSTER is built in, following Figma's `Type` axis (Filter Toolbar
 * 150:3688). Both types show:  Add · AI · undo · configure · │ · refresh · ⋮
 * and `data-type="view"` inserts a snapped [★ │ Save │ ▾] group after the
 * divider. This REVERSES an earlier decision to delegate the cluster to an
 * `actions` slot — Figma models it as one component, and every host that
 * mounted a toolbar had to rebuild the same seven buttons. `data-no-actions`
 * hides the cluster for a host that wants the trailing end to itself; the
 * `actions` slot survives for host extras and renders before the cluster.
 *
 * The bar OPENS with a Group and a Sort chip (Figma Filter Toolbar Type=data leads
 * its content slot with two menu chips, then a divider, then the filter chips).
 * Those two change how the grid is ARRANGED rather than which rows survive, so
 * they live in their own zone and fire their own events. Give them columns with
 * organise({ group: [...], sort: [...] }).
 *
 * The Sort chip is TRI-STATE on its body: ascending → descending → suspended.
 * Suspended keeps the chosen column — it turns the sort off temporarily rather
 * than clearing it. The column itself is chosen from the chip's menu.
 *
 * A value-MENU chip is a two-state toggle too: ON filters by the picked values,
 * OFF ignores that field WITHOUT clearing the picks. `values` reports what is
 * applied; `pickedValues` reports what is remembered.
 *
 * @fires quick-filter-change — the active filter set changes. bubbles + composed. detail: { active: string[], values: Record<string, string[]>, picked: Record<string, string[]> }
 * @fires group-change — the group column changed. bubbles + composed. detail: { field: string | null }
 * @fires sort-change — the sort column or direction changed. bubbles + composed. detail: { field: string | null, direction: 'asc' | 'desc' }
 * @fires filter-add — the Add chip's body was clicked. bubbles + composed. detail: {}
 * @fires filter-clear — the undo button reset every chip. bubbles + composed. detail: {}
 * @fires ai-filter-request — the AI button was clicked. bubbles + composed. detail: {}
 * @fires filter-configure — the configure (sliders) button was clicked. bubbles + composed. detail: {}
 * @fires data-refresh — the refresh button was clicked. bubbles + composed. detail: {}
 * @fires filter-overflow — the overflow (⋮) button was clicked. bubbles + composed. detail: {}
 * @fires view-save — Save was clicked (view type). bubbles + composed. detail: {}
 * @fires view-favorite — the star toggled (view type). bubbles + composed. detail: { favourite: boolean }
 * @fires view-menu-open — the Save group's caret was clicked (view type). bubbles + composed. detail: {}
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import '../sherpa-quick-filter/sherpa-quick-filter.js';
// Chips with `options` stamp a <sherpa-menu>, so it must be defined.
import '../sherpa-menu/sherpa-menu.js';
// The built-in action cluster is made of buttons, so they must be defined.
import '../sherpa-button/sherpa-button.js';

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
  /** A leading Font Awesome icon class list. */
  icon?: string;
  /**
   * Values this chip filters by. Given options, the chip gets a caret and a
   * <sherpa-menu> of rows: checkboxes when `select` is 'multiple' (the default),
   * radios when it is 'single'.
   */
  options?: QuickFilterOption[];
  select?: 'single' | 'multiple';
  /**
   * A chip that cannot be switched OFF — a SELECTOR rather than a toggle.
   *
   * The view chip is the case this exists for: you are always looking at some
   * view, so "no view" is not a state the page can be in. Its menu changes
   * WHICH one; its body has nothing to turn off.
   */
  persistent?: boolean;
}

interface ChipEl extends HTMLElement {
  current: boolean;
}

/** One column the grid can be grouped or sorted by. */
export interface OrganiseColumn {
  /** The field name reported in group-change / sort-change. */
  field: string;
  label: string;
}

/** The columns the leading Group / Sort chips offer. */
export interface OrganiseDef {
  group?: OrganiseColumn[];
  sort?: OrganiseColumn[];
}

/** Which way a sort runs — matches the standard data-sort-direction values. */
export type SortDirection = 'asc' | 'desc';

export class SherpaQuickFilterToolbar extends SherpaElement {
  static override css = new URL('./sherpa-quick-filter-toolbar.css', import.meta.url);
  static override html = new URL('./sherpa-quick-filter-toolbar.html', import.meta.url);

  #filters: QuickFilterDef[] = [];
  #organise: OrganiseDef = {};
  /**
   * Filters the user MAY add but has not — the Add chip's menu.
   *
   * Separate from #filters because they are the two halves of one idea: what is
   * on the bar, and what else could be. Picking one moves it across.
   */
  #available: QuickFilterDef[] = [];

  override onRender(): void {
    this.addEventListener('quick-filter-click', this.#onChipClick);
    // The cluster is delegated from its own zone, not per button: every control
    // is a sherpa-button firing the same button-click, so one listener reads
    // data-act off whichever one was pressed.
    this.$('.actions-zone')?.addEventListener('button-click', this.#onAction);
    // The organise chips carry MENUS, so their selection arrives as the chip's
    // own quick-filter-change (relayed from <sherpa-menu>), not as a body click.
    this.addEventListener('quick-filter-change', this.#onOrganiseChange);
    // Action rows (the "Remove filter" button) report separately from value rows.
    this.addEventListener('menu-select', this.#onMenuSelect);
    // The ADD menu hangs off a sherpa-BUTTON, which — unlike a chip — does not
    // relay menu-change as quick-filter-change. So its commit is heard directly.
    this.addEventListener('menu-change', this.#onAddCommit as EventListener);
    if (this.#filters.length) this.#render();
    if (this.#organise.group?.length || this.#organise.sort?.length) this.#renderOrganise();
    if (this.#available.length) this.#renderAvailable();
  }

  /**
   * populate([{ id, label, type?, active?, icon?, options? }]) — the filter chips.
   *
   * There is deliberately no `count`. A badge on a plain TOGGLE chip could only
   * mean "how many rows match", which the host often cannot know up front — a
   * server-side query has not answered yet when the bar is built. The badge is
   * reserved for "how many VALUES are picked", which a menu chip sets itself.
   */
  protected override renderData(data: unknown): void {
    this.#filters = Array.isArray(data) ? (data as QuickFilterDef[]) : [];
    this.#render();
  }

  /**
   * The ids of the currently-active TOGGLE chips, in order.
   *
   * A chip with a value MENU is deliberately left out. Its id ("plan", "owner")
   * names a COLUMN, not a value, so a host filtering `row.status` against this
   * list matched nothing and turning on a Plan chip emptied the grid. A menu
   * chip's picks live in `values` instead.
   */
  get active(): string[] {
    return this.#chips()
      .filter((c) => c.current && !c.hasAttribute('data-menu'))
      .map((c) => c.dataset['id'] ?? '');
  }

  /**
   * The LIVE value constraints, keyed by chip id.
   *
   * A value-menu chip is a two-state toggle: ON means "filter this field by the
   * picked values", OFF means "ignore this field". Turning it off does NOT clear
   * the picks — they are still in the menu, ready to come back — so this getter
   * reports only chips that are ON. A caller can therefore iterate the object and
   * know every entry is something to filter by, with no on/off check of its own.
   *
   * Use `pickedValues` to read a suspended chip's remembered picks.
   *
   * A single-select chip still reports an array — one shape for both, so a caller
   * does not have to branch on the chip's select mode.
   */
  get values(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const chip of this.#chips()) {
      if (!chip.hasAttribute('data-menu')) continue;
      // OFF = this field is not being filtered. The picks survive; they are just
      // not applied.
      if (!chip.hasAttribute('data-current')) continue;
      const id = chip.dataset['id'];
      if (!id) continue;
      const picked = this.#chipPicks(chip);
      if (picked.length) out[id] = picked;
    }
    return out;
  }

  /**
   * Every menu chip's picks, on or OFF.
   *
   * The counterpart to `values`: this is what the chip REMEMBERS, which is what a
   * "restore my view" feature needs, whereas `values` is what is being applied.
   */
  get pickedValues(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const chip of this.#chips()) {
      if (!chip.hasAttribute('data-menu')) continue;
      const id = chip.dataset['id'];
      if (!id) continue;
      const picked = this.#chipPicks(chip);
      if (picked.length) out[id] = picked;
    }
    return out;
  }

  /** The values ticked in one chip's menu. */
  #chipPicks(chip: HTMLElement): string[] {
    return Array.from(chip.querySelectorAll<HTMLInputElement>('input:checked')).map(
      (i) => i.value,
    );
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
      if (f.icon) chip.setAttribute('data-icon-start', f.icon);
      // A selector, not a toggle: always on, and its body does not flip it.
      if (f.persistent) {
        chip.setAttribute('data-persistent', '');
        chip.setAttribute('data-current', '');
      }
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
    // The prototype carries slot="menu" for a CHIP; a sherpa-button names the
    // same slot, so the one prototype serves both.
    menu.setAttribute('slot', 'menu');
    menu.setAttribute('data-select', single ? 'single' : 'multiple');
    // A filter menu COMMITS on Apply. Filtering a table or chart is expensive and
    // a partly-built selection is rarely a query anyone wants run, so the rows are
    // a draft until Apply and Cancel discards them. The menu shows the footer and
    // withholds menu-change until then; nothing else here has to change.
    menu.setAttribute('data-commit', '');
    // EVERY value menu gets a search. A filter's values are the user's own data
    // — regions, owners, plans — so the list is as long as their data is, and
    // scrolling a hundred owners to find one is the case this exists for.
    menu.setAttribute('data-search', '');

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

    // A REMOVE row on the filter chips only. Not on the organise chips (Group and
    // Sort are fixed parts of the bar, not filters a user put there) and not on
    // the Add chip itself, whose menu IS the list of things to add.
    if (chip.classList.contains('chip')) {
      const removeTpl = this.$<HTMLTemplateElement>('template.qf-remove-tpl');
      if (removeTpl) menu.appendChild(removeTpl.content.firstElementChild!.cloneNode(true));
    }

    chip.setAttribute('data-menu', '');
    chip.appendChild(menu);
  }

  /**
   * A "Remove filter" row was clicked — take that chip off the bar.
   *
   * The menu fires `menu-select` for ACTION rows (buttons), separately from the
   * `menu-change` its value rows commit on Apply, so a remove never has to be
   * told apart from a value pick.
   */
  #onMenuSelect = (event: Event): void => {
    if ((event as CustomEvent).detail?.value !== 'remove') return;
    // composedPath, not `event.target`. menu-select is composed and re-emitted
    // from the menu's own host, so by the time it reaches this listener the
    // target has RETARGETED to the toolbar itself — `target.closest('.chip')`
    // finds nothing. The path still holds the chip (the menu is slotted into it):
    //
    //   sherpa-menu › slot › span › div.chip › #shadow › sherpa-quick-filter.chip › …
    //
    // Matched on the TAG, not on `.chip`: the quick-filter's own shadow root
    // contains a <div class="chip"> too, and it comes FIRST on the path — so
    // matching the class found that inner div, which carries no data-id, and
    // every remove silently bailed.
    const chip = event
      .composedPath()
      .find(
        (n): n is HTMLElement =>
          n instanceof HTMLElement && n.localName === 'sherpa-quick-filter',
      );
    const id = chip?.dataset['id'];
    if (!id) return;
    event.stopImmediatePropagation();
    // Shut the menu first: it is about to be removed from the DOM with its chip,
    // and a popover destroyed while open leaves the top layer confused.
    (chip.querySelector('sherpa-menu') as HTMLElement & { hide?: () => void })?.hide?.();
    this.#removeFilter(id);
  };

  #onChipClick = (event: Event): void => {
    // quick-filter-click is composed → find the originating chip on the path.
    const path = event.composedPath();

    // The SORT chip's body is a TRI-STATE toggle: asc → desc → off. "Off" does
    // NOT clear the chosen column — it suspends the sort, so one more click
    // brings the same column back ascending. The column itself only changes from
    // the menu.
    const sortChip = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.dataset['id'] === 'sort',
    );
    if (sortChip?.classList.contains('organise-chip')) {
      // IMMEDIATE: the chip's event and this listener are both on the HOST, so
      // plain stopPropagation would only block ancestors and a host listening on
      // the toolbar itself would still see the raw chip click.
      event.stopImmediatePropagation();
      this.#cycleSort(sortChip);
      return;
    }

    const chip = path.find(
      (n): n is ChipEl => n instanceof HTMLElement && n.classList.contains('chip'),
    );
    if (!chip) return;

    // A PERSISTENT chip is a selector: it has already flipped itself off by the
    // time this fires (a chip is a two-state toggle by default), so put it back.
    // You are always in some view — "no view" is not a state the page can be in,
    // and the menu is what changes which one.
    if (chip.hasAttribute('data-persistent')) {
      chip.toggleAttribute('data-current', true);
      return;
    }
    this.#emitChange();
  };

  /**
   * Report the whole filter state: the active toggle chips AND every menu chip's
   * picks.
   *
   * `active` alone could not describe a menu chip — its id names a column, so a
   * host matching row values against that list found nothing and a Plan pick
   * emptied the grid.
   */
  #emitChange(): void {
    this.emit('quick-filter-change', {
      active: this.active,
      // What is APPLIED — only the chips that are ON.
      values: this.values,
      // What is REMEMBERED — including chips toggled off, whose picks survive.
      picked: this.pickedValues,
    });
  }

  /**
   * Advance the sort chip: ascending → descending → suspended → ascending …
   *
   * The chip stays ON for the two live directions and goes OFF for suspended, so
   * the bar shows at a glance whether the sort is doing anything. `data-direction`
   * keeps the last live direction through the suspended step, which is what lets
   * "off" be temporary rather than a reset.
   */
  #cycleSort(chip: HTMLElement): void {
    // The chip has ALREADY flipped its own data-current by the time
    // quick-filter-click arrives (it is a two-state toggle by default), so undo
    // that first. Without this the flip and the cycle fought each other and the
    // chip never left ascending: every click flipped it off, then the cycle's
    // "suspended → on" branch put it straight back.
    const live = !chip.hasAttribute('data-current');
    const direction = chip.dataset['direction'] === 'desc' ? 'desc' : 'asc';

    if (!live) {
      // Suspended → back on, in the direction it was left in.
      chip.toggleAttribute('data-current', true);
    } else if (direction === 'asc') {
      chip.dataset['direction'] = 'desc';
      chip.toggleAttribute('data-current', true);
    } else {
      // Descending → SUSPENDED, and the direction resets to ascending so the
      // next "on" starts the cycle again.
      //
      // This is what broke after one full cycle: leaving `desc` in place meant
      // click 4 read desc→suspend and click 5 read suspend→on-at-desc, so the
      // chip ping-ponged between descending and off and never returned to
      // ascending. The COLUMN still survives — that is what makes "off"
      // temporary rather than a reset — only the direction rewinds.
      chip.removeAttribute('data-current');
      chip.dataset['direction'] = 'asc';
    }

    this.#syncSortLabel(chip);
    this.emit('sort-change', { field: this.sortField, direction: this.sortDirection });
  }

  /**
   * Show the sort chip's state in its own label and icon.
   *
   * A tri-state control has to say which state it is in — the chip's on/off tint
   * alone cannot tell ascending from descending.
   */
  #syncSortLabel(chip: HTMLElement): void {
    const live = chip.hasAttribute('data-current');
    const desc = chip.dataset['direction'] === 'desc';
    const column = this.#organise.sort?.find((c) => c.field === this.#menuValue('sort'));
    chip.setAttribute('data-label', column ? `Sort: ${column.label}` : 'Sort');
    const { sortNone, sortAsc, sortDesc } = SherpaQuickFilterToolbar.#icons;
    // OFF gets its OWN glyph. It used to wear the ascending arrow, so a
    // suspended sort looked identical to an active ascending one — the whole
    // point of a tri-state icon is that the three states look different.
    chip.setAttribute('data-icon-start', !live ? sortNone : desc ? sortDesc : sortAsc);
  }

  /**
   * available([...]) — the filters the Add chip offers.
   *
   * The Add control is a Filter Chip pinned State=menu in the design: its body
   * is a trigger and its caret opens a list. This is that list — the filters
   * a user can put on the bar OVER AND ABOVE the defaults populate() gave it.
   *
   * Picking one STAMPS it into the chip run and drops it from the menu, because
   * a filter already on the bar is not one you can add again. It arrives ON, so
   * the reason you added it is visible immediately.
   */
  available(defs: QuickFilterDef[]): void {
    this.#available = Array.isArray(defs) ? defs : [];
    this.#renderAvailable();
  }

  /** Stamp the Add button's menu from whatever is left to add. */
  #renderAvailable(): void {
    const add = this.$<HTMLElement>('.add-btn');
    if (!add) return;
    // Nothing left to add — the button would open an empty list, so it is
    // disabled rather than lying about what it can do.
    const any = this.#available.length > 0;
    this.toggleAttribute('data-can-add', any);
    add.toggleAttribute('disabled', !any);
    add.querySelector('sherpa-menu')?.remove();
    if (!any) return;
    this.#addMenu(add, {
      id: 'add',
      label: 'Add filter',
      // MULTI-select: adding filters is a batch job — a user setting up a view
      // wants three of them, and a single-select menu made that three separate
      // open-pick-apply rounds.
      select: 'multiple',
      options: this.#available.map((f) => ({ value: f.id, label: f.label })),
    });
    // A long field list is what a search is for.
    add.querySelector('sherpa-menu')?.toggleAttribute('data-search', true);
  }

  /** Move the chosen available filters onto the bar. */
  #addFilters(ids: string[]): void {
    const added: QuickFilterDef[] = [];
    for (const id of ids) {
      const i = this.#available.findIndex((f) => f.id === id);
      if (i < 0) continue;
      const [def] = this.#available.splice(i, 1);
      // ON on arrival: a filter you just chose should be doing something.
      added.push({ ...def!, active: true });
    }
    if (!added.length) return;
    this.#filters = [...this.#filters, ...added];
    this.#render();
    this.#renderAvailable();
    // ONE event for the batch, not one per filter — a host re-queries once.
    this.emit('filter-add', { ids: added.map((f) => f.id), filters: added });
    this.#emitChange();
  }

  /**
   * Take one filter back OFF the bar.
   *
   * It returns to the Add menu rather than vanishing: a user who removes a chip
   * by mistake, or narrows a view and then widens it again, should find it where
   * they got it. Its picked values are dropped — the chip comes back clean,
   * because "remove" means remove, not "hide and remember".
   */
  #removeFilter(id: string): void {
    const i = this.#filters.findIndex((f) => f.id === id);
    if (i < 0) return;
    const [def] = this.#filters.splice(i, 1);
    const { active: _active, ...clean } = def!;
    this.#available = [...this.#available, clean as QuickFilterDef];
    this.#render();
    this.#renderAvailable();
    this.emit('filter-remove', { id, filter: clean });
    this.#emitChange();
  }

  /* ── Action cluster ────────────────────────────────────────────────── */

  /**
   * One listener for the whole cluster.
   *
   * Every control fires the same `button-click`, so the ACTION is read off
   * `data-act` rather than each button owning a listener. A new button in the
   * template needs one line in this map, not new wiring.
   *
   * The events are the ones Figma's own description names, so a host written
   * against the design finds the event it expects.
   */
  #onAction = (event: Event): void => {
    const path = event.composedPath();
    const btn = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && !!n.dataset['act'],
    );
    if (!btn) return;

    switch (btn.dataset['act']) {
      case 'ai':
        this.emit('ai-filter-request', {});
        break;
      case 'clear':
        // The undo button RESETS rather than merely announcing: a host should not
        // have to reach into the shadow root to clear chips it did not stamp.
        this.clearAll();
        break;
      case 'configure':
        this.emit('filter-configure', {});
        break;
      case 'refresh':
        this.emit('data-refresh', {});
        break;
      case 'overflow':
        this.emit('filter-overflow', {});
        break;
      case 'save':
        this.emit('view-save', {});
        break;
      case 'view-menu':
        this.emit('view-menu-open', {});
        break;
      case 'favourite':
        this.#toggleFavourite(btn);
        break;
      case 'add':
        // The button IS the trigger now — there is no caret to open the list.
        // Adding a filter always meant "show me the options", so a body/caret
        // split was two controls doing one job.
        this.#openAddMenu(btn);
        break;
    }
  };

  /**
   * The Add menu committed — put the chosen filters on the bar.
   *
   * Heard as `menu-change` rather than `quick-filter-change`: the menu hangs off
   * a sherpa-button, and only a CHIP re-emits its menu's commit under the
   * quick-filter name. A menu on a plain button reports for itself.
   */
  #onAddCommit = (event: Event): void => {
    const add = event
      .composedPath()
      .find((n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('add-btn'));
    if (!add) return;
    event.stopImmediatePropagation();
    const picked = (event as CustomEvent).detail?.values as string[] | undefined;
    if (picked?.length) this.#addFilters(picked);
  };

  /**
   * Open the Add button's menu, anchored to the button.
   *
   * `aria-expanded` tracks it so the control announces itself as a menu button,
   * which is what makes a plain <button> an acceptable trigger for a popover.
   */
  #openAddMenu(btn: HTMLElement): void {
    const menu = btn.querySelector<HTMLElement & { show?: (t: HTMLElement) => void }>(
      'sherpa-menu',
    );
    if (!menu) return;
    btn.setAttribute('aria-expanded', 'true');
    menu.addEventListener('menu-close', () => btn.setAttribute('aria-expanded', 'false'), {
      once: true,
    });
    menu.show?.(btn);
  }

  /**
   * Flip the star.
   *
   * The attribute is the state and CSS paints from it; the GLYPH swaps too
   * (outline → solid) so the state survives for anyone who cannot tell the
   * brand purple from the default ink. `aria-pressed` carries it to a screen
   * reader, which is why the star is a toggle button rather than a plain one.
   */
  #toggleFavourite(btn: HTMLElement): void {
    const on = !this.hasAttribute('data-favourite');
    this.toggleAttribute('data-favourite', on);
    // ACTIVE is a real Style MODE in the design, not a colour to invent: the
    // Style collection's `active` mode re-points style-surface/base to
    // surface/active/base, style-border/base to border/active/+2 and
    // style-content/base to content/active/+1.
    //
    // The attribute is set as the honest description of the state — and CSS in
    // THIS component's sheet does the painting, because the [data-status]
    // SELECTOR that would normally supply --_status-* lives in tokens.css,
    // which is loaded into the DOCUMENT and is not in sharedStyles. It reaches
    // a light-DOM element (verified: it resolves #f2dfff there) and never one
    // inside a shadow root, so the button saw nothing at all.
    if (on) btn.setAttribute('data-status', 'active');
    else btn.removeAttribute('data-status');
    btn.setAttribute('data-icon-start', on ? 'fa-solid fa-star' : 'fa-regular fa-star');
    btn.setAttribute('aria-pressed', String(on));
    this.emit('view-favorite', { favourite: on });
  }

  /**
   * Turn every chip off and drop every picked value.
   *
   * This is what the undo button means: not "undo the last thing" but "back to
   * no filters". The organise chips are included — a grouping and a sort are as
   * much a view state as a filter is, and leaving them behind made the reset
   * look broken.
   *
   * Fires the three change events afterwards, so a host re-queries once per
   * concern rather than once per chip.
   */
  clearAll(): void {
    for (const chip of this.#chips()) {
      // A PERSISTENT chip survives a reset — "no view" is not a state the page
      // can be in, so clearing the filters must not leave the view chip off with
      // nothing to put back. Its PICK survives with it: resetting the filters
      // does not mean leaving the view you are in.
      if (chip.hasAttribute('data-persistent')) continue;
      chip.removeAttribute('data-current');
      for (const input of chip.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
    }
    for (const chip of this.$$<HTMLElement>('.organise-chip')) {
      chip.removeAttribute('data-current');
      for (const input of chip.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
      if (chip.dataset['id'] === 'sort') {
        chip.dataset['direction'] = 'asc';
        this.#syncSortLabel(chip);
      }
    }
    this.emit('filter-clear', {});
    this.#emitChange();
    this.emit('group-change', { field: null });
    this.emit('sort-change', { field: null, direction: 'asc' });
  }

  /* ── Organise: the leading Group / Sort chips ───────────────────────── */

  /**
   * Glyphs for the organise chips, mirroring the Figma icons page (`group`,
   * `sort-none`, `sort-ascending`, `sort-descending`).
   *
   * These are Font Awesome APPROXIMATIONS of the Apex artwork — this branch has
   * no local icon set, every icon is an FA class list. Named here rather than
   * inline so the three places that set a sort glyph cannot drift apart, which
   * is how the off-state ended up wearing the ascending arrow.
   *
   * `wide-short` / `short-wide` over `a-z` / `z-a`: the Figma glyphs are plain
   * bars with an arrow, not letters, and a Sort chip can order a NUMBER column
   * where an A-Z badge reads as wrong.
   */
  static readonly #icons = {
    group: 'fa-solid fa-layer-group',
    sortNone: 'fa-solid fa-bars',
    sortAsc: 'fa-solid fa-arrow-up-wide-short',
    sortDesc: 'fa-solid fa-arrow-down-wide-short',
  } as const;

  /**
   * organise({ group: [...], sort: [...] }) — the columns the leading chips offer.
   *
   * Separate from populate() on purpose: these two chips change how the grid is
   * ARRANGED, not which rows survive, and they are single-choice where a filter
   * chip is a toggle. Mixing them into the filter set would put them in `active`
   * and make quick-filter-change lie about what is being filtered.
   */
  organise(def: OrganiseDef): void {
    this.#organise = def ?? {};
    this.#renderOrganise();
  }

  /** The column the grid is grouped by, or null. */
  get groupField(): string | null {
    return this.#menuValue('group') ?? null;
  }

  /**
   * The column the grid is sorted by, or null.
   *
   * Null while the chip is SUSPENDED (its third state), even though the chip
   * still remembers the column — a suspended sort must not order anything, and a
   * host reading this should see "no sort", not a sort it is expected to ignore.
   */
  get sortField(): string | null {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="sort"]');
    if (!chip || !chip.hasAttribute('data-current')) return null;
    return this.#menuValue('sort') ?? null;
  }

  /** Which way that sort runs. Defaults to ascending. */
  get sortDirection(): SortDirection {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="sort"]');
    return chip?.dataset['direction'] === 'desc' ? 'desc' : 'asc';
  }

  /** Whether the sort is suspended — a column is picked but not being applied. */
  get sortSuspended(): boolean {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="sort"]');
    return !!chip && !chip.hasAttribute('data-current') && !!this.#menuValue('sort');
  }

  /**
   * Stamp the Group and Sort chips into the organise zone.
   *
   * Both are `data-menu` chips with SINGLE-select (radio) rows, because a grid is
   * grouped by one column and sorted by one column at a time. Sort offers each
   * column twice — ascending and descending — as `field:asc` / `field:desc`, so
   * one radio row carries the whole answer and the two halves of a sort can never
   * disagree with each other.
   */
  #renderOrganise(): void {
    const zone = this.$('.organise-zone');
    const chipTpl = this.$<HTMLTemplateElement>('template.qf-tpl');
    if (!zone || !chipTpl) return;

    const group = this.#organise.group ?? [];
    const sort = this.#organise.sort ?? [];
    zone.replaceChildren();
    // Written by the JS, not inferred: CSS cannot see whether the zone has
    // children, and an empty zone would leave its divider rule floating.
    this.toggleAttribute('data-has-organise', group.length > 0 || sort.length > 0);

    if (group.length) {
      zone.appendChild(
        // fa-SOLID: the free Font Awesome set the examples load has no regular
        // weight for these two glyphs, so `fa-regular` rendered the missing-glyph
        // box. The other toolbar chips (tag, user) are solid for the same reason.
        this.#organiseChip('group', 'Group', SherpaQuickFilterToolbar.#icons.group,
          group.map((c) => ({ value: c.field, label: c.label }))),
      );
    }
    if (sort.length) {
      // The MENU picks the column; the chip BODY cycles the direction. Listing
      // each column twice (A-Z and Z-A) doubled a long menu and made "turn the
      // sort off but keep the column" impossible to express.
      // Built in the OFF state, so it opens with the sort-none glyph.
      const chip = this.#organiseChip('sort', 'Sort', SherpaQuickFilterToolbar.#icons.sortNone,
        sort.map((c) => ({ value: c.field, label: c.label })));
      chip.dataset['direction'] = 'asc';
      zone.appendChild(chip);
    }
  }

  /** One organise chip: a menu chip with single-select rows. */
  #organiseChip(
    id: string,
    label: string,
    icon: string,
    options: QuickFilterOption[],
  ): HTMLElement {
    const tpl = this.$<HTMLTemplateElement>('template.qf-tpl')!;
    const chip = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
    chip.classList.remove('chip');
    chip.classList.add('organise-chip');
    chip.dataset['id'] = id;
    chip.setAttribute('data-label', label);
    chip.setAttribute('data-icon-start', icon);
    this.#addMenu(chip, { id, label, select: 'single', options });
    return chip;
  }

  /** The committed value of one organise chip's menu. */
  #menuValue(id: string): string | undefined {
    const chip = this.$(`.organise-chip[data-id="${id}"]`);
    const checked = chip?.querySelector<HTMLInputElement>('input:checked');
    return checked?.value;
  }

  #onOrganiseChange = (event: Event): void => {
    // This listener hears the chips' quick-filter-change AND the toolbar's own
    // (emit() is composed, so it re-enters here). Only act on an event that came
    // from an organise chip, and stop it there so a host listening for
    // quick-filter-change never sees a group/sort pick as a filter change.
    const path = event.composedPath();
    const chip = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('organise-chip'),
    );
    if (!chip) {
      // The ADD chip's menu committed — the user picked a filter to put on the
      // bar. That is not a change to the filter SET's values, it is a change to
      // which chips exist, so it is handled here and never reaches #emitChange
      // as a value edit.
      // A FILTER menu chip committed its selection (Apply). The chip's own event
      // reports one chip's values; the toolbar must re-report the WHOLE state, so
      // swap it for the toolbar-level one.
      const filterChip = path.find(
        (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('chip'),
      );
      if (filterChip) {
        event.stopImmediatePropagation();
        // A menu chip is ON while it holds picks — that is what makes an applied
        // value filter visible in the bar.
        const id = filterChip.dataset['id'] ?? '';
        // A persistent chip stays on whatever its menu holds — an empty pick is
        // still a view, where an ordinary value chip with nothing picked is not
        // filtering anything and says so by going off.
        filterChip.toggleAttribute(
          'data-current',
          filterChip.hasAttribute('data-persistent') || (this.values[id]?.length ?? 0) > 0,
        );
        this.#emitChange();
      }
      return;
    }
    // stopIMMEDIATEPropagation, not stopPropagation. The chip's event and this
    // listener are both on the HOST, so plain stopPropagation only blocks
    // ANCESTORS — a host listening on the toolbar itself still received the chip's
    // raw event and saw a group/sort pick as a filter change.
    event.stopImmediatePropagation();

    // The chip shows itself as ON while it holds a choice, which is what makes an
    // applied grouping visible in the bar (Figma's populated chip treatment).
    const id = chip.dataset['id'];
    const picked = !!this.#menuValue(id ?? '');
    chip.toggleAttribute('data-current', picked);

    if (id === 'group') this.emit('group-change', { field: this.groupField });
    else if (id === 'sort') {
      // Choosing a column from the menu resumes the sort in its remembered
      // direction — the tri-state cycle only runs off the chip BODY.
      this.#syncSortLabel(chip);
      this.emit('sort-change', { field: this.sortField, direction: this.sortDirection });
    }
  };
}

customElements.define('sherpa-quick-filter-toolbar', SherpaQuickFilterToolbar);
