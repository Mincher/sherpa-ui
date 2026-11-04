/**
 * sherpa-node-panel — the nodes a graph editor may place, by category, in a floating card.
 *
 * It re-makes nothing: a sherpa-container, a sherpa-input-text for the search, a sherpa-accordion
 * per category, a sherpa-list of sherpa-list-items, and a sherpa-menu for "Add a node". It places
 * nothing either: an item clicked, Enter on it, or dragged off the card is `node-add`, and the
 * editor that hears it makes the node. TRAP T-the-node-panel-asks-it-places
 *
 * Map:
 * - AddContext — Where "Add a node" opens, and what it is for: a socket of a type, dragged to a point.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { paletteFor, type PaletteGroup, type SocketType } from '../../core/data/node-kinds.js';
// Defined before the template stamps them.
import '../sherpa-accordion/sherpa-accordion.js';
import '../sherpa-container/sherpa-container.js';
import '../sherpa-container-header/sherpa-container-header.js';
import '../sherpa-input-text/sherpa-input-text.js';
import '../sherpa-list/sherpa-list.js';
import '../sherpa-list-item/sherpa-list-item.js';
import '../sherpa-menu/sherpa-menu.js';

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

export class SherpaNodePanel extends SherpaElement {
  static override css = new URL('./sherpa-node-panel.css', import.meta.url);
  static override html = new URL('./sherpa-node-panel.html', import.meta.url);

  /** The categories, as populated. */
  #palette: readonly PaletteGroup[] = [];
  /** What "Add a node" is open for, until a choice or a close. */
  #context: AddContext | null = null;
  /** A drag just ended: the click it makes is not a place. */
  #dragged = false;

  override onRender(): void {
    this.on(this.root, 'input', this.#onSearch);
    this.on(this.root, 'click', this.#onClick);
    this.on(this.root, 'pointerdown', this.#onDown as EventListener);
    this.on(this.$('.add')!, 'menu-select', this.#onChoose);
    this.#draw();
  }

  /** populate(paletteOf(kinds)) — each category and its kinds. */
  protected override renderData(data: unknown): void {
    this.#palette = Array.isArray(data) ? (data as PaletteGroup[]) : [];
    this.#draw();
  }

  /** Stamp each category and its items, then apply the search. */
  #draw(): void {
    this.renderItems('.categories', 'template.category-tpl', this.#palette, {
      after: (node, group) => {
        node.toggleAttribute('data-empty', !group.items.length);
        const list = node.querySelector('.items')!;
        for (const { id, kind } of group.items) {
          // A preset is a file's: read only, and its line says so.
          const preset = 'preset' in kind && !!kind.preset;
          const item = this.cloneItem('template.item-tpl', {
            id, heading: kind.heading, icon: kind.icon, description: preset ? `Preset, read only.${kind.description ? ` ${kind.description}` : ''}` : kind.description,
          });
          if (item && preset) item.toggleAttribute('data-preset', true);
          if (item) list.append(item);
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

  /** Narrow the items to those whose name holds what is typed; a category with none is hidden, and one with a match is open. */
  #search(): void {
    const query = (this.$<HTMLInputElement>('.find')?.value ?? '').trim().toLowerCase();
    let shown = 0;
    for (const category of this.$$('.categories > sherpa-accordion')) {
      let own = 0;
      for (const item of category.querySelectorAll<HTMLElement>('sherpa-list-item')) {
        const hit = !query || (item.dataset['label'] ?? '').toLowerCase().includes(query);
        item.toggleAttribute('data-filtered', !hit);
        if (hit) own++;
      }
      // A category with nothing in it shows only while nothing is searched.
      category.toggleAttribute('data-filtered', !!query && !own);
      if (query && own) category.setAttribute('open', '');
      shown += own;
    }
    this.toggleState('none', !!query && shown === 0);
  }

  /* ── Placing ──────────────────────────────────────────────────────────── */

  /** A click on an item, or Enter on it: the button inside it clicks. */
  #onClick = (event: Event): void => {
    if (this.#dragged) return;
    const item = this.pathFind(event, 'sherpa-list-item[data-kind]');
    if (item) this.emit('node-add', { kind: item.dataset['kind'] });
  };

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
      if (e.type === 'pointerup' && !over) this.emit('node-add', { kind: item.dataset['kind'], point: { x: e.clientX, y: e.clientY } });
    };
    this.on(window, 'pointermove', follow as EventListener, { while: shorter.signal });
    this.on(window, 'pointerup', stop as EventListener, { while: shorter.signal });
    this.on(window, 'pointercancel', stop as EventListener, { while: shorter.signal });
  };

  /* ── Add a node ───────────────────────────────────────────────────────── */

  /** Open "Add a node" where a line was let go: the kinds a socket of its type could join, a Value first. */
  askAdd(context: AddContext): void {
    const choices = paletteFor(this.#palette, context.type, context.side).map(({ id, kind }) => ({ id, heading: kind.heading }));
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
