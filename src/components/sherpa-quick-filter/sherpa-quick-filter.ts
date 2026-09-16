/**
 * sherpa-quick-filter — a filter chip you can toggle, with an optional value menu.
 *
 * Clicking the chip body flips it on or off and fires quick-filter-click.
 *
 * `data-menu` is the code form of Figma's `State` variant axis on "Filter Chip
 * (atom)" (154:3904): absent = State=simple (one box), present = State=menu (the
 * chip and a caret button SNAPPED into one 24-tall unit via the Structure
 * snap-right-edge / snap-left-edge extensions). It stays a boolean rather than a
 * `data-state` enum because the second value is the only difference and a boolean
 * reads better at the call site.
 *
 * The caret opens a slotted <sherpa-menu> of values for the field — checkbox rows
 * for a multi-select field, radio rows for a single-select one. The menu is a
 * native popover; it measures its own placement off the caret we hand it, because
 * a CSS anchor name cannot cross the shadow boundary between them.
 *
 * CSS owns the look: the neutral count chip that LEADS the label, the accent, the
 * on-state tint, the snapped corners and the disabled treatment. JS writes the
 * label, the count and the icon, and relays the menu's selection.
 *
 * A VALUE chip that is on but holds no values is a contradiction — it filters by
 * nothing, so it is filtering nothing out. CSS paints that as the WARNING status
 * rather than the active one, off `data-empty`. A plain toggle chip (no menu)
 * never gets it: on/off is its whole meaning, so "on with no values" is normal.
 *
 * With EXACTLY ONE value picked the chip rewrites its own label to
 * "Field: Value" — one pick fits, and it says what the chip filters TO rather
 * than only what it filters ON, so no count badge is needed. Two or more picks
 * will not fit, so those revert to the bare field name and the count badge
 * carries the number. The badge therefore only ever reads 2 or higher.
 *
 * @element sherpa-quick-filter
 * @attr {enum}    data-type       default | ai | populated
 * @attr {boolean} data-current    the chip is on
 * @attr {string}  data-label      chip text (or use the default slot). The chip
 *                                 rewrites this to "Field: Value" while exactly
 *                                 one menu value is picked.
 * @attr {string}  data-icon-start leading icon — an FA class list
 * @attr {boolean} data-indicator  show the leading status dot
 * @attr {string}  data-count      leading count chip — set only at 2+ picked values.
 *                                 Hovering it lists the chosen values in a bubble
 *                                 above the badge (pure CSS; see the .count-tip part).
 * @attr {boolean} data-menu       Figma State=menu — snap on the caret button
 * @attr {boolean} data-empty      set by the chip: it is ON but holds no values
 * @attr {boolean} data-no-value  the caret names no VALUE — for a chip whose menu
 *                lists other filters rather than values (the toolbar's More chip)
 * @attr {boolean} data-plain  an icon-only chip with NO CHROME while resting —
 *                no face, no ring, just the glyph. A real property on the
 *                caret, never a re-point of --sherpa-style-surface-base: a
 *                custom property set on the host inherits into the chip's
 *                slotted MENU and turns its card transparent too (and @scope
 *                cannot stop that — scoping limits what a rule MATCHES, not
 *                how far the value it sets inherits). A chip that is ON keeps
 *                its full accent face.
 * @attr {boolean} data-icon-only  the chip reduced to its menu button: body,
 *                count, indicator and value label all hidden, the caret squared
 *                off and its glyph swapped for a funnel. For a filter
 *                affordance whose FIELD is named by something else — the data
 *                grid's column header is the case this exists for. Purely CSS;
 *                the shadow DOM is unchanged, so a chip can flip either way.
 * @attr {boolean} data-persistent  a SELECTOR, not a toggle — always on, never
 *                                  empty. Set by the toolbar.
 * @attr {boolean} data-locked   the chip's ON/OFF state is not its own to change.
 *                Clicking the body and ticking rows in its menu both leave
 *                `data-current` exactly as the host set it.
 *
 *                For a chip that is CHROME rather than a filter: the toolbar's
 *                More chip stands for "these filters are folded in here", so its
 *                menu's rows belong to other chips and must not re-point it, and
 *                its count badge counts FOLDED FILTERS rather than picked values.
 *                A locked chip still opens its menu, still reports what happened
 *                inside it, and is still styled by whatever `data-current` the
 *                host chose — it simply never sets that itself.
 *
 * @slot (default) — the chip label
 * @slot menu      — a <sherpa-menu> of values for this field
 *
 * @fires quick-filter-click  — the chip body is toggled. detail: { active: boolean }
 * @fires quick-filter-change — the menu selection changed. detail: { values: string[] }
 */
