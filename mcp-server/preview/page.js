/**
 * page.js — the preview's page, and its one Context's module: the outlet started
 * over the Context served beside it, its store the Node host's, and every report
 * and span the data layer says kept, by act, for the MCP to read. Fixed code from
 * the MCP's own package: a caller sends it no script.
 * TRAP T-a-preview-is-this-machine-only
 *
 * Map:
 * - init — the Context's module: its source handed to the page, which waits on its loads
 */
import { DATA_BASE, SessionStore, onReport, onTrace, openRequestStore, settled, traceQuerySteps } from '/dist/bundle/index.js';
import { walked } from '/preview/walked.js';

/** The most spans an act keeps. */
const KEPT = 2000;
const LATE = Symbol('late');
/** What the page has said since it opened, and since its act began; why its store could not open. */
const said = { reports: [], act: { reports: [], spans: [] }, failure: null };
let source = null;
let context = null;
/** Loads begun since the source was handed over. */
let loads = 0;
let walking = Promise.resolve();

onReport((r) => {
  const one = { code: r.code, message: r.message, ...(r.at ? { at: r.at } : {}) };
  said.reports.push(one);
  said.act.reports.push(one);
});
onTrace((span) => {
  if (said.act.spans.length < KEPT) said.act.spans.push(span);
  if (source && span.step === 'load' && span.ms !== undefined) {
    walking = walking.then(() => walked({ traceQuerySteps }, source, span)).catch(() => undefined);
  }
});

const loaded = new Promise((done) => {
  document.addEventListener('context-load', (event) => done((context = event.detail.context)), { once: true });
});

/** The Context's module: its source handed to the page. */
export function init(_root, ctx) {
  source = ctx.source ?? null;
  source?.addEventListener('loading', (event) => {
    if (event.detail?.loading) loads++;
  });
}

/** Everything in the Context, and in the region it lifts into the shell: by tag. */
function drawn() {
  const out = {};
  for (const el of document.querySelectorAll('#context-root *, sherpa-app-shell > [slot="context-header"], sherpa-app-shell > [slot="context-header"] *')) {
    if (el.localName.startsWith('sherpa-')) out[el.localName] = (out[el.localName] ?? 0) + 1;
  }
  return out;
}

window.__sherpaPreview = {
  /** A new act: what is said from now on is its own. */
  begin() {
    said.act = { reports: [], spans: [] };
  },
  act: () => said.act,
  /** Wait until the Context has loaded, its source has answered, its walk is said
   *  and every component has drawn (`settled`) — and nothing began meanwhile. */
  async idle(ms) {
    let timer;
    const late = new Promise((done) => { timer = setTimeout(() => done(LATE), ms); });
    try {
      if ((await Promise.race([loaded, late])) === LATE) return { loaded: false, settled: false };
      for (let pass = 0; pass < 3; pass++) {
        const begun = loads;
        const quiet = (async () => {
          await source?.load();
          await walking;
          await settled(document);
        })();
        if ((await Promise.race([quiet, late])) === LATE) return { loaded: true, settled: false };
        if (loads === begun) return { loaded: true, settled: true };
      }
      return { loaded: true, settled: false };
    } finally {
      clearTimeout(timer);
    }
  },
  facts: () => ({
    context,
    failure: said.failure,
    reports: said.reports,
    source: source && {
      total: source.total, rows: source.rows.length, page: source.state.page, pageSize: source.state.pageSize ?? null,
      totalPages: source.totalPages, reach: source.reach, ...(source.failure ? { failure: source.failure } : {}),
    },
    drawn: drawn(),
  }),
};

const [app, config] = await Promise.all(['/app.json', '/preview.json'].map((url) => fetch(url).then((r) => r.json())));
const stores = {};
const ready = config.store
  ? openRequestStore({ name: config.store, base: DATA_BASE, origin: location.origin, send: (request) => fetch(request) }).then(
    (store) => { stores[config.store] = store; },
    (error) => { said.failure = `The store "${config.store}" could not be opened: ${error.message}`; },
  )
  : Promise.resolve();
const session = new SessionStore({ nav: { pinned: false, favorites: [], recent: [], hierarchy: false } });
void document.getElementById('context-root').start({ app, base: new URL('/app.json', location.href), session, stores: () => stores, ready });
