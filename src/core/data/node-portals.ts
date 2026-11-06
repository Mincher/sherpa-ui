/**
 * node-portals.ts — a PORTAL: an In and an Out joined by a name, with no line between them. An In takes many routes;
 * every Out of its name draws ONE ROW per route into any In of the name, `@` and the route's source, and each row is
 * routed on alone, as a Custom Node's Group Input is (763). The ONE resolver of a portal hop, which every reader of what
 * flows reads through; the names, the matches, Rename, and the rules a Custom Node keeps. DOM-free. Will, TODOs 779, 826
 * · docs/history/plan-779-portals.md · docs/history/plan-826-portal-rows.md · TRAP T-a-portal-hop-is-resolved-once
 *
 * Map:
 * - PORTAL — The portal family's kind id.
 * - Portal — A node as a portal: its side and its name.
 * - portalOf — A node as a portal, a definition's or a drawn one; none, it is no portal.
 * - connectionRow — An Out's row for one route into an In of its name: `@` and the route's source address.
 * - connectionOf — The source a connection row names; none, the row is no connection's.
 * - FlowRoute — A route as the data flows: the portal it passes through, where it does.
 * - PortalFlow — A graph's routes as the data flows, each Out's rows, the routes a gone row keeps, and the warnings.
 * - portalFlow — The routes as the data flows: a route from an Out's row is one route from that row's source.
 * - portalNames — Every name a graph's portals hold, in the order met.
 * - nextPortalName — The next free name, `Portal N`.
 * - portalLinks — The other portals of a portal's name, by id.
 * - portalHint — What a portal's Name row says: how many portals of its name it is joined to, and an Out's rows.
 * - renamedPortals — The nodes with one name renamed on every portal that holds it.
 * - cutNames — The names a pick holds some, and not all, of the portals of.
 * - ungroupNames — The names a Custom Node's body brings out, each one the graph holds already taking the next free number.
 */
import type { NodeRoute } from './node-kinds.js';

/** A socket address's node and row, `node` or `node/row`: here, not imported, so node-kinds may import this file. */
const nodeOf = (address: string): string => address.split('/', 1)[0]!;
const rowPart = (address: string): string | undefined => (address.includes('/') ? address.slice(address.indexOf('/') + 1) : undefined);

/** The portal family's kind id. */
export const PORTAL = 'portal';

/** A node as a portal: its side, In or Out, and its name; none named, it links nothing. */
export interface Portal {
  side: 'in' | 'out';
  name: string;
}

/** A node as a definition holds it, its values; or drawn, its rows. */
type AnyNode = { id: string; kind: string; values?: Readonly<Record<string, unknown>>; rows?: readonly { name: string; value?: unknown }[] };

/** A node as a portal: In unless its type says Out; its name trimmed. None: it is no portal. */
export function portalOf(node: AnyNode | undefined): Portal | undefined {
  if (node?.kind !== PORTAL) return undefined;
  const at = (row: string): unknown => (node.rows ? node.rows.find((r) => r.name === row)?.value : node.values?.[row]);
  const name = at('name');
  return { side: at('type') === 'out' ? 'out' : 'in', name: typeof name === 'string' ? name.trim() : '' };
}

/** An Out's row for one route into an In of its name: `@` and that route's source, so the same route back is the same row,
 *  and a route from it holds while the route into the In does. */
export function connectionRow(source: string): string {
  return `@${source}`;
}

/** The source address a connection row names; none, the row is no connection's. */
export function connectionOf(row: string | undefined): string | undefined {
  return row?.startsWith('@') ? row.slice(1) : undefined;
}

/** A route as the data flows: the name of the portal it passes through, where it does. */
export interface FlowRoute extends NodeRoute {
  portal?: string;
}

/** A graph's routes as the data flows, each Out's rows, the routes a gone row keeps, and the warnings. */
export interface PortalFlow {
  /** The routes as the data flows: none enters an In; one from an Out's row comes from that row's source, its name on it. */
  routes: readonly FlowRoute[];
  /** Each Out's rows, by id: the source of each route into an In of its name, in order, each once. */
  rows: ReadonlyMap<string, readonly string[]>;
  /** The routes from a row no route into an In feeds now: the draft keeps them, unseen; Save leaves them out. */
  orphans: readonly NodeRoute[];
  /** A portal's own warning, in words: an Out of no name, or one no In names. */
  warnings: readonly { node: string; words: string }[];
}

/**
 * The routes as the data flows. Each route into an In of a name is a ROW on every Out of the name (`connectionRow`), and a
 * route from that row is one route from its source, as if routed straight: so 1-to-many, many-to-1 and many-to-many are
 * routes as any other, each row routed alone. An Out's row routed into an In of another name chains. A route from a row
 * no route feeds now is an orphan, kept. The ONE place a hop is resolved: every reader of what flows reads these routes,
 * never the drawn ones. TRAP T-a-portal-hop-is-resolved-once
 */
