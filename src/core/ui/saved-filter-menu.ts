/**
 * saved-filter-menu.ts — a saved filter's card: each field's OWN menu, read-only, edited in place.
 * TRAP T-a-saved-chip-lists-its-conditions
 * TRAP T-a-saved-filter-keeps-its-edit
 *
 * Map:
 * - SavedAnswer — a saved filter's answer as its card draws it
 * - SavedMenuHost — what a bar or panel lends the card: a unit to fill, its defs, where a change goes
 * - drawSavedMenu — draw a saved filter's fields into its card, or update them in place
 * - editSavedMenu — Edit filter: the card's field menus take changes
 * - endSavedEdit — editing ends: keep the change as ONE edit, or put the saved answer back
 */

import { sayReadings, type SaidField } from '../data/filter-face.js';
import {
  fieldState, readingRows, savedReading, type FieldFacts, type FieldReading,
} from '../data/filter-state.js';
import { report } from '../data/report.js';
import { advancedOf, kindOf, type FilterKind } from './filter-kind.js';
import { menuFor, type FilterMenuDef, type FilterMenuItem } from './filter-menu.js';

/** A saved filter's answer as its card draws it. */
export interface SavedAnswer {
  readings: Readonly<Record<string, FieldReading>>;
  /** The change it applies now, not yet saved. */
  edited?: Readonly<Record<string, FieldReading>> | undefined;
  /** Its conditions in words, as its source says them. */
  says?: readonly SaidField[] | undefined;
}

/** What a bar or panel lends the card. */
export interface SavedMenuHost {
  /** A fresh `<div>` holding `p.menu-section`, `div.saved-field` and `p.menu-line`. */
  unit(): HTMLElement | null;
  /** The field's own filter def; none keeps the field as words. */
  defOf(field: string): FilterMenuDef | undefined;
  /** The change, once editing ends. */
  edit(readings: Record<string, FieldReading>): void;
  bounds?: string | undefined;
}

type FieldMenu = HTMLElement & { reading: FieldReading; items(next: readonly FilterMenuItem[]): void };

interface Card {
  saved: SavedAnswer;
  host: SavedMenuHost;
  /** Each field as last drawn, so an unchanged one is left alone. */
  drawn: Map<string, string>;
  /** Each field menu's reading when Edit filter was pressed; null while read-only. */
  start: Map<string, string> | null;
}

const cards = new WeakMap<HTMLElement, Card>();

/** Every event a field menu, or a part inside it, sends. None is the card's. */
const FIELD_EVENTS = [
  'menu-change', 'menu-apply', 'menu-cancel', 'menu-clear', 'menu-select', 'menu-open', 'menu-close',
  'menu-items', 'menu-drill', 'menu-back', 'menu-range-change', 'condition-change', 'filter-mode-change',
  'datetime-change', 'range-select', 'calendar-apply', 'calendar-cancel', 'find-step', 'find-replace',
  'button-click', 'breadcrumb-select', 'selection-scenario', 'input', 'change',
] as const;

const stop = (event: Event): void => event.stopPropagation();

/** The card's field menus. */
function fieldMenus(menu: HTMLElement): FieldMenu[] {
  return [...menu.querySelectorAll<FieldMenu>(':scope > .saved-field > sherpa-menu')];
}

/** A field this card can draw as a menu: not on/off, not a selector. */
function drawable(def: FilterMenuDef | undefined): def is FilterMenuDef {
  return !!def && !def.persistent && kindOf(def) !== 'boolean';
}

/** How a field's answer is shown: on its rows. A Simple answer is its picks, as OR'd rows. */
function shown(answer: FieldReading, kind: FilterKind): FieldReading {
  if (kind === 'date') return answer;
  const rows = readingRows(answer);
  if (answer.mode !== 'simple' && rows.length) return { ...answer, conditions: rows, mode: 'advanced', mirror: false };
  // A number's mode turns its body into rows. TRAP T-a-number-has-advanced-rows
  const { conditions: _rows, ...simple } = answer;
  if (kind === 'number') return { ...simple, mode: 'advanced' };
  return { picked: answer.picked ?? [], mode: 'advanced', mirror: true };
}

