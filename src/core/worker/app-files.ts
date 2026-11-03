/**
 * app-files.ts — a Service Worker keeps the app's own files, so the app opens
 * offline and can be installed. Plan 652 S3 · TRAP T-a-worker-keeps-the-apps-files
 *
 * Map:
 * - WorkerScope — The part of a Service Worker's global scope this reads.
 * - WorkerFetchEvent — A request the worker may answer.
 * - AppFilesOptions — The app's version, the files kept at install, and how fresh it keeps them.
 * - APP_CACHE_PREFIX — What every cache of an app's files is named from.
 * - keepAppFiles — Keep an app's files in the worker: its install, activate and fetch.
 */
import { DATA_BASE } from '../data/data-handler.js';

/** The part of a Service Worker's global scope this reads: the DOM library has no worker types. */
export interface WorkerScope extends EventTarget {
  readonly location: { readonly origin: string };
  readonly clients: {
    claim(): Promise<void>;
    /** The app's open tabs, and a new one: where a notification's press lands. */
    matchAll?(options: { type: 'window' }): Promise<ReadonlyArray<{ readonly url: string; focus(): Promise<unknown> }>>;
    openWindow?(url: string): Promise<unknown>;
  };
  skipWaiting(): Promise<void>;
  /** Background Sync, where the engine has it: Chromium. A notification, where the reader allowed it. */
  readonly registration?: {
    readonly sync?: { register(tag: string): Promise<void> };
    showNotification?(title: string, options?: { body?: string; data?: unknown; tag?: string }): Promise<void>;
  };
}

/** A worker event that holds the worker open until its promise settles. */
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

/** A request the worker may answer. */
export interface WorkerFetchEvent extends ExtendableEvent {
  readonly request: Request;
  respondWith(response: Response | Promise<Response>): void;
}

/** The app's version, the files kept at install, and how fresh it keeps them. */
export interface AppFilesOptions {
  /** A new version is a new cache, and the old ones go when it takes over. */
  version: string;
  /** Kept when the worker installs — the app's shell, its first page. The rest are
   *  kept as the app asks for them. */
  files?: readonly string[];
  /** `fresh` (the default): the network first and the cache when it cannot answer,
   *  so a page always runs what was built last. `fast`: the cache first and the
   *  network behind it, so a page opens at once and a new build shows next time. */
  strategy?: 'fresh' | 'fast';
  /** Paths never kept: the data layer's, which keeps its own, and a live feed's. */
  skip?: readonly string[];
  /** How long `fresh` waits for the network before the cache answers, in ms. Default 4000. */
  timeout?: number;
}

/** What every cache of an app's files is named from. */
export const APP_CACHE_PREFIX = 'sherpa-app:';

/** Keep an app's files in the worker: what it installs with, what it lets go when a
 *  new version takes over, and how it answers each request for a file. */
export function keepAppFiles(scope: WorkerScope, options: AppFilesOptions): void {
  const name = APP_CACHE_PREFIX + options.version;
  const fast = options.strategy === 'fast';
  const skip = options.skip ?? [DATA_BASE];
  const timeout = options.timeout ?? 4000;

  scope.addEventListener('install', (event) => {
    (event as ExtendableEvent).waitUntil((async () => {
      await (await caches.open(name)).addAll([...(options.files ?? [])]);
      // Fresh, it serves the network anyway: it takes over at once.
      if (!fast) await scope.skipWaiting();
    })());
  });

  scope.addEventListener('activate', (event) => {
    (event as ExtendableEvent).waitUntil((async () => {
      for (const key of await caches.keys()) if (key.startsWith(APP_CACHE_PREFIX) && key !== name) await caches.delete(key);
      await scope.clients.claim();
    })());
  });

  scope.addEventListener('fetch', (event) => {
    const { request } = event as WorkerFetchEvent;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== scope.location.origin || skip.some((path) => url.pathname.startsWith(path))) return;
    // A live feed stays open: it is never a file.
    if (request.headers.get('accept')?.includes('text/event-stream')) return;
    (event as WorkerFetchEvent).respondWith(fast ? cacheFirst(name, request) : networkFirst(name, request, timeout));
  });
}

/** A file's answer kept, where it is the app's own and whole. */
async function keep(name: string, request: Request, response: Response): Promise<void> {
  if (!response.ok || response.type !== 'basic') return;
  await (await caches.open(name)).put(request, response.clone());
}

/** What the cache holds for a request: a page, by its path alone, as its query
 *  string only names a Context. */
async function kept(name: string, request: Request): Promise<Response | undefined> {
  const cache = await caches.open(name);
  return (await cache.match(request)) ?? (request.mode === 'navigate' ? cache.match(request, { ignoreSearch: true }) : undefined);
}

/** The network first; the cache when it fails or is slow. */
async function networkFirst(name: string, request: Request, timeout: number): Promise<Response> {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(timeout) });
    await keep(name, request, response);
    return response;
  } catch (error) {
    const old = await kept(name, request);
    if (old) return old;
    throw error;
  }
}

/** The cache first, the network behind it for next time. */
async function cacheFirst(name: string, request: Request): Promise<Response> {
  const old = await kept(name, request);
  const next = fetch(request).then(async (response) => {
    await keep(name, request, response);
    return response;
  });
  if (old) {
    next.catch(() => undefined);
    return old;
  }
  return next;
}
