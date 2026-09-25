/**
 * browser.js — one long-lived Chromium page the MCP can drive.
 *
 * P5's premise: anything a person can do by clicking, a caller can do by
 * calling — and an agent is just a caller with no pointer. The components make
 * that true (45 methods across 23 specs); this is the wire that lets an agent
 * on the other side of a tool boundary reach them.
 *
 * ONE page, reused. Launching Chromium costs ~300ms and a fresh page loses
 * whatever the last call set up — which would make the tier useless for the
 * thing it exists for: doing something, then looking at what happened.
 *
 * SCOPE, deliberately narrow. This executes code in a browser, so it is the
 * largest security surface in this server:
 *   - LOCALHOST ONLY. A remote URL is refused, not fetched.
 *   - No arbitrary script. A caller names an ELEMENT, a METHOD and JSON
 *     ARGUMENTS; the page-side code is fixed and lives here, not in the input.
 *   - Opt-in. Nothing launches until a tool asks, and `browser_close` ends it.
 *
 * Map:
 * - checkUrl — Localhost only — a tool that executes in a browser must not fetch the internet.
 * - getPage — Launch on first use.
 * - closeBrowser — Shut the browser down.
 * - browserState — What the bridge currently holds, for a status line.
 */
let _chromium = null;
let _browser = null;
let _page = null;
let _url = null;

/** Localhost only — a tool that executes in a browser must not fetch the internet. */
export function checkUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return `"${raw}" is not a URL.`; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return `only http(s) URLs; got "${u.protocol}".`;
  const host = u.hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  if (!local) {
    return `only localhost is allowed, got "${host}". This tool runs code in a browser; pointing it at a remote site is out of scope. Serve the page locally (\`npm run preview\` → http://localhost:4000).`;
  }
  return null;
}

/** Launch on first use. Returns `{ page }` or `{ error }` — never throws at a tool. */
export async function getPage(url) {
  const bad = checkUrl(url);
  if (bad) return { error: bad };

  if (!_chromium) {
    try {
      ({ chromium: _chromium } = await import('@playwright/test'));
    } catch (e) {
      return { error: `Playwright is not available (${e.message}). It is a devDependency — run \`npm install\`.` };
    }
  }
  try {
    if (!_browser || !_browser.isConnected()) {
      _browser = await _chromium.launch();
      _page = null;
    }
    if (!_page || _page.isClosed()) {
      _page = await _browser.newPage();
      _url = null;
    }
    if (_url !== url) {
      const res = await _page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (res && !res.ok()) {
        return { error: `${url} returned ${res.status()}. Is the server running? \`npm run preview\` serves the repo on :4000.` };
      }
      _url = url;
    }
    return { page: _page };
  } catch (e) {
    // The common case by far, and worth naming rather than surfacing raw:
    // nothing is listening on that port.
    const hint = /ERR_CONNECTION_REFUSED|net::/.test(e.message)
      ? `\n\nNothing is serving ${url}. Start one: \`npm run preview\` (no build) or \`npm run sandbox\` (builds first), both on :4000.`
      : '';
    return { error: `could not open ${url}: ${e.message}${hint}` };
  }
}

/** Shut the browser down. Safe to call when nothing is running. */
export async function closeBrowser() {
  const wasOpen = Boolean(_browser);
  try { await _browser?.close(); } catch { /* already gone */ }
  _browser = null; _page = null; _url = null;
  return wasOpen;
}

/** What the bridge currently holds, for a status line. */
export function browserState() {
  return { open: Boolean(_browser?.isConnected()), url: _url };
}
