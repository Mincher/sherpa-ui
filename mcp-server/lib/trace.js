/**
 * trace.js — the MCP's own half of the one trace stream: each load a query tool
 * runs, heard with every span it says, and its walk's counts said under it as the
 * Node Editor says them; the loads of the last call kept for watch_trace.
 * TRAP T-a-preview-is-this-machine-only
 *
 * Map:
 * - traced — one load of an act, run with the stream heard; a page opened begins a new call
 * - lastCall — the loads of the last query tool's call: its page, and each load's ask and spans
 * - byNode — spans by the Query graph node each lights, each span once, as it ended
 */
import { imported } from './sherpa.js';
import { walked } from '../preview/walked.js';

/** The last call: its page, and each load it ran. */
let last = null;

/** Each span of a trace begun here: one that came in from another host, a preview's, is that act's. */
function own(spans) {
  const roots = new Set(spans.filter((s) => !s.parent).map((s) => s.trace));
  return spans.filter((s) => roots.has(s.trace));
}

/** One load of an act, run with the stream heard, and its walk said under it. `what`
 *  is `{ open: pageId }`, which begins a new call, or `{ asked: request }`. */
export async function traced(what, source, run) {
  const dl = await imported('sherpa-ui/data');
  const spans = [];
  const stop = dl.onTrace((span) => spans.push(span));
  try {
    await run();
    const load = spans.findLast((s) => s.step === 'load' && s.ms !== undefined);
    if (load) await walked(dl, source, load);
  } finally {
    stop();
    if ('open' in what || !last) last = { page: what.open ?? null, at: Date.now(), loads: [] };
    last.loads.push({ asked: 'open' in what ? 'open' : what.asked, spans: own(spans) });
  }
}

/** The loads of the last query tool's call, or null before one. */
export const lastCall = () => last;

/** Spans by the Query graph node each lights (`queryStepNode`), in the order they
 *  began: each span once, as it ended, else as it began. */
export function byNode(dl, spans) {
  const latest = new Map();
  for (const span of spans) latest.set(span.id, span);
  const nodes = new Map();
  for (const s of latest.values()) {
    const node = dl.queryStepNode(s) ?? '(no node)';
    const { state, rows, total, node: _named, ...rest } = s.detail ?? {};
    if (!nodes.has(node)) nodes.set(node, []);
    nodes.get(node).push({
      step: s.step, host: s.host, state: state ?? (s.ms === undefined ? 'start' : 'done'),
      ...(s.ms !== undefined ? { ms: s.ms } : {}), ...(rows !== undefined ? { rows } : {}), ...(total !== undefined ? { total } : {}),
      ...(s.store ? { store: s.store } : {}), ...(Object.keys(rest).length ? { detail: rest } : {}),
    });
  }
  return [...nodes].map(([node, steps]) => ({ node, steps }));
}
