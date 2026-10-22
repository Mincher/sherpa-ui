/**
 * filter-field.ts — ONE drawn filter field, whatever draws it: its chips, its
 * menu, and its answer in and out. A host keeps a Map of these, so a field's
 * logic is written once, not once per host. TODO 424 · TRAP T-a-field-is-one-object
 *
 * Map:
 * - FieldTiers — A tiered field's picks, those kept off, and each parent's children.
 * - FilterField — One drawn field: its chips, its menu, and its answer, in and out.
 * - .menu — The menu built for it, where it needs one.
 * - .tiers — A TIERED field's picks; its chips are its parents.
 * - .none — Its last value let go by the reader, where picks fetch: no rows.
 * - .chips — Every chip that draws it: a run's values, a tiered field's parents, or its one chip.
 * - .oneChip — The ONE chip a whole field is drawn as — Group, Sort, a date, a long list — or null.
 * - .answerChip — The one chip that ANSWERS it, and so reads, draws and empties itself: not Group or Sort.
 * - .chipIn — The chip for one of its values.
 * - .menus — Its menus: its own, and each tiered parent's children's.
 * - .picked — The values ticked.
 * - .reading — Its whole answer: the chips are Simple's, the menu's rows Advanced's.
 * - .draw — Draw a told answer.
 * - .press — A reader's press on one of its chips: a parent flips, a single pick sweeps, the last let go is none.
 * - .takeKids — A parent's children menu applied.
 * - .paintTiers — Draw each parent chip: ON while it, or a child of it, is picked.
 * - .empty — Empty it, whatever answers it.
 * - .changed — Its chips whose tick differs from the answer applied: only those read as pending.
 * - .answered — Has it an answer: a chip ticked, a row, or none.
 */
import { modeOf, type ConditionType, type FieldReading } from '../data/filter-state.js';
import { valueKey } from '../data/store.js';
import type { FilterDef } from './filter-def.js';
import { arranges, kindOf, picksOne } from './filter-kind.js';
import type { SherpaMenu } from '../../components/sherpa-menu/sherpa-menu.js';
import type { SherpaQuickFilter } from '../../components/sherpa-quick-filter/sherpa-quick-filter.js';

/** A tiered field's picks, those kept off, and each parent's children. TODO 369 */
export interface FieldTiers {
  picks: Set<string>;
  off: Set<string>;
  kids: Map<string, string[]>;
}

/** One drawn field: its chips, its menu, and its answer, in and out. Each chip
 *  it draws says its field in `data-id`. */
export class FilterField {
  /** The menu built for it, where it needs one. */
  menu?: SherpaMenu;
  /** A TIERED field's picks; its chips are its parents. TRAP T-a-parent-pick-is-the-parent */
  tiers?: FieldTiers;
  /** Its last value let go by the reader, where picks fetch: no rows. TRAP T-none-is-an-answer */
  none = false;

  constructor(public readonly def: FilterDef, public readonly scope: string, public readonly box: HTMLElement, public readonly values: HTMLElement) {}

  chips(): SherpaQuickFilter[] {
    return [...this.values.querySelectorAll<SherpaQuickFilter>(`.value[data-id="${CSS.escape(this.def.id)}"]`)];
  }

  oneChip(): SherpaQuickFilter | null {
    if (!arranges(kindOf(this.def)) && !this.def.asChip) return null;
    return this.chipIn(this.def.id);
  }

  /** TRAP T-a-chip-says-its-own-answer */
  answerChip(): SherpaQuickFilter | null {
    return arranges(kindOf(this.def)) ? null : this.oneChip();
  }

  chipIn(value: string): SherpaQuickFilter | null {
    return this.chips().find((c) => c.dataset['value'] === value) ?? null;
  }

  menus(): Array<SherpaMenu | undefined> {
    return [this.menu, ...this.chips().flatMap((c) => [...c.querySelectorAll<SherpaMenu>(':scope > sherpa-menu[data-kids]')])];
  }

  picked(): string[] {
    if (this.tiers) return [...this.tiers.picks];
    if (this.answerChip() && this.menu?.dataset['body'] !== 'date') return [...this.menu?.values ?? []];
    return this.chips().filter((c) => c.hasAttribute('data-current')).map((c) => c.dataset['value'] ?? '').filter(Boolean);
  }

  /** TRAP T-both-answers-are-kept */
  reading(): FieldReading {
    const none = this.none ? { none: true } : {};
    const tiers = this.tiers;
    if (tiers) return { picked: [...tiers.picks], ...(tiers.off.size ? { off: [...tiers.off] } : {}), ...(tiers.picks.size ? {} : none) };
    const menu = this.menu;
    // A NUMBER body answers for itself, as it does on a bar chip.
    if (menu?.dataset['body'] === 'number') return menu.reading;
    /* A DATE, or a long list: its ONE chip answers, OFF keeping its answer.
       TRAP T-a-panel-date-answers-with-its-days · TRAP T-only-group-and-sort-stay-one-chip */
    const one = this.answerChip();
    if (one) return one.reading ?? menu?.reading ?? {};
    const picked = this.picked();
    return { ...menu?.reading, picked, ...(picked.length ? {} : none) };
  }

