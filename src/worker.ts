/**
 * worker.ts — `sherpa-ui/worker`: what an app's Service Worker imports. It keeps
 * the app's files (plan 652 S3), and answers the data layer's requests (S4).
 * TRAP T-a-worker-keeps-the-apps-files
 */
export { APP_CACHE_PREFIX, keepAppFiles, type AppFilesOptions, type WorkerScope } from './core/worker/app-files.js';
// The data layer's own requests, answered here for every tab. S4 · TRAP T-the-worker-answers-the-data
export { OUTBOX_SYNC, serveData, type PushSaid, type ServeDataOptions } from './core/worker/serve-data.js';
