/**
 * node-host.ts — the data layer's handlers, served on Node: a `node:http` request
 * as a web `Request`, the `Response` written back, streamed. The same handlers the
 * page and the worker answer with: one protocol, three hosts. DOM-free.
 * TRAP T-a-node-host-is-the-same-handler
 *
 * Map:
 * - WebHandler — Answer a web request, or null where it is not this handler's.
 * - NodeHostOptions — The origin a request's URL is made on.
 * - NodeListener — A `node:http` listener, and an Express-style middleware: one function.
 * - nodeHandler — Serve web handlers on Node: each asked in turn; where none answers, the next middleware, else 404.
 */
/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Answer a web request, or null where it is not this handler's. */
export type WebHandler = (request: Request) => Response | null | Promise<Response | null>;

/** The origin a request's URL is made on. */
export interface NodeHostOptions {
  /** The public origin, behind a proxy that ends TLS: `https://app.example`. Default
   *  the request's own `Host`, over https where its socket is encrypted. */
  origin?: string;
}

/** A request as Node, or Express on it, hands it over. */
type NodeRequest = IncomingMessage & { originalUrl?: string; body?: unknown };

/** A `node:http` listener, and an Express-style middleware: one function. */
export type NodeListener = (req: NodeRequest, res: ServerResponse, next?: (error?: unknown) => void) => Promise<void>;

/** Serve web handlers on Node: each asked in turn; where none answers, the next
 *  middleware, else 404. A reader that goes away aborts its request's signal. */
export function nodeHandler(handlers: WebHandler | readonly WebHandler[], options: NodeHostOptions = {}): NodeListener {
  const all = typeof handlers === 'function' ? [handlers] : [...handlers];
  return async (req, res, next) => {
    const gone = new AbortController();
    res.on('close', () => gone.abort());
    try {
      const request = requestOf(req, gone.signal, options);
      for (const handle of all) {
        const response = await handle(request);
        if (response) return await write(res, response);
      }
    } catch (error) {
      if (next) return next(error);
      if (!res.headersSent) res.statusCode = 500;
      res.end();
      return;
    }
    if (next) return next();
    res.statusCode = 404;
    res.end();
  };
}

/** A Node request as a web `Request`: its URL on its origin, its headers, its body. */
function requestOf(req: NodeRequest, signal: AbortSignal, options: NodeHostOptions): Request {
  const origin = options.origin ?? `${(req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http'}://${req.headers.host ?? 'localhost'}`;
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    // HTTP/2's pseudo-headers are no header a Request can carry.
    if (value === undefined || name.startsWith(':')) continue;
    for (const each of Array.isArray(value) ? value : [value]) headers.append(name, each);
  }
  const method = req.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : bodyOf(req);
  return new Request(new URL(req.originalUrl ?? req.url ?? '/', origin), { method, headers, signal, ...(body !== undefined ? { body, duplex: 'half' } as RequestInit : {}) });
}

/** The request's body, read only as a handler reads it: a request no handler
 *  answers goes on to the next middleware whole. One a parser before read is its
 *  value, as JSON. */
function bodyOf(req: NodeRequest): BodyInit | undefined {
  if (req.readableEnded) return req.body === undefined ? undefined : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  let chunks: AsyncIterator<Buffer> | undefined;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      chunks ??= req[Symbol.asyncIterator]();
      const read = await chunks.next();
      if (read.done) controller.close();
      else controller.enqueue(new Uint8Array(read.value));
    },
    async cancel() {
      await chunks?.return?.();
    },
  }, { highWaterMark: 0 });
}

/** A web `Response`, written to Node: its status and headers, then its body as it
 *  comes — an event stream stays open until its reader goes. */
async function write(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') res.setHeader(name, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader('set-cookie', cookies);
  if (!response.body) {
    res.end();
    return;
  }
  res.flushHeaders();
  const reader = response.body.getReader();
  res.on('close', () => void reader.cancel().catch(() => undefined));
  try {
    for (let read = await reader.read(); !read.done; read = await reader.read()) {
      if (!res.write(read.value)) await new Promise((drained) => { res.once('drain', drained); res.once('close', drained); });
    }
  } catch {
    // The reader went: its stream was cancelled.
  }
  res.end();
}
