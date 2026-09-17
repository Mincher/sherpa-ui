/**
 * live-stores.ts — records the SERVER pushes.
 *
 * Every other store PULLS: something asks, the store answers. These two are the
 * other direction — the server speaks first, and whatever is bound redraws. A
 * notification count that is right without anybody refreshing is the case, and
 * it is one the layer could not express before.
 *
 * ## Two transports
 *
 *   SocketStore  WebSocket. TWO WAY — the client can send as well as receive,
 *                which a live cursor, a collaborative edit or an ack needs.
 *                Does NOT reconnect by itself, so this store backs off and
 *                retries.
 *
 *   EventStore   Server-Sent Events. ONE WAY, server → browser, over ordinary
 *                HTTP. Reconnects by itself, replays what was missed via
 *                Last-Event-ID, and passes through proxies that block WebSocket.
 *                For a feed that only ever ARRIVES — notifications — it is the
 *                better fit and the simpler of the two.
 *
 * Both are native. Neither adds a dependency, and both are real Stores, so a
 * DataSource binds to them exactly as it binds to an ArrayStore.
 *
 * ## What a message may say
 *
 * Either shape, and the message itself decides:
 *
 *   [{…}, {…}]                      these are now the rows
 *   { type: 'insert', row: {…} }    add one
 *   { type: 'update', row: {…} }    merge one, matched on the key
 *   { type: 'remove', key: 3 }      drop one
 *
 * The second is the SAME `StoreChangeDetail` shape every other store already
 * announces, so a server that speaks it is speaking the layer's own language —
 * and a 500-row push for one new notification is avoided.
 */
import { ArrayStore } from './stores.js';
import { readField, type LoadOptions, type LoadResult, type Row, type Store } from './store.js';
import type { StoreOptions } from './stores.js';

/** One thing a server can say. */
export type PushMessage =
  | Row[]
  | { type: 'insert'; row: Row }
  | { type: 'update'; row: Row; key?: unknown }
  | { type: 'remove'; key: unknown };

export interface LiveStoreOptions extends StoreOptions {
  /** Where to connect. */
  url: string;
  /** Rows to show before the first message lands. */
  rows?: readonly Row[];
  /**
   * Read the payload before the store does.
   *
   * A server rarely sends exactly what a store wants — a notification feed might
   * wrap its list in `{ data: [...] }`, or send a type this app does not care
   * about. This is where that is untangled, and returning `undefined` DROPS the
   * message, which is how a store subscribes to a shared channel and ignores
   * what is not its business.
   */
  parse?: (data: unknown) => PushMessage | undefined;
  /**
   * Feed an EXISTING store rather than making a new one.
   *
   * Several connections into ONE feed — alerts, builds and deploys arriving on
   * three sockets and appearing in one list — is impossible otherwise, because
   * each live store creates its own `ArrayStore` and a DataSource can bind only
   * one of them:
   *
   *   const feed = new ArrayStore([], { key: 'id', maxRows: 200 });
   *   new SocketStore({ url: alertsUrl,  into: feed });
   *   new SocketStore({ url: buildsUrl,  into: feed });
   *   new DataSource({ store: feed });   // one query over all three
   *
   * No new concept: the re-dispatch below already treats inner and outer as one
   * store, so this only changes WHERE the inner one comes from. A store passed
   * here is NOT owned — `rows` and `key` are its own, and nothing here
   * disconnects it.
   */
  into?: ArrayStore;
}

/**
 * Shared plumbing for a store fed by a connection.
 *
 * The records live in an ArrayStore, because everything AFTER receiving them —
 * sorting, filtering, paging, the schema guard, copy-in/copy-out — is work that
 * is already written and correct. This class is only about the wire.
 */
abstract class LiveStore extends EventTarget implements Store {
  readonly key: string;
  protected readonly inner: ArrayStore;
  protected readonly options: LiveStoreOptions;
  /** Whether the connection is currently up — see `connected`. */
  #connected = false;

  constructor(options: LiveStoreOptions) {
    super();
    this.options = options;
    this.key = options.key ?? 'id';
    // A SHARED store when one is given: several connections, one feed. Its own
    // `rows`/`key` win, because it may already hold another socket's messages.
    this.inner = options.into ?? new ArrayStore(options.rows ?? [], options);
    // The inner store's changes are THIS store's changes. A DataSource listens
    // to one thing and never learns there are two.
    this.inner.addEventListener('change', (event) => {
      this.dispatchEvent(new CustomEvent('change', { detail: (event as CustomEvent).detail }));
    });
  }

  /** Is the connection up? */
  get connected(): boolean {
    return this.#connected;
  }

