/**
 * node-portals.ts — a PORTAL: an In and an Out joined by a name, with no line between them. What reaches an In
 * comes out of every Out of its name. The ONE resolver of a portal hop, which every reader of what flows reads
 * through; the names, the matches, Rename, and the rules a Custom Node keeps. DOM-free. Will, TODO 779
 * · docs/history/plan-779-portals.md · TRAP T-a-portal-hop-is-resolved-once
 *
 * Map:
 * - PORTAL — The portal family's kind id.
 * - Portal — A node as a portal: its side and its name.
 * - portalOf — A node as a portal, a definition's or a drawn one; none, it is no portal.
 * - FlowRoute — A route as the data flows: the portal it passes through, where it does.
 * - NullWhy — Why an input reads null: more reach it through a portal than it takes, or no In has the name.
 * - PortalFlow — A graph's routes as the data flows, and what reads null and warns.
 * - portalFlow — The routes as the data flows: each hop through a portal joined, from what reaches an In to where its Outs go.
 * - nullWords — Why an input reads null, in words, after its label.
 * - portalNames — Every name a graph's portals hold, in the order met.
 * - nextPortalName — The next free name, `Portal N`.
 * - portalLinks — The other portals of a portal's name, by id.
 * - portalHint — What a portal's Name row says: how many portals of its name it is joined to.
 * - renamedPortals — The nodes with one name renamed on every portal that holds it.
 * - cutNames — The names a pick holds some, and not all, of the portals of.
 * - ungroupNames — The names a Custom Node's body brings out, each one the graph holds already taking the next free number.
 */
import type { NodeRoute } from './node-kinds.js';

/** The node a socket address names, `node` or `node/row`: here, not imported, so node-kinds may import this file. */
const nodeOf = (address: string): string => address.split('/', 1)[0]!;

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

/** A route as the data flows: the name of the portal it passes through, where it does. */
export interface FlowRoute extends NodeRoute {
  portal?: string;
}

/** Why an input reads null: `count` reach it through `portal`, and it takes one; or `none`, the Out it comes from is named
 *  by no In. */
export type NullWhy = { count: number; portal: string } | { none: string };

/** A graph's routes as the data flows, and what reads null and warns. */
export interface PortalFlow {
  /** The routes as the data flows: no route enters an In or leaves an Out; each hop joined, its name on it. */
  routes: readonly FlowRoute[];
  /** The routes into an input that reads null: no reader reads them; a loop is still a loop through them. */
  dropped: readonly FlowRoute[];
  /** Each input address that reads null, and why. */
  nulls: ReadonlyMap<string, NullWhy>;
  /** Each Out's sources: what reaches every In of its name, by the output sockets it comes from. */
  sources: ReadonlyMap<string, readonly string[]>;
  /** A portal's own warning, in words: an Out no In names. */
  warnings: readonly { node: string; words: string }[];
  /** The names whose portals send into themselves: a loop. */
  loops: readonly string[];
}

const EMPTY: PortalFlow = { routes: [], dropped: [], nulls: new Map(), sources: new Map(), warnings: [], loops: [] };

/**
 * The routes as the data flows: a route into an In and a route out of an Out of its name are ONE route, from what
 * reaches the In to where the Out goes, each In's its own send (many-to-1, 1-to-many, many-to-many). An Out into an
 * In of another name chains. An input that takes one (`takesMany` false) reached by more than one, any through a
 * portal, reads null; so does one only Outs no In names reach. The ONE place a hop is resolved: every reader of what
 * flows reads these routes, never the drawn ones. TRAP T-a-portal-hop-is-resolved-once
 */
