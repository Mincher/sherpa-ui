/**
 * preview.js — one preview at a time: a Context's files served by sherpa-ui's own
 * Node host — its data handler over the sample rows, then the files and the build —
 * on a port the system picks on 127.0.0.1, and opened in a headless Chromium that
 * asks nothing of another host. In the page runs only the MCP's own code: a caller
 * names an element, a method and JSON. TRAP T-a-preview-is-this-machine-only
 *
 * Map:
 * - loopback — whether a URL is on this machine: http on localhost, 127.0.0.1 or [::1]
 * - openPreview — a Context served and opened, any preview before it closed; once settled, its shot and what it said
 * - closePreview — end the preview: its pages, its browser and its server; what was open, or null
 * - pageAt — the page a tool acts on: the preview's, or a page on this machine beside it in the same browser
 * - settle — wait for a page: the preview's until its Context has loaded, answered and drawn; another's until it has drawn
 * - begin — begin a new act on the preview's page: what is said from now on is its own
 * - lastAct — the preview's last act: what began it, its reports, and its spans with its Node host's
 * - elementAt — the element a selector finds, in the page or a shadow root: its tag, or null
 * - atElement — that element: a method called with JSON, the page waited for; then its attributes, states, parts
 * - shot — the page as it is drawn, as PNG bytes
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { imported, served } from './sherpa.js';
import { typeProblems } from './check.js';
import { typedStore } from './describe.js';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
/** Never these, should the system pick one: an app's own servers listen there. */
const NEVER = new Set([4000, 4200]);
/** The longest a page is waited for, in ms. */
const WAIT = 15000;
/** The most spans of its Node host a preview keeps. */
const KEPT = 2000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff',
};
/** Only what this server serves, and no inline script: markup sent to a preview runs none. */
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
  + "font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

/** One of the MCP's own files for the page. */
const own = (file) => readFileSync(new URL(`../preview/${file}`, import.meta.url), 'utf8');

/** Whether a URL is on this machine: http on localhost, 127.0.0.1 or [::1]. */
export function loopback(raw) {
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) && LOOPBACK.has(url.hostname);
  } catch {
    return false;
  }
}

/** The preview open now: its browser, server, pages and what its host said. */
let open = null;

/** Chromium, through the Playwright installed beside the MCP: its own, else the
 *  machine's Chrome. It throws, in words to act on, when there is neither. */
async function launch() {
  let pw;
  try {
    pw = await import('playwright-core');
  } catch {
    throw new Error('A preview needs Playwright beside sherpa-ui-mcp: `npm install --save-dev playwright-core`, then `npx playwright install chromium`.');
  }
  const { chromium } = pw.chromium ? pw : pw.default;
  try {
    return await chromium.launch();
  } catch (first) {
    try {
      return await chromium.launch({ channel: 'chrome' });
    } catch {
      throw new Error(`No browser to preview in: ${String(first.message).split('\n')[0]}. \`npx playwright install chromium\` installs one; Google Chrome serves too.`);
    }
  }
}

/** A browser context that asks nothing of another host: such a request is refused, and said. */
async function contextIn(browser, options = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', ...options });
  await context.route('**/*', (route) => (loopback(route.request().url()) ? route.continue() : route.abort('blockedbyclient')));
  return context;
}

/** What each page said beside the data layer. */
const HEARD = new WeakMap();

