/**
 * chip-answer.ts — a FIELD's answer, as a chip's menu holds it: read off, written in,
 * held by the presets on, and read as one state. A bar chip's, a section's and a grid
 * heading's alike. A module of sherpa-quick-filter, not an element. Plan 695 P5
 * TRAP T-a-chip-says-its-own-answer · TRAP T-one-state-per-filtered-field
 *
 * Map:
 * - ChipAnswer — One chip's answer: its menu's, what its presets hold, and what is kept off.
 * - .off — Picks a tiered parent switched OFF keeps, by key.
 * - .all — ALL was asked: every value its menu has, and every one that comes.
 * - .menu — The menu that answers a FIELD, or null: a toggle, a selector, Group, Sort.
 * - .reading — Its whole answer as the menu holds it, `suspended` while the chip is off.
 * - .take — The reader's own answer, into the menu: both modes, each body by its own door.
 * - .setValues — Set the picks, silently, and read them back.
 * - .answers — Does it hold an answer, over these picks?
 * - .hasTypedAnswer — Is its menu on a typing condition with something typed?
 * - .orDefault — A date with no day reads its default, Today.
 * - .hold — What the presets on hold of this field: said, and its menu shows them.
 * - .presets — Each preset on that holds this field: its name, scope and tree.
 * - .presetsOff — The requests that turn each of them off.
 * - .heldBy — The presets on whose trees touch a value, by name; none, ''.
 * - .presetSaid — What the presets on hold, in words.
 * - .forget — Its picks kept off, its ALL and its presets let go.
 * - .empty — Empty its menu, whatever answers it, and switch it off.
 * - .name — The field's name, remembered before a pick rewrites the visible label.
 * - .state — Its state, read off its menu, into the shared model.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import {
  DEFAULT_OP, OP_TAKES, conditionLeaves, groupOf, joinConditions, valueKey,
  type Condition, type FilterOp,
} from '../../core/data/store.js';
import {
  answeredCondition, fieldState, modeOf, presetTouches, type FieldReading, type FilterState,
} from '../../core/data/filter-state.js';
import { spellConditions } from '../../core/data/filter-face.js';
import { NON_VALUE_ROWS, heldByPreset } from '../../core/ui/shared-constants.js';
import { today } from '../../core/ui/temporal.js';
import type { SherpaMenu } from '../sherpa-menu/sherpa-menu.js';
import type { ChipHost } from './chip-host.js';

/** What each preset on holds of this field, by its id. */
type Held = NonNullable<FieldReading['byPreset']>;

/** One chip's answer: its menu's, what its presets hold, and what is kept off. */
export class ChipAnswer {
  /** Its chip. */
  readonly #host: ChipHost;
  /** Picks a tiered parent switched OFF keeps for when it comes back on, by key. */
  readonly off = new Set<string>();
  /** ALL was asked — Select all on, or drawn so: ON with every value ticked. Will, TODO 489 */
  all = false;
  /** What each preset on holds of this field, by its id. */
  #held: Held = {};
  /** …and as a list: its name, its scope and its tree. */
  #presets: Held[string][] = [];
  /** The field name, remembered before a pick rewrites the visible label. */
  #field: string | null = null;

  constructor(host: ChipHost) {
    this.#host = host;
  }

  /** The menu that answers a FIELD, or null: a toggle, a selector, Group, Sort. */
  menu(): SherpaMenu | null {
    const menu = this.#host.el.menu;
    const body = menu?.dataset['body'];
    return menu && (body === 'number' || body === 'date' || menu.getAttribute('data-type') === 'filter')
      ? menu : null;
  }

