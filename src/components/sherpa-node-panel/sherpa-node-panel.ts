/**
 * sherpa-node-panel — the nodes a graph editor may place, by category, in a card on a canvas.
 *
 * It re-makes nothing: a sherpa-container, a Jump to chip and a sherpa-input-text for the search,
 * a sherpa-section-header per category that sticks while its items scroll, a sherpa-list of
 * sherpa-list-items, and a sherpa-menu for "Add a node". It places nothing either: an item
 * clicked, Enter on it, or dragged off the card is `node-add`, and the editor that hears it makes
 * the node. An item is a FAMILY: its line names its types, and the search finds it by any of
 * them, or by a tag: "round" finds Math, placed as Round. TRAP T-the-node-panel-asks-it-places
 * A Custom Node is listed under each of its tags. TRAP T-a-node-panel-lists-under-sticky-headings
 * It floats in its canvas as an overlay panel floats in the window, by the same code. TRAP T-a-floating-panel-is-a-state
 *
 * Map:
 * - AddContext — Where "Add a node" opens, and what it is for: a socket of a type, dragged to a point.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { FLOAT_ATTRS, FloatBox } from '../../core/ui/float-box.js';
import { fitOf, paletteFor, paletteMatch, type NodeKind, type PaletteGroup, type PaletteItem, type SocketType } from '../../core/data/node-kinds.js';
// Defined before the template stamps them.
import '../sherpa-button/sherpa-button.js';
import '../sherpa-container/sherpa-container.js';
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-input-text/sherpa-input-text.js';
import '../sherpa-list/sherpa-list.js';
import '../sherpa-list-item/sherpa-list-item.js';
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-quick-filter/sherpa-quick-filter.js';
import '../sherpa-section-header/sherpa-section-header.js';

/** Where "Add a node" opens, and what it is for: a socket of a type, a line let go at a point.
 *  The panel hands it back on `node-add` untouched. */
export interface AddContext {
  /** The socket the line came from, `node` or `node/row`. */
  socket: string;
  /** Its type, and which side it is: an OUTPUT sends into the new node, an INPUT takes from it. */
  type: SocketType;
  side: 'out' | 'in';
  /** Where it was let go: on the screen, to open the menu; on the plane, to place the node. */
  client: { x: number; y: number };
  at: { x: number; y: number };
}

/** How far a pointer travels before a press on an item becomes a drag. */
const THRESHOLD = 4;

/** An item's line: a family's types, in order; else its kind's own. A preset says it is read only. */
function lineOf(kind: NodeKind): string | undefined {
  if ('preset' in kind && kind.preset) return `Preset, read only.${kind.description ? ` ${kind.description}` : ''}`;
  const types = Object.values(kind.types ?? {});
  return types.length > 1 ? types.map((t) => t.label).join(', ') : kind.description;
}

/** One category as drawn: its items with no tag, then a group per tag, each with an id to jump to. */
interface Drawn {
  category: string;
  anchor: string;
  items: PaletteItem[];
  tags: { tag: string; anchor: string; items: PaletteItem[] }[];
}

/** A category's items split by tag: those with none, then each tag in order of its words, an item under each of its own.
 *  A tag is one in any case, said as it is first met. */
function byTag(group: PaletteGroup, index: number): Drawn {
  const said = new Map<string, string>();
  for (const tag of group.items.flatMap((i) => i.kind.tags ?? [])) if (!said.has(tag.toLowerCase())) said.set(tag.toLowerCase(), tag);
  const has = (item: PaletteItem, key: string): boolean => !!item.kind.tags?.some((t) => t.toLowerCase() === key);
  return {
    category: group.category, anchor: `category-${index}`,
    items: group.items.filter((i) => !i.kind.tags?.length),
    tags: [...said].sort(([a], [b]) => a.localeCompare(b)).map(([key, tag], t) => ({ tag, anchor: `category-${index}-tag-${t}`, items: group.items.filter((i) => has(i, key)) })),
  };
}

