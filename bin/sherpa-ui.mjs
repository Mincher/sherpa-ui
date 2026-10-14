#!/usr/bin/env node
/**
 * sherpa-ui — `sherpa-ui init <folder>`: a new app from the starter, one
 * folder with no build; `sherpa-ui serve [folder] [--port N]`: serve a folder,
 * so nothing is downloaded to run one; `sherpa-ui check-usage [folder]`: its
 * markup against the component specs. No dependencies.
 * TRAP T-a-starter-is-one-folder · TRAP T-nothing-downloads-to-serve
 *
 * Map:
 * - init — Copy the starter into a new folder, named for it.
 * - serve — Serve a folder's files over HTTP on localhost; resolves with the server once it listens.
 */
import { cpSync, createReadStream, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STARTER = join(dirname(fileURLToPath(import.meta.url)), '..', 'starter');
/* npm drops a package's `.gitignore`, and this repo ignores `.mcp.json`: the
   starter keeps both without their dot. */
const DOTTED = ['gitignore', 'mcp.json'];

/** Copy the starter into a new folder, named for it. Throws when the folder holds anything. */
export function init(folder) {
  const target = resolve(folder);
  if (existsSync(target) && readdirSync(target).length) throw new Error(`${folder} is not empty`);
  cpSync(STARTER, target, { recursive: true });
  for (const file of DOTTED) renameSync(join(target, file), join(target, `.${file}`));
  const pkgPath = join(target, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.name = basename(target).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'sherpa-app';
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  return target;
}

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
    try {
      let info = await stat(file);
      if (info.isDirectory()) {
        // `/docs` → `/docs/`, so the page's relative URLs resolve inside it.
        if (!path.endsWith('/')) return void res.writeHead(301, { location: `${path}/` }).end();
        file = join(file, 'index.html');
        info = await stat(file);
      }
      const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
      res.writeHead(200, {
        'content-type': TEXT.test(type) ? `${type}; charset=utf-8` : type,
        'content-length': info.size,
        'cache-control': 'no-cache',
      });
      if (req.method === 'HEAD') return void res.end();
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => ok(server));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
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
    const [folder] = rest;
    if (command !== 'init' || !folder) {
      console.log('Usage:\n  npx sherpa-ui init <folder>     a new Sherpa UI app: one folder, no build\n'
        + '  npx sherpa-ui serve [folder]    serve a folder on localhost (--port N, default 4000)\n'
        + '  npx sherpa-ui check-usage [folder]   check its markup against the component specs');
      process.exit(command ? 1 : 0);
    }
    try {
      init(folder);
    } catch (error) {
      console.error(`sherpa-ui init: ${error.message}`);
      process.exit(1);
    }
    console.log(`A Sherpa UI app is in ${folder}. Next:\n\n  cd ${folder}\n  npm install\n  npm start\n\nAGENTS.md says where each kind of file goes.`);
  }
}
