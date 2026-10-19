#!/usr/bin/env node
/**
 * check-bench.mjs — what a reader's act costs the data layer, against a baseline that may only FALL.
 *
 * Records over 10k seeded rows in an ArrayStore, its controls faked from their specs, each act
 * the event a real control sends. Counted: loads, counts, the rows they hand back, compiles,
 * clones, and scans — each full pass over a set of rows, held or not. Time is printed, never
 * gated. TODO 286
 * TRAP T-the-bench-counts-and-never-times
 *
 *   npm run check:bench [-- --staged]
 *   npm run check:bench -- --update-baseline   record the costs as they are now
 *
 * Map:
 * - GATED — the costs per act that may only fall
 * - bench — open each page, run its acts in order, and count what each cost
 * - asked — each act on the remote page, after it opens, that asked the store
 * - over — each cost above the baseline, and each act one side lacks
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const BASELINE = 'scripts/bench-baseline.json';
const PAGE = 'test/unit/fixtures/records.page.json';
const N = 10_000;
const COUNTER = Symbol.for('sherpa.bench');
/** The costs per act that may only fall. */
export const GATED = ['loads', 'counts', 'distinct', 'rows', 'compiles', 'clones', 'scans'];
// The fakes are read from these specs, so a change to one changes the bench.
const SPECS = ['sherpa-quick-filter-toolbar', 'sherpa-data-grid', 'sherpa-barchart', 'sherpa-filter-panel']
  .map((tag) => `src/components/${tag}/${tag}.component.json`);
const STAGED = ['src/core/data/', 'src/core/ui/bind-source.ts', 'scripts/check-bench.mjs', 'scripts/bench-baseline.json', PAGE, ...SPECS];
const counters = { loads: 0, counts: 0, distinct: 0, rows: 0, compiles: 0, clones: 0, scans: 0, draws: 0 };

/* ── The data layer, bundled from src/ with compile() counted ─────────── */

const ENTRY = `
export { openSource } from './src/core/data/page-definition.ts';
export { ArrayStore } from './src/core/data/stores.ts';
export { spoofRemote } from './src/core/data/spoof-remote.ts';
export { onReport } from './src/core/data/report.ts';
export { bindSource } from './src/core/ui/bind-source.ts';
`;

/** Each pass over a set of rows — a filter, a sort and page, a tally — wherever it runs; one
 *  pass inside another is not counted twice. */
const SCANNED = ['applyOptions', 'filterRows', 'distinctOf'];

const countCompiles = {
  name: 'count-compiles',
  setup(b) {
    b.onLoad({ filter: /src[\\/]core[\\/]data[\\/]store\.ts$/ }, (args) => {
      let text = readFileSync(args.path, 'utf8');
      for (const name of SCANNED) {
        if (!text.includes(`export function ${name}(`)) throw new Error(`check-bench: store.ts has no \`export function ${name}(\` to count`);
        text = text.replace(`export function ${name}(`, `function ${name}Once(`);
        text += `\nexport function ${name}(...a) { const c = globalThis[Symbol.for('sherpa.bench')]; if (c && !scanDepth) c.scans++; scanDepth++; try { return ${name}Once(...a); } finally { scanDepth--; } }\n`;
      }
      return { loader: 'ts', contents: `let scanDepth = 0;\n${text}` };
    });
    b.onLoad({ filter: /src[\\/]core[\\/]data[\\/]query\.ts$/ }, (args) => {
      const text = readFileSync(args.path, 'utf8');
      if (!text.includes('export function compile(')) throw new Error('check-bench: query.ts has no `export function compile(` to count');
      return {
        loader: 'ts',
        contents: `${text.replace('export function compile(', 'function compileOnce(')}
export function compile(query, facts) { const c = globalThis[Symbol.for('sherpa.bench')]; if (c) c.compiles++; return compileOnce(query, facts); }
`,
      };
    });
  },
};

