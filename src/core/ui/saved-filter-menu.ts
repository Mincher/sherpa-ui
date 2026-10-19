/**
 * saved-filter-menu.ts — a saved filter's card: each field's OWN menu, read-only.
 * TRAP T-a-saved-chip-lists-its-conditions
 *
 * Map:
 * - SavedAnswer — a saved filter's answer as its card draws it
 * - SavedMenuHost — what a bar or panel lends the card: a unit to fill, and its defs
 * - drawSavedMenu — draw a saved filter's fields into its card, or update them in place
 * - hangSavedMenu — Hang a saved filter's card on its chip, headed by the filter's name, and draw it.
 */

import { sayReadings, type SaidField } from '../data/filter-face.js';
import { readingRows, type FieldFacts, type FieldReading } from '../data/filter-state.js';
import { advancedOf, kindOf, type FilterKind } from './filter-kind.js';
import { menuFor, type FilterMenuDef } from './filter-menu.js';

/** A saved filter's answer as its card draws it. */
export interface SavedAnswer {
  readings: Readonly<Record<string, FieldReading>>;
  /** Its conditions in words, as its source says them. */
  says?: readonly SaidField[] | undefined;
}

/** What a bar or panel lends the card. */
export interface SavedMenuHost {
  /** The host's shadow root, which holds the menu prototype. TRAP T-a-family-shares-markup */
  root: ParentNode;
  /** A fresh `<div>` holding `p.menu-section`, `div.saved-field` and `p.menu-line`. */
  unit(): HTMLElement | null;
  /** The field's own filter def; none keeps the field as words. */
  defOf(field: string): FilterMenuDef | undefined;
  bounds?: string | undefined;
}

interface Card {
  saved: SavedAnswer;
  host: SavedMenuHost;
  /** Each field as last drawn, so an unchanged one is left alone. */
  drawn: Map<string, string>;
}

const cards = new WeakMap<HTMLElement, Card>();

/** Every event a field menu, or a part inside it, sends. None is the card's. */
const FIELD_EVENTS = [
  'menu-change', 'menu-apply', 'menu-cancel', 'menu-clear', 'menu-select', 'menu-open', 'menu-close',
  'menu-items', 'menu-drill', 'menu-back', 'menu-range-change', 'condition-change', 'condition-mode-change',
  'datetime-change', 'range-select', 'calendar-apply', 'calendar-cancel', 'find-step', 'find-replace',
  'button-click', 'breadcrumb-select', 'selection-scenario', 'input', 'change',
] as const;

const stop = (event: Event): void => event.stopPropagation();

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
  const said = saved.says?.find((s) => s.field === field);
  if (said) return said;
  return sayReadings({ [field]: answer }, () => factsOf(def))[0];
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
    // A number is always given rows: 'only' is a list's word.
    const only = advancedOf(def) === 'only' && kindOf(def) !== 'number';
    const built = menuFor(
      card.host.root,
      { ...def, advanced: only ? 'only' : true, commit: false, selectAll: false },
      { inline: true, remote: false, bounds: card.host.bounds },
    );
    const own = built.menu;
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
 * unchanged field is left as it is, so an open card is never shut. Returns
 * how many fields it holds.
 */
export function drawSavedMenu(menu: HTMLElement, saved: SavedAnswer, host: SavedMenuHost): number {
  let card = cards.get(menu);
  if (!card) {
    card = { saved, host, drawn: new Map() };
    cards.set(menu, card);
  }
  card.saved = saved;
  card.host = host;
  const answers = saved.readings;
  const fields = Object.keys(answers);

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

/** Hang a saved filter's card on its chip, headed by the filter's name, and draw it. */
export function hangSavedMenu(chip: HTMLElement, menu: HTMLElement, label: string, saved: SavedAnswer, host: SavedMenuHost): void {
  menu.setAttribute('data-heading', label);
  chip.setAttribute('data-menu', '');
  chip.appendChild(menu);
  drawSavedMenu(menu, saved, host);
}
