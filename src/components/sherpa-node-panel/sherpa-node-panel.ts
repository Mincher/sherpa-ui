/**
 * sherpa-node-panel — the nodes a graph editor may place, by category, in a card docked on a canvas.
 *
 * It re-makes nothing: a sherpa-container, sherpa-tabs (Preset Nodes, Custom Nodes) and a sherpa-input-text for the search,
 * a sherpa-section-header per category that sticks while its items scroll, a sherpa-list of
 * sherpa-list-items, and a sherpa-menu for "Add a node". It places nothing either: an item
 * clicked, Enter on it, or dragged off the card is `node-add`, and the editor that hears it makes
 * the node. An item is a FAMILY: its line is its kind's synopsis, and the search finds it by any
 * type's name, or by a tag: "round" finds Math, placed as Round. TRAP T-the-node-panel-asks-it-places
 * A Custom Node is listed under each of its tags. TRAP T-a-node-panel-lists-under-sticky-headings
 * Docked flush in its canvas's panel area, it floats there as an overlay panel floats in the window, by the
 * same code. TRAP T-a-floating-panel-is-a-state
 *
 * Map:
 * - AddContext — Where "Add a node" opens, and what it is for: a socket of a type, dragged to a point.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { FLOAT_ATTRS, FloatBox, roomOf } from '../../core/ui/float-box.js';
import { fitOf, paletteFor, paletteMatch, type NodeKind, type PaletteGroup, type PaletteItem, type SocketType } from '../../core/data/node-kinds.js';
import { takesGiven, type Given } from '../../core/data/node-input.js';
// Defined before the template stamps them.
import '../sherpa-button/sherpa-button.js';
import '../sherpa-container/sherpa-container.js';
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-input-text/sherpa-input-text.js';
import '../sherpa-list/sherpa-list.js';
import '../sherpa-list-item/sherpa-list-item.js';
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-tabs/sherpa-tabs.js';
import '../sherpa-section-header/sherpa-section-header.js';

/** Where "Add a node" opens, and what it is for: a socket of a type, a line let go at a point.
 *  The panel hands it back on `node-add` untouched. */
export interface AddContext {
  /** The socket the line came from, `node` or `node/row`. */
  socket: string;
  /** Its type, and which side it is: an OUTPUT sends into the new node, an INPUT takes from it. */
  type: SocketType;
  side: 'out' | 'in';
  /** What an output sends, finer than its type: a Field's column offers only the kinds that can use one. */
  gives?: Given;
  /** Where it was let go: on the screen, to open the menu; on the plane, to place the node. */
  client: { x: number; y: number };
  at: { x: number; y: number };
}

/** The two lists: the kinds a file gives, and the Custom Nodes a reader saved. */
const TABS = [{ id: 'preset', label: 'Preset Nodes' }, { id: 'custom', label: 'Custom Nodes' }] as const;
const CUSTOM = 'Custom Nodes';
const tabOf = (category: string): string => (category === CUSTOM ? 'custom' : 'preset');

/** How far a pointer travels before a press on an item becomes a drag. */
const THRESHOLD = 4;

/** An item's line: its kind's synopsis, never its types (809). A preset says it is read only. */
function lineOf(kind: NodeKind): string | undefined {
  if ('preset' in kind && kind.preset) return `Preset, read only.${kind.description ? ` ${kind.description}` : ''}`;
  return kind.description;
}

/** One category as drawn: its items with no tag, then a group per tag, each with an id. */
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

  /** Floating, in its canvas: its area's layout is its room, the whole canvas. TRAP T-a-panel-area-is-a-layout */
  readonly #floatBox: FloatBox = new FloatBox({
    el: this,
    box: () => this.$<HTMLElement>('.box'),
    room: () => roomOf(this),
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
    this.on(this.$('.tabs')!, 'tab-select', this.#onTab);
    void this.$<SherpaElement>('.tabs')?.populate(TABS.map(({ id, label }) => ({ id, label })));
    // `button-click`, not `click`: a disabled sherpa-button still gets raw clicks.
    this.on(this.$('.float')!, 'button-click', this.#onFloat);
    this.#floatBox.wire(this.$('.heading'), this.$('.grip'), this.$('.corner'));
    this.#floatBox.draw();
    this.toggleState('floating', this.hasAttribute('data-floating'));
    this.#floatBox.floated(this.hasAttribute('data-floating'));
    this.$<HTMLElement>('.categories')?.setAttribute('data-tab', 'preset');
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
        // An id is no field a template writes.
        node.id = group.anchor;
        node.dataset['group'] = tabOf(group.category);
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

  /** A tab was picked: its list shows. */
  #onTab = (event: Event): void => {
    this.#showTab((event as CustomEvent<{ id: string }>).detail.id);
  };

  /** Show one tab's categories; CSS hides the rest. */
  #showTab(id: string): void {
    this.$<HTMLElement>('.categories')?.setAttribute('data-tab', id);
    this.#search();
  }

  /** Narrow the items to those whose name, a tag, or a type's name holds what is typed; a heading with none under
   *  it is hidden. An item found by a type, not by its name, says that type and its line, and places it. Each tab
   *  wears the count of its matches while something is typed, so a match on the other tab is not missed. */
  #search(): void {
    const query = (this.$<HTMLInputElement>('.find')?.value ?? '').trim().toLowerCase();
    let shown = 0;
    const current = this.$('.tabs')?.getAttribute('data-current-id') ?? 'preset';
    const counts: Record<string, number> = { preset: 0, custom: 0 };
    for (const category of this.$$('.categories > .category')) {
      let own = 0;
      for (const item of category.querySelectorAll<HTMLElement>('sherpa-list-item')) if (this.#match(item, query)) own++;
      // A heading with nothing under it shows only while nothing is searched.
      category.toggleAttribute('data-filtered', !!query && !own);
      for (const tag of category.querySelectorAll<HTMLElement>('.tag')) {
        const any = !!tag.querySelector('sherpa-list-item:not([data-filtered])');
        tag.toggleAttribute('data-filtered', !any);
      }
      counts[category.dataset['group'] ?? 'preset']! += own;
      if (category.dataset['group'] === current) shown += own;
    }
    this.toggleState('none', !!query && shown === 0);
    void this.$<SherpaElement>('.tabs')?.populate(TABS.map(({ id, label }) => ({ id, label, badge: query ? String(counts[id]) : '' })));
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

  /* ── Floating ─────────────────────────────────────────────────────────── */

  /** Float, and lift where it is docked the first time, 16px in on each side, so it visibly lifts; or dock back
   *  in its area. To the front as it floats. TRAP T-a-pressed-panel-comes-to-the-front */
  #float(): void {
    const floating = this.hasAttribute('data-floating');
    const box = this.$<HTMLElement>('.box');
    if (floating && box && !this.hasState('floating')) {
      const inset = parseFloat(getComputedStyle(this).getPropertyValue('--sherpa-layout-grid-padding')) || 16;
      this.#floatBox.lift(box.getBoundingClientRect(), inset);
    }
    this.toggleState('floating', floating);
    this.#floatBox.floated(floating);
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
    const choices = paletteFor(this.#palette, context.type, context.side).filter(({ kind }) => !context.gives || takesGiven(kind, context.gives)).map(({ id, kind }) => {
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