import { SherpaElement } from '../../core/sherpa-element.js';
// The count badge's value list is a composed tooltip, in floating mode so it
// escapes the toolbar's clipping chip run.
import '../sherpa-tooltip/sherpa-tooltip.js';

interface MenuLike extends HTMLElement {
  toggle?: (trigger?: HTMLElement) => void;
  values?: string[];
}

export class SherpaQuickFilter extends SherpaElement {
  static override css = new URL('./sherpa-quick-filter.css', import.meta.url);
  static override html = new URL('./sherpa-quick-filter.html', import.meta.url);
  static override props = {
    'data-count': { type: 'string', kind: 'content', to: '.count' },
  } as const;

  // data-label keeps its own handling: the write is SKIPPED when the attribute is
  // absent, so the template's own default label survives. data-icon-start is the
  // Font Awesome case and belongs to icon().
  static override observed = ['data-label', 'data-icon-start', 'data-current'];

  override onRender(): void {
    this.#syncText();
    this.$('.body')?.addEventListener('click', this.#onClick);
    this.$('.caret')?.addEventListener('click', this.#onCaret);
    // The menu lives in the light DOM; its events bubble up through the host.
    this.addEventListener('menu-change', this.#onMenuChange as EventListener);
    this.addEventListener('menu-open', this.#onMenuToggle as EventListener);
    this.addEventListener('menu-close', this.#onMenuToggle as EventListener);
  }

  /**
   * The empty check reads the SLOTTED menu, which is a light-DOM child — so it
   * has to wait for onConnect. At onRender time a chip written as markup may not
   * have had its children parsed yet, and an empty read there would flag a chip
   * that does in fact hold values.
   */
  override onConnect(): void {
    this.#syncEmpty();
    // A chip can arrive with values ALREADY ticked (markup, or the toolbar's own
    // `options: [{ selected: true }]`), and no menu event ever fires for those.
    // Without this the caret label would stay blank until the user opened the menu.
    const initial = this.menu?.values ?? [];
    if (initial.length) {
      this.#syncLabelForSelection(initial);
      this.#syncCountTip(initial);
      if (initial.length > 1) this.dataset['count'] = String(initial.length);
    }
  }

  override onChange(name: string): void {
    if (name === 'data-current') this.#syncEmpty();
    else this.#syncText();
  }

  get current(): boolean {
    return this.hasAttribute('data-current');
  }
  set current(v: boolean) {
    this.toggleAttribute('data-current', v);
    this.#syncEmpty();
  }

  /**
   * The text shown in the caret button — the chip's PICKED VALUE.
   *
   * Public because the value is not always the chip's own to derive: a DATE chip's
   * pick is an ISO string that has to be formatted to the reader's locale, and the
   * toolbar owns that formatting. The chip owns the element; the caller owns the
   * words.
   *
   * Empty collapses the button back to a bare caret (`.caret-label:empty` in CSS).
   */
  set valueLabel(text: string) {
    const caret = this.$('.caret-label');
    if (caret) caret.textContent = text;
  }
  get valueLabel(): string {
    return this.$('.caret-label')?.textContent ?? '';
  }

  /** The chip's slotted value menu, if it has one. */
  get menu(): MenuLike | null {
    return this.querySelector<MenuLike>('[slot="menu"]');
  }

  /**
   * The chip's picked values — the same list `quick-filter-change` reports.
   *
   * PARITY: what a reader picks in the menu, a caller must be able to set. A
   * saved view, a deep link and an agent all need this door, and before it
   * existed a view could narrow the DATA while the chip sat blank — the bar
   * then lies about what is being shown.
   */
  get values(): string[] {
    return (this.menu?.values ?? []) as string[];
  }

  /**
   * Set the picks, and bring the chip's whole face with them.
   *
   * The chip does NOT store its state — it derives its label, badge, tooltip
   * and on/off from the menu's ticked rows. So ticking the rows from outside is
   * only half the job: the first version of this ticked them and left the chip
   * reading "Region" with no value, lit but silent. Every sync `#onMenuChange`
   * runs on a click runs here too, through the same code.
   *
   * SILENT. The caller is the one who asked, and a host that routes
   * `quick-filter-change` back into its query would apply the same filter
   * twice. Clicks report an INTENT; this is the answer to one.
   *
   * A value naming no row is ignored — a saved view outlives the options it
   * was made from.
   */
  set values(next: readonly string[]) {
    const menu = this.menu;
    if (!menu) return;
    const want = new Set(next.map(String));
    for (const input of this.querySelectorAll<HTMLInputElement>('[slot="menu"] input')) {
      // The "All" row is a control, not a value; it derives from the rest.
      if (!input.closest('.qf-all')) input.checked = want.has(input.value);
    }
    // Read BACK, never trust the ask: a value naming no row never landed.
    this.#applySelection((menu.values ?? []) as string[]);
  }

  /**
   * Everything the chip derives from its picks, in one place.
   *
   * Shared by the menu event and the `values` setter so a click and a call
   * cannot drift — the same five writes, the same order.
   */
  #applySelection(values: string[]): void {
    if (values.length > 1) this.dataset['count'] = String(values.length);
    else delete this.dataset['count'];
    this.current = values.length > 0;
    this.#syncLabelForSelection(values);
    this.#syncCountTip(values);
    this.#syncEmpty();
    this.#syncText();
  }

  /**
   * The chip's own field name, remembered before a single pick rewrites the
   * visible label to "Field: Value". Without it, going from one pick to two (or
   * back to none) would have nothing to restore — the field name would already
   * have been overwritten in data-label.
   */
  #field: string | null = null;

  #syncText(): void {
    const label = this.$('.label');
    const value = this.dataset['label'];
    if (label && value != null) label.textContent = value;
    // The leading icon is a Font Awesome class list; render it as an <i>, not text.
    //
    // BOTH slots take it: `.icon` leads the chip body, and `.caret-icon` sits in
    // the caret for an ICON-ONLY chip, whose body is hidden. CSS picks which is
    // visible — a sort control needs three different glyphs and cannot use the
    // hardcoded funnel, so it writes data-icon-start like anything else.
    const glyph = this.dataset['iconStart'];
    // The base class's writer, not a fourth copy of the same if/else. It also
    // strips previously-applied `fa-*` classes, which the hand-rolled version
    // did not — so a chip whose glyph changes cannot end up wearing two.
    for (const icon of this.$$('.icon, .caret-icon')) this.writeIcon(icon, glyph ?? '');
  }

  #onClick = (): void => {
    if (this.hasAttribute('disabled')) return;
    // A LOCKED chip reports the click but does not flip itself — its state is
    // the host's to set. It still emits, so a host that wants the click can act
    // on it (opening the menu, say) without the chip having guessed first.
    if (!this.hasAttribute('data-locked')) this.current = !this.current;
    this.emit('quick-filter-click', { active: this.current });
  };

  #onCaret = (event: Event): void => {
    if (this.hasAttribute('disabled')) return;
    event.stopPropagation(); // opening the menu must not toggle the chip
    // Anchored to the CHIP, not to the caret that was clicked. The menu belongs
    // to the whole chip, so its leading edge lines up with the chip's — anchored
    // to the caret it started at the little arrow on the far right and the card
    // hung off the end of what it belonged to.
    //
    // NOT CSS anchor positioning. `anchor-name` resolves inside one tree, and
    // this trigger and that card are in different shadow roots — re-probed on
    // Chromium 153: supported, and silently places the card at the viewport's
    // far corner. sherpa-menu measures the trigger instead.
    this.menu?.toggle?.(this);
  };

  /** Mirror the menu's open state onto the caret for assistive tech. */
  #onMenuToggle = (event: Event): void => {
    const open = event.type === 'menu-open';
    this.$('.caret')?.setAttribute('aria-expanded', String(open));
    // A chip with its menu OPEN wears the focus ring, so the bar says which
    // chip the card belongs to. Real focus is inside the menu by then — its
    // search field, or a row — so `:focus-visible` on the chip is false and
    // nothing on the bar marked it. The flag is the JS→CSS path; the ring
    // itself is entirely in the stylesheet.
    this.toggleAttribute('data-open', open);
  };

