/**
 * menu-list.ts — the menu's value list: its rows stamped from items, a tree of
 * tiered values, Select all and None, child-menu rows, the search, and the limits
 * the filters before it set. A module of sherpa-menu, not an element.
 * TRAP T-one-field-one-filter-menu · TRAP T-a-tree-menu-keeps-its-ticks-as-data
 *
 * Map:
 * - ListHost — What the list asks of its menu.
 * - MenuList — One menu's value rows, as data and as the rows drawn from it.
 * - .held — Picks given before any row could show them.
 * - .items — Take the items, and stamp what can be stamped.
 * - .itemData — Each item's value, label, parent and swatch.
 * - .tree — Whether the rows are a tree of tiered values.
 * - .stamped — Whether its items have been drawn as rows.
 * - .values — What the rows hold, ticked.
 * - .setValues — Tick the rows these values name.
 * - .inputs — Every value row's control; Select all and None excluded.
 * - .rows — Every slotted row.
 * - .fieldValues — The field's own values, read from its value rows.
 * - .present — What the filters before it leave; `null` is everything.
 * - .setPresent — Take what the filters before it leave; false when it is the same.
 * - .offered — What a serial set's chain offers; `null` is everything.
 * - .setOffered — Take what the chain offers; false when it is the same.
 * - .heldBy — Who among the presets on holds a value.
 * - .markPresent — Grey each row the filters before it rule out; remove what the chain does not offer.
 * - .setMatches — Each value row's match count, by value; `null` takes them off.
 * - .setCount — A child menu's pick count on its row.
 * - .stamp — Stamp the items into the rows slot.
 * - .drawSwatches — Each value row leads with its swatch, or not, as `data-swatches` says.
 * - .said — What a reader's act says beyond its ticks: all, or nothing more.
 * - .all — Every value ticked, on purpose.
 * - .tickAll — Tick every row Select all could.
 * - .syncSelectAll — Point Select all at the set: all, some or none.
 * - .change — A row's box changed: what kind of change it was, with the rows brought into line.
 * - .settle — A row let go that is ruled out is refused now — and goes, hiding them.
 * - .clear — Untick every row.
 * - .nameRadios — A single list's radios share its own group name.
 * - .search — Narrow the rows to the typed text.
 * - .click — A twisty or a child menu's row was pressed: true when it was one of them.
 * - .hover — A pointer resting on a child menu's row opens it.
 * - .key — ArrowRight and ArrowLeft on a tree or a child menu's row: true when the key was theirs.
 * - .stop — Stop the hover timer.
 */
import { valueKey, valueSet } from '../../core/data/store.js';
import { goesFromList, ruleOut } from '../../core/data/filter-state.js';
import { NON_VALUE_ROWS, RULED_OUT, SET_ASIDE, onByPreset } from '../../core/ui/shared-constants.js';
import { hiddenRows } from '../../core/ui/tree-rows.js';
import { TreePicks } from '../../core/ui/tree-picks.js';
import { renderIcon } from '../../core/ui/render-icon.js';
import { paintSwatch } from '../../core/ui/chart-parts.js';
import type { MenuItem } from './sherpa-menu.js';

/** How long a pointer RESTS on a row before its child menu opens. */
const HOVER_OPENS_AFTER = 500;

/** Each menu's own radio group number. */
let radioGroups = 0;

/** Is a list of value keys the set held already — or both nothing? */
function sameKeys(held: ReadonlySet<string> | null, next: readonly string[] | null): boolean {
  if (!held || !next) return !held && !next;
  const keys = new Set(next);
  return keys.size === held.size && [...keys].every((k) => held.has(k));
}

/** What the list asks of its menu. */
export interface ListHost {
  /** The menu element: its rows are its light DOM. */
  readonly el: HTMLElement;
  /** A shadow query. */
  $<T extends Element = HTMLElement>(sel: string): T | null;
  /** Clone a prototype from the menu's template. */
  clone<T extends Element = HTMLElement>(from: string | HTMLTemplateElement | null | undefined): T | null;
  /** This menu's own light-DOM nodes: a nested menu answers for itself. */
  own<T extends Element>(selector: string): T[];
  /** Set or clear one of the menu's own states. */
  toggleState(name: string, on: boolean): void;
  /** Is the card open? */
  open(): boolean;
  /** The rows were stamped: the menu says so. */
  stamped(): void;
  /** A row asks for its child menu. */
  drill(value: string): void;
  /** ArrowLeft in a drilled menu: back. */
  back(): void;
  /** A tick held for Apply, or reported now: whether the menu waits for Apply. */
  commits(): boolean;
}