async function layer() {
  const out = await build({
    stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', plugins: [countCompiles],
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}

/* ── 10k rows, seeded, so every run is the same ────────────────────────── */

const ROWS = (() => {
  let seed = 286;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const of = (list) => list[Math.floor(rnd() * list.length)];
  const pad = (n) => String(n).padStart(2, '0');
  const day = () => `2025-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}`;
  return Array.from({ length: N }, (_, i) => ({
    id: i + 1, name: `Person ${i}`, email: `p${i}@example.com`,
    customer: `Customer ${pad(1 + Math.floor(rnd() * 40))}`,
    status: of(['active', 'trial', 'churned', 'paused']), plan: of(['free', 'pro', 'enterprise']),
    tier: of(['bronze', 'silver', 'gold']), region: of(['EMEA', 'AMER', 'APAC', 'LATAM']),
    owner: rnd() < 0.1 ? 'Unassigned' : `Owner ${pad(1 + Math.floor(rnd() * 25))}`,
    seats: Math.floor(rnd() * 500), spend: Math.floor(rnd() * 100_000),
    openTickets: Math.floor(rnd() * 10), health: Math.floor(rnd() * 101),
    created: day(), lastSeen: day(),
  }));
})();

/** The inner store's reads, counted: loads, counts and distinct reads. */
function counted(store) {
  const load = store.load.bind(store);
  const total = store.totalCount.bind(store);
  store.load = async (o) => { counters.loads++; const r = await load(o); counters.rows += r.rows.length; return r; };
  store.totalCount = (o) => { counters.counts++; return total(o); };
  if (typeof store.distinct === 'function') {
    const distinct = store.distinct.bind(store);
    store.distinct = (...a) => { counters.distinct++; return distinct(...a); };
  }
  return store;
}

/* ── Controls, faked from their specs: the source checks what each has ─── */

function control(tag, id, holds = []) {
  const spec = JSON.parse(readFileSync(`src/components/${tag}/${tag}.component.json`, 'utf8'));
  const el = new EventTarget();
  Object.assign(el, {
    id, holds: [...holds], readings: {}, presets: {}, superseded: [],
    setAttribute() {}, removeAttribute() {}, toggleAttribute() {},
    send(type, detail) { el.dispatchEvent(new CustomEvent(type, { detail })); },
    answer(readings, presets = el.presets) { el.readings = readings; el.presets = presets; el.report(); },
    // The bar's filter Switch, as a reader flips it.
    switchOff(off) { el.suspended = off; el.report(); },
  });
  for (const m of [...(spec.$extensions?.sherpa?.methods ?? []).map((x) => x.name), 'populate']) {
    if (!(m in el)) el[m] = () => { counters.draws++; };
  }
  const has = (m) => (spec.$extensions?.sherpa?.methods ?? []).some((x) => x.name === m);
  if (has('drawReading')) {
    el.drawReading = (field, r) => {
      counters.draws++;
      if ((r?.picked ?? []).length || (r?.text ?? '').trim() || (r?.conditions ?? []).length) el.readings[field] = r;
      else delete el.readings[field];
    };
  }
  // A bar supersedes only its own chips.
  if (has('supersede')) el.supersede = (fields) => { counters.draws++; el.superseded = (fields ?? []).filter((f) => el.holds.includes(f)); };
  // As the toolbar draws a scope: a filter with `readings` is a saved filter, the rest are fields.
  if (has('drawScope')) {
    el.drawScope = (d) => {
      counters.draws++;
      const filters = d?.filters ?? [];
      el.holds = filters.filter((f) => !f.readings).map((f) => f.id);
      el.presets = Object.fromEntries(filters.filter((f) => f.readings).map((f) => [f.id, { on: !!f.active, readings: f.readings }]));
      el.readings = Object.fromEntries(filters.filter((f) => !f.readings && f.state).map((f) => [f.id, f.state]));
      if ('suspended' in el) el.suspended = !!d?.suspended;
    };
  }
  // EVERY chip it holds, answered or not, as the toolbar's `readings` does.
  if (has('report')) {
    el.report = () => {
      const readings = Object.fromEntries(el.holds.filter((f) => !el.superseded.includes(f)).map((f) => {
        const r = el.readings[f];
        return [f, r ? { ...r, suspended: !!r.suspended } : { picked: [], suspended: true }];
      }));
      el.send('quick-filter-change', { readings, presets: el.presets, holds: el.holds,
        ...('suspended' in el ? { suspended: el.suspended } : {}) });
    };
  }
  return el;
}

/** The page, opened and bound as the provider binds it. */
async function open(L, remote, announcesAll) {
  const def = JSON.parse(readFileSync(PAGE, 'utf8')).source;
  const store = counted(new L.ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id', time: 'created' }));
  const seen = remote ? L.spoofRemote(store, { delay: 0, ...(announcesAll === false ? { announcesAll } : {}) }) : store;
  return { L, def, store: seen, ...await page(L, def, seen) };
}

/** One page over a store: its source, and its controls bound as the provider binds them. */
async function page(L, def, store) {
  const source = await L.openSource(def, store);
  source.limitOptions = true;
  // As the provider keeps it.
  const initial = structuredClone(source.query.applied);
  const view = control('sherpa-quick-filter-toolbar', 'view-bar', def.scopes.view.holds);
  const data = control('sherpa-quick-filter-toolbar', 'data-bar', def.scopes.data.holds);
  data.presets = Object.fromEntries((def.scopes.data.presets ?? []).map((p) => [p, { on: false, readings: {} }]));
  const grid = control('sherpa-data-grid', 'grid');
  const chart = control('sherpa-barchart', 'chart');
  const panel = control('sherpa-filter-panel', 'panel');
  L.bindSource(source, view, { steerOnly: true, scope: 'view' });
  L.bindSource(source, data, { steerOnly: true, scope: 'data' });
  L.bindSource(source, grid, { scope: 'data', shows: 'grid' });
  L.bindSource(source, chart, { readonly: true, rows: 'all' });
  L.bindSource(source, panel, { steerOnly: true, scope: ['view', 'data'] });
  return { source, initial, view, data, grid, chart, panel };
}

const REPORT = { status: { picked: ['active', 'trial'] }, owner: { picked: ['Owner 01'] }, plan: { picked: ['pro'] } };
const AT_RISK = { 'has-tickets': { on: false, readings: {} }, 'at-risk': { on: true, readings: {} }, unassigned: { on: false, readings: {} } };

/** The acts, in order: they share one page's state. */
const ACTS = {
  pick: (p) => p.view.answer({ region: { picked: ['EMEA'] } }),
  repick: (p) => p.view.answer({ region: { picked: ['EMEA'] } }),
  // While the rows still fill many pages: after the report they fit on one.
  page: (p) => p.grid.send('page-change', { page: 2 }),
  report: (p) => p.data.answer(REPORT, AT_RISK),
  'switch-off': (p) => p.data.switchOff(true),
  'switch-on': (p) => p.data.switchOff(false),
  sort: (p) => p.grid.send('sort-change', { field: 'customer', direction: 'asc' }),
  heading: (p) => p.grid.send('column-filter-change', { field: 'tier', reading: { picked: ['gold'] } }),
  search: (p) => p.data.send('search-change', { value: 'owner 1' }),
  raise: (p) => p.panel.send('filter-add', { scope: 'view', ids: ['status'], from: 'data' }),
  clear: (p) => p.view.answer({}),
  reset: (p) => p.source.setQuery(structuredClone(p.initial)),
  // A reader's own writes: each names its row, so a held set takes it in place.
  add: (p) => p.store.insert({ ...ROWS[0], id: N + 1, name: 'Person new', email: 'new@example.com' }),
  save: (p) => p.store.update(17, { owner: 'Owner 02' }),
  delete: (p) => p.store.remove(N + 1),
  // The page left and opened again over the same store: a held set is the store's, and stays.
  reopen: async (p) => {
    p.source.close();
    Object.assign(p, await page(p.L, p.def, p.store));
  },
  // A pick the filters before it leave no row for is SET ASIDE: under Customer 01, paused,
  // free and gold hold 3 rows — Owners 03, 04 and 21 — so Owner 01 goes. TRAP T-one-walk-counts-and-limits-in-order
  narrow: (p) => p.view.answer({ customer: { picked: ['Customer 01'] } }),
  aside: (p) => p.data.answer({ status: { picked: ['paused'] }, plan: { picked: ['free'] }, tier: { picked: ['gold'] },
    owner: { picked: ['Owner 03', 'Owner 01'] } }),
};
const PAGES = {
  records: { remote: false, acts: Object.keys(ACTS) },
  remote: { remote: true, acts: Object.keys(ACTS) },
  // A store that may miss a writer (a server another client writes): a reopen shows its set and checks it behind.
  rest: { remote: true, announcesAll: false, acts: Object.keys(ACTS) },
};

/** An act has ended when no counter moves for three timer turns. */
async function settle(name) {
  let last = '';
  let still = 0;
  for (let i = 0; i < 1000; i++) {
    await new Promise((r) => setTimeout(r, 0));
    const now = Object.values(counters).join();
    still = now === last ? still + 1 : 0;
    last = now;
    if (still >= 3) return;
  }
  throw new Error(`check-bench: "${name}" never settled`);
}

/** Open each page, run its acts in order, and count what each cost. */
export async function bench() {
  const L = await layer();
  const reports = [];
  const undo = L.onReport((r) => reports.push(r.code));
  const clone = globalThis.structuredClone;
  globalThis[COUNTER] = counters;
  globalThis.structuredClone = (v, o) => { counters.clones++; return clone(v, o); };
  const costs = {};
  const measure = async (name, act) => {
    const was = { ...counters };
    const t = performance.now();
    const out = await act();
    await settle(name);
    if (reports.length) throw new Error(`check-bench: "${name}" reported ${reports.join(', ')}`);
    costs[name] = Object.fromEntries(Object.keys(counters).map((k) => [k, counters[k] - was[k]]));
    costs[name].ms = Math.round(performance.now() - t);
    return out;
  };
  try {
    for (const [page, { remote, announcesAll, acts }] of Object.entries(PAGES)) {
      const p = await measure(`${page}/open`, () => open(L, remote, announcesAll));
      for (const act of acts) await measure(`${page}/${act}`, () => ACTS[act](p));
    }
  } finally {
    globalThis.structuredClone = clone;
    delete globalThis[COUNTER];
    undo();
  }
  return costs;
}

/** The reads that leave the data layer. */
const ASKS = ['loads', 'counts', 'distinct'];

/** Each act on the remote page, after it opens, that asked the store: its whole
 *  set is held, so the client answers. A rule, never a baseline — Will, TODO 340.
 *  TRAP T-a-remote-source-holds-its-whole-set */
export function asked(costs) {
  // A rest/ open and reopen read the set ONCE — the reopen behind the set it shows. TRAP T-a-read-is-planned
  const once = new Set(['rest/open', 'rest/reopen']);
  return Object.entries(costs)
    .filter(([act]) => act.startsWith('remote/') || act.startsWith('rest/'))
    .filter(([act, c]) => (act === 'remote/open' ? false
      : once.has(act) ? c.loads !== 1 || c.counts > 0 || c.distinct > 0
        : ASKS.some((k) => c[k] > 0)))
    .map(([act, c]) => `${act} asked the store: ${ASKS.map((k) => `${k} ${c[k]}`).join(', ')}${once.has(act) ? ' (want: loads 1)' : ''}`);
}

/** Each cost above the baseline, and each act one side lacks. */
export function over(costs, base) {
  const out = [];
  for (const [act, cost] of Object.entries(costs)) {
    if (!base[act]) { out.push(`${act}: not in the baseline`); continue; }
    for (const k of GATED) if ((cost[k] ?? 0) > (base[act][k] ?? 0)) out.push(`${act}: ${k} ${base[act][k] ?? 0} → ${cost[k]}`);
  }
  for (const act of Object.keys(base)) if (!costs[act]) out.push(`${act}: in the baseline, no longer run`);
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.includes('--staged')) {
    const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' }).split('\n');
    if (!staged.some((f) => STAGED.some((s) => f.startsWith(s)))) {
      console.log('check-bench: nothing the bench measures is staged');
      process.exit(0);
    }
  }
  const costs = await bench();
  console.table(costs);
  const asks = asked(costs);
  if (asks.length) {
    for (const line of asks) console.log(`  ${line}`);
    console.log('A remote act asked the store. Its whole set is held, so the client answers it (TODO 340).');
    process.exit(1);
  }
  if (process.argv.includes('--update-baseline')) {
    const keep = Object.fromEntries(Object.entries(costs).map(([a, c]) => [a, Object.fromEntries(GATED.map((k) => [k, c[k]]))]));
    writeFileSync(BASELINE, `${JSON.stringify(keep, null, 2)}\n`);
    console.log(`check-bench: baseline recorded — ${Object.keys(keep).length} acts`);
    process.exit(0);
  }
  const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  const bad = over(costs, base);
  if (bad.length) {
    for (const line of bad) console.log(`  ${line}`);
    console.log('An act costs more. Remove what it added, or record it: npm run check:bench -- --update-baseline');
    process.exit(1);
  }
  const fell = Object.entries(costs).flatMap(([a, c]) => GATED.filter((k) => c[k] < (base[a]?.[k] ?? 0)).map((k) => `${a}: ${k} ${base[a][k]} → ${c[k]}`));
  for (const line of fell) console.log(`  ▼ ${line}`);
  console.log(`check-bench: ${Object.keys(costs).length} acts within the baseline`);
}