export class SherpaNodePanel extends SherpaElement {
  // The floating box's sheet, shared with the overlay panel. TRAP T-a-floating-panel-is-a-state
  static override css = [new URL('../../core/sherpa-float.css', import.meta.url), new URL('./sherpa-node-panel.css', import.meta.url)];
  static override html = new URL('./sherpa-node-panel.html', import.meta.url);

  static override props = {
    'data-floatable': { type: 'boolean', kind: 'style' },
    // Lifted off its place, anywhere in its canvas. TRAP T-a-floating-panel-is-a-state
    'data-floating': { type: 'boolean', kind: 'behaviour' },
    'data-x': { type: 'number', kind: 'behaviour' },
    'data-y': { type: 'number', kind: 'behaviour' },
    'data-width': { type: 'number', kind: 'behaviour' },
    'data-height': { type: 'number', kind: 'behaviour' },
  } as const;
  static override observed = ['data-x', 'data-y', 'data-width', 'data-height'];

  /** The categories, as populated. */
  #palette: readonly PaletteGroup[] = [];
  /** What "Add a node" is open for, until a choice or a close. */
  #context: AddContext | null = null;
  /** A drag just ended: the click it makes is not a place. */
  #dragged = false;
  /** Each item's kind. */
  #kinds = new WeakMap<Element, NodeKind>();
  /** The type a search found an item by, when its name did not match: placing it sets that type. */
  #found = new WeakMap<Element, string>();
  /** The heading a Jump to pick scrolled to: it takes the focus once the menu has shut. */
  #jumped: HTMLElement | null = null;