/** One menu's value rows, as data and as the rows drawn from it. */
export class MenuList {
  /** The menu it is part of. */
  readonly #host: ListHost;
  /** The items last given. Kept, so a late render can still stamp them. */
  #items: MenuItem[] = [];
  /** A tiered list's ticks, as data; null for a flat one. TRAP T-a-tree-menu-keeps-its-ticks-as-data */
  #tree: TreePicks | null = null;
  /** Each tree parent's open or shut, kept across items(), as the nav keeps its Areas. */
  #opened = new Map<string, boolean>();
  /** Parents a search holds open, for a child it matched. */
  #searchOpen = new Set<string>();
  /** Parents whose children are drawn: a shut one's wait for its first open. */
  #kidsDrawn = new Set<string>();
  /** Each item's place, by value: a tree row's id. */
  #indexOf = new Map<string, number>();
  /** Its items have been drawn as rows at least once. */
  #stamped = false;
  /** Picks set before any row could show them. TRAP T-a-value-before-the-first-render-is-held */
  held: string[] | null = null;
  /** What the filters before it leave; `null` is everything. */
  #present: Set<string> | null = null;
  /** What the chain offers; `null` is everything. */
  #offered: Set<string> | null = null;
  /** Who holds a value; `null` while no preset does. */
  #heldBy: ((value: string) => string) | null = null;
  /** Each value's match count, as last given. */
  #matches: Readonly<Record<string, number>> | null = null;
  /** Every value ticked, on purpose. */
  #all = false;
  /** The row a pointer rests on. */
  #hovered: HTMLElement | null = null;
  /** Opens that row's child menu once the rest is long enough. */
  #hoverTimer: ReturnType<typeof setTimeout> | undefined;
  /** This menu's radio group: its own, never a nested menu's of the same heading.
   *  TRAP T-a-nested-menu-answers-for-itself */
  readonly #group = `sherpa-menu-${++radioGroups}`;

  constructor(host: ListHost) {
    this.#host = host;
  }

