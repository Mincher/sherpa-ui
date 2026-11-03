/**
 * trace.ts — ONE trace stream: each step a host takes — the page, its Service
 * Worker, a server — as a span, joined across hosts by one trace id, and said to
 * every context on one BroadcastChannel; a graph's step names its node. Nobody
 * listens: no span is made. DOM-free. TRAP T-one-trace-stream
 *
 * Map:
 * - TraceHost — Where a span ran: the page, its Service Worker, or a server.
 * - Span — One step a host took: when, how long, and the trace it belongs to.
 * - TRACE_CHANNEL — The BroadcastChannel spans are said on, to every context.
 * - TraceContext — The span a step runs under: its host, its trace, its id.
 * - OpenSpan — A span begun; `end()` says it again, with how long it took.
 * - onTrace — Hear every span, from every context; the function it returns stops.
 * - tracing — Does anyone listen, here or in another context?
 * - startSpan — Begin a span under the one running, or null when nobody listens.
 * - StepState — How a graph's node stands as its step runs: begun, then done, failed or skipped.
 * - OpenStep — A step begun: `end()` says how it ended — done unless told — and its `rows`.
 * - StepOptions — Where a step runs and what it says: its graph, its span's step, the rows it ended with.
 * - traceStep — Say that a graph's node ran its step: a span naming the node, its state, time and rows.
 * - within — Run `run` with a span as the one its calls begin under.
 * - traceparent — A span as the W3C `traceparent` a request carries.
 * - readTraceparent — A request's `traceparent` as the span it was sent under, or null.
 */

/** Where a span ran: the page, its Service Worker, or a server. */
export type TraceHost = 'page' | 'worker' | 'server';

/** One step a host took: when, how long, and the trace it belongs to. A span is
 *  said as it begins, without `ms`, and again as it ends. */
export interface Span {
  host: TraceHost;
  /** What it did: `load`, `request`, `answer`, `hold`, `recheck`, `send`. */
  step: string;
  /** The store's name, where the step has one. */
  store?: string;
  /** Every span of one act, on every host, carries it: W3C's trace-id. */
  trace: string;
  /** This span's own id. */
  id: string;
  /** The span it ran under: on its own host, or the one that asked. */
  parent?: string;
  /** When it began, in ms since the epoch. */
  t: number;
  /** How long it took, in ms: none while it runs. */
  ms?: number;
  detail?: Readonly<Record<string, string | number | boolean>>;
}

/** The BroadcastChannel spans are said on, to every context. */
export const TRACE_CHANNEL = 'sherpa-trace';

/** The span a step runs under: its host, its trace, its id. */
export interface TraceContext {
  readonly host: TraceHost;
  readonly trace: string;
  readonly id: string;
  readonly store?: string;
  /** Asked for by the request that carried it: said even where no listener is known. */
  readonly sampled?: boolean;
}

/** A span begun; `end()` says it again, with how long it took. */
export interface OpenSpan extends TraceContext {
  end(detail?: Span['detail']): void;
}

/** What one context says to the others on the channel. */
type Said = { span: Span } | { listen: string } | { unlisten: string } | { ask: true };

const listeners = new Set<(span: Span) => void>();
/** The other contexts that listen, by id. */
const others = new Set<string>();
let me = '';
let channel: BroadcastChannel | null | undefined;
/** The span this context's calls begin under, during `within`. */
let current: TraceContext | null = null;
/** A Service Worker's spans are the worker's unless said otherwise. */
const here: TraceHost = typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope === 'function' ? 'worker' : 'page';

/** `bytes` random bytes, as hex. */
function hex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The channel, opened once: it asks who listens. Null where there is none. */
function open(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  if (typeof BroadcastChannel !== 'function') return (channel = null);
  me = hex(8);
  const opened = new BroadcastChannel(TRACE_CHANNEL);
  // Open as long as its context: in Node, it keeps nothing running.
  (opened as { unref?: () => void }).unref?.();
  opened.addEventListener('message', (event) => {
    const said = (event as MessageEvent<Said | null>).data;
    if (!said || typeof said !== 'object') return;
    if ('span' in said) hear(said.span);
    else if ('listen' in said) others.add(said.listen);
    else if ('unlisten' in said) others.delete(said.unlisten);
    else if (listeners.size) opened.postMessage({ listen: me });
  });
  opened.postMessage({ ask: true });
  return (channel = opened);
}

/** A span, to each listener here: one that throws breaks nothing. */
function hear(span: Span): void {
  for (const listener of listeners) {
    try {
      listener(span);
    } catch { /* a listener's fault is its own */ }
  }
}

/** Say a span here, and to the other contexts where one listens or it was asked for. */
function say(span: Span, sampled: boolean): void {
  hear(span);
  const to = open();
  if (to && (others.size || sampled)) to.postMessage({ span });
}

