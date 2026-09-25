/**
 * live-stores.ts — records the SERVER pushes. Every other store PULLS.
 *
 * A message is either the whole set, `[{…}]`, or one `StoreChangeDetail`:
 * `{type:'insert'|'update'|'remove', …}` — the same shape every store announces.
 *
 * TRAP T-sse-over-websocket-for-a-feed
 *
 * Map:
 * - PushMessage — One thing a server can say.
 * - LiveStoreOptions — the URL, the rows to show first, and how to read a message
 * - EventStoreOptions — a live store over Server-Sent Events
 * - EventStore — Records pushed over Server-Sent Events — `new EventStore({ url })`, then `.connect()`.
 * - SocketStoreOptions — a live store over a WebSocket, which can also send
 * - SocketStore — Records over a WebSocket — two-way.
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
  /** Read the payload first. Returning `undefined` DROPS the message. */
  parse?: (data: unknown) => PushMessage | undefined;
  /** Feed an EXISTING store, not owned. TRAP T-live-store-into-shares-one-feed */
  into?: ArrayStore;
}

/** Shared plumbing for a store fed by a connection — only about the wire. */
abstract class LiveStore extends EventTarget implements Store {
  readonly key: string;
  readonly time: string | undefined;
  protected readonly inner: ArrayStore;
  protected readonly options: LiveStoreOptions;
  /** Is the connection up. */
  #connected = false;

  constructor(options: LiveStoreOptions) {
    super();
    this.options = options;
    this.key = options.key ?? 'id';
    this.time = options.time;
    this.inner = options.into ?? new ArrayStore(options.rows ?? [], options);
    // The inner store's changes are THIS store's changes, so a DataSource
    // listens to one thing and never learns there are two.
    this.inner.addEventListener('change', (event) => {
      this.dispatchEvent(new CustomEvent('change', { detail: (event as CustomEvent).detail }));
    });
  }

  /** Is the connection up? */
  get connected(): boolean {
    return this.#connected;
  }

  /**
   * Open the connection. Safe to call twice. NOT called by the constructor: that
   * opens a socket for a view never shown, and leaves no moment to attach a
   * listener before message one.
   */
  abstract connect(): void;

  /** Close it. A component that is going away must not hold a socket open. */
  abstract disconnect(): void;

  protected setConnected(value: boolean): void {
    if (this.#connected === value) return;
    this.#connected = value;
    // So a UI can show "reconnecting…".
    this.dispatchEvent(new CustomEvent('connection', { detail: { connected: value } }));
  }

  /** Apply a message. TRAP T-push-handler-never-throws — a throw kills the handler. */
  protected receive(raw: unknown): void {
    let message: PushMessage | undefined;
    try {
      message = this.options.parse ? this.options.parse(raw) : (raw as PushMessage);
    } catch (error) {
      this.#fail('parse', error);
      return;
    }
    // `undefined` is how parse() says "not mine".
    if (message == null) return;

    void this.#apply(message);
  }

  /** Apply one pushed message to the rows: a whole set, or one change. */
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
          // The key may travel separately, or sit inside the row.
          const key = message.key ?? readField(message.row, this.key);
          await this.inner.update(key, message.row);
          return;
        }
        case 'remove':
          await this.inner.remove(message.key);
          return;
      }
    } catch (error) {
      // A push the SCHEMA refused lands here.
      this.#fail('apply', error);
    }
  }

  /** Report a failure as an `error` event, naming the stage it broke at. */
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

  /** A LOCAL write — TRAP T-socket-send-refuses-rather-than-queues. */
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
  /** Listen for a NAMED `event:` line — one endpoint, several feeds. */
  eventName?: string;
  /** Send cookies with the request — for a feed behind a session. */
  withCredentials?: boolean;
}

/**
 * Records pushed over Server-Sent Events — `new EventStore({ url })`, then
 * `.connect()`. TRAP T-sse-over-websocket-for-a-feed
 */
export class EventStore extends LiveStore {
  /** The open Server-Sent Events stream, or null. */
  #source: EventSource | null = null;

  /* TRAP T-narrowing-constructor-is-not-useless — narrows the options type. */
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
      // TRAP T-eventsource-error-is-not-fatal — the browser is already retrying.
      this.setConnected(false);
      this.failConnection(event);
    });

    const onMessage = (event: MessageEvent<string>): void => {
      try {
        this.receive(JSON.parse(event.data));
      } catch (error) {
        // Not JSON is still a message — TRAP T-push-handler-never-throws.
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
  /** Retry after a drop, backing off. Default true. TRAP T-eventsource-error-is-not-fatal */
  reconnect?: boolean;
}

/**
 * Records over a WebSocket — two-way. Use it when the client also SENDS; for a
 * feed that only arrives, prefer EventStore, which reconnects and replays free.
 */
export class SocketStore extends LiveStore {
  /** The open socket, or null. */
  #socket: WebSocket | null = null;
  /** How many reconnects in a row — the step into the back-off. */
  #retry = 0;
  /** The pending reconnect. */
  #timer: ReturnType<typeof setTimeout> | null = null;
  /** Closing on purpose, so a close is not retried. */
  #closing = false;

  /** How long to wait before retry N, capped. */
  static readonly BACKOFF_MS = [500, 1000, 2000, 5000, 10000] as const;

  /* TRAP T-narrowing-constructor-is-not-useless — narrows the options type. */
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
      // #closing separates a deliberate disconnect() from a drop.
      if (!this.#closing && (options.reconnect ?? true)) this.#scheduleRetry();
    });
  }

  /** Reconnect after the next back-off step. */
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

  /** Send up the same connection; false when shut. TRAP T-socket-send-refuses-rather-than-queues */
  send(data: unknown): boolean {
    if (this.#socket?.readyState !== WebSocket.OPEN) return false;
    this.#socket.send(typeof data === 'string' ? data : JSON.stringify(data));
    return true;
  }
}