/** What the data layer knows of a field from its def: its label, its type, its values. */
function factsOf(def: FilterMenuDef | undefined): Omit<FieldFacts, 'field'> {
  const kind = def ? kindOf(def) : null;
  return {
    ...(def?.label ? { label: def.label } : {}),
    ...(kind === 'number' || kind === 'date' ? { type: kind } : {}),
    ...(def?.options?.length ? {
      values: def.options.map((o) => o.value),
      labels: Object.fromEntries(def.options.map((o) => [o.value, o.label ?? o.value])),
    } : {}),
  };
}

/** A field's conditions in words: its source's, or worded from its def. */
function wordsOf(saved: SavedAnswer, field: string, answer: FieldReading, def: FilterMenuDef | undefined): SaidField | undefined {
  // The source's words are for what was SAVED.
  if (!saved.edited) {
    const said = saved.says?.find((s) => s.field === field);
    if (said) return said;
  }
  return sayReadings({ [field]: answer }, () => factsOf(def))[0];
}

/** The readings with ONE field's answer changed — in their own order, so a
 *  change put back compares equal. No answer drops the field. */
function withAnswer(
  readings: Readonly<Record<string, FieldReading>>,
  field: string,
  def: FilterMenuDef | undefined,
  answer: FieldReading,
): Record<string, FieldReading> {
  const kept = savedReading(fieldState({ field, ...factsOf(def) }, answer));
  const next = Object.fromEntries(Object.entries(readings)
    .flatMap(([f, r]): [string, FieldReading][] => (f !== field ? [[f, r]] : kept ? [[f, kept]] : [])));
  if (kept && !(field in readings)) next[field] = kept;
  return next;
}

/** Build one field's nodes: its heading, then its menu or its words. */
function fieldNodes(card: Card, field: string, answer: FieldReading, def: FilterMenuDef | undefined, said: SaidField | undefined): Element[] {
  const unit = card.host.unit();
  if (!unit) return [];
  const label = def?.label ?? said?.label ?? field;
  const words = said?.lines ?? [];
  unit.querySelector('.menu-section')!.textContent = label;
  const group = unit.querySelector<HTMLElement>('.saved-field')!;
  const line = unit.querySelector<HTMLElement>('.menu-line')!;
  if (drawable(def)) {
    line.remove();
    // Its rows are inert while read-only, so the group says them. TRAP T-a-saved-chip-lists-its-conditions
    group.setAttribute('aria-label', label);
    if (words.length) group.setAttribute('aria-description', words.join(', '));
    for (const type of FIELD_EVENTS) group.addEventListener(type, stop);
    // ONE DEF, ONE MENU — the field's own, on its rows. TRAP T-one-field-one-filter-menu
    const built = menuFor(
      { ...def, advanced: advancedOf(def) === 'only' ? 'only' : true, commit: false, selectAll: false },
      { inline: true, remote: false, bounds: card.host.bounds },
    );
    const own = built.menu as FieldMenu;
    // TRAP T-an-inline-menu-is-the-same-menu
    own.removeAttribute('slot');
    own.setAttribute('data-readonly', '');
    own.dataset['field'] = field;
    group.append(own);
    // Both wait for the menu to draw. TRAP T-custom-element-upgrade
    if (built.items.length) own.items(built.items);
    own.reading = shown(answer, built.kind);
  } else {
    group.remove();
    for (const said of words) {
      const each = line.cloneNode() as HTMLElement;
      each.textContent = said;
      unit.append(each);
    }
    line.remove();
  }
  const nodes = [...unit.children];
  for (const node of nodes) node.setAttribute('data-field', field);
  return nodes;
}

/**
 * Draw a saved filter's fields into its card, before its action rows. An
 * unchanged field is left as it is, so an open card is never shut. While the
 * reader edits, the draft wins. Returns how many fields it holds.
 */