/** A page, with what it throws and each request not answered heard. */
async function pageIn(context) {
  const page = await context.newPage();
  const heard = { errors: [], failed: [] };
  const at = (url) => (loopback(url) ? new URL(url).pathname : url);
  page.on('pageerror', (error) => heard.errors.push(`threw: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') heard.errors.push(`said: ${message.text()}`); });
  page.on('requestfailed', (request) => {
    const why = request.failure()?.errorText ?? 'failed';
    // The page stopped it itself: a read a newer one superseded.
    if (why === 'net::ERR_ABORTED') return;
    heard.failed.push(`${request.method()} ${at(request.url())} — ${why}${loopback(request.url()) ? '' : ' (not this machine: refused)'}`);
  });
  page.on('response', (response) => { if (response.status() >= 400) heard.failed.push(`${response.request().method()} ${at(response.url())} — ${response.status()}`); });
  HEARD.set(page, heard);
  return page;
}

/** What a page said beside the data layer: what it threw, and each request not answered. */
const heardOn = (page) => HEARD.get(page) ?? { errors: [], failed: [] };

/** A web handler for fixed files, by path, and the build under /dist/. */
function filesOf(paths) {
  return (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return null;
    const { pathname } = new URL(request.url);
    const body = pathname.startsWith('/dist/') ? served(decodeURIComponent(pathname.slice('/dist/'.length))) : paths.get(pathname);
    if (body == null) return null;
    const type = TYPES[path.extname(pathname === '/' ? '/index.html' : pathname).toLowerCase()] ?? 'application/octet-stream';
    return new Response(request.method === 'HEAD' ? null : body, {
      headers: { 'content-type': type, 'cache-control': 'no-store', 'content-security-policy': CSP },
    });
  };
}

/** A server stopped: every connection it holds closed. */
const stop = (server) => new Promise((done) => {
  server.closeAllConnections();
  server.close(() => done());
});

/** A server on 127.0.0.1, on a port the system picks — never one an app's own server uses. */
async function listen(listener) {
  for (;;) {
    const server = createServer(listener);
    await new Promise((up, fail) => {
      server.once('error', fail);
      server.listen(0, '127.0.0.1', up);
    });
    if (!NEVER.has(server.address().port)) return server;
    await stop(server);
  }
}

/** A client that goes away leaves no preview behind. */
const leave = () => void closePreview();

/**
 * Serve a Context and open it, closing any preview before: `context` is its name
 * in the app it is served as; `template`, `definition` and `views` its three files,
 * as text; `viewFiles` each file a View names, `[path from the Views, text]`; the
 * store the page names holds `rows`, made from their `type` when one is given. Resolves once the page has settled.
 */
export async function openPreview({ context, label, chrome, template, definition, views, viewFiles = [], store, rows = [], key, type },
  { width = 1280, height = 800, mode = 'light', view } = {}) {
  const [dl, host] = await Promise.all([imported('sherpa-ui/data'), imported('sherpa-ui/server')]);
  // Refused before anything opens, or closes.
  const wrong = type ? typeProblems(dl, type) : [];
  if (wrong.length) throw new Error(`The type is not one (type.v1):\n${wrong.map((w) => `- ${w}`).join('\n')}`);
  await closePreview();
  if (!served('bundle/index.js')) throw new Error('sherpa-ui\'s build has no bundle/index.js, which the page loads: run `npm run build` in sherpa-ui.');
  const now = (open = { browser: await launch(), spans: [], act: 'open' });
  process.stdin.once('end', leave);
  try {
    const app = {
      v: 1, product: { name: label }, default: context,
      contexts: {
        [context]: {
          label, template: 'context/template.html',
          ...(definition != null ? { definition: 'context/definition.json' } : {}),
          ...(views != null ? { views: 'context/views.json' } : {}),
          module: 'preview/page.js', ...(chrome ? { chrome } : {}),
        },
      },
    };
    const paths = new Map([
      ['/', own('index.html')], ['/preview/page.js', own('page.js')], ['/preview/walked.js', own('walked.js')],
      ['/app.json', JSON.stringify(app)], ['/preview.json', JSON.stringify({ store: store ?? null })],
      ['/context/template.html', template],
      ...(definition != null ? [['/context/definition.json', definition]] : []),
      ...(views != null ? [['/context/views.json', views]] : []),
      // Where the page asks for it: beside the Views.
      ...viewFiles.map(([rel, text]) => [new URL(rel, 'http://preview/context/views.json').pathname, text]),
    ]);
    const handlers = [
      ...(store ? [host.createDataHandler({ stores: dl.defineStores(() => ({ [store]: typedStore(dl, rows, { key, type }) })), host: 'server' })] : []),
      filesOf(paths),
    ];
    now.server = await listen(host.nodeHandler(handlers));
    const stopTrace = dl.onTrace((span) => {
      if (span.host !== 'server') return;
      now.spans.push(span);
      if (now.spans.length > KEPT) now.spans.shift();
    });
    now.stopTrace = stopTrace;
    now.url = `http://127.0.0.1:${now.server.address().port}/?context=${encodeURIComponent(context)}${view ? `&view=${encodeURIComponent(view)}` : ''}`;
    now.page = await pageIn(await contextIn(now.browser, { viewport: { width, height }, colorScheme: mode }));
    await now.page.goto(now.url, { waitUntil: 'load', timeout: WAIT });
    const waited = await settle({ page: now.page, preview: true }).catch((error) => {
      const { errors } = heardOn(now.page);
      throw new Error(`The preview's page did not start: ${errors.length ? errors.join('; ') : error.message.split('\n')[0]}`);
    });
    return { url: now.url, ...waited, shot: await shot(now.page), facts: await facts(now.page), heard: heardOn(now.page) };
  } catch (error) {
    await closePreview();
    throw error;
  }
}

/** End the preview: its pages, its browser and its server. What was open, or null. */
export async function closePreview() {
  const was = open;
  open = null;
  if (!was) return null;
  process.stdin.off('end', leave);
  was.stopTrace?.();
  await was.browser?.close().catch(() => undefined);
  if (was.server) await stop(was.server);
  return { url: was.url ?? null, ...(was.otherUrl ? { other: was.otherUrl } : {}) };
}

/**
 * The page a tool acts on: the preview's, when no URL is given or it is on the
 * preview's server; else a page on this machine, opened beside it in the same
 * browser — in one of its own when no preview is open. Any other host is refused
 * before anything opens.
 */
export async function pageAt(url) {
  if (url === undefined) {
    if (!open?.page) throw new Error('No preview is open: preview_page opens one, or give the `url` of a page on this machine.');
    return { page: open.page, preview: true, url: open.url };
  }
  if (!loopback(url)) throw new Error(`Only a page on this machine — http://localhost:<port>/… — and "${url}" is not, so nothing was opened.`);
  if (open?.page && new URL(url).origin === new URL(open.url).origin) return { page: open.page, preview: true, url: open.url };
  if (!open) {
    open = { browser: await launch(), spans: [] };
    process.stdin.once('end', leave);
  }
  open.other ??= await pageIn(await contextIn(open.browser));
  if (open.otherUrl !== url) {
    open.otherUrl = null;
    let response;
    try {
      response = await open.other.goto(url, { waitUntil: 'load', timeout: WAIT });
    } catch (error) {
      throw new Error(/ERR_CONNECTION_REFUSED/.test(error.message) ? `Nothing is serving ${url}.` : `${url} did not open: ${error.message.split('\n')[0]}`);
    }
    if (response && !response.ok()) throw new Error(`${url} answered ${response.status()}.`);
    open.otherUrl = url;
  }
  return { page: open.other, preview: false, url };
}

/** Wait for a page: the preview's until its Context has loaded, its source answered
 *  and every component drawn (`settled`); another's until it has drawn. */
export async function settle({ page, preview }) {
  if (preview) {
    await page.waitForFunction(() => window.__sherpaPreview, null, { timeout: WAIT });
    return page.evaluate((ms) => window.__sherpaPreview.idle(ms), WAIT);
  }
  await page.evaluate(async () => {
    if (typeof window.__settled === 'function') await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
  return null;
}

/** Begin a new act on the preview's page, named for watch_trace. */
export async function begin(name) {
  if (!open?.page) return;
  open.act = name;
  await open.page.evaluate(() => window.__sherpaPreview.begin());
}

/** The preview's last act: what began it, its reports, and its spans with its
 *  Node host's, in the order they began. Null when no preview is open. */
export async function lastAct() {
  if (!open?.page) return null;
  const { reports, spans } = await open.page.evaluate(() => window.__sherpaPreview.act());
  const traces = new Set(spans.map((s) => s.trace));
  return { act: open.act, url: open.url, reports, spans: [...spans, ...open.spans.filter((s) => traces.has(s.trace))].sort((a, b) => a.t - b.t) };
}

/* The page's half of the two calls below: fixed code, run with JSON. A selector
   is found in the page, else in each shadow root under it. */

/** The element a selector finds, in the page or a shadow root: its tag, or null. */
export function elementAt(page, selector) {
  return page.evaluate((sel) => {
    const find = (root) => root.querySelector(sel) ?? [...root.querySelectorAll('*')].reduce((hit, el) => hit ?? (el.shadowRoot && find(el.shadowRoot)), null);
    return find(document)?.localName ?? null;
  }, selector);
}

/**
 * That element, once it has rendered: `call`, `{ method, args }`, called with its
 * JSON arguments and the page waited for (`settle`); then the element as it stands —
 * its attributes, which of `states` (its spec's) are on, each of `props`, and the
 * parts in its shadow root. `gone` when the selector no longer finds a `tag`.
 */
export function atElement(page, { selector, tag, call, props = [], states = [], preview }) {
  return page.evaluate(async ({ sel, tag: was, call: asked, props: names, states: named, preview: ours, wait }) => {
    const find = (root) => root.querySelector(sel) ?? [...root.querySelectorAll('*')].reduce((hit, el) => hit ?? (el.shadowRoot && find(el.shadowRoot)), null);
    const plain = (value, most) => {
      try {
        const text = JSON.stringify(value, (_, v) => (v instanceof Element ? `<${v.localName}${v.id ? `#${v.id}` : ''}>`
          : typeof v === 'function' ? '[function]' : v instanceof Map ? Object.fromEntries(v) : v instanceof Set ? [...v] : v));
        return text === undefined ? null : text.length > most ? `${text.slice(0, most)}…` : JSON.parse(text);
      } catch {
        return String(value);
      }
    };
    let el = find(document);
    if (el?.localName !== was) return { gone: true };
    await el.rendered;
    const out = {};
    if (asked) {
      try {
        out.returned = plain(await el[asked.method](...asked.args), 20000);
      } catch (error) {
        out.threw = String(error?.message ?? error);
      }
      if (ours) out.waited = await window.__sherpaPreview.idle(wait);
      else {
        if (typeof window.__settled === 'function') await window.__settled();
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      }
      // A call may draw it again: the one there now is read.
      el = find(document) ?? el;
    }
    out.on = named.filter(({ selector }) => {
      try {
        const host = /^:host\((.*)\)$/s.exec(selector);
        return host ? el.matches(host[1]) : !!el.shadowRoot?.querySelector(selector);
      } catch {
        return false;
      }
    }).map((s) => s.name);
    out.values = {};
    for (const name of names) {
      try {
        out.values[name] = plain(el[name], 4000);
      } catch (error) {
        out.values[name] = `threw: ${error.message}`;
      }
    }
    out.parts = [...(el.shadowRoot?.querySelectorAll('[part]') ?? [])].map((n) => ({
      part: n.getAttribute('part'), tag: n.localName, shown: n.checkVisibility(),
      ...(n.textContent.trim() ? { text: n.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) } : {}),
    }));
    return { tag: el.localName, attrs: Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])), inShadow: el.getRootNode() instanceof ShadowRoot, ...out };
  }, { sel: selector, tag, call: call ?? null, props, states, preview: !!preview, wait: WAIT });
}

/** The page as it is drawn, as PNG bytes. */
export const shot = (page) => page.screenshot({ type: 'png' });

/** What the preview's page says of itself: its Context, its source's rows, its reports, what it drew. */
const facts = (page) => page.evaluate(() => window.__sherpaPreview.facts());