  /** Its WHOLE answer as its menu holds it, `suspended` while the chip is OFF. Null: it
   *  answers no field. TRAP T-a-chip-says-its-own-answer · TRAP T-grid-suspend-is-not-clear */
  reading(): FieldReading | null {
    const menu = this.menu();
    if (!menu) return null;
    const own = menu.reading;
    // ALL: every value, whichever come — no filter; OFF keeps it, as it keeps picks. TRAP T-all-is-an-answer
    const all = this.all && own.mode !== 'advanced' && !(own.text ?? '').trim();
    // A tiered parent switched OFF keeps its picks. TODO 369, 425 · TRAP T-a-parent-pick-is-the-parent
    const off = this.off.size ? { off: [...this.off] } : {};
    return { ...own, ...off, ...(all ? { picked: [], all: true } : {}), ...(this.#host.el.current ? {} : { suspended: true }) };
  }

  /** The reader's own answer, into the menu: both modes, each body by its own door. */
  take(next: FieldReading): void {
    const menu = this.menu();
    if (!menu) return;
    const { el } = this.#host;
    const body = menu.dataset['body'];
    /* Its own mode, else rows say Advanced, else the menu's — read once the menu
       has it: a menu not yet drawn still says Simple. Will, TODO 464; every body, 518 */
    const advanced = (): boolean => (modeOf(next) ?? menu.mode) === 'advanced';
    const tree = answeredCondition(next.tree);
    /* A NUMBER takes its WHOLE reading: its one value, and its rows.
       TRAP T-a-menu-owns-its-own-bodies */
    if (body === 'number') {
      menu.reading = next;
      // In Advanced its TREE answers it. TRAP T-a-number-has-advanced-rows
      const answered = advanced() ? !!tree
        : (next.picked ?? []).length > 0 || (next.text ?? '').trim() !== '';
      el.current = answered && !next.suspended;
      // TRAP T-a-silent-steer-still-redraws-its-chip
      el.refresh();
      return;
    }
    /* A DATE takes its answer as it reports it: one day, or two ends. Through
       the menu's own door, which keeps a reading given before it has drawn. */
    if (body === 'date') {
      menu.reading = next;
      this.#host.applySelection(menu.values ?? []);
      // In Advanced its TREE answers it — "In the last 12 months" is ON.
      const answered = advanced() ? !!tree
        : (next.text ?? '').trim() !== '' || (next.picked ?? []).length > 0;
      el.current = answered && !next.suspended;
      el.refresh();
      return;
    }
    /* BOTH ANSWERS, and the mode the reading names. A steer carrying a tree IS
       the opt-in reaching the menu.
       TRAP T-both-answers-are-kept · TRAP T-many-conditions-are-one-reading */
    if (tree) menu.setAttribute('data-advanced', '');
    menu.reading = next;
    if (advanced()) {
      el.current = !!tree && !next.suspended;
      el.refresh();
      return;
    }
    // By KEY: a site pick is an object, and String() makes it "[object Object]". TODO 422
    this.off.clear();
    for (const value of next.off ?? []) this.off.add(valueKey(value));
    this.#setPicks((next.picked ?? []).map(valueKey), next.suspended, next.all);
  }

  /** Picks, and OFF where there are none or the answer is suspended. Nothing
   *  ticked filters nothing: Will, TODO 550. */
  #setPicks(picks: readonly string[], off = false, all = false): void {
    this.setValues(picks);
    // ALL ticks every value its menu has, and every one that comes. TRAP T-all-is-an-answer
    this.all = all;
    const menu = all ? this.menu() : null;
    if (menu) {
      menu.all = true;
      this.#host.applySelection(menu.values ?? []);
    }
    if (all && !off) this.#host.el.current = true;
    else if (!picks.length || off) this.#host.el.current = false;
  }

  /** Set the picks. TRAP T-chip-values-round-trip-silently — silent, unlike a pick. */
  setValues(next: readonly string[]): void {
    const menu = this.#host.el.menu;
    if (!menu) return;
    /* THE MENU ticks its rows — rows not drawn yet too,
       which it holds. Upgraded first: a property set on a plain element hides
       the setter for good. TRAP T-a-menu-owns-its-own-bodies
       TRAP T-a-value-before-the-first-render-is-held · TRAP T-custom-element-upgrade */
    customElements.upgrade(menu);
    if (!((menu as Element) instanceof SherpaElement)) return;
    // A list given is a list, not ALL. TRAP T-all-is-an-answer
    this.all = false;
    menu.values = next;
    // Read BACK, never trust the ask: a value naming no row never landed.
    this.#host.applySelection(menu.values ?? []);
  }

  /** Does it hold an answer over these picks: a pick, typing, a row, or ALL? Nothing
   *  ticked is no answer: Will, TODO 550. */
  answers(values: readonly string[]): boolean {
    // A TYPING condition answers with text. TODO 480
    return values.length > 0 || this.hasTypedAnswer() || this.all;
  }

  /** Is this chip's menu on a typing condition with something typed? */
  hasTypedAnswer(): boolean {
    const menu = this.#host.el.menu;
    if (menu?.getAttribute('data-type') !== 'filter') return false;

    /* ADVANCED mode answers with ROWS, and ANY answered row is an answer. A
       chip reading row one only stayed off while three rows filtered.
       TRAP T-a-filter-menu-has-two-modes */
    if (menu.mode === 'advanced') {
      return !!menu.condition;
    }

    // A LIST in Simple mode answers by its picks; row one's text is Advanced's.
    if (!menu.dataset?.['body']) return false;
    const op = (menu.dataset?.['op'] ?? DEFAULT_OP) as FilterOp;
    if ((OP_TAKES[op] ?? 'list') !== 'text') return false;
    return (menu.conditionValue ?? '').trim() !== '';
  }

  /** A DATE with no day reads its default, Today: OFF, one press from on. Will, TODO 394 */
  orDefault(values: string[]): string[] {
    const menu = this.#host.el.menu;
    if (values.length || menu?.dataset['body'] !== 'date' || menu.mode === 'advanced') return values;
    const day = today().toString();
    return menu.hasAttribute('data-range') ? [day, day] : [day];
  }

  /** What presets on hold of this field: it says so, in blue. A host that paints
   *  its menu itself, a grid heading, says it here. Will, TODO 521 */
  hold(held: FieldReading['byPreset']): void {
    const was = this.#presets.length > 0;
    this.#held = held ?? {};
    this.#presets = Object.values(this.#held);
    const names = this.#presets.map((p) => p.label).join(', ');
    this.#host.set('data-by-preset', names || null);
    const menu = this.menu();
    if (!menu) return;
    menu.heldByPreset = names ? this.heldBy : null;
    // Its values are the preset's while it is on: shown, refused, and the menu says why. Will, TODO 601
    if (names) {
      menu.setAttribute('data-readonly', '');
      menu.setAttribute('title', heldByPreset(names));
    } else if (was) {
      menu.removeAttribute('title');
      if (!this.#host.el.hasAttribute('data-superseded')) menu.removeAttribute('data-readonly');
    }
  }

  /** Each preset on that holds this field: its name, its scope and its tree. */
  get presets(): readonly Held[string][] {
    return this.#presets;
  }

  /** The requests that turn off each preset on that holds this field. Will, TODO 592 */
  get presetsOff(): { scope: string; preset: string; on: false }[] {
    return Object.entries(this.#held).map(([preset, { scope }]) => ({ scope, preset, on: false }));
  }

  /** The presets on whose trees touch a value, by name; none, ''. Will, TODOs 521, 590 */
  heldBy = (value: string): string => this.#presets
    .filter((p) => presetTouches(p.tree, value)).map((p) => p.label).join(', ');

  /** What the presets on hold, in words: their picks, or their conditions. */
  presetSaid(): string {
    const tree = joinConditions('and', this.#presets.map((p) => p.tree));
    // A list ORed reads as its values.
    const parts = tree && groupOf(tree);
    const leaves = conditionLeaves(tree);
    const listed = !parts || (parts[0] === 'or' && parts[1].every((p) => !groupOf(p)));
    return listed && leaves.every((l) => l.op === DEFAULT_OP || l.op === 'in')
      ? leaves.flatMap((l) => (Array.isArray(l.value) ? l.value : [l.value])).map(valueKey).join(', ') : this.#spell(tree);
  }

  /** A tree as an Advanced answer reads, for a field of this chip's kind. */
  #spell(tree: Condition | undefined): string {
    const body = this.menu()?.dataset['body'];
    const type = body === 'number' || body === 'date' ? { type: body as 'number' | 'date' } : {};
    return spellConditions(fieldState({ field: this.#host.el.dataset['id'] ?? '', ...type }, { ...(tree ? { tree } : {}), mode: 'advanced' }));
  }

  /** Its picks kept off, its ALL and its presets let go. */
  forget(): void {
    this.off.clear();
    this.all = false;
    this.hold(undefined);
  }

  /** EMPTY its menu, whatever answers it, and switch it off: a list's ticks, typing
   *  and rows, a number's two shapes, a date's days. `op` is the condition a list goes
   *  back to. TRAP T-empty-is-every-kind-of-answer */
  empty(op: FilterOp): void {
    const { el } = this.#host;
    const menu = this.menu();
    if (menu?.dataset['body'] === 'number') {
      // BOTH shapes: `values = []` empties only the one in force.
      menu.reading = { picked: [] };
      el.current = false;
      el.refresh();
      return;
    }
    if (menu && !menu.dataset['body']) {
      menu.dataset['op'] = op;
      menu.conditionValue = '';
      if (menu.condition) menu.condition = undefined;
      menu.mode = 'simple';
    }
    if (el.hasAttribute('data-menu')) return this.#setPicks([]);
    this.#host.set('data-current', null);
    for (const input of el.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
  }

  /** The field name, remembered before a pick rewrites the visible label. */
  name(): string | null {
    this.#field ??= this.#host.el.dataset['label'] ?? null;
    return this.#field;
  }

  /**
   * This chip's state, read off its menu.
   *
   * ONE read, into the shared model — the badge, the caret, the count and the
   * tooltip all come back from `filterFace`, so the chip draws rather than
   * decides. TRAP T-one-state-per-filtered-field
   */
  state(values: string[]): FilterState {
    const { el } = this.#host;
    const menu = el.menu;
    const isFilter = menu?.getAttribute('data-type') === 'filter';
    /* The menu's whole answer — both modes, and which is in force — so the
       badge and the tip read the answer that filters. A number's "> 2" is
       typed text there, not a tick.
       TRAP T-a-condition-badge-says-that-not-which · TRAP T-both-answers-are-kept */
    const body = menu?.dataset['body'];
    // A DATE that offers Advanced is a filter menu too: its rows are in its reading. TODO 21d
    const list = body === 'number' || isFilter ? menu?.reading : undefined;
    // A menu nested in the chip's answers for itself. TRAP T-a-nested-menu-answers-for-itself
    /* A TREE's children are not drawn until their parent opens: its items say
       them, with their parents. TODO 369 */
    const tree = menu?.itemData?.some((i) => i.parent !== undefined) ? menu.itemData : null;
    const all = tree ? tree.map((i) => i.value) : [...el.querySelectorAll<HTMLInputElement>('[slot="menu"] input')]
      .filter((i) => i.closest('sherpa-menu') === menu && !i.closest(NON_VALUE_ROWS))
      .map((i) => i.value);
    return fieldState(
      {
        field: el.dataset['id'] ?? el.dataset['label'] ?? '',
        label: this.#field ?? el.dataset['label'] ?? '',
        /* A NUMBER or a DATE has no list: its picks ARE its values. An empty
           list said "nothing to pick", and the chip said nothing at all.
           TRAP T-a-chip-says-its-own-answer */
        ...(body === 'number' || body === 'date' ? { type: body } : { values: all }),
        labels: tree ? Object.fromEntries(tree.map((i) => [i.value, i.label]))
          : this.#valueLabels(all),
        ...(tree ? { parentOf: new Map(tree.flatMap((i) => (i.parent !== undefined ? [[i.value, i.parent] as const] : []))) } : {}),
      },
      list ? { ...list, picked: values, ...(this.all ? { all: true } : {}) } : {
        picked: values,
        ...(this.all ? { all: true } : {}),
        op: isFilter ? ((menu?.dataset['op'] ?? DEFAULT_OP) as FilterOp) : DEFAULT_OP,
        text: isFilter ? (menu?.conditionValue ?? '') : '',
        // A DATE's two days are a span, as its calendar has it.
        ...(body === 'date' ? { range: !!menu?.hasAttribute('data-range') } : {}),
      },
    );
  }

  /** Each value's VISIBLE text, falling back to the raw value — in ONE pass: a
   *  lookup per value was rows × rows, 4.4 s of a load at 20k rows. Plan 652 S9 */
  #valueLabels(values: readonly string[]): Record<string, string> {
    const menu = this.#host.el.menu;
    // Its item's own label: a word its row adds — "(Default)" — is the menu's. Will, TODO 684
    const named = new Map(menu?.itemData?.map((i) => [i.value, i.label]) ?? []);
    const shown = new Map<string, string>();
    if (values.some((v) => !named.get(v))) {
      for (const input of menu?.querySelectorAll<HTMLInputElement>('input') ?? []) {
        if (input.closest('sherpa-menu') !== menu || shown.has(input.value)) continue;
        shown.set(input.value, input.closest('label')?.textContent?.trim() ?? '');
      }
    }
    return Object.fromEntries(values.map((v) => [v, named.get(v) || shown.get(v) || v]));
  }
}