export function drawSavedMenu(menu: HTMLElement, saved: SavedAnswer, host: SavedMenuHost): number {
  let card = cards.get(menu);
  if (!card) {
    card = { saved, host, drawn: new Map(), start: null };
    cards.set(menu, card);
    // A close KEEPS the change: there is no Apply. TRAP T-a-saved-filter-keeps-its-edit
    menu.addEventListener('menu-close', () => endSavedEdit(menu, 'keep'));
  }
  card.saved = saved;
  card.host = host;
  const answers = saved.edited ?? saved.readings;
  const fields = Object.keys(answers);
  if (card.start) return fields.length;

  const nodesOf = (field: string): Element[] =>
    [...menu.querySelectorAll(`:scope > [data-field="${CSS.escape(field)}"]`)];
  for (const field of card.drawn.keys()) {
    if (field in answers) continue;
    for (const node of nodesOf(field)) node.remove();
    card.drawn.delete(field);
  }
  // Last field first, so each goes in before the one after it.
  let anchor: Element | null = menu.querySelector(':scope > hr, :scope > button');
  for (const field of [...fields].reverse()) {
    const answer = answers[field]!;
    const def = card.host.defOf(field);
    const said = wordsOf(saved, field, answer, def);
    const key = JSON.stringify([answer, def?.label, drawable(def) && kindOf(def), said]);
    if (card.drawn.get(field) !== key) {
      for (const node of nodesOf(field)) node.remove();
      for (const node of fieldNodes(card, field, answer, def, said)) menu.insertBefore(node, anchor);
      card.drawn.set(field, key);
    }
    anchor = nodesOf(field)[0] ?? anchor;
  }
  return fields.length;
}

/** Edit filter: the card's field menus take changes. A field it has no menu for stays words. */
export function editSavedMenu(menu: HTMLElement): void {
  const card = cards.get(menu);
  if (!card || card.start) return;
  const menus = fieldMenus(menu);
  card.start = new Map(menus.map((m) => [m.dataset['field'] ?? '', JSON.stringify(m.reading)]));
  for (const m of menus) m.removeAttribute('data-readonly');
  menu.setAttribute('data-editing', '');
  const words = new Set([...menu.querySelectorAll<HTMLElement>(':scope > .menu-line[data-field]')]
    .map((line) => line.dataset['field'] ?? ''));
  // TRAP T-a-broken-assumption-reports
  for (const field of words) {
    report({
      code: 'unknown-filter',
      message: 'A saved filter names a field this control cannot draw, so that field cannot be changed here.',
      at: { field },
    });
  }
}

/**
 * Editing ends. `keep` sends what changed as ONE edit, the fields that moved
 * folded into the answer it applies now; `discard` puts the saved answer
 * back. Returns the edit, or null when nothing changed.
 */
export function endSavedEdit(menu: HTMLElement, how: 'keep' | 'discard'): Record<string, FieldReading> | null {
  const card = cards.get(menu);
  if (!card) return null;
  const start = card.start;
  card.start = null;
  menu.removeAttribute('data-editing');
  const menus = fieldMenus(menu);
  for (const m of menus) m.setAttribute('data-readonly', '');
  if (how === 'discard') {
    card.drawn.clear();
    drawSavedMenu(menu, { readings: card.saved.readings, says: card.saved.says }, card.host);
    return null;
  }
  if (!start) return null;
  const changed = menus.filter((m) => JSON.stringify(m.reading) !== start.get(m.dataset['field'] ?? ''));
  if (!changed.length) return null;
  let next: Record<string, FieldReading> = { ...(card.saved.edited ?? card.saved.readings) };
  for (const m of changed) {
    const field = m.dataset['field'] ?? '';
    next = withAnswer(next, field, card.host.defOf(field), m.reading);
  }
  card.saved = { ...card.saved, edited: next };
  card.host.edit(next);
  return next;
}