export function portalFlow(nodes: readonly AnyNode[], routes: readonly NodeRoute[]): PortalFlow {
  const portals = new Map(nodes.flatMap((n) => { const p = portalOf(n); return p ? [[n.id, p] as const] : []; }));
  if (!portals.size) return { routes, rows: new Map(), orphans: [], warnings: [] };
  const at = (address: string): Portal | undefined => portals.get(nodeOf(address));
  const ins = (name: string): Set<string> => new Set(name ? [...portals].filter(([, p]) => p.side === 'in' && p.name === name).map(([id]) => id) : []);
  const fromRow = (address: string): string | undefined => (at(address) ? connectionOf(rowPart(address)) : undefined);
  // An orphan feeds no In, so its Out's row goes, and what that row fed: read again until none goes.
  let live = [...routes];
  const orphans: NodeRoute[] = [];
  let rows = new Map<string, readonly string[]>();
  for (;;) {
    rows = new Map([...portals].flatMap(([id, p]) => {
      const into = ins(p.name);
      return p.side === 'out' ? [[id, [...new Set(live.filter((r) => into.has(r.to)).map((r) => r.from))]] as const] : [];
    }));
    const gone = live.filter((r) => { const c = fromRow(r.from); return c !== undefined && !(rows.get(nodeOf(r.from)) ?? []).includes(c); });
    if (!gone.length) break;
    orphans.push(...gone);
    live = live.filter((r) => !gone.includes(r));
  }
  // A row's source, followed through an Out's row into another In: each step is a shorter address, so it ends.
  const source = (address: string): string => { const c = fromRow(address); return c === undefined ? address : source(c); };
  const flow: FlowRoute[] = [];
  const seen = new Set<string>();
  for (const r of live) {
    if (at(r.to)?.side === 'in') continue;
    const from = fromRow(r.from) === undefined ? r.from : source(r.from);
    const key = `${from}\u0000${r.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    flow.push(from === r.from ? r : { from, to: r.to, portal: at(r.from)!.name });
  }
  const warnings = [...portals].flatMap(([id, p]) => (p.side !== 'out' ? []
    : !p.name ? [{ node: id, words: 'It has no name: pick one, or New name…, for a row per route into its In' }]
      : !ins(p.name).size ? [{ node: id, words: `No In portal is named "${p.name}": it has no rows` }] : []));
  return { routes: flow, rows, orphans, warnings };
}

/** Every name a graph's portals hold, in the order met. */
export function portalNames(nodes: readonly AnyNode[]): string[] {
  return [...new Set(nodes.flatMap((n) => { const p = portalOf(n); return p?.name ? [p.name] : []; }))];
}

/** The next free name: `Portal 1`, else the least number no name holds. */
export function nextPortalName(names: readonly string[]): string {
  for (let n = 1; ; n++) if (!names.includes(`Portal ${n}`)) return `Portal ${n}`;
}

/** The other portals of a portal's name, by id: what picking it lights. None: it is no portal, or has no name. */
export function portalLinks(nodes: readonly AnyNode[], id: string): string[] {
  const own = portalOf(nodes.find((n) => n.id === id));
  if (!own?.name) return [];
  return nodes.filter((n) => n.id !== id && portalOf(n)?.name === own.name).map((n) => n.id);
}

const count = (n: number, side: 'In' | 'Out'): string => `${n} ${side} portal${n === 1 ? '' : 's'}`;

/** What a portal's Name row says: "Sends to 2 Out portals"; an Out, its rows, "2 rows, from 1 In portal, with 1 other Out portal". */
export function portalHint(nodes: readonly AnyNode[], id: string, rows = 0): string {
  const own = portalOf(nodes.find((n) => n.id === id));
  if (!own) return '';
  if (!own.name) return 'Pick a name, or New name…';
  const linked = portalLinks(nodes, id).map((l) => portalOf(nodes.find((n) => n.id === l))!.side);
  const [i, o] = [linked.filter((s) => s === 'in').length, linked.filter((s) => s === 'out').length];
  const [other, others] = own.side === 'in' ? [o, i] : [i, o];
  const side = own.side === 'in' ? 'In' : 'Out';
  const main = own.side === 'in' ? (other ? `Sends to ${count(other, 'Out')}` : 'No Out portal has this name')
    : other ? `${rows} row${rows === 1 ? '' : 's'}, from ${count(other, 'In')}` : 'No In portal has this name';
  return others ? `${main}, with ${others} other ${side} portal${others === 1 ? '' : 's'}` : main;
}

/** The nodes with one name renamed on every portal that holds it: Rename keeps every link. */
export function renamedPortals<N extends AnyNode>(nodes: readonly N[], from: string, to: string): N[] {
  return nodes.map((n) => (portalOf(n)?.name === from && n.values ? { ...n, values: { ...n.values, name: to } } : n));
}

/** The names a pick holds some, and not all, of the portals of: what Save as Custom Node would cut in two. */
export function cutNames(nodes: readonly AnyNode[], picked: ReadonlySet<string>): string[] {
  const names = portalNames(nodes);
  return names.filter((name) => {
    const held = nodes.filter((n) => portalOf(n)?.name === name);
    const inside = held.filter((n) => picked.has(n.id)).length;
    return inside > 0 && inside < held.length;
  });
}

/** The names a Custom Node's body brings out by Ungroup, as each becomes: one the graph holds already takes the next free
 *  number, `rows 2`, so nothing links that did not. A name is local to the graph it is in. */
export function ungroupNames(outer: readonly AnyNode[], body: readonly AnyNode[]): Map<string, string> {
  const taken = new Set(portalNames(outer));
  const moved = new Map<string, string>();
  for (const name of portalNames(body)) {
    let to = name;
    for (let n = 2; taken.has(to); n++) to = `${name} ${n}`;
    taken.add(to);
    if (to !== name) moved.set(name, to);
  }
  return moved;
}
