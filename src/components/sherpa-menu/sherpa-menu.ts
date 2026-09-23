/**
 * sherpa-menu — a floating list of choices or actions, on the native popover API.
 *
 * The browser owns the top layer, Escape, outside-click and focus. `#place()`
 * measures the trigger: CSS anchoring cannot cross a shadow root.
 * TRAP T-anchor-cross-root
 * TRAP T-menu-rows-stay-native-controls
 *
 * @prop {string[]} values — the checked row values (read/write)
 *
 * @see TRAP T-footer-row-raises-on-any-flag
 */
import { SHARED_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import {
  DEFAULT_OP, OPS_FOR_TYPE, OP_LABELS, OP_SYMBOLS, OP_TAKES, type FilterOp, valueSet,
} from '../../core/data/store.js';
import { NON_VALUE_ROWS } from '../../core/ui/shared-constants.js';
// TRAP T-menu-composes-real-components — the page may not have imported these.
import '../sherpa-breadcrumbs/sherpa-breadcrumbs.js';
import '../sherpa-input-text/sherpa-input-text.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-container-footer/sherpa-container-footer.js';

/** One item a menu draws for itself. */
export interface MenuItem {
  value: string;
  /** What a reader sees. Defaults to `value`. */
  label?: string;
  selected?: boolean;
  /** Whether a remaining row carries it. Recorded, never drawn: every item is
   *  listed the same way and the checkbox is the only signal. */
  available?: boolean;
}

export class SherpaMenu extends SherpaElement {
  static override css = new URL('./sherpa-menu.css', import.meta.url);
  static override html = new URL('./sherpa-menu.html', import.meta.url);
  static override props = {
    'data-bounds': SHARED_PROPS['data-bounds'],
    'data-select': { type: 'enum', kind: 'style', values: ['single', 'multiple'] },
    'data-drill': { type: 'boolean', kind: 'style' },
    /* FILTER type only — which ops its condition dropdown offers, and which
       body answers it. TRAP T-an-operator-decides-pick-or-type */
    'data-conditions': { type: 'string', kind: 'style' },
    'data-takes': { type: 'enum', kind: 'style', values: ['list', 'text'] },
    'data-heading': { type: 'string', kind: 'content', to: '.heading' },
    /* A RANGE body offers two ends; `data-commit` holds its Apply until asked. */
    'data-range': { type: 'boolean', kind: 'style' },
    'data-commit': { type: 'boolean', kind: 'style' },
  } as const;

  static override observed = [
    'data-heading',
    'data-align',
    'data-search',
    'data-clearable',
    'data-removable',
    'data-type',
    // The crumb text is written from this, so a change must reach #syncCrumb.
    'data-drill-from',
    // Which condition is picked — a host may set it, and #sync follows.
    'data-op',
    // What was typed under it. An ATTRIBUTE, so a re-stamp cannot lose it.
    'data-value',
    'open',
  ];

  /* `data-type` picks the TEMPLATE, so a change must re-stamp the shadow DOM.
     Without this the attribute is read once, at birth, and a menu that becomes
     a filter never grows its condition row. TRAP T-variant-attrs-or-one-way-door */
  static override variantAttrs = ['data-type'];

  /** The FILTER menu is its own tree: only it carries the condition row.
   *  One field gets ONE menu, whether a chip or a column heading opens it.
   *  TRAP T-one-field-one-filter-menu */
  protected override get templateId(): string {
    return this.dataset['type'] === 'filter' ? 'filter' : 'default';
  }

  /** Gap between trigger and card. */
  static readonly OFFSET = 4;

  /** The open menu's trigger — re-measured on scroll / resize. */
  #trigger: HTMLElement | null = null;
  /** What Cancel restores. TRAP T-cancel-baseline-captured-on-open */
  #baseline: string[] = [];

  #card(): HTMLElement | null {
    return this.$('.menu');
  }

  override onRender(): void {
    this.#sync();
    /* Items given BEFORE this element had a shadow tree. A caller building a
       chip clones an UNUPGRADED <sherpa-menu>, so there is no template to
       stamp from until it enters the page.
       TRAP T-custom-element-upgrade */
    this.#stampItems();
    const card = this.#card();
    if (!card) return;
    card.addEventListener('toggle', this.#onToggle as EventListener);
    // Rows are LIGHT DOM, so the host is the listener.
    this.addEventListener('change', this.#onChange);
    this.$('.drill-back')?.addEventListener('click', this.#onBack);
    this.$('.drill-crumbs')?.addEventListener('breadcrumb-select', this.#onBack);
    // slotchange is the only hook a drill has; show() happens before it.
    // TRAP T-rows-changed-re-places-next-frame
    this.$('.rows slot')?.addEventListener('slotchange', this.#onRowsChanged);
    this.addEventListener('click', this.#onClick);
    this.$('.apply')?.addEventListener('click', this.#onApply);
    this.$('.cancel')?.addEventListener('click', this.#onCancel);
    this.$('.clear')?.addEventListener('click', this.#onClear);
    this.$('.today')?.addEventListener('click', this.#onToday);
    this.$('.remove')?.addEventListener('click', this.#onRemove);
    this.$('.search')?.addEventListener('input', this.#onSearch);
    /* Composed sherpa-input-texts, which re-dispatch `change` and `input`
       from the HOST — so these reach here without a shadow-root listener. */
    this.$('.condition')?.addEventListener('change', this.#onCondition);
    this.$('.condition-value')?.addEventListener('input', this.#onCondition);
  }

  /**
   * The condition, or what was typed under it, changed.
   *
   * Nothing is rebuilt — `data-takes` is what CSS reads, so the ticked rows and
   * the typed box both survive a flip.
   * TRAP T-an-operator-decides-pick-or-type
   */
  #onCondition = (event?: Event): void => {
    const select = this.#conditionField();
    const op = (select?.value ?? DEFAULT_OP) as FilterOp;
    if (this.dataset['op'] !== op) this.dataset['op'] = op;
    this.setAttribute('data-takes', OP_TAKES[op] ?? 'list');
    // Typing writes through to the attribute, so a re-stamp cannot lose it.
    if (event?.target === this.$('.condition-value')) {
      this.dataset['value'] = this.#valueField()?.value ?? '';
    }
    this.emit('condition-change', { op, value: this.conditionValue });
  };

  /**
   * The picked condition. `eq` unless a host says otherwise.
   * TRAP T-an-operator-decides-pick-or-type
   */
  get op(): FilterOp {
    return (this.dataset['op'] as FilterOp | undefined) ?? DEFAULT_OP;
  }

  set op(next: FilterOp) {
    this.dataset['op'] = next;
  }

  /**
   * What was TYPED, for a condition that takes text rather than a pick.
   *
   * Mirrored to `data-value`, because a variant RE-STAMP replaces the whole
   * shadow tree and the box with it — a value living only in the input is lost
   * the moment `data-type` changes. TRAP T-restamp-does-not-abort
   */
  get conditionValue(): string {
    return this.#valueField()?.value ?? this.dataset['value'] ?? '';
  }

  set conditionValue(next: string) {
    if (this.dataset['value'] !== next) this.dataset['value'] = next;
    const box = this.#valueField();
    if (box) box.value = next;
  }

  /** The composed field that names the condition. */
  #conditionField(): (HTMLElement & { value: string; populate?: (d: unknown) => unknown }) | null {
    return this.$('.condition');
  }

  /** The composed field that holds what was typed. */
  #valueField(): (HTMLElement & { value: string }) | null {
    return this.$('.condition-value');
  }

  /** Stamp the condition <option>s and keep `data-takes` in step. */
  #syncConditions(): void {
    const select = this.#conditionField();
    if (!select) return;

    /* A comma list names the ops; the default is the text set, which is what
       a field question asks. One vocabulary, in store.ts. */
    const declared = this.dataset['conditions'] ?? '';
    const wanted = declared.trim()
      ? declared.split(',').map((op) => op.trim()).filter(Boolean)
      : [...(OPS_FOR_TYPE['text'] ?? [])];
    const ops = wanted.filter((op): op is FilterOp => op in OP_LABELS);
    if (!ops.length) return;

    // The field keeps its own options across a re-stamp; this only re-sends
    // them when the SET changed.
    if (this.#sentOps.join() !== ops.join()) {
      this.#sentOps = [...ops];
      /* "Equals (=)" — the WORD says what it does, the SIGN is what the chip's
         badge will wear, so a reader meets both together once.
         TRAP T-an-operator-decides-pick-or-type */
      void select.populate?.(ops.map((op) => ({
        value: op, label: `${OP_LABELS[op]} (${OP_SYMBOLS[op]})`,
      })));
    }

    const op = ops.includes(this.op) ? this.op : (ops[0] ?? DEFAULT_OP);
    select.value = op;
    if (this.dataset['op'] !== op) this.dataset['op'] = op;
    this.setAttribute('data-takes', OP_TAKES[op] ?? 'list');

    // Put back what was typed — a re-stamp blanked the box, not the state.
    const box = this.#valueField();
    const held = this.dataset['value'] ?? '';
    if (box && box.value !== held) box.value = held;
  }

  /** The op set last sent to the condition field. */
  #sentOps: string[] = [];

  /** Narrow rows to a typed substring; a hidden row keeps its tick.
   * TRAP T-menu-search-is-a-substring-find */
  #onSearch = (): void => {
    const field = this.$<HTMLElement & { value?: string }>('.search');
    const q = (field?.value ?? '').trim().toLowerCase();
    let shown = 0;
    for (const row of this.#rows()) {
      const hit = !q || (row.textContent ?? '').toLowerCase().includes(q);
      // JS writes the flag; CSS owns the hiding.
      row.toggleAttribute('data-filtered-out', !hit);
      if (hit) shown += 1;
    }
    this.toggleAttribute('data-no-matches', !!q && shown === 0);
  };

  /** Every slotted row — label rows and action buttons alike. */
  #rows(): HTMLElement[] {
    return [...this.children].filter((n): n is HTMLElement => n instanceof HTMLElement);
  }

  override onChange(): void {
    this.#sync();
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  /** Open the menu under `trigger`, which is also what it measures against. */
  show(trigger?: HTMLElement): void {
    if (trigger) this.#trigger = trigger;
    // A closed popover measures 0, so show first. TRAP T-show-then-measure
    this.#syncSelectAll();
    this.#card()?.showPopover();
    this.#place();
  }

  hide(): void {
    this.#card()?.hidePopover();
  }

  /**
   * @see hide — accepted so one verb closes every Sherpa component.
   * TRAP T-one-verb-proxies-to-the-native-one
   */
  close(): void {
    this.hide();
  }

  toggle(trigger?: HTMLElement): void {
    if (this.open) this.hide();
    else this.show(trigger);
  }

  get open(): boolean {
    const card = this.#card();
    return !!card?.matches(':popover-open');
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.hide();
  }

  /** What the menu holds. A NUMBER or CALENDAR menu has no rows.
   * TRAP T-menu-value-is-not-always-rows */
  get values(): string[] {
    const numeric = this.#numericValues();
    if (numeric) return numeric;
    const dates = this.#calendarValues();
    if (dates) return dates;
    return this.#inputs()
      .filter((i) => i.checked)
      .map((i) => i.value);
  }

  /** A NUMBER menu's value, or null. A range at full bounds excludes nothing. */
  #numericValues(): string[] | null {
    const field = this.querySelector<HTMLInputElement>('input[type="number"]');
    const slider = this.querySelector<HTMLElement & { range: [number, number] }>('sherpa-slider');
    if (!field && !slider) return null;
    if (this.hasAttribute('data-range')) {
      if (!slider) return [];
      const [lo, hi] = slider.range;
      const min = Number(slider.getAttribute('min') ?? 0);
      const max = Number(slider.getAttribute('max') ?? 100);
      return lo === min && hi === max ? [] : [String(lo), String(hi)];
    }
    const raw = field?.value.trim() ?? '';
    return raw === '' ? [] : [raw];
  }
  /** A CALENDAR menu's value, or null when this is not one. */
  #calendarValues(): string[] | null {
    const cal = this.querySelector<HTMLElement>('sherpa-calendar');
    if (!cal) return null;
    // A RANGE reports both ends, and only once BOTH are picked.
    const start = cal.dataset['valueStart'];
    const end = cal.dataset['valueEnd'];
    if (start && end) return [start, end];
    const single = cal.dataset['value'];
    return single ? [single] : [];
  }

  set values(next: string[]) {
    // The query's comparison — TRAP T-one-comparison-rule-for-query-and-ui.
    const wanted = valueSet(next);
    for (const input of this.#inputs()) input.checked = wanted.has(input.value);
  }

  /**
   * populate([{ value, label, selected?, available? }]) — the menu's items.
   *
   * THE MENU chooses the markup, from `data-select` and from what each value
   * is. A caller hands over DATA; handing over markup is what let a chip menu
   * and a column heading menu drift into different controls over the same
   * field. TRAP T-one-field-one-filter-menu
   */
  protected override renderData(data: unknown): void {
    this.#items = Array.isArray(data) ? (data as MenuItem[]) : [];
    this.#stampItems();
  }

  /**
   * items([...]) — the SYNCHRONOUS door, for a caller building a detached tree.
   *
   * `populate()` awaits `rendered`, and a cloned `<sherpa-menu>` does not
   * upgrade until it enters the page — so the await never settles and the menu
   * stays empty. This records the items NOW and stamps what it can; `onRender`
   * stamps the rest. TRAP T-custom-element-upgrade
   */
  items(next: readonly MenuItem[]): void {
    this.#items = [...next];
    this.#stampItems();
  }

  /** The items last given. Kept, so a late render can still stamp them. */
  #items: MenuItem[] = [];

  /**
   * Stamp `#items` into the rows slot. Needs the shadow template, so it is
   * safe to call before this element has one — it simply waits for onRender.
   */
  #stampItems(): void {
    if (!this.#items.length) return;
    const single = this.dataset['select'] === 'single';
    const tpl = this.$<HTMLTemplateElement>(
      single ? 'template.menu-radio-tpl' : 'template.menu-check-tpl',
    );
    if (!tpl?.content.firstElementChild) return;

    const name = `sherpa-menu-${this.dataset['heading'] ?? 'group'}`;
    const stamp = (item: MenuItem): HTMLElement => {
      const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const box = row.querySelector('input')!;
      box.value = item.value;
      box.checked = !!item.selected;
      if (single) box.name = name;
      row.querySelector('.menu-row-label')!.textContent = item.label ?? item.value;
      return row;
    };

    /* SELECT ALL is the MENU's row, not the caller's — one of the two used to
       add its own and the other did not, so the same field read two ways.
       TRAP T-select-all-is-not-a-value */
    const all = !single && this.#items.length ? this.clone('template.menu-all-tpl') : null;

    /* ONE list, in the order the caller gave. A value no remaining row carries
       is still listed and still ticks — that is what `available` is for. It
       does not re-sort or dim: the checkbox already says what is picked, and a
       divider plus a grey row said it a second, noisier way.
       TRAP T-unavailable-value-sorts-below-a-divider */
    const rows = this.#items.map(stamp);
    const out: Element[] = all ? [all, ...rows] : rows;
    /* KEEP what the menu does not own. A caller's own rows — a Select-all, a
       Remove action — live here too, and a blanket replace ate them the moment
       this stamped late. Only the menu's own items are replaced. */
    for (const node of [...this.children]) {
      if (node.classList.contains('menu-row')) {
        node.remove();
      }
    }
    /* FIRST, keeping whatever the caller put below — in practice a Remove
       action, which a chip appends after this. */
    this.prepend(...out);

    /* SAY SO. A host reads its own face off the menu's values, and pre-ticked
       rows fire no native change — so a chip built before its items arrived
       would sit with an empty caret over a ticked row.
       TRAP T-chip-empty-check-waits-for-onconnect */
    this.emit('menu-items', { values: this.values });
  }

  /* ── Private ─────────────────────────────────────────────────────── */

  /** Every value row's control; the select-all row is excluded.
   * TRAP T-select-all-is-not-a-value */
  #inputs(): HTMLInputElement[] {
    return Array.from(
      this.querySelectorAll<HTMLInputElement>('input[type="checkbox"], input[type="radio"]'),
    ).filter((i) => !i.closest(NON_VALUE_ROWS));
  }

  /** The drill trail. An `href` would dismiss the popover.
   * TRAP T-drill-crumbs-carry-no-href */
  #syncCrumb(): void {
    const crumbs = this.$<HTMLElement & { populate(d: unknown): void }>('.drill-crumbs');
    if (!crumbs) return;
    const from = this.dataset['drillFrom'];
    if (!from) {
      crumbs.populate([]);
      return;
    }
    crumbs.populate([{ label: from }, { label: this.dataset['heading'] ?? '' }]);
  }

  #sync(): void {
    this.#syncCrumb();
    this.#syncConditions();
    // The name must reach a screen reader even when no heading is drawn.
    // TRAP T-calendar-header-has-no-heading
    const card = this.#card();
    const name = this.dataset['heading'] ?? '';
    if (card && name) card.setAttribute('aria-label', name);
    else card?.removeAttribute('aria-label');

    // A shared name makes the browser enforce "one at a time".
    if (this.dataset['select'] === 'single') {
      const name = `sherpa-menu-${this.dataset['heading'] ?? 'group'}`;
      for (const input of this.#inputs()) {
        if (input.type === 'radio' && !input.name) input.name = name;
      }
    }

  }

  /** The box the card stays inside — viewport, or a host's `data-bounds`.
   * A missing or zero-sized box falls back to the viewport.
   * TRAP T-bounds-clamp-to-the-viewport */
  #bounds(): { left: number; top: number; right: number; bottom: number } {
    const viewport = {
      left: 0,
      top: 0,
      right: document.documentElement.clientWidth,
      bottom: document.documentElement.clientHeight,
    };
    const sel = this.dataset['bounds'];
    if (!sel) return viewport;
    const box = document.querySelector(sel)?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return viewport;
    // Never wider than the viewport, or the card follows a scrolled-away box off-screen.
    return {
      left: Math.max(viewport.left, box.left),
      top: Math.max(viewport.top, box.top),
      right: Math.min(viewport.right, box.right),
      bottom: Math.min(viewport.bottom, box.bottom),
    };
  }

  #place(): void {
    const card = this.#card();
    const trigger = this.#trigger;
    if (!card || !trigger?.isConnected) return;

    const t = trigger.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const gap = SherpaMenu.OFFSET;
    // `--_max-h` is the room on the side the card landed on.
    // TRAP T-card-max-height-follows-the-side
    const bounds = this.#bounds();
    const vw = bounds.right;
    const vh = bounds.bottom;

    // Below the trigger, unless there is no room and there IS room above.
    const below = vh - t.bottom - gap * 2;
    const above = t.top - gap * 2;
    let y = t.bottom + gap;
    if (y + c.height > vh && t.top - gap - c.height >= 0) y = t.top - gap - c.height;

    const room = Math.max(below, above);
    if (c.height > below && above > below) y = Math.max(gap, t.top - gap - Math.min(c.height, above));
    card.style.setProperty('--_max-h', `${Math.max(120, Math.round(room))}px`);

    // The trigger's start edge (end edge on data-align="end"), clamped inside.
    let x = this.dataset['align'] === 'end' ? t.right - c.width : t.left;
    if (x + c.width > vw) x = vw - c.width - gap;
    if (x < bounds.left + gap) x = bounds.left + gap;

    if (y < bounds.top + gap) y = bounds.top + gap;

    card.style.setProperty('--_x', `${Math.round(x)}px`);
    card.style.setProperty('--_y', `${Math.round(y)}px`);
  }

  #onToggle = (event: Event): void => {
    const open = (event as ToggleEvent).newState === 'open';
    this.toggleAttribute('open', open);
    if (open) {
      this.#baseline = this.values;
      /* These live while the menu is OPEN, which is shorter than the element's
         life — `while` is that shorter lifetime, and the base class ANDs it
         with its own disconnect signal.

         `onFrame`, not `on`: #place() reads two boxes, and a scroll listener
         runs per EVENT. Measured before this, 50 scroll events produced 100
         getBoundingClientRect() calls.
         capture: an ancestor's scroll does not bubble.
         TRAP T-a-layout-read-belongs-in-a-frame
         TRAP T-open-menu-resize-closes */
      this.#openAc = new AbortController();
      const whileOpen = { while: this.#openAc.signal, passive: true } as const;
      this.onFrame(window, 'scroll', this.#reposition, { ...whileOpen, capture: true });
      this.on(window, 'resize', this.#onViewportResize, whileOpen);
      this.#cardResize ??= new ResizeObserver(() => this.#place());
      const card = this.#card();
      if (card) this.#cardResize.observe(card);
    } else {
      /* A COMMITTING menu holds ticks as a DRAFT until Apply. Closing any other
         way — clicking away, Escape — discards them, exactly as Cancel does.
         Without this the draft survived: the chip read ["Northwind"] while
         `current` stayed false, so it LOOKED set and filtered nothing.
         TRAP T-a-draft-dies-with-its-menu */
      if (this.#commits && !this.#applying) this.values = this.#baseline;
      this.#openAc?.abort();
      this.#openAc = null;
      this.#cardResize?.disconnect();
      this.#trigger = null;
    }
    this.emit(open ? 'menu-open' : 'menu-close', {});
  };

  /** Watches the card's box, so a body that grows re-places. */
  #cardResize: ResizeObserver | null = null;
  /** Aborts when the menu SHUTS — the viewport listeners' own lifetime. */
  #openAc: AbortController | null = null;

  #reposition = (): void => {
    this.#place();
  };

  #onViewportResize = (): void => {
    this.hide();
  };

  override onDisconnect(): void {
    // The viewport listeners carry their own signals; only the observer is manual.
    this.#openAc?.abort();
    this.#cardResize?.disconnect();
  }

  static readonly ALL_LABEL = 'Select all';

  /** The select-all control (class `qf-all`). */
  #allRow(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>('.qf-all input');
  }

  /** Tick or clear every value row — writes the BOXES, so a committing menu's
   * draft still works. TRAP T-select-all-ticks-boxes-not-values */
  #onSelectAll(input: HTMLInputElement): void {
    // Read the SET, not the box. TRAP T-indeterminate-reports-false
    const boxes = this.#inputs();
    const on = boxes.some((b) => !b.checked);
    for (const box of boxes) box.checked = on;
    input.indeterminate = false;
    this.#syncSelectAll();
    if (!this.#commits) this.emit('menu-change', { values: this.values });
  }

  /** Point select-all at the set: all, some (indeterminate) or none. Rewritten
   * every time the set moves. TRAP T-indeterminate-is-a-property */
  #syncSelectAll(): void {
    const all = this.#allRow();
    if (!all) return;
    const boxes = this.#inputs();
    const on = boxes.filter((b) => b.checked).length;
    all.checked = boxes.length > 0 && on === boxes.length;
    all.indeterminate = on > 0 && on < boxes.length;
    const label = all.parentElement?.querySelector('.qf-row-label');
    if (label) label.textContent = SherpaMenu.ALL_LABEL;
  }

  /** Rows changed — re-read select-all, re-place next frame. */
  #onRowsChanged = (): void => {
    this.#syncSelectAll();
    if (this.open) requestAnimationFrame(() => this.#place());
  };

  /** Report the back arrow; the menu cannot know what it drilled into.
   * TRAP T-menu-back-is-a-report */
  #onBack = (event: Event): void => {
    event.stopPropagation();
    this.emit('menu-back', {});
  };

  #onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    // A NUMBER menu's field and slider are value shapes too.
    // TRAP T-native-change-stops-at-the-host
    const numeric = input.type === 'number' || input.tagName === 'SHERPA-SLIDER';
    if (!numeric && input.type !== 'checkbox' && input.type !== 'radio') return;
    // The SELECT-ALL row drives the others, so it reports for itself.
    if (input.closest('.qf-all')) {
      this.#onSelectAll(input);
      return;
    }
    this.#syncSelectAll();
    // A COMMITTING menu holds the change as a DRAFT until Apply.
    if (this.#commits) return;
    this.emit('menu-change', { values: this.values });
  };

  /** Whether changes wait for Apply. */
  get #commits(): boolean {
    return this.hasAttribute('data-commit');
  }

  /** True while Apply or Cancel is closing the card — they own the values. */
  #applying = false;

  #onApply = (): void => {
    // Apply rewrites the baseline Cancel would restore.
    this.#applying = true;
    this.#baseline = this.values;
    this.emit('menu-apply', { values: this.values });
    this.emit('menu-change', { values: this.values });
    this.hide();
    this.#applying = false;
  };

  #onCancel = (): void => {
    // Restore, THEN report.
    this.#applying = true;
    this.values = this.#baseline;
    this.emit('menu-cancel', {});
    this.hide();
    this.#applying = false;
  };

  /** Empty the selection and report it — the checkboxes AND a slotted
   * calendar's date attributes. TRAP T-clear-empties-both-body-shapes */
  #onClear = (): void => {
    for (const input of this.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
    // A FILTER menu's typed value is part of what Clear empties.
    if (this.dataset['type'] === 'filter') this.conditionValue = '';
    for (const cal of this.querySelectorAll<HTMLElement>('sherpa-calendar')) {
      for (const a of ['data-value', 'data-value-start', 'data-value-end']) cal.removeAttribute(a);
    }
    this.emit('menu-clear', {});
    /* ALWAYS, even on a COMMITTING menu. Clear is an action ON THE FILTER, not
       an edit to a draft: without this the menu emptied itself and the query
       kept every value, so the card and the rows disagreed until the reader
       found Apply. Apply and Cancel still own the row TICKS.
       TRAP T-every-chip-menu-gets-clear-and-search */
    this.emit('menu-change', { values: this.values });
  };

  /** Drive the slotted calendar to today; stays OPEN.
   * TRAP T-today-and-remove-are-menu-chrome */
  #onToday = (): void => {
    for (const cal of this.querySelectorAll<HTMLElement & { today?: () => void }>('sherpa-calendar')) {
      cal.today?.();
    }
  };

  /** Remove — the footer-button form of a `<button value="remove">` row. */
  #onRemove = (): void => {
    this.emit('menu-select', { value: 'remove', label: 'Remove' });
    this.hide();
  };

  #onClick = (event: Event): void => {
    // Only plain ACTION rows close the menu; value rows stay open.
    const button = (event.target as HTMLElement).closest('button');
    if (!button || button.disabled) return;
    this.emit('menu-select', { value: button.value, label: button.textContent?.trim() ?? '' });
    this.hide();
  };
}

customElements.define('sherpa-menu', SherpaMenu);
