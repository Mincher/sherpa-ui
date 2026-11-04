/**
 * chip-says.ts — what a chip SAYS, whatever face draws it: its answer in words in its
 * tip and to a screen reader, its pick in the caret, its results in its badge.
 * A module of sherpa-quick-filter, not an element. Plan 695 P5
 * TRAP T-a-chip-says-its-own-answer · TRAP T-an-inactive-chip-says-where-its-filter-went
 *
 * Map:
 * - SaysHost — What the words ask of their chip.
 * - ChipSays — One chip's tip, caret value and badge.
 * - .valueLabel — The text in the caret: the chip's picked value.
 * - .drawLabel — Draw the caret text, if there is a caret.
 * - .results — The rows its answer matches, as its source counted them.
 * - .said — Its answer in words, then its tip written.
 * - .count — Its answer in words, read off its picks.
 * - .label — The field's name on the chip, its pick in the caret.
 * - .tip — Write the tip: its answer in words, then its matches.
 * - .badge — The badge: its results once applied, on or off.
 */
import { countSaid, filterFace } from '../../core/data/filter-face.js';
import { writeTip } from '../../core/ui/description-tips.js';
import { NOT_AVAILABLE, RULED_OUT, SET_ASIDE, UNAPPLIED, UNFETCHED, heldByPreset, movedTo, onByPreset, unusedHere } from '../../core/ui/shared-constants.js';
import type { ChipAnswer } from './chip-answer.js';
import type { ChipHost } from './chip-host.js';

/** What the words ask of their chip. */
export interface SaysHost extends ChipHost {
  /** Its answer. */
  readonly answer: ChipAnswer;
}

/** One chip's tip, caret value and badge. */
export class ChipSays {
  /** Its chip. */
  readonly #host: SaysHost;
  /** What the caret says: kept as data, drawn once there is a caret.
   *  TRAP T-a-value-before-the-first-render-is-held */
  #caretText = '';
  /** What the chip's answer says, in words — the tip before its matches. */
  #said = '';
  /** Undefined: never told — a chip with no menu then leaves `data-count` to its host. */
  #results: number | null | undefined;

  constructor(host: SaysHost) {
    this.#host = host;
  }

  /** The text in the caret button — the chip's PICKED VALUE. */
  get valueLabel(): string {
    return this.#caretText;
  }
  set valueLabel(text: string) {
    this.#caretText = text;
    this.drawLabel();
  }

  /** Draw the caret text, if there is a caret. */
  drawLabel(): void {
    const caret = this.#host.$('.caret-label');
    if (caret) caret.textContent = this.#caretText;
  }

  /** The rows this chip's own answer matches, as its source counted them.
   *  Null: no number. TRAP T-a-chip-counts-within-the-filters-before-it */
  get results(): number | null {
    return this.#results ?? null;
  }
  set results(n: number | null) {
    if (n === this.#results) return;
    this.#results = n;
    this.badge();
  }

  /** Its answer in words, then its tip written. */
  said(words: string): void {
    this.#said = words;
    this.tip();
  }

  /** The tooltip: the values or the condition, in words — and the same words on
   *  the button for a screen reader, as the tooltip describes only itself.
   *  TRAP T-one-state-per-filtered-field */
  count(values: string[]): void {
    const { answer } = this.#host;
    this.said(filterFace(answer.state(answer.orDefault(values))).tip);
  }

  /**
   * TRAP T-caret-carries-the-value-not-the-label — the chip label is ALWAYS the
   * field name; the pick reads in the caret. One pick reads "Field: Value"; none
   * or several reads the field alone.
   */
  label(values: string[]): void {
    const { answer } = this.#host;
    const field = answer.name();
    if (field == null) return;
    this.#host.set('data-label', field);

    const face = filterFace(answer.state(answer.orDefault(values)));
    this.valueLabel = face.value || (answer.presets.length ? answer.presetSaid() : '');
    this.badge();
  }

  /**
   * What the tooltip says. A chip with values describes them; one that is OFF
   * because another control owns its field says SO, because "no tooltip" reads
   * as "nothing here" — and the reader's own filter has not gone anywhere.
   * TRAP T-an-inactive-chip-says-where-its-filter-went
   */
  #tipText(values: string): string {
    const { el, answer } = this.#host;
    // A greyed chip says WHY, in a few words. Will, TODO 176.
    /* A section's value on and ruled out is every pick ruled out — one beside a
       pick that stands is let go (512) — so in force: "no matches", as its row says. TODO 518 */
    if (el.hasAttribute('data-unavailable')) return el.current && el.dataset['type'] !== 'key' && el.slot !== 'values' ? SET_ASIDE : RULED_OUT;
    if (el.hasAttribute('data-unused')) return unusedHere(el.dataset['label']);
    if (el.hasAttribute('disabled')) return NOT_AVAILABLE;
    const by = el.dataset['byPreset'];
    if (el.hasAttribute('data-superseded') && !by) {
      // The VALUES too where there are any: they come back when the field is free.
      const moved = movedTo(el.dataset['appliedAt']);
      return values ? `${moved} This chip holds ${values}.` : moved;
    }
    if (el.dataset['heldOut']) return heldByPreset(el.dataset['heldOut']);
    // Why it is on, then what the reader's own answer adds. Will, TODO 521
    if (by) return [onByPreset(by), answer.presets.length ? answer.presetSaid() : '', values].filter(Boolean).join(' ');
    return values;
  }

