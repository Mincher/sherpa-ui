/**
 * chip-section.ts — a SECTION, a field's whole answer in the flow as a portrait bar
 * draws it, and a field's values alone in a bar (`data-layout`): one value chip per
 * menu row, a tiered value's children in its own menu. The answer stays the menu's;
 * these only show it and pick through it. A module of sherpa-quick-filter, not an
 * element. TODO 425 · Plan 695 P5
 * TRAP T-a-parent-pick-is-the-parent · TRAP T-each-field-can-apply-on-its-own
 *
 * Map:
 * - SectionHost — What the section asks of its chip.
 * - ChipSection — A section's value chips, what is applied, and their counts.
 * - .lays — Its values are laid out as value chips: a section's, or its values alone.
 * - .sync — One value chip per menu row, ticked as the menu is.
 * - .inline — A section in Advanced draws its rows: its menu inline, not a card.
 * - .applied — Its applied answer while its field waits, null while it does not.
 * - .valueResults — Its value chips' own counts, by value.
 * - .kidsChange — A parent's Sites menu changed: those sites are its picks.
 * - .valuePress — A value chip was pressed: its row is picked through the menu.
 */
import { valueKey } from '../../core/data/store.js';
import type { FieldReading } from '../../core/data/filter-state.js';
import type { SherpaMenu } from '../sherpa-menu/sherpa-menu.js';
import type { ChipAnswer } from './chip-answer.js';
import type { ChipHost } from './chip-host.js';
import type { SherpaQuickFilter } from './sherpa-quick-filter.js';

/** What the section asks of its chip. */
export interface SectionHost extends ChipHost {
  /** Its answer. */
  readonly answer: ChipAnswer;
  /** Set or clear one of its own states. */
  toggleState(name: string, on?: boolean): void;
  /** A value a preset holds was pressed: the preset goes. */
  released(): void;
}

/** A section's value chips, what is applied, and their counts. */
export class ChipSection {
  /** Its chip. */
  readonly #host: SectionHost;
  /** What is applied of this field, as its host last said. */
  #applied: FieldReading | null = null;
  /** Each value's count, as its host last said. */
  #valueResults: Readonly<Record<string, number>> | null = null;

  constructor(host: SectionHost) {
    this.#host = host;
  }

  /** Its values are laid out as value chips: a section's, or its values alone. */
  lays(): boolean {
    const layout = this.#host.el.dataset['layout'];
    return layout === 'section' || layout === 'values';
  }

