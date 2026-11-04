#!/usr/bin/env node
/**
 * sherpa-ui — `sherpa-ui serve [folder] [--port N]`: serve a folder, so
 * nothing is downloaded to run one; `sherpa-ui check-usage [folder]`: its
 * markup against the component specs. No dependencies. A new app is
 * `npm create sherpa-ui`, its own package. TRAP T-nothing-downloads-to-serve
 *
 * Map:
 * - serve — Serve a folder's files over HTTP on localhost; resolves with the server once it listens.
 */
import { realpathSync } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pipeline } from 'node:stream';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.map': 'application/json', '.txt': 'text/plain', '.md': 'text/plain',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
};
const TEXT = /^(text\/|application\/json|image\/svg)/;

/** Serve a folder's files over HTTP on localhost; resolves with the server once
 *  it listens. A folder serves its `index.html`; nothing outside it is served. */
export function serve(folder = '.', { port = 4000, host = 'localhost' } = {}) {
  const root = resolve(folder);
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return void res.writeHead(405).end();
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    let file = resolve(root, `.${path}`);
    if (file !== root && !file.startsWith(root + sep)) return void res.writeHead(403).end();
    let handle;
    try {
      let info = await stat(file);
      if (info.isDirectory()) {
        // `/docs` → `/docs/`, so the page's relative URLs resolve inside it.
        if (!path.endsWith('/')) return void res.writeHead(301, { location: `${path}/` }).end();
        file = join(file, 'index.html');
      }
      // Measured and read through ONE open file: a build swapped in meanwhile is
      // not half-read, nor a crash. TRAP T-a-build-is-swapped-in-whole
      handle = await open(file);
      info = await handle.stat();
      const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
      res.writeHead(200, {
        'content-type': TEXT.test(type) ? `${type}; charset=utf-8` : type,
        'content-length': info.size,
        'cache-control': 'no-cache',
      });
      if (req.method === 'HEAD') return void handle.close().then(() => res.end());
      pipeline(handle.createReadStream(), res, () => undefined);
    } catch {
      void handle?.close().catch(() => undefined);
      // The reader left after the 200 went out (Firefox drops a request it no longer
      // needs), so `pipeline` threw: end the reply. A 404 now throws and kills the server.
      if (res.headersSent) return void res.destroy();
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => ok(server));
  });
}

// By REAL path: run through npx or a linked node_modules, the two differ. TRAP T-a-cli-is-run-through-a-link
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'check-usage') {
    // TRAP T-markup-is-checked-against-the-spec
    const { checkUsage } = await import('../scripts/check-usage.mjs');
    process.exit(checkUsage(rest[0]));
  } else if (command === 'serve') {
    const at = rest.indexOf('--port');
    const port = at >= 0 ? Number(rest[at + 1]) : 4000;
    const folder = rest.find((a, i) => !a.startsWith('--') && rest[i - 1] !== '--port') ?? '.';
    serve(folder, { port }).then(
      () => console.log(`Serving ${resolve(folder)} at http://localhost:${port}/`),
      (error) => { console.error(`sherpa-ui serve: ${error.message}`); process.exit(1); },
    );
  } else {
    console.log('Usage:\n  npx sherpa-ui serve [folder]    serve a folder on localhost (--port N, default 4000)\n'
      + '  npx sherpa-ui check-usage [folder]   check its markup against the component specs\n\n'
      + 'A new app: npm create sherpa-ui <folder>');
    process.exit(command ? 1 : 0);
  }
}