  /**
   * Open the connection. Safe to call twice — the second is a no-op.
   *
   * NOT called by the constructor. A store that connected on construction would
   * open a socket for a view that was built and never shown, and there would be
   * no moment for a caller to attach a listener before the first message.
   */
  abstract connect(): void;

  /** Close it. A component that is going away must not hold a socket open. */
  abstract disconnect(): void;

  protected setConnected(value: boolean): void {
    if (this.#connected === value) return;
    this.#connected = value;
    // A UI can show "reconnecting…" off this rather than guessing from silence.
    this.dispatchEvent(new CustomEvent('connection', { detail: { connected: value } }));
  }

  /**
   * A message arrived — apply it.
   *
   * Everything a wire can go wrong with funnels here: bad JSON, a shape nobody
   * expected, a type this store does not handle. None of them throw, because a
   * throw inside a socket handler kills the handler and the page goes quiet with
   * no sign of why. They report instead.
   */
  protected receive(raw: unknown): void {
    let message: PushMessage | undefined;
    try {
      message = this.options.parse ? this.options.parse(raw) : (raw as PushMessage);
    } catch (error) {
      this.#fail('parse', error);
      return;
    }
    // `undefined` is how parse() says "not mine" — a store on a shared channel
    // ignoring a message meant for another.
    if (message == null) return;

    void this.#apply(message);
  }

  async #apply(message: PushMessage): Promise<void> {
    try {
      // A whole ARRAY replaces the set. `setRows` announces for us.
      if (Array.isArray(message)) {
        this.inner.setRows(message);
        return;
      }

      switch (message.type) {
        case 'insert':
          await this.inner.insert(message.row);
          return;
        case 'update': {
          // The key may travel separately, or be inside the row — a server that
          // sends the whole record should not also have to name its id.
          const key = message.key ?? readField(message.row, this.key);
          await this.inner.update(key, message.row);
          return;
        }
        case 'remove':
          await this.inner.remove(message.key);
          return;
      }
    } catch (error) {
      // A push the SCHEMA refused lands here, which is the point of putting the
      // guard on the store: a bad record from a server is stopped exactly where
      // a bad record from a form is.
      this.#fail('apply', error);
    }
  }

  #fail(stage: 'parse' | 'apply' | 'connection', error: unknown): void {
    this.dispatchEvent(new CustomEvent('error', { detail: { stage, error } }));
  }

  protected failConnection(error: unknown): void {
    this.#fail('connection', error);
  }

  /* ── Store, delegated ────────────────────────────────────────────── */

  load(options?: LoadOptions): Promise<LoadResult> {
    return this.inner.load(options);
  }
  byKey(key: unknown): Promise<Row | undefined> {
    return this.inner.byKey(key);
  }
  totalCount(options?: LoadOptions): Promise<number> {
    return this.inner.totalCount(options);
  }

  /**
   * A LOCAL write.
   *
   * It changes what is on screen and does NOT travel to the server — the server
   * is the one pushing, and this store has no route back to it. A caller that
   * needs the change to stick sends it their own way (a POST, a SocketStore's
   * `send`) and lets the next push confirm it.
   */
  insert(values: Row): Promise<Row> {
    return this.inner.insert(values);
  }
  update(key: unknown, values: Row): Promise<Row> {
    return this.inner.update(key, values);
  }
  remove(key: unknown): Promise<void> {
    return this.inner.remove(key);
  }
}

/* ── EventStore — Server-Sent Events ───────────────────────────────── */

export interface EventStoreOptions extends LiveStoreOptions {
  /**
   * Listen for a NAMED event rather than the default unnamed one.
   *
   * SSE messages can carry an `event:` line, which is how one endpoint serves
   * several feeds. Named here, the store hears only its own.
   */
  eventName?: string;
  /** Send cookies with the request — for a feed behind a session. */
  withCredentials?: boolean;
}

/**
 * Records pushed over Server-Sent Events.
 *
 *   const notifications = new EventStore({ url: '/events/notifications' });
 *   const source = new DataSource({ store: notifications });
 *   source.bind(menu, { as: (rows) => rows });
 *   notifications.connect();
 *
 * SSE over WebSocket for a feed like this, for three reasons that all matter:
 * it is ordinary HTTP so proxies and CDNs do not block it, the browser
 * RECONNECTS on its own, and `Last-Event-ID` lets the server replay what was
 * missed while the connection was down — which is exactly what a notification
 * list must not lose.
 */
export class EventStore extends LiveStore {
  #source: EventSource | null = null;

  /* NOT a useless constructor, though it looks like one. Without it this class
     inherits `LiveStore`'s signature and would accept a bare
     `LiveStoreOptions` — so a caller could construct a EventStore with none of the
     fields that make it one, and TypeScript would allow it. The body is
     `super(options)` precisely because the only job here is NARROWING the
     parameter type. */
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- narrows the options type; see above
  constructor(options: EventStoreOptions) {
    super(options);
  }