  /**
   * A SECTION's value chips: one per menu row — a tiered field's parents —
   * ticked as the menu is, a parent while it or a child is. The answer stays the
   * menu's; these only show it. TODO 425
   */
  sync(): void {
    const { el, answer } = this.#host;
    const menu = answer.menu();
    // Its menu's rows lead with the swatches its value chips carry. Will, TODO 677
    menu?.toggleAttribute('data-swatches', this.lays());
    // A section's values, or its values alone — a chart's legend in a bar. Will, TODO 670
    const items = this.lays() && menu && !menu.dataset['body'] ? menu.itemData ?? [] : [];
    const tops = items.filter((i) => i.parent === undefined);
    const mine = new Map([...el.querySelectorAll<HTMLElement>(':scope > .value')].map((c) => [c.dataset['value'] ?? '', c]));
    const picked = new Set(menu?.values ?? []);
    // What is APPLIED, told while the field waits: only a value its draft changed reads as pending. TODO 425
    const waiting = this.#applied != null;
    const was = new Set((this.#applied && !this.#applied.suspended ? this.#applied.picked ?? [] : []).map(valueKey));
    for (const item of tops) {
      const one = mine.get(item.value) ?? this.#host.clone('template.value-chip-tpl');
      if (!one) return;
      mine.delete(item.value);
      one.dataset['value'] = item.value;
      one.dataset['id'] = el.dataset['id'] ?? '';
      one.setAttribute('data-label', item.label);
      // A chart's value leads with its series' swatch, as its legend does.
      if (item.swatch) one.dataset['swatch'] = String(item.swatch);
      const kids = [item.value, ...items.filter((k) => k.parent === item.value).map((k) => k.value)];
      // Blue where a preset on touches it. Will, TODOs 521, 590
      const by = answer.heldBy(item.value);
      one.toggleAttribute('data-current', !!by || kids.some((k) => picked.has(k)));
      one.toggleAttribute('data-by-preset', !!by);
      if (by) one.dataset['byPreset'] = by;
      // The rest of a field a preset holds are refused too. Will, TODO 601
      if (answer.presets.length && !by) one.dataset['heldOut'] = answer.presets.map((p) => p.label).join(', ');
      else delete one.dataset['heldOut'];
      one.toggleAttribute('data-pending', waiting && kids.some((k) => picked.has(k) !== was.has(k)));
      (one as SherpaQuickFilter).results = this.#valueResults?.[item.value] ?? null;
      this.#kids(one, item.value, items, picked);
      // In the menu's order: appending one already here moves it.
      el.append(one);
    }
    for (const gone of mine.values()) gone.remove();
    // A value of it waits: said on the section itself. TRAP T-each-field-can-apply-on-its-own
    this.#host.toggleState('values-pending', !!el.querySelector(':scope > .value[data-pending]'));
  }

  /** A SECTION in Advanced draws its rows: its menu inline, not a card, answered
   *  or not. Will, TODO 455. TRAP T-an-inline-menu-is-the-same-menu */
  inline(): void {
    const { el } = this.#host;
    const menu = el.menu;
    const inline = el.dataset['layout'] === 'section' && menu?.mode === 'advanced';
    menu?.toggleAttribute('data-inline', inline);
    this.#host.toggleState('inline-rows', inline);
  }

  /** A SECTION's applied answer while its field waits, null while it does not:
   *  its host says it. TODO 425 */
  get applied(): FieldReading | null {
    return this.#applied;
  }
  set applied(reading: FieldReading | null) {
    this.#applied = reading;
    this.sync();
  }

  /** A SECTION's value chips' own counts, by value: its host says them. TODO 425 */
  get valueResults(): Readonly<Record<string, number>> | null {
    return this.#valueResults;
  }
  set valueResults(results: Readonly<Record<string, number>> | null) {
    this.#valueResults = results;
    /* A chip's own menu draws them on its rows; a section's are its value chips. Its
       values alone draw both: folded, its menu stands for its value chips. TODOs 466, 677 */
    this.#host.el.menu?.setMatches?.(this.#host.el.dataset['layout'] === 'section' ? null : results);
    this.sync();
  }

  /** A TIERED value's chip is a field chip of its own: its menu is the parent's
   *  children, ticked from the field's picks — all of them while the parent is
   *  picked whole. TODO 425 · TRAP T-a-parent-pick-is-the-parent */
  #kids(one: HTMLElement, parent: string, items: ReadonlyArray<{ value: string; label: string; parent?: string }>, picked: ReadonlySet<string>): void {
    const kids = items.filter((k) => k.parent === parent);
    let menu = one.querySelector<SherpaMenu>(':scope > sherpa-menu.kids');
    if (!kids.length) {
      menu?.remove();
      one.removeAttribute('data-menu');
      return;
    }
    if (!menu) {
      menu = this.#host.clone<SherpaMenu>('template.kids-menu-tpl');
      if (!menu) return;
      menu.setAttribute('data-heading', items.find((i) => i.value === parent)?.label ?? parent);
      one.append(menu);
      one.setAttribute('data-menu', '');
    }
    menu.toggleAttribute('data-readonly', this.#host.answer.presets.length > 0);
    const whole = picked.has(parent);
    const given = kids.map((k) => ({ value: k.value, label: k.label, selected: whole || picked.has(k.value) }));
    // The same list does nothing: a new one would close what the reader has open.
    const key = JSON.stringify(given);
    if (menu.dataset['given'] === key) return;
    menu.dataset['given'] = key;
    menu.items(given);
  }

  /** A parent's Sites menu changed: those sites are its picks — the parent
   *  itself while every one is ticked — picked through the field's menu. TODO 425 */
  kidsChange = (event: Event): void => {
    const kidsMenu = event.target as HTMLElement;
    const one = kidsMenu.parentElement;
    if (!kidsMenu.classList?.contains('kids') || one?.parentElement !== this.#host.el) return;
    event.stopPropagation();
    const menu = this.#host.answer.menu();
    if (!menu) return;
    const parent = one.dataset['value'] ?? '';
    const kids = (menu.itemData ?? []).filter((i) => i.parent === parent).map((i) => i.value);
    const want = new Set(((event as CustomEvent).detail?.values ?? []) as string[]);
    const mine = new Set([parent, ...kids]);
    const rest = menu.values.filter((v) => !mine.has(v));
    menu.values = kids.length && kids.every((k) => want.has(k)) ? [...rest, parent] : [...rest, ...kids.filter((k) => want.has(k))];
    menu.apply();
  };

  /** A value chip was pressed: pick its row — a parent with its children — as a
   *  reader would, through the menu, Apply too. TODO 425 */
  valuePress = (event: Event): void => {
    const { el, answer } = this.#host;
    const one = event.target as HTMLElement;
    if (one === el || one.parentElement !== el || !one.classList.contains('value')) return;
    event.stopPropagation();
    // A preset holds it: toggled off, its conditions no longer stand, so the preset goes. Will, TODO 592
    if (one.hasAttribute('data-by-preset')) {
      this.#host.released();
      return;
    }
    // …and the rest of its field refuse. Will, TODO 601
    if (one.hasAttribute('data-held-out')) return;
    // Inactive is not interactive. TRAP T-a-ruled-out-value-is-greyed
    const menu = answer.menu();
    // …but one still ON may be let go. TODO 462
    if (!menu || (one.hasAttribute('data-unavailable') && !one.hasAttribute('data-current'))) return;
    const value = one.dataset['value'] ?? '';
    const kids = (menu.itemData ?? []).filter((i) => i.parent === value).map((i) => i.value);
    const mine = new Set([value, ...kids]);
    const rest = menu.values.filter((v) => !mine.has(v));
    const held = menu.values.filter((v) => mine.has(v));
    if (kids.length && held.length) {
      // A PARENT on goes OFF, and keeps its picks. Will, TODO 369 · TRAP T-a-parent-pick-is-the-parent
      for (const v of held) answer.off.add(v);
      menu.values = rest;
    } else if (kids.length && [...mine].some((k) => answer.off.has(k))) {
      // …and off comes back on, with them.
      const back = [...mine].filter((k) => answer.off.delete(k));
      menu.values = [...rest, ...back];
    } else {
      const on = !held.length;
      menu.values = menu.dataset['select'] === 'single' ? (on ? [value] : []) : on ? [...rest, value] : rest;
    }
    menu.apply();
  };
}