  /** Floating, in its canvas: the parent it sits in is its room, which the canvas makes the whole canvas. */
  readonly #floatBox: FloatBox = new FloatBox({
    el: this,
    box: () => this.$<HTMLElement>('.box'),
    room: () => (this.parentElement ?? this).getBoundingClientRect(),
    free: () => this.hasAttribute('data-floating'),
    set: (attr, value) => this.set(attr, value),
    num: (attr) => this.num(attr, NaN),
    toggleState: (name, on) => this.toggleState(name, on),
    moved: (at) => this.emit('panel-move', at),
    sized: (size) => this.emit('panel-resize', size),
  });

  override onRender(): void {
    this.on(this.root, 'input', this.#onSearch);
    this.on(this.root, 'click', this.#onClick);
    this.on(this.root, 'pointerdown', this.#onDown as EventListener);
    this.on(this.$('.add')!, 'menu-select', this.#onChoose);
    this.on(this.$('.jump')!, 'jump-select', this.#onJump);
    this.on(this.$('.jump')!, 'menu-close', this.#onJumpShut);
    // `button-click`, not `click`: a disabled sherpa-button still gets raw clicks.
    this.on(this.$('.float')!, 'button-click', this.#onFloat);
    this.#floatBox.wire(this.$('.heading'), this.$('.grip'), this.$('.corner'));
    this.#floatBox.draw();
    this.toggleState('floating', this.hasAttribute('data-floating'));
    this.#draw();
  }

  override onChange(name: string): void {
    if (name === 'data-floating') this.#float();
    else if (FLOAT_ATTRS.includes(name)) this.#floatBox.draw();
  }

  /** populate(paletteOf(kinds)) — each category and its kinds. */
  protected override renderData(data: unknown): void {
    this.#palette = Array.isArray(data) ? (data as PaletteGroup[]) : [];
    this.#draw();
  }

  /** Stamp each category, its items and its tags, then apply the search. */
  #draw(): void {
    const fill = (list: Element, items: readonly PaletteItem[]): void => {
      for (const { id, kind } of items) {
        const item = this.cloneItem('template.item-tpl', { id, heading: kind.heading, icon: kind.icon, description: lineOf(kind) });
        if (!item) continue;
        // A preset is a file's: read only, and its line says so.
        if ('preset' in kind && kind.preset) item.toggleAttribute('data-preset', true);
        this.#kinds.set(item, kind);
        list.append(item);
      }
    };
    this.renderItems('.categories', 'template.category-tpl', this.#palette.map(byTag), {
      after: (node, group) => {
        // An id is no field a template writes: Jump to scrolls to it.
        node.id = group.anchor;
        node.toggleAttribute('data-empty', !group.items.length && !group.tags.length);
        const list = node.querySelector('.items')!;
        fill(list, group.items);
        for (const tag of group.tags) {
          const block = this.cloneItem('template.tag-tpl', tag);
          if (!block) continue;
          block.id = tag.anchor;
          fill(block.querySelector('.items')!, tag.items);
          node.insertBefore(block, node.querySelector('.empty'));
        }
      },
    });
    this.#search();
  }

  /* ── Search ───────────────────────────────────────────────────────────── */

  /** The search field's typing: narrow the items. */
  #onSearch = (event: Event): void => {
    if (event.target !== this.$('.find')) return;
    this.#search();
  };

  /** Narrow the items to those whose name, a tag, or a type's name holds what is typed; a heading with none under
   *  it is hidden. An item found by a type, not by its name, says that type and its line, and places it. Jump to
   *  lists the headings left. */
  #search(): void {
    const query = (this.$<HTMLInputElement>('.find')?.value ?? '').trim().toLowerCase();
    let shown = 0;
    const places: { value: string; label: string }[] = [];
    for (const category of this.$$('.categories > .category')) {
      const name = category.querySelector('.category-heading')?.getAttribute('data-heading') ?? '';
      let own = 0;
      for (const item of category.querySelectorAll<HTMLElement>('sherpa-list-item')) if (this.#match(item, query)) own++;
      // A heading with nothing under it shows only while nothing is searched.
      category.toggleAttribute('data-filtered', !!query && !own);
      if (!query || own) places.push({ value: category.id, label: name });
      for (const tag of category.querySelectorAll<HTMLElement>('.tag')) {
        const any = !!tag.querySelector('sherpa-list-item:not([data-filtered])');
        tag.toggleAttribute('data-filtered', !any);
        if (any) places.push({ value: tag.id, label: `${name} › ${tag.querySelector('.tag-heading')?.getAttribute('data-heading') ?? ''}` });
      }
      shown += own;
    }
    this.toggleState('none', !!query && shown === 0);
    void this.$<SherpaElement>('.jump')?.populate(places);
  }

  /** Whether an item answers the search, its line said for how; and its `data-filtered`. */
  #match(item: HTMLElement, query: string): boolean {
    const kind = this.#kinds.get(item);
    const hit = kind && paletteMatch(kind, query);
    const type = hit?.type ? kind!.types![hit.type]! : undefined;
    item.toggleAttribute('data-filtered', !hit);
    if (hit?.type) this.#found.set(item, hit.type);
    else this.#found.delete(item);
    const line = type ? [type.label, type.help].filter(Boolean).join(': ') : kind && lineOf(kind);
    if (line) item.setAttribute('data-description', line);
    else item.removeAttribute('data-description');
    return !!hit;
  }

  /* ── Jump to ──────────────────────────────────────────────────────────── */

  /** A Jump to pick: the chip scrolled the list to that heading; the heading takes the focus once its menu shuts. */
  #onJump = (event: Event): void => {
    const { value } = (event as CustomEvent<{ value: string }>).detail;
    this.#jumped = this.root.getElementById(value)?.querySelector<HTMLElement>('.category-heading, .tag-heading') ?? null;
  };

  /** The menu shut, its focus back on the chip: a jump moves it on to the heading, so the next Tab is its first item. */
  #onJumpShut = (): void => {
    const heading = this.#jumped;
    this.#jumped = null;
    if (heading) requestAnimationFrame(() => heading.focus({ preventScroll: true }));
  };

  /* ── Floating ─────────────────────────────────────────────────────────── */

  /** Float, and lift where it is docked the first time; or dock back in its place. */
  #float(): void {
    const floating = this.hasAttribute('data-floating');
    const box = this.$<HTMLElement>('.box');
    // In place, and its shadow steps up: it is already a card floating 32px in.
    if (floating && box && !this.hasState('floating')) this.#floatBox.lift(box.getBoundingClientRect());
    this.toggleState('floating', floating);
  }

  /** Float, or dock, and report it. */
  #onFloat = (): void => {
    const floating = !this.hasAttribute('data-floating');
    this.set('data-floating', floating);
    this.emit('panel-float', { floating });
  };

  /* ── Placing ──────────────────────────────────────────────────────────── */

  /** A click on an item, or Enter on it: the button inside it clicks. */
  #onClick = (event: Event): void => {
    if (this.#dragged) return;
    const item = this.pathFind(event, 'sherpa-list-item[data-kind]');
    if (item) this.emit('node-add', this.#asked(item));
  };

  /** What placing an item asks for: its kind, and the type a search found it by. */
  #asked(item: HTMLElement): { kind: string | undefined; type?: string } {
    const type = this.#found.get(item);
    return { kind: item.dataset['kind'], ...(type ? { type } : {}) };
  }

  /** A press on an item, moved a few pixels: a drag. Let go off the card, it asks for the node there. */
  #onDown = (event: PointerEvent): void => {
    const item = this.pathFind(event, 'sherpa-list-item[data-kind]');
    if (event.button !== 0 || !item) return;
    const { clientX: x0, clientY: y0 } = event;
    const ghost = this.$('.ghost')!;
    const shorter = new AbortController();
    let moving = false;
    const follow = (e: PointerEvent): void => {
      if (!moving && Math.hypot(e.clientX - x0, e.clientY - y0) < THRESHOLD) return;
      if (!moving) {
        moving = true;
        ghost.textContent = item.dataset['label'] ?? '';
        this.toggleState('dragging', true);
      }
      const box = this.getBoundingClientRect();
      ghost.style.setProperty('--_x', `${e.clientX - box.left + 12}px`);
      ghost.style.setProperty('--_y', `${e.clientY - box.top + 12}px`);
    };
    const stop = (e: PointerEvent): void => {
      shorter.abort();
      if (!moving) return;
      this.toggleState('dragging', false);
      this.#dragged = true;
      setTimeout(() => { this.#dragged = false; });
      const card = this.$('.card')!.getBoundingClientRect();
      const over = e.clientX >= card.left && e.clientX <= card.right && e.clientY >= card.top && e.clientY <= card.bottom;
      if (e.type === 'pointerup' && !over) this.emit('node-add', { ...this.#asked(item), point: { x: e.clientX, y: e.clientY } });
    };
    this.on(window, 'pointermove', follow as EventListener, { while: shorter.signal });
    this.on(window, 'pointerup', stop as EventListener, { while: shorter.signal });
    this.on(window, 'pointercancel', stop as EventListener, { while: shorter.signal });
  };

  /* ── Add a node ───────────────────────────────────────────────────────── */

  /** Open "Add a node" where a line was let go: the kinds a socket of its type could join, a Value first. */
  askAdd(context: AddContext): void {
    // A family that fits only as another type says which: "Collection › Count".
    const choices = paletteFor(this.#palette, context.type, context.side).map(({ id, kind }) => {
      const type = fitOf(kind, context.type, context.side)?.type;
      return { id, heading: type ? `${kind.heading} › ${kind.types![type]!.label}` : kind.heading };
    });
    if (!choices.length) return;
    this.#context = context;
    this.renderItems('.add', 'template.choice-tpl', choices);
    const box = this.getBoundingClientRect();
    const anchor = this.$('.anchor')!;
    anchor.style.setProperty('--_ax', `${context.client.x - box.left}px`);
    anchor.style.setProperty('--_ay', `${context.client.y - box.top}px`);
    this.$<HTMLElement & { show(trigger?: HTMLElement): void }>('.add')?.show(anchor);
  }

  /** A choice of "Add a node": the node for the socket it was opened for. */
  #onChoose = (event: Event): void => {
    const { value } = (event as CustomEvent<{ value: string }>).detail;
    const context = this.#context;
    this.#context = null;
    if (context) this.emit('node-add', { kind: value, context });
  };
}

define('sherpa-node-panel', SherpaNodePanel);