  override connect(): void {
    if (this.#source) return;
    const options = this.options as EventStoreOptions;
    const source = new EventSource(options.url, {
      withCredentials: options.withCredentials ?? false,
    });
    this.#source = source;

    source.addEventListener('open', () => this.setConnected(true));
    source.addEventListener('error', (event) => {
      // NOT fatal. EventSource reconnects by itself, so an error here usually
      // means "the connection dropped and I am retrying" rather than "give up" —
      // closing it would throw away the retry the browser is already doing.
      this.setConnected(false);
      this.failConnection(event);
    });

    const onMessage = (event: MessageEvent<string>): void => {
      try {
        this.receive(JSON.parse(event.data));
      } catch (error) {
        // A message that is not JSON is still a message — it reports and the
        // connection carries on rather than the feed dying on one bad line.
        this.failConnection(error);
      }
    };

    if (options.eventName) source.addEventListener(options.eventName, onMessage as EventListener);
    else source.addEventListener('message', onMessage as EventListener);
  }

  override disconnect(): void {
    this.#source?.close();
    this.#source = null;
    this.setConnected(false);
  }
}

/* ── SocketStore — WebSocket ───────────────────────────────────────── */

export interface SocketStoreOptions extends LiveStoreOptions {
  /** Sub-protocols, passed straight to the WebSocket constructor. */
  protocols?: string | string[];
  /**
   * Try again after a drop, backing off. Default true.
   *
   * WebSocket does NOT reconnect by itself — unlike EventSource — so without
   * this a page that loses its connection for a moment stays silent until it is
   * reloaded.
   */
  reconnect?: boolean;
}

/**
 * Records over a WebSocket — two-way.
 *
 * Use it when the client also SENDS: a cursor position, a collaborative edit, an
 * acknowledgement. For a feed that only ever arrives, prefer EventStore, which
 * reconnects and replays for free.
 */
export class SocketStore extends LiveStore {
  #socket: WebSocket | null = null;
  #retry = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #closing = false;

  /** How long to wait before retry N, capped. */
  static readonly BACKOFF_MS = [500, 1000, 2000, 5000, 10000] as const;

  /* NOT a useless constructor, though it looks like one. Without it this class
     inherits `LiveStore`'s signature and would accept a bare
     `LiveStoreOptions` — so a caller could construct a SocketStore with none of the
     fields that make it one, and TypeScript would allow it. The body is
     `super(options)` precisely because the only job here is NARROWING the
     parameter type. */
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor -- narrows the options type; see above
  constructor(options: SocketStoreOptions) {
    super(options);
  }

  override connect(): void {
    if (this.#socket) return;
    this.#closing = false;
    const options = this.options as SocketStoreOptions;
    const socket = options.protocols
      ? new WebSocket(options.url, options.protocols)
      : new WebSocket(options.url);
    this.#socket = socket;

    socket.addEventListener('open', () => {
      // A successful connection resets the backoff, so a long-lived page that
      // drops once an hour does not creep up to a ten-second wait.
      this.#retry = 0;
      this.setConnected(true);
    });

    socket.addEventListener('message', (event: MessageEvent<string>) => {
      try {
        this.receive(JSON.parse(event.data));
      } catch (error) {
        this.failConnection(error);
      }
    });

    socket.addEventListener('error', (event) => this.failConnection(event));
    socket.addEventListener('close', () => {
      this.#socket = null;
      this.setConnected(false);
      // A deliberate disconnect() must not reconnect — that is what #closing
      // separates from a drop.
      if (!this.#closing && (options.reconnect ?? true)) this.#scheduleRetry();
    });
  }

  #scheduleRetry(): void {
    const steps = SocketStore.BACKOFF_MS;
    const wait = steps[Math.min(this.#retry, steps.length - 1)]!;
    this.#retry += 1;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.connect();
    }, wait);
  }

  override disconnect(): void {
    this.#closing = true;
    if (this.#timer != null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#socket?.close();
    this.#socket = null;
    this.setConnected(false);
  }

  /**
   * Send something up the same connection.
   *
   * The half EventStore cannot do. Returns false when the socket is not open,
   * rather than throwing or queueing: a caller that must not lose the message
   * should hear so and decide, and a silent queue that drains on reconnect
   * delivers stale messages in a new context.
   */
  send(data: unknown): boolean {
    if (this.#socket?.readyState !== WebSocket.OPEN) return false;
    this.#socket.send(typeof data === 'string' ? data : JSON.stringify(data));
    return true;
  }
}