export function portalFlow(nodes: readonly AnyNode[], routes: readonly NodeRoute[], takesMany: (address: string) => boolean = () => false): PortalFlow {
  const portals = new Map(nodes.flatMap((n) => { const p = portalOf(n); return p ? [[n.id, p] as const] : []; }));
  if (!portals.size) return { ...EMPTY, routes };
  const at = (address: string): Portal | undefined => portals.get(nodeOf(address));
  const ins = (name: string): string[] => (name ? [...portals].filter(([, p]) => p.side === 'in' && p.name === name).map(([id]) => id) : []);
  const loops = new Set<string>();
  const memo = new Map<string, string[]>();
  // What reaches every In of a name, as the sockets it comes from: an Out's own, followed through its name.
  const reach = (name: string, walking: ReadonlySet<string>): string[] => {
    if (walking.has(name)) { loops.add(name); return []; }
    const held = memo.get(name);
    if (held) return held;
    const on = new Set([...walking, name]);
    const found = ins(name).flatMap((id) => routes.filter((r) => r.to === id).flatMap((r) => {
      const from = at(r.from);
      return !from ? [r.from] : from.side === 'out' ? reach(from.name, on) : [];
    }));
    const unique = [...new Set(found)];
    if (!walking.size) memo.set(name, unique);
    return unique;
  };
  const flow: FlowRoute[] = [];
  const seen = new Set<string>();
  const push = (r: FlowRoute): void => {
    const key = `${r.from}\u0000${r.to}`;
    if (seen.has(key)) return;
    seen.add(key);
    flow.push(r);
  };
  const dead = new Map<string, string>();
  const sources = new Map<string, readonly string[]>();
  const warnings: { node: string; words: string }[] = [];
  for (const [id, p] of portals) {
    if (p.side !== 'out') continue;
    sources.set(id, reach(p.name, new Set()));
    if (!p.name) warnings.push({ node: id, words: 'It has no name: pick one, or New name…, to send what reaches its In' });
    else if (!ins(p.name).length) warnings.push({ node: id, words: `No In portal is named "${p.name}": it sends nothing` });
  }
  // Plain routes first, so a route drawn straight is the one kept where a hop brings the same.
  for (const r of routes) if (!at(r.from) && !at(r.to)) push(r);
  for (const r of routes) {
    const [from, to] = [at(r.from), at(r.to)];
    if (to?.side === 'in' || (!from && !to)) continue;
    if (!from) { push(r); continue; }
    if (from.side !== 'out') continue;
    const sent = sources.get(nodeOf(r.from)) ?? [];
    if (!sent.length && !ins(from.name).length) dead.set(r.to, from.name);
    for (const s of sent) push({ from: s, to: r.to, portal: from.name });
  }
  const nulls = new Map<string, NullWhy>();
  for (const [to, name] of dead) if (!flow.some((r) => r.to === to)) nulls.set(to, { none: name });
  // An input that takes one, reached by more than one through a portal, reads null: Will's rule, a mismatch warns.
  const into = Map.groupBy(flow, (r) => r.to);
  for (const [to, list] of into) {
    const hop = list.find((r) => r.portal);
    if (list.length > 1 && hop && !takesMany(to)) nulls.set(to, { count: list.length, portal: hop.portal! });
  }
  return { routes: flow.filter((r) => !nulls.has(r.to)), dropped: flow.filter((r) => nulls.has(r.to)), nulls, sources, warnings, loops: [...loops] };
}

/** Why an input reads null, in words after its label: "Sort takes one route; 2 reach it through the portal "rows"". */
export function nullWords(label: string, why: NullWhy): string {
  return 'none' in why ? `${label} reads nothing: no In portal is named "${why.none}"` : `${label} takes one route; ${why.count} reach it through the portal "${why.portal}"`;
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

/** What a portal's Name row says: "Sends to 2 Out portals", "Sends what reaches 1 In portal, with 1 other Out portal". */
export function portalHint(nodes: readonly AnyNode[], id: string): string {
  const own = portalOf(nodes.find((n) => n.id === id));
  if (!own) return '';
  if (!own.name) return 'Pick a name, or New name…';
  const linked = portalLinks(nodes, id).map((l) => portalOf(nodes.find((n) => n.id === l))!.side);
  const [i, o] = [linked.filter((s) => s === 'in').length, linked.filter((s) => s === 'out').length];
  const [other, others] = own.side === 'in' ? [o, i] : [i, o];
  const side = own.side === 'in' ? 'In' : 'Out';
  const main = own.side === 'in' ? (other ? `Sends to ${count(other, 'Out')}` : 'No Out portal has this name') : (other ? `Sends what reaches ${count(other, 'In')}` : 'No In portal has this name');
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
