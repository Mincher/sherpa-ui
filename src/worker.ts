/**
 * worker.ts — `sherpa-ui/worker`: what an app's Service Worker imports. It keeps
 * the app's files now (plan 652 S3); the data layer joins it in S4.
 * TRAP T-a-worker-keeps-the-apps-files
 */
export { APP_CACHE_PREFIX, keepAppFiles, type AppFilesOptions, type WorkerScope } from './core/worker/app-files.js';