  /** A menu selection sets the label, the count chip and the on-state, then relays outward. */
  #onMenuChange = (event: Event): void => {
    const values = ((event as CustomEvent).detail?.values ?? []) as string[];
    // A LOCKED chip's menu is not a list of ITS values — the More chip's rows
    // stand for other filters — so nothing in there may re-point its label, its
    // badge or its on/off state. It still relays the event, because the toolbar
    // is listening for exactly that.
    if (this.hasAttribute('data-locked')) {
      this.emit('quick-filter-change', { values });
      return;
    }
    // The badge needs TWO or more picks to say anything. At one pick the label
    // already names the value ("Region: EMEA"), so a "1" beside it is pure noise
    // — and on a single-select chip the badge could never read anything else.
    this.#applySelection(values);
    this.emit('quick-filter-change', { values });
  };

  /**
   * Flag "on, but filtering by nothing" so CSS can paint it as a warning.
   *
   * Only a VALUE chip can be in that state: it has a menu, so holding no values
   * means it excludes nothing while still claiming to be on. A plain toggle chip
   * has no values to hold, so on/off is its whole meaning and it is never empty.
   *
   * Reads the menu's checked rows rather than the last event's detail, because a
   * chip can be switched on from OUTSIDE (the toolbar's `active: true`) with no
   * menu event ever having fired.
   *
   * A PERSISTENT chip is exempt. It is a selector, not a filter: it is on
   * because you are always in some state it names (a view), so "on with nothing
   * picked" is a chip still waiting for its rows, not a contradiction. Painting
   * it amber was the intermittent warning on the view chip — the flag was read
   * before the menu's rows were there to be counted.
   */
  #syncEmpty(): void {
    // A PERSISTENT chip is a selector, so "on with nothing" is not a state it
    // can be in.
    //
    // A LOCKED one cannot be judged this way at all: `data-empty` is derived
    // from the menu's TICKED ROWS, and a locked chip's menu is not a list of
    // its values. The More chip's rows stand for other filters; a data grid's
    // column-filter menu holds a condition and a typed value. Either way "no
    // rows ticked" says nothing about whether the chip is filtering, and
    // reading it as "on but empty" painted a working filter in the amber
    // warning state — the exact colour that means "this is doing nothing".
    if (this.hasAttribute('data-persistent') || this.hasAttribute('data-locked')) {
      this.removeAttribute('data-empty');
      return;
    }
    const menu = this.menu;
    const empty = !!menu && this.current && (menu.values?.length ?? 0) === 0;
    this.toggleAttribute('data-empty', empty);
  }

  /**
   * A count says HOW MANY but never WHICH, so the badge's hover bubble lists the
   * chosen values. The same list goes on the badge's aria-label: the tooltip
   * carries it visually, and this is the route to AT.
   */
  #syncCountTip(values: string[]): void {
    const labels = values.map((v) => this.#valueLabel(v));
    // `data-text` is sherpa-tooltip's own API — the component writes the bubble.
    const tip = this.$<HTMLElement>('.count-wrap');
    if (tip) tip.dataset['text'] = labels.join(', ');
    const badge = this.$('.count');
    if (!badge) return;
    if (labels.length > 1) badge.setAttribute('aria-label', `${labels.length} selected: ${labels.join(', ')}`);
    else badge.removeAttribute('aria-label');
  }

  /**
   * The chip keeps the FIELD name; the picked value reads in the caret button.
   *
   * Figma's State=menu makes the caret a Button instance with its own `label` text
   * property, so the two are separate places (150:3408). The chip used to fold them
   * together as "Field: Value", which meant the field name moved and re-flowed the
   * whole bar every time a value was picked.
   *
   *   nothing picked   caret label empty → the button collapses to a bare caret
   *   one value        caret label is that value
   *   two or more      caret label is the FIRST value plus an ellipsis, and the
   *                    count badge carries the number
   *
   * The ellipsis says "there is more here" without guessing how many values fit —
   * the exact list is on the badge's hover tip and in its aria-label.
   */
  #syncLabelForSelection(values: string[]): void {
    this.#field ??= this.dataset['label'] ?? null;
    const field = this.#field;
    if (field == null) return;
    // The chip label is now ALWAYS the field name — it no longer moves.
    this.dataset['label'] = field;

    const first = values.length ? this.#valueLabel(values[0]!) : '';
    this.valueLabel = values.length > 1 ? `${first}…` : first;
  }

  /**
   * The VISIBLE text of a menu row, not its raw value — a chip must read
   * "Region: EMEA", never "Region: emea". Falls back to the raw value when the
   * row carries no text of its own.
   */
  #valueLabel(value: string): string {
    const input = this.menu?.querySelector<HTMLInputElement>(
      `input[value="${CSS.escape(value)}"]`,
    );
    const row = input?.closest('label');
    return row?.textContent?.trim() || value;
  }
}

customElements.define('sherpa-quick-filter', SherpaQuickFilter);
