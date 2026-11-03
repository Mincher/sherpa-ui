/**
 * worker-script.ts — the app server's half of a new build: its Service Worker script
 * served stamped with the build, so a new build is a new worker; and each build that
 * lands said on the feed, so one tab asks for it at once. DOM-free.
 * TRAP T-a-new-build-is-a-new-worker · TRAP T-news-is-pushed-by-the-server
 *
 * Map:
 * - WorkerScriptOptions — The worker script, where it is served, and the folders a build writes.
 * - serveWorkerScript — Serve the worker script stamped with the build; say each new build on the feed.
 */
/// <reference types="node" />
import { watch } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { UpdatesFeed } from '../data/updates-feed.js';
import type { WebHandler } from './node-host.js';

/** The worker script, where it is served, and the folders a build writes. */
export interface WorkerScriptOptions {
  /** The app's worker script, on disk. */
  file: string;
  /** Where the page registers it. Default `/sw.js`. */
  path?: string;
  /** The folders a build writes: the newest file in them is the build's stamp. */
  build: readonly string[];
  /** Where each new build is said, `{ kind: 'app' }`: one tab asks for the new worker. */
  feed?: UpdatesFeed;
  /** More for the stamp, from the request: a test's own deploy, to its browser alone. */
  more?: (request: Request) => string;
}

/** Serve the worker script stamped with the build — its first line names it, so the
 *  browser sees a new worker — and say each new build on the feed. */
export function serveWorkerScript(options: WorkerScriptOptions): WebHandler {
  const path = options.path ?? '/sw.js';
  // The newest file, read at most every 2 s: a page's checks come often.
  let stamped = { at: 0, stamp: Promise.resolve('') };
  const stamp = (): Promise<string> => {
    if (Date.now() - stamped.at > 2000) stamped = { at: Date.now(), stamp: newest(options.build).then(String) };
    return stamped.stamp;
  };
  // A build writes many files: once they settle, a new stamp is a new build, said once.
  let built: string | undefined;
  void stamp().then((first) => { built = first; });
  let settling: ReturnType<typeof setTimeout> | undefined;
  for (const dir of options.build) {
    try {
      watch(dir, { recursive: true }, () => {
        clearTimeout(settling);
        settling = setTimeout(async () => {
          stamped.at = 0;
          const now = await stamp();
          if (built !== undefined && now !== built) options.feed?.say({ kind: 'app' });
          built = now;
        }, 500);
        settling.unref();
      }).unref();
    } catch {
      // A folder not built yet is no build.
    }
  }
  return async (request) => {
    if (request.method !== 'GET' || new URL(request.url).pathname !== path) return null;
    const more = options.more?.(request);
    const script = await readFile(options.file, 'utf8');
    return new Response(`// build ${await stamp()}${more ? `-${more}` : ''}\n${script}`, {
      headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' },
    });
  };
}

/** The newest change of any file under these folders, in whole ms; 0 where none is. */
async function newest(dirs: readonly string[]): Promise<number> {
  let at = 0;
  for (const dir of dirs) {
    for (const entry of await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => [])) {
      if (entry.isFile()) at = Math.max(at, (await stat(join(entry.parentPath, entry.name))).mtimeMs);
    }
  }
  return Math.round(at);
}
