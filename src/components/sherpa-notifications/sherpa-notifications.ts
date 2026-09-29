/**
 * sherpa-notifications — the bell's list, as a menu.
 *
 * Composed throughout: <sherpa-menu> for the card, <sherpa-list-item> for each
 * row, <sherpa-button> for the action. This file owns only WHICH notifications
 * there are and what happens when one is clicked.
 *
 * It takes rows through `populate()`, so a DataSource binds to it like anything
 * else — which is the point. Point it at a SocketStore or an EventStore and the
 * list is right without anybody refreshing:
 *
 *   const feed = new SocketStore({ url: 'wss://…/notifications' });
 *   new DataSource({ store: feed }).bind(notifications);
 *   feed.connect();
 *
 * Map:
 * - Notification — one notification: id, label, description, icon, time, and whether it is unread
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-list-item/sherpa-list-item.js';
import '../sherpa-button/sherpa-button.js';

export interface Notification {
  id: string;
  /**
   * The notification's headline.
   *
   * `label`, matching the `data-label` it is written into and the rest of the
   * library. `title` is kept as the old spelling — it was translated in the one
   * line where both met, which is the same shape sherpa-metric carried.
   */
  label?: string;
  /** @deprecated The old spelling of `label`. Still read, so nothing breaks. */
  title?: string;
  description?: string;
  /** An icon name for the leading glyph. */
  icon?: string;
  /** Already-formatted, e.g. "2m ago" — this component does not format time. */
  time?: string;
  unread?: boolean;
}

export class SherpaNotifications extends SherpaElement {
  static override css = new URL('./sherpa-notifications.css', import.meta.url);
  static override html = new URL('./sherpa-notifications.html', import.meta.url);
  static override observed = ['data-empty-text'];

  /** The notifications, as populated. */
  #items: Notification[] = [];

  override onRender(): void {
    // Delegated from the HOST, not the menu: the rows are slotted into the
    // menu's light DOM, so a click starts inside a list item's own shadow root
    // and the host is the one place every route passes through.
    this.addEventListener('click', this.#onClick);
    /* The card's own state, because `menu.open` cannot answer a CLICK: the
       native popover light-dismisses on pointerdown, so by the time the click
       lands an open menu already reads shut.
       TRAP T-a-trigger-click-follows-light-dismiss */
    this.addEventListener('menu-open', this.#onMenuToggle);
    this.addEventListener('menu-close', this.#onMenuToggle);
    this.#render();
  }

  /** populate([{ id, title, … }]) — the notifications. */
  protected override renderData(data: unknown): void {
    this.#items = Array.isArray(data) ? (data as Notification[]) : [];
    this.#render();
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  /** How many are unread — what the bell's badge shows. */
  get unreadCount(): number {
    return this.#items.filter((n) => n.unread).length;
  }

  /** Open the list, anchored to whatever opened it (the bell). */
  show(trigger?: HTMLElement): void {
    this.#menu()?.show(trigger);
  }

  hide(): void {
    this.#menu()?.hide();
  }

  /**
   * @see hide — accepted so one verb closes every Sherpa component.
   * TRAP T-one-verb-proxies-to-the-native-one
   */
  close(): void {
    this.hide();
  }

  /**
   * Open if shut, shut if open — what a bell click does.
   *
   * `#open` decides, NOT `menu.open`. Measured before this: the bell opened the
   * list and no later click could shut it, because light-dismiss had already
   * closed the card and `toggle()` re-opened what the reader just closed.
   * TRAP T-a-trigger-click-follows-light-dismiss
   */
  toggle(trigger?: HTMLElement): void {
    const wasOpen = this.#open;
    this.#open = false;
    if (wasOpen) this.#menu()?.hide();
    else this.#menu()?.show(trigger);
  }

  /** Whether the card is open, as the last menu event reported it. */
  #open = false;

  /** Track whether the menu is open, and say so in this component's own words. */
  #onMenuToggle = (event: Event): void => {
    this.#open = event.type === 'menu-open';
    this.emit(this.#open ? 'notifications-open' : 'notifications-close');
  };

  /* ── Private ─────────────────────────────────────────────────────── */

  /** The dropdown menu the notifications list in. */
  #menu(): (HTMLElement & { show(t?: HTMLElement): void; hide(): void; toggle(t?: HTMLElement): void }) | null {
    return this.$('.menu');
  }

  /** Draw the list, or the "all caught up" state when it is empty. */
  #render(): void {
    const menu = this.#menu();
    if (!menu) return;

    // EMPTY is its own state, not an empty list. A menu with nothing in it reads
    // as broken rather than as "you are up to date".
    this.toggleAttribute('data-empty', this.#items.length === 0);
    if (!this.#items.length) {
      // Clear only the ROWS, for the same reason — replaceChildren would take
      // the header slot with them.
      for (const node of this.$$('.menu > .notification, .menu > .empty')) node.remove();
      const empty = this.clone('template.empty-tpl');
      if (empty) {
        empty.textContent = this.dataset['emptyText'] ?? 'No notifications';
        menu.appendChild(empty);
      }
      return;
    }

    // `own-children`, not `replace`: the header slot holding "Mark all read" is a
    // fixed part of the template and lives in the same light DOM the rows are
    // stamped into. Emptying the menu took it with them.
    // The prototype declares id, label (with its data-title alias), description,
    // the unread flag and the time. Only the icon is left: it replaces the whole
    // className rather than writing an attribute, because the glyph and the
    // element's own `.notification-icon` class share that one property.
    this.renderItems('.menu', 'template.notification-tpl', this.#items, {
      clear: 'own-children',
      ownSel: '.menu > .notification, .menu > .empty',
      after: (node, item) => {
        const icon = node.querySelector<HTMLElement>('.notification-icon');
        if (icon) icon.className = `notification-icon ${item.icon ?? 'status-info'}`;
      },
    });
  }

  /** Mark all read, or open one notification. */
  #onClick = (event: Event): void => {
    // MARK ALL READ, before the row check — the button is inside the menu the
    // rows are in.
    if (this.pathFind(event, '.read-all')) {
      const ids = this.#items.filter((n) => n.unread).map((n) => n.id);
      // Marked LOCALLY as well as reported. A host that persists this will push
      // the same change back, and a list that waited for that round trip would
      // sit unread-looking for as long as the network took.
      this.#items = this.#items.map((n) => ({ ...n, unread: false }));
      this.#render();
      this.emit('notification-read', { ids });
      return;
    }

    const row = this.pathFind(event, '.notification');
    if (!row) return;
    const id = row.dataset['id'];
    const notification = this.#items.find((n) => n.id === id);
    if (!notification) return;
    this.emit('notification-click', { id, notification });
  };
}

customElements.define('sherpa-notifications', SherpaNotifications);
