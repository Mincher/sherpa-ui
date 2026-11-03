/**
 * server.ts — `sherpa-ui/server`: the data layer hosted on Node — the same handler
 * the page and the Service Worker answer with, a Node adapter for it, and the app
 * server's half of what is new: the worker script stamped with its build, and the
 * feed. DOM-free; the stores come from `sherpa-ui/data`. Plan 695 H5
 * TRAP T-a-node-host-is-the-same-handler
 */
export { nodeHandler, type NodeHostOptions, type NodeListener, type WebHandler } from './core/server/node-host.js';
export { serveWorkerScript, type WorkerScriptOptions } from './core/server/worker-script.js';
// The one protocol, and the one feed, as the worker and the page have them.
export { DATA_BASE, createDataHandler, type CorsPolicy, type DataHandler, type DataHandlerOptions } from './core/data/data-handler.js';
export { UPDATES_PATH, updatesFeed, type FeedNotice, type UpdatesFeed } from './core/data/updates-feed.js';