  /**
   * Draw a told answer. A run has no OFF: a suspended answer is drawn as none
   * (TRAP T-a-suspended-answer-is-drawn-as-off); one chip keeps its own. `mode`
   * is told the mode a reading names, before the menu takes it — the host may
   * build the menu then. Gives false for Group or Sort: no reading draws them.
   * TRAP T-an-open-panel-follows-the-data-layer
   */
  draw(given: FieldReading, mode?: (advanced: boolean) => void): boolean {
    const reading: FieldReading = given.suspended ? { picked: [] } : given;
    if (this.tiers) {
      this.tiers.picks = new Set((reading.picked ?? []).map(valueKey));
      this.tiers.off = new Set((given.off ?? []).map(valueKey));
      this.none = !!reading.none && !this.tiers.picks.size;
      this.paintTiers();
      return true;
    }
    if (this.oneChip()) {
      const chip = this.answerChip();
      if (!chip) return false;
      chip.reading = given;
      return true;
    }
    if (this.menu?.dataset['body'] === 'number') {
      this.menu.reading = reading;
      return true;
    }
    // BOTH answers: the chips, then the rows — and the mode only where the reading names one.
    const want = new Set((reading.picked ?? []).map(valueKey));
    this.none = !!reading.none && !want.size;
    for (const chip of this.chips()) chip.toggleAttribute('data-current', want.has(chip.dataset['value'] ?? ''));
    const named: ConditionType | undefined = modeOf(reading);
    if (named) mode?.(named === 'advanced');
    if (this.menu) this.menu.reading = { ...reading, picked: [...want] };
    return true;
  }

  /** `fetches`: its picks fetch, so the last let go is none. Will, TODO 369, 403.
   *  TRAP T-a-section-heading-is-not-a-field */
  press(chip: SherpaQuickFilter, fetches: boolean): void {
    const t = this.tiers;
    if (t) {
      // On goes OFF and keeps its picks; off comes back on; with none, the parent is picked whole.
      const p = chip.dataset['value'] ?? '';
      const mine = [p, ...t.kids.get(p) ?? []];
      if (mine.some((k) => t.picks.has(k))) for (const k of mine) { if (t.picks.delete(k)) t.off.add(k); }
      else if (mine.some((k) => t.off.has(k))) for (const k of mine) { if (t.off.delete(k)) t.picks.add(k); }
      else t.picks.add(p);
      this.none = fetches && !t.picks.size;
      this.paintTiers();
      return;
    }
    // ONE of THIS field's values: a section can hold two fields.
    if (picksOne(kindOf(this.def))) for (const other of this.chips()) if (other !== chip) other.removeAttribute('data-current');
    this.none = fetches && !this.picked().length;
  }

  /** These children are the parent's picks — the parent itself only while it
   *  stays whole. TRAP T-a-parent-pick-is-the-parent */
  takeKids(p: string, values: readonly string[]): void {
    const t = this.tiers;
    if (!t) return;
    const kids = t.kids.get(p) ?? [];
    const want = new Set(values);
    const whole = t.picks.has(p) && kids.every((k) => want.has(k));
    for (const k of [p, ...kids]) {
      t.off.delete(k);
      if (!whole) t.picks.delete(k);
    }
    if (!whole) for (const k of kids) if (want.has(k)) t.picks.add(k);
    this.paintTiers();
  }

  paintTiers(): void {
    const t = this.tiers;
    if (!t) return;
    for (const chip of this.chips()) {
      const p = chip.dataset['value'] ?? '';
      chip.toggleAttribute('data-current', [p, ...t.kids.get(p) ?? []].some((k) => t.picks.has(k)));
    }
  }

  /** Its value chips, its menu's rows, number or days. TRAP T-empty-is-every-kind-of-answer */
  empty(): void {
    this.none = false;
    if (this.tiers) {
      this.tiers.picks.clear();
      this.tiers.off.clear();
      this.paintTiers();
      return;
    }
    const one = this.answerChip();
    if (one) return one.clear();
    // Each chip clears itself — a Group or Sort chip its column and way.
    for (const chip of this.chips()) chip.clear();
    if (this.menu && !arranges(kindOf(this.def))) this.menu.reading = { picked: [] };
  }

  /** ONE chip is the whole field; a run's or a tiered field's chip changed when
   *  its value — or a child of its — is ticked now and was not applied, or the
   *  other way. Will, TODO 424 */
  changed(applied: FieldReading | undefined): Set<SherpaQuickFilter> {
    const chips = this.chips();
    if (this.oneChip()) return new Set(chips);
    const was = new Set((applied && !applied.suspended ? applied.picked ?? [] : []).map(valueKey));
    const t = this.tiers;
    const now = new Set(t ? t.picks : this.picked());
    return new Set(chips.filter((chip) => {
      const v = chip.dataset['value'] ?? '';
      return [v, ...t?.kids.get(v) ?? []].some((k) => now.has(k) !== was.has(k));
    }));
  }

  get answered(): boolean {
    const advanced = this.box.hasAttribute('data-advanced') && (this.menu?.conditions?.length ?? 0) > 0;
    return this.chips().some((c) => c.hasAttribute('data-current')) || advanced || this.none;
  }
}