  /** Is this a single list: radios, not boxes? */
  #single(): boolean {
    return this.#host.el.dataset['select'] === 'single';
  }

  /** Take the items, and stamp what can be stamped. TRAP T-custom-element-upgrade */
  items(next: readonly MenuItem[]): void {
    this.#items = [...next];
    // Items that name their picks are newer than picks held for them.
    if (next.some((item) => item.selected !== undefined)) this.held = null;
    this.#tree = next.some((item) => item.parent !== undefined)
      ? new TreePicks(next, next.filter((item) => item.selected).map((item) => item.value)) : null;
    this.#indexOf = new Map(next.map((item, i) => [item.value, i]));
    this.stamp();
  }

  /** Each item's value, label, parent and swatch — a row not drawn yet too. */
  get itemData(): Array<{ value: string; label: string; parent?: string; swatch?: number | string }> {
    return this.#items.map(({ value, label, parent, swatch }) => ({
      value, label: label ?? value, ...(parent !== undefined ? { parent } : {}), ...(swatch ? { swatch } : {}),
    }));
  }

  /** Whether the rows are a tree of tiered values. */
  get tree(): boolean {
    return !!this.#tree;
  }

  /** Whether its items have been drawn as rows. */
  get stamped(): boolean {
    return this.#stamped;
  }

  /** What the rows hold, ticked. */
  values(): string[] {
    if (this.held) return [...this.held];
    // ALL, before its rows are drawn: every item. TRAP T-all-is-an-answer
    if (this.#all && !this.#stamped && this.#items.length) return this.#items.filter((item) => item.parent === undefined).map((item) => item.value);
    if (this.#tree) return this.#tree.values;
    // Not stamped yet: its items' own picks. TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp
    if (!this.#stamped && this.#items.length) return this.#items.filter((item) => item.selected).map((item) => item.value);
    return this.inputs()
      .filter((i) => i.checked)
      .map((i) => i.value);
  }

  /** Tick the rows these values name. */
  setValues(next: readonly string[]): void {
    if (this.#tree) {
      this.held = null;
      this.#tree.set(next);
      this.#drawTicks();
      return;
    }
    const inputs = this.inputs();
    this.held = inputs.length ? null : [...next];
    // The query's comparison — TRAP T-one-comparison-rule-for-query-and-ui.
    const wanted = valueSet(next);
    for (const input of inputs) input.checked = wanted.has(input.value);
    this.#syncNone();
  }

  /** Every value row's control; the select-all row is excluded.
   * TRAP T-select-all-is-not-a-value */
  inputs(): HTMLInputElement[] {
    return this.#host.own<HTMLInputElement>('input[type="checkbox"], input[type="radio"]')
      .filter((i) => !i.closest(NON_VALUE_ROWS));
  }

  /** Every slotted row — label rows and action buttons alike. */
  rows(): HTMLElement[] {
    return [...this.#host.el.children].filter((n): n is HTMLElement => n instanceof HTMLElement);
  }

  /** The field's own values, read from its value rows. */
  fieldValues(): { value: string; label: string }[] {
    // Its own value ROWS: a nested menu's group is not one. TRAP T-a-nested-menu-answers-for-itself
    return this.rows()
      .filter((row) => !row.matches(NON_VALUE_ROWS) && !row.querySelector('sherpa-menu'))
      .map((row) => ({
        value: row.querySelector<HTMLInputElement>('input')?.value ?? '',
        label: (row.textContent ?? '').trim(),
      }))
      .filter((o) => o.value !== '');
  }

  /* ── The limits the filters before it set ── TRAP T-a-ruled-out-value-is-greyed ── */

  /** What the filters before it leave; `null` is everything. */
  get present(): readonly string[] | null {
    return this.#present ? [...this.#present] : null;
  }
  /** Take what the filters before it leave; false when it is the same. */
  setPresent(values: readonly string[] | null): boolean {
    // The same list does nothing: a draw tells every chip's menu each time.
    if (sameKeys(this.#present, values)) return false;
    this.#present = values ? new Set(values) : null;
    this.markPresent();
    return true;
  }

  /** What a serial set's chain offers; `null` is everything. */
  get offered(): readonly string[] | null {
    return this.#offered ? [...this.#offered] : null;
  }
  /** Take what the chain offers; false when it is the same. TRAP T-a-filter-set-groups-or-chains */
  setOffered(values: readonly string[] | null): boolean {
    if (sameKeys(this.#offered, values)) return false;
    this.#offered = values ? new Set(values) : null;
    this.markPresent();
    return true;
  }

  /** Who among the presets on holds a value. Will, TODOs 521, 590 */
  set heldBy(held: ((value: string) => string) | null) {
    this.#heldBy = held;
    this.#markHeld();
  }

  /** Mark each row a preset holds, and let go of each it no longer does. */
  #markHeld(): void {
    for (const row of this.#host.el.querySelectorAll<HTMLElement>('.menu-row')) {
      const box = row.querySelector<HTMLInputElement>(':scope > input');
      if (!box) continue;
      const by = this.#heldBy?.(box.value);
      const was = row.hasAttribute('data-by-preset');
      if (!by && !was) continue;
      row.toggleAttribute('data-by-preset', !!by);
      box.checked = !!by;
      box.disabled = !!by;
      if (by) row.setAttribute('title', onByPreset(by));
      else row.removeAttribute('title');
    }
  }

  /** Grey each row the filters before it rule out; refuse it unless it is ticked.
   *  A row the chain does not offer goes, unless it is ticked — and, hiding
   *  unmatched, so does one they rule out. */
  markPresent(): void {
    this.#markHeld();
    const given = new Map(this.#items.map((i) => [i.value, i]));
    const hides = this.#host.el.hasAttribute('data-hide-unavailable');
    const limit = ruleOut(this.#present, this.#offered);
    const outOf = (box: HTMLInputElement): boolean => given.get(box.value)?.available === false || limit(box.value) !== null;
    // ALL is every value it may have: one ruled out or not offered is not ticked, and comes back. TRAP T-all-is-an-answer
    if (this.#all && !this.#tree) for (const box of this.inputs()) box.checked = !outOf(box);
    /* Every ticked row ruled out: the filter stays in force (Will, 2026-10-20), so
       they say "no matches"; only beside a pick that stands are they "not applied". */
    const ticked = this.inputs().filter((box) => box.checked);
    const inForce = ticked.length > 0 && ticked.every(outOf);
    for (const box of this.inputs()) {
      const row = box.closest<HTMLElement>('.menu-row');
      // A value its def says is unavailable is ruled out as one the filters leave none of.
      const why = limit(box.value) ?? (given.get(box.value)?.available === false ? 'unmatched' : null);
      row?.toggleAttribute('data-removed', goesFromList(why, hides, box.checked));
      const out = why !== null;
      // INACTIVE refuses a tick ON; one still ticked may be let go, once (Will, TODO 462).
      // Only ever undo its OWN refusal.
      if (out && !box.checked) box.disabled = true;
      else if (row?.hasAttribute('data-unavailable')) box.disabled = false;
      row?.toggleAttribute('data-unavailable', out);
      const said = box.getAttribute('aria-description');
      // Said on hover too: why it is greyed. Will, TODO 176.
      if (out) {
        const why = box.checked && !inForce ? SET_ASIDE : RULED_OUT;
        box.setAttribute('aria-description', why);
        row?.setAttribute('title', why);
      } else if (said === RULED_OUT || said === SET_ASIDE) {
        box.removeAttribute('aria-description');
        row?.removeAttribute('title');
      }
    }
  }

  /* ── Counts on rows ── */

  /** Each value row's match count, by value; `null` takes them off. Will, TODO 466 */
  setMatches(counts: Readonly<Record<string, number>> | null): void {
    this.#matches = counts;
    this.#drawMatches();
  }

  /** Draw each value row's count; a child menu's row keeps its badge for its picks. */
  #drawMatches(): void {
    const counts = this.#matches;
    for (const box of this.inputs()) {
      const row = box.closest<HTMLElement>('.menu-row');
      if (!row || row.hasAttribute('data-drill') || box.closest(NON_VALUE_ROWS)) continue;
      const n = counts?.[valueKey(box.value)] ?? counts?.[box.value];
      const had = row.querySelector<HTMLElement>(':scope > .menu-row-count');
      if (n == null) {
        had?.remove();
        row.removeAttribute('data-matches');
        continue;
      }
      const badge = this.#countBadge(row);
      if (!badge) continue;
      badge.textContent = String(n);
      row.setAttribute('data-matches', '');
    }
  }

  /** Write a child menu's pick count on its row. An empty badge draws nothing. */
  setCount(value: string, count: number): void {
    // The DATA too, so rows stamped later draw it.
    this.#items = this.#items.map((item) => (item.drill && item.value === value ? { ...item, count } : item));
    for (const row of this.#host.own<HTMLElement>('.menu-row[data-drill]')) {
      if (row.dataset['value'] !== value) continue;
      const badge = count > 0 ? this.#countBadge(row) : row.querySelector(':scope > .menu-row-count');
      if (badge) badge.textContent = count > 0 ? String(count) : '';
    }
  }

  /** A row's count badge, stamped the first time it has a count: before its caret, where it has one. */
  #countBadge(row: HTMLElement): HTMLElement | null {
    const had = row.querySelector<HTMLElement>(':scope > .menu-row-count');
    if (had) return had;
    const badge = this.#host.clone<HTMLElement>('template.menu-count-tpl');
    if (badge) row.insertBefore(badge, row.querySelector(':scope > .menu-row-drill'));
    return badge;
  }

  /* ── Stamping ── */

  /**
   * Stamp the items into the rows slot. Needs the shadow template, so it is
   * safe to call before the menu has one — it simply waits for its render.
   */
  stamp(): void {
    if (!this.#items.length) return;
    const single = this.#single();
    const tpl = this.#host.$<HTMLTemplateElement>(
      single ? 'template.menu-radio-tpl' : 'template.menu-check-tpl',
    );
    if (!tpl?.content.firstElementChild) return;

    const held = this.held ? valueSet(this.held) : null;
    this.held = null;
    if (this.#tree && held) this.#tree.set(this.#items.map((item) => item.value).filter((v) => held.has(v)));
    this.#kidsDrawn.clear();
    // Not in items(): a menu not yet upgraded has no states to set.
    this.#host.toggleState('tree', !!this.#tree);
    const stamp = (item: MenuItem): HTMLElement | null => this.#stampRow(item, tpl, held);

    /* SELECT ALL is the MENU's row, not the caller's — one of the two used to
       add its own and the other did not, so the same field read two ways. A
       list of FILTERS asks for none. TRAP T-select-all-is-not-a-value */
    const all = !single && this.#items.length && !this.#host.el.hasAttribute('data-no-select-all')
      ? this.#host.clone('template.menu-all-tpl') : null;
    // NONE is a single list's "nothing", in its radio group. Will, TODO 394
    const none = single && this.#items.length && this.#host.el.hasAttribute('data-none') ? this.#host.clone('template.menu-none-tpl') : null;
    const noneBox = none?.querySelector('input');
    if (noneBox) noneBox.name = this.#group;

    /* ONE list, in the order the caller gave: a ruled-out value is still
       listed, never re-sorted. TRAP T-unavailable-value-sorts-below-a-divider */
    const rows: Element[] = [];
    let section: string | undefined;
    for (const item of this.#items) {
      // A shut parent's children wait for its first open: their ticks are the tree's.
      if (item.parent !== undefined) {
        if (!this.#isOpen(item.parent)) continue;
        this.#kidsDrawn.add(item.parent);
      }
      if (item.section && item.section !== section) {
        const head = this.#host.clone('template.menu-section-tpl');
        if (head) {
          head.textContent = item.section;
          rows.push(head);
        }
      }
      section = item.section;
      const one = stamp(item);
      if (one) rows.push(one);
    }
    // SELECT ALL belongs to the section it heads, so it follows a leading heading.
    const head = rows[0]?.classList.contains('menu-section') ? [rows.shift()!] : [];
    const out: Element[] = [...head, ...(all ? [all] : []), ...(none ? [none] : []), ...rows];
    /* KEEP what the menu does not own. A caller's own rows — a Select-all, a
       Remove action — live here too, and a blanket replace ate them the moment
       this stamped late. Only the menu's own items are replaced. */
    const el = this.#host.el;
    for (const node of [...el.children]) {
      if (node.classList.contains('menu-row')) {
        node.remove();
      }
    }
    /* FIRST, keeping whatever the caller put below — in practice a Remove
       action, which a chip appends after this — and a caller row marked
       `data-lead` above: a Filters menu's actions. TODO 383 */
    el.prepend(...out);
    el.prepend(...[...el.children].filter((n) => n.hasAttribute('data-lead')));
    this.#stamped = true;
    this.#drawTicks();
    if (this.#all) this.tickAll();
    this.#drawOpen();
    this.markPresent();
    this.#drawMatches();

    /* SAY SO. A host reads its own face off the menu's values, and pre-ticked
       rows fire no native change — so a chip built before its items arrived
       would sit with an empty caret over a ticked row.
       TRAP T-chip-empty-check-waits-for-onconnect */
    this.#host.stamped();
  }

  /** One item's row: its box, label, note and ends. */
  #stampRow(item: MenuItem, tpl: HTMLTemplateElement, held: { has: (v: unknown) => boolean } | null): HTMLElement | null {
    if (item.action) {
      const act = this.#host.clone<HTMLButtonElement>('template.menu-action-tpl');
      if (!act) return null;
      act.value = item.value;
      act.querySelector('.menu-row-label')!.textContent = item.label ?? item.value;
      if (item.current) act.setAttribute('aria-current', 'true');
      return act;
    }
    const row = (item.pickable === false ? this.#host.clone('template.menu-bare-tpl') : null) ?? this.#host.clone(tpl);
    if (!row) return null;
    const box = row.querySelector('input');
    if (box) {
      box.value = item.value;
      box.checked = held ? held.has(item.value) : !!item.selected;
      if (this.#single()) box.name = this.#group;
    }
    const label = item.label ?? item.value;
    row.querySelector('.menu-row-label')!.textContent = label;
    // …and a word that is the row's, not the value's name. Will, TODO 684
    const suffix = item.suffix ? this.#host.clone('template.menu-suffix-tpl') : null;
    if (suffix) {
      suffix.textContent = item.suffix!;
      row.querySelector('.menu-row-label')!.append(' ', suffix);
    }
    /* AN ATTRIBUTE, drawn by CSS: the row is light DOM, and `::slotted` cannot
       reach its children — only the row itself and its pseudo-elements.
       Said to assistive tech too, since generated content is not reliably. */
    if (item.note) {
      row.dataset['note'] = item.note;
      box?.setAttribute('aria-description', item.note);
    }
    if (item.drill) this.#addDrill(row, item.value, label, item.count ?? 0);
    if (this.#tree) this.#treeRow(row, item);
    this.#leadRow(row, item);
    return row;
  }

  /** A CHILD MENU's door on a row: its pick count, then its caret.
   *  TRAP T-a-row-opens-its-child-menu */
  #addDrill(row: HTMLElement, value: string, label: string, count: number): void {
    row.dataset['drill'] = '';
    row.dataset['value'] = value;
    // The SEARCH reads this: the badge's number is not part of the name.
    row.dataset['label'] = label;
    const caret = this.#host.clone('template.menu-drill-tpl');
    if (caret) {
      caret.setAttribute('aria-label', `Open ${label}`);
      row.append(caret);
    }
    const badge = count > 0 ? this.#countBadge(row) : null;
    if (badge) badge.textContent = String(count);
  }

  /** A row's LEADING mark, in its label: the icon its chip carries, or — where this
   *  menu draws them — its value's swatch. Will, TODO 677 */
  #leadRow(row: HTMLElement, item: MenuItem): void {
    const label = row.querySelector('.menu-row-label');
    label?.querySelector(':scope > .menu-row-swatch')?.remove();
    if (!label || label.querySelector(':scope > .menu-row-icon')) return;
    if (item.icon) {
      const icon = this.#host.clone('template.menu-icon-tpl');
      if (icon) label.prepend(icon);
      if (icon) renderIcon(icon, item.icon);
    } else if (item.swatch && this.#host.el.hasAttribute('data-swatches')) {
      const swatch = this.#host.clone<HTMLElement>('template.menu-swatch-tpl');
      if (swatch) label.prepend(swatch);
      if (swatch) paintSwatch(swatch, item.swatch);
    }
  }

  /** Each value row leads with its swatch, or not, as `data-swatches` says now. */
  drawSwatches(): void {
    const byValue = new Map(this.#items.map((item) => [item.value, item]));
    for (const box of this.inputs()) {
      const row = box.closest<HTMLElement>('.menu-row');
      const item = byValue.get(box.value);
      if (row && item) this.#leadRow(row, item);
    }
  }

  /* ── A tree of tiered values. TODO 369 · TRAP T-a-tree-menu-keeps-its-ticks-as-data ── */

  /** A tree row: a child's place under its parent; a parent's twisty. */
  #treeRow(row: HTMLElement, item: MenuItem): void {
    const box = row.querySelector('input');
    if (item.parent !== undefined) {
      row.dataset['parent'] = item.parent;
      row.dataset['depth'] = '1';
      row.id = this.#rowId(item.value);
      // Said with its parent's name: "London, Northwind".
      box?.setAttribute('aria-describedby', this.#rowId(item.parent, 'label'));
      return;
    }
    row.dataset['tree'] = '';
    row.querySelector('.menu-row-label')!.id = this.#rowId(item.value, 'label');
    if (!this.#tree!.kids(item.value).length) return;
    const twisty = this.#host.clone('template.menu-twisty-tpl');
    if (!twisty) return;
    row.dataset['twisty'] = '';
    twisty.dataset['value'] = item.value;
    row.prepend(twisty);
  }

  /** A tree row's id, unique to this menu. */
  #rowId(value: string, part = 'row'): string {
    return `${this.#group}-${part}-${this.#indexOf.get(value) ?? -1}`;
  }

  /** Each drawn box from the tree's ticks: on, off, or — a parent — some. */
  #drawTicks(): void {
    const tree = this.#tree;
    if (!tree) return;
    const single = this.#single();
    const picked = new Set(tree.values);
    for (const box of this.inputs()) {
      const shows = tree.box(box.value);
      box.checked = single ? picked.has(box.value) : shows === 'on';
      box.indeterminate = !single && shows === 'some';
    }
  }

  /** Is a tree parent open — by the reader, or by a search that matched a child? */
  #isOpen(parent: string): boolean {
    return (this.#opened.get(parent) ?? false) || this.#searchOpen.has(parent);
  }

  /** Each parent's box says open or shut, and names its children; a shut one's are hidden. */
  #drawOpen(): void {
    if (!this.#tree) return;
    const kids = this.#host.own<HTMLElement>('.menu-row[data-parent]');
    const parentOf = new Map(kids.map((row) => [row.id, row.dataset['parent']!]));
    const under = Map.groupBy(kids, (row) => row.dataset['parent']!);
    const open = new Map<string, boolean>();
    for (const row of this.#host.own<HTMLElement>('.menu-row[data-twisty]')) {
      const box = row.querySelector('input');
      if (!box) continue;
      const on = this.#isOpen(box.value);
      open.set(box.value, on);
      box.setAttribute('aria-expanded', String(on));
      const ids = (under.get(box.value) ?? []).map((k) => k.id);
      if (ids.length) box.setAttribute('aria-controls', ids.join(' '));
      else box.removeAttribute('aria-controls');
      row.querySelector('.menu-row-twisty')?.setAttribute('data-icon-start', on ? 'chevron-down' : 'chevron-right');
    }
    const hidden = hiddenRows(parentOf.keys(), parentOf, open);
    for (const row of kids) row.toggleAttribute('data-shut', hidden.has(row.id));
  }

  /** Open or shut a parent; its children are drawn the first time it opens. */
  #setOpen(parent: string, open: boolean): void {
    this.#opened.set(parent, open);
    if (open) this.#drawKids(parent);
    this.#drawOpen();
  }

  /** Draw a parent's children under it, once. */
  #drawKids(parent: string): void {
    if (this.#kidsDrawn.has(parent)) return;
    const tpl = this.#host.$<HTMLTemplateElement>(this.#single() ? 'template.menu-radio-tpl' : 'template.menu-check-tpl');
    const at = this.#host.own<HTMLElement>('.menu-row[data-twisty]').find((row) => row.querySelector('input')?.value === parent);
    if (!tpl || !at) return;
    this.#kidsDrawn.add(parent);
    const rows = this.#items.filter((item) => item.parent === parent).flatMap((item) => this.#stampRow(item, tpl, null) ?? []);
    at.after(...rows);
    this.#drawTicks();
    this.markPresent();
  }

  /* ── Select all and None ── */

  /** The select-all control (class `qf-all`). */
  #allRow(): HTMLInputElement | null {
    return this.#host.own<HTMLInputElement>('.qf-all input')[0] ?? null;
  }

  /** Tick or clear every value row — writes the BOXES, so a committing menu's
   * draft still works. TRAP T-select-all-ticks-boxes-not-values */
  #selectAll(input: HTMLInputElement): void {
    // Read the SET, not the box. TRAP T-indeterminate-reports-false
    // A ruled-out box is never ticked by Select all. TRAP T-a-ruled-out-value-is-greyed
    const boxes = this.inputs().filter((b) => !b.disabled);
    if (this.#tree) {
      // A tree ticks every parent. TRAP T-a-tree-menu-keeps-its-ticks-as-data
      const can = this.#canTick(boxes);
      this.#tree.all(this.#tree.allBox(can) !== 'on', can);
      this.#drawTicks();
    } else {
      const on = boxes.some((b) => !b.checked);
      for (const box of boxes) box.checked = on;
    }
    input.indeterminate = false;
    // Select all ON is ALL: rows that come later are ticked too. TRAP T-all-is-an-answer
    this.#all = this.values().length > 0;
    this.syncSelectAll();
  }

  /** What a reader's act says beyond its ticks. ALL: Select all on. A list left
   *  empty says nothing: it filters nothing (Will, TODO 550). TRAP T-all-is-an-answer */
  said(): { all?: true } {
    return this.#all ? { all: true } : {};
  }

  /** EVERY value ticked, on purpose — Select all on, or its host's answer. Will, TODO 489 */
  get all(): boolean {
    return this.#all;
  }
  set all(on: boolean) {
    this.#all = on;
    if (on) this.tickAll();
  }

  /** Tick every row Select all could — once there are rows; stamping ticks them after. */
  tickAll(): void {
    if (!this.#stamped) return;
    const boxes = this.inputs().filter((b) => !b.disabled);
    if (this.#tree) {
      this.#tree.all(true, this.#canTick(boxes));
      this.#drawTicks();
    } else {
      for (const box of boxes) box.checked = true;
    }
    this.syncSelectAll();
  }

  /** What Select all may tick: a value whose box is drawn and not refused. */
  #canTick(boxes: readonly HTMLInputElement[]): (value: string) => boolean {
    const open = new Set(boxes.map((b) => b.value));
    return (value) => open.has(value);
  }

  /** Point select-all at the set: all, some (indeterminate) or none. Rewritten
   * every time the set moves. TRAP T-indeterminate-is-a-property */
  syncSelectAll(): void {
    // A ticked value unticked may now be ruled out. TRAP T-a-ruled-out-value-is-greyed
    this.markPresent();
    this.#syncNone();
    const all = this.#allRow();
    if (!all) return;
    if (this.#tree) {
      const shows = this.#tree.allBox(this.#canTick(this.inputs().filter((b) => !b.disabled)));
      all.checked = shows === 'on';
      all.indeterminate = shows === 'some';
      return;
    }
    const boxes = this.inputs().filter((b) => !b.disabled || b.checked);
    const on = boxes.filter((b) => b.checked).length;
    all.checked = boxes.length > 0 && on === boxes.length;
    all.indeterminate = on > 0 && on < boxes.length;
  }

  /** None is ticked while nothing else is. */
  #syncNone(): void {
    const none = this.#host.own<HTMLInputElement>('.qf-none input')[0];
    if (none) none.checked = !this.inputs().some((i) => i.checked);
  }

  /** A row's box changed: `all` for Select all, `none` for None, `value` for a
   *  value row, null for no row of this list's. */
  change(event: Event): 'all' | 'none' | 'value' | null {
    const input = event.target as HTMLInputElement | null;
    if (!input || (input.type !== 'checkbox' && input.type !== 'radio')) return null;
    // A nested menu's row is ITS answer. TRAP T-a-nested-menu-answers-for-itself
    if (input.closest('sherpa-menu') !== this.#host.el) return null;
    // The SELECT-ALL row drives the others, so it reports for itself.
    if (input.closest('.qf-all')) {
      this.#selectAll(input);
      return 'all';
    }
    // NONE: its radio group has unticked the rest; the answer is nothing.
    if (input.closest('.qf-none')) {
      this.#all = false;
      this.#tree?.set([]);
      this.#drawTicks();
      this.markPresent();
      return 'none';
    }
    if (this.#tree) {
      if (input.type === 'radio') this.#tree.set([input.value]);
      else this.#tree.tick(input.value, input.checked);
      this.#drawTicks();
    }
    // One row changed: a list now, not ALL — unless every row is ticked again.
    this.#all = this.#all && this.inputs().every((b) => b.checked || b.disabled);
    this.syncSelectAll();
    return 'value';
  }

  /** A row let go that is ruled out is refused now — and goes, hiding them. TODO 462 */
  settle(): void {
    this.markPresent();
  }

  /** Untick every row. TRAP T-clear-empties-both-body-shapes */
  clear(): void {
    this.#all = false;
    for (const input of this.#host.own<HTMLInputElement>('input')) input.checked = false;
    this.#tree?.set([]);
    this.#drawTicks();
  }

  /** A single list's radios share its group name, so the browser enforces one. */
  nameRadios(): void {
    if (!this.#single()) return;
    for (const input of this.inputs()) {
      if (input.type === 'radio' && !input.name) input.name = this.#group;
    }
  }

  /* ── The search ── */

  /** Narrow rows to a typed substring; a hidden row keeps its tick.
   * TRAP T-menu-search-is-a-substring-find */
  search(typed: string): void {
    const q = typed.trim().toLowerCase();
    const hits = (label: string): boolean => !q || label.toLowerCase().includes(q);
    /* A TREE searches its DATA: a child that matches shows, its parent held open
       while the search stands; a parent that matches shows as it was. TODO 369 */
    const labelOf = new Map(this.#tree ? this.#items.map((item) => [item.value, item.label ?? item.value]) : []);
    if (this.#tree) {
      this.#searchOpen = new Set(q ? this.#items.flatMap((item) => (item.parent !== undefined && hits(item.label ?? item.value) ? [item.parent] : [])) : []);
      for (const parent of this.#searchOpen) this.#drawKids(parent);
      this.#drawOpen();
    }
    let shown = 0;
    // A SECTION heading shows while a row under it does — never on its own name.
    let heading: HTMLElement | null = null;
    let under = false;
    const close = (): void => { heading?.toggleAttribute('data-filtered-out', !under); };
    for (const row of this.rows()) {
      if (row.classList.contains('menu-section')) {
        close();
        heading = row;
        under = false;
        continue;
      }
      // A composed row draws its name in its own shadow root, so say it here.
      const text = row.getAttribute('data-label') ?? row.textContent ?? '';
      const value = this.#tree ? row.querySelector('input')?.value : undefined;
      const parent = row.dataset['parent'];
      const hit = value === undefined ? hits(text)
        : hits(labelOf.get(value) ?? text) || this.#searchOpen.has(value) || (parent !== undefined && hits(labelOf.get(parent) ?? ''));
      // JS writes the flag; CSS owns the hiding.
      row.toggleAttribute('data-filtered-out', !hit);
      if (hit) {
        shown += 1;
        under = true;
      }
    }
    close();
    this.#host.toggleState('no-matches', !!q && shown === 0);
  }

  /* ── Child menus and the tree's twisties, by pointer and by key ── */

  /** A tree parent's twisty opens or shuts it, and does NOT tick; a child menu's
   *  row opens it from anywhere but its tick box. True when the press was one of them.
   *  TRAP T-a-row-opens-its-child-menu */
  click(event: Event): boolean {
    const target = event.target as HTMLElement;
    const twisty = target.closest<HTMLElement>('.menu-row-twisty');
    if (twisty) {
      event.preventDefault();
      event.stopPropagation();
      const parent = twisty.dataset['value'] ?? '';
      this.#setOpen(parent, !this.#isOpen(parent));
      return true;
    }
    const row = target.closest<HTMLElement>('.menu-row[data-drill]');
    if (row && !target.closest('input')) {
      // preventDefault, or the label ticks its box as well.
      event.preventDefault();
      event.stopPropagation();
      this.#drillInto(row);
      return true;
    }
    return false;
  }

  /** Ask the host to open a row's child menu. */
  #drillInto(row: HTMLElement): void {
    clearTimeout(this.#hoverTimer);
    this.#hovered = null;
    this.#host.drill(row.dataset['value'] ?? '');
  }

  /** A pointer RESTING on a child menu's row opens it; one passing over does not —
   *  a quick pass once drilled the list away. TRAP T-a-row-opens-its-child-menu */
  hover = (event: PointerEvent): void => {
    const row = event.type === 'pointerleave' || event.pointerType === 'touch' ? null
      : (event.target as Element).closest<HTMLElement>('.menu-row[data-drill]');
    if (row === this.#hovered) return;
    clearTimeout(this.#hoverTimer);
    this.#hovered = row;
    if (!row) return;
    this.#hoverTimer = setTimeout(() => {
      if (this.#hovered === row && row.isConnected && this.#host.open()) this.#drillInto(row);
    }, HOVER_OPENS_AFTER);
  };

  /** ArrowRight opens a row's child menu, and ArrowLeft goes back, as in an OS
   *  menu; in a tree they open and shut a parent. True when the key was theirs. */
  key(event: KeyboardEvent): boolean {
    if (this.#treeKey(event)) return true;
    const row = (event.target as Element).closest<HTMLElement>('.menu-row[data-drill]');
    if (event.key === 'ArrowRight' && row) this.#drillInto(row);
    else if (event.key === 'ArrowLeft' && this.#host.el.hasAttribute('data-drill')) this.#host.back();
    else return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  /** In a tree, ArrowRight opens a parent, and ArrowLeft shuts it — from a child,
   *  its parent, which takes the focus. Was the key the tree's? */
  #treeKey(event: KeyboardEvent): boolean {
    if (!this.#tree || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return false;
    const row = (event.target as Element).closest<HTMLElement>('.menu-row[data-twisty], .menu-row[data-parent]');
    if (!row) return false;
    const open = event.key === 'ArrowRight';
    const parent = row.dataset['parent'];
    if (parent !== undefined) {
      if (open) return false;
      this.#setOpen(parent, false);
      this.#host.own<HTMLElement>('.menu-row[data-twisty]').find((r) => r.querySelector('input')?.value === parent)
        ?.querySelector('input')?.focus();
    } else this.#setOpen(row.querySelector('input')?.value ?? '', open);
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  /** Stop the hover timer. */
  stop(): void {
    clearTimeout(this.#hoverTimer);
  }
}