  /**
   * WRITE THE TIP: the answer in words, then ` - X matches` while the chip
   * shows its results — on or off. The CHIP's own, whatever draws it — a bar, a panel, a
   * grid heading. Will, TODO 130. TRAP T-a-chip-says-its-own-answer
   */
  tip(): void {
    const { el } = this.#host;
    // ON OR OFF it says the same — its answer and its matches, as its badge keeps its number. Will, 363.
    const n = this.#shown();
    const matches = n == null ? '' : countSaid(n, ['match', 'matches']).label;
    // A failed fetch says so first, then changed-not-applied. Will, TODO 406 and 411
    const lead = [el.hasAttribute('data-failed') ? UNFETCHED : '', this.#unapplied() ? UNAPPLIED : ''];
    const said = [...lead, this.#tipText(this.#said), matches].filter(Boolean).join(' - ');
    /* A chip with NO WORDS on it — a grid cell's or heading's — says its name in
       the tip, as an icon button does: "Filter Team: Blue". */
    const name = el.hasAttribute('data-icon-only') ? el.getAttribute('aria-label') ?? '' : '';
    const tip = this.#host.$('.tip');
    /* IN LINES, where the page shows them: its field's name, what the field is,
       its answer, then the rest. Will, TODO 691 · TRAP T-a-tip-in-lines */
    const label = el.dataset['label'] ?? this.#host.$<HTMLSlotElement>('.label slot')?.assignedNodes({ flatten: true }).map((n) => n.textContent ?? '').join('');
    if (tip) {
      writeTip(tip, {
        plain: said || name, name: name || label, description: el.dataset['description'],
        value: this.#tipText(this.#said), more: [...lead, matches].filter(Boolean).join(' - '),
      });
    }
    // For a screen reader the name is said already; only the answer describes.
    const body = this.#host.$('.body');
    if (said) body?.setAttribute('aria-description', said);
    else body?.removeAttribute('aria-description');
  }

  /** The results the chip shows now: once applied, ON OR OFF — the source gives
   *  a number only to a chip that holds an answer. Will, TODO 123. */
  #shown(): number | null {
    return this.#unapplied() ? null : this.#results ?? null;
  }

  /** Changed and not applied: its source says it waits, or its open menu holds a draft. */
  #unapplied(): boolean {
    return this.#host.el.hasAttribute('data-pending') || this.#host.el.drafting;
  }

  /**
   * The badge is the chip's RESULTS once applied, on or off — not a count of
   * picks, nor `fx`: the tip says those. Will, TODO 60 and 123.
   * TRAP T-a-chip-counts-within-the-filters-before-it
   */
  badge(): void {
    // The tip names the matches too, and follows the same rule.
    this.tip();
    if (this.#results === undefined && !this.#host.el.menu) return;
    const n = this.#shown();
    const badge = this.#host.$('.count');
    if (n == null) {
      badge?.removeAttribute('aria-label');
      this.#host.set('data-count', null);
      return;
    }
    const { said, label } = countSaid(n);
    this.#host.set('data-count', said);
    badge?.setAttribute('aria-label', label);
  }
}