/** Hear every span, from every context; the function it returns stops. */
export function onTrace(listener: (span: Span) => void): () => void {
  const first = !listeners.size;
  listeners.add(listener);
  if (first) open()?.postMessage({ listen: me });
  return () => {
    if (listeners.delete(listener) && !listeners.size) channel?.postMessage({ unlisten: me });
  };
}

/** Does anyone listen, here or in another context? */
export function tracing(): boolean {
  if (listeners.size) return true;
  open();
  return others.size > 0;
}

/** Where a span begins, and what it says. */
interface SpanOptions {
  host?: TraceHost;
  store?: string;
  parent?: TraceContext | null;
  detail?: Span['detail'];
}

/** A span, made — or null when nobody listens, and nothing is made. */
function made(step: string, options: SpanOptions): { span: Span; sampled: boolean } | null {
  const parent = options.parent === undefined ? current : options.parent;
  const sampled = !!parent?.sampled;
  if (!sampled && !tracing()) return null;
  const store = options.store ?? parent?.store;
  const span: Span = {
    host: options.host ?? parent?.host ?? here, step, ...(store !== undefined ? { store } : {}),
    trace: parent?.trace ?? hex(16), id: hex(8), ...(parent ? { parent: parent.id } : {}),
    t: Date.now(), ...(options.detail ? { detail: options.detail } : {}),
  };
  return { span, sampled };
}

/** Begin a span under the one running — or `parent` — or null when nobody listens:
 *  then nothing is made. */
export function startSpan(step: string, options: SpanOptions = {}): OpenSpan | null {
  const begun = made(step, options);
  if (!begun) return null;
  const { span, sampled } = begun;
  const store = span.store;
  say(span, sampled);
  const began = performance.now();
  return {
    host: span.host, trace: span.trace, id: span.id, ...(store !== undefined ? { store } : {}), sampled,
    end(detail): void {
      const ms = Math.round((performance.now() - began) * 10) / 10;
      say({ ...span, ms, ...(detail ? { detail: { ...span.detail, ...detail } } : {}) }, sampled);
    },
  };
}

/** How a graph's node stands as its step runs: begun, then done, failed or skipped. */
export type StepState = 'start' | 'done' | 'failed' | 'skipped';

/** A step begun: `end()` says how it ended — done unless told — and its `rows`. */
export interface OpenStep extends TraceContext {
  end(state?: Exclude<StepState, 'start'>, detail?: Span['detail']): void;
}

/** Where a step runs and what it says: its graph, its span's step, the rows it ended with. */
export interface StepOptions extends SpanOptions {
  /** The graph it is a step of — a workflow's id. Its trace is then that graph's. */
  graph?: string;
  /** The span's `step`: `step` unless told. */
  step?: string;
  /** Said once, as it ended — a step already run, or one skipped — in `ms`. */
  state?: Exclude<StepState, 'start'>;
  ms?: number;
  rows?: number;
}

/**
 * Say that a graph's node ran its step, on the one stream: a span whose
 * `detail.node` names the node by its graph id, `detail.state` how it stands and
 * `detail.rows` the rows it ended with. Begun now — `end()` ends it — or, given
 * `state`, said once as it ended. The worker, any code or an agent says a step
 * this way. Nobody listens: nothing is made, and null. TRAP T-a-step-names-its-node
 */
export function traceStep(node: string, options: StepOptions = {}): OpenStep | null {
  const { graph, step = 'step', state, ms, rows, ...where } = options;
  if (!where.parent?.sampled && !current?.sampled && !tracing()) return null;
  const said = { ...where.detail, node, ...(graph !== undefined ? { graph } : {}), ...(rows !== undefined ? { rows } : {}) };
  if (state) {
    const once = made(step, { ...where, detail: { ...said, state } });
    if (once) say({ ...once.span, ms: ms ?? 0 }, once.sampled);
    return null;
  }
  const span = startSpan(step, { ...where, detail: { ...said, state: 'start' } });
  return span && { ...span, end: (ended = 'done', detail) => span.end({ ...detail, state: ended }) };
}

/** Run `run` with a span as the one its calls begin under. A call captures it in
 *  its first, synchronous part: a span begun after an `await` begins under none. */
export function within<T>(span: TraceContext | null, run: () => T): T {
  const was = current;
  current = span;
  try {
    return run();
  } finally {
    current = was;
  }
}

/** A span as the W3C `traceparent` a request carries: sampled, so the host that
 *  answers says its own spans. */
export function traceparent(span: TraceContext): string {
  return `00-${span.trace}-${span.id}-01`;
}

/** A request's `traceparent` as the span it was sent under, on the host that
 *  answers it — or null where it has none, or a malformed one. */
export function readTraceparent(header: string | null, host: TraceHost): TraceContext | null {
  const [, trace, id, flags] = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(header ?? '') ?? [];
  if (!trace || !id || !flags || /^0+$/.test(trace) || /^0+$/.test(id)) return null;
  return { host, trace, id, sampled: (parseInt(flags, 16) & 1) === 1 };
}
