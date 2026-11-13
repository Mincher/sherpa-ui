/**
 * graph-views.ts — a GRAPH View: a View whose body is a canvas, bound to one entity of the View's
 * type, or to a page's Query (`PAGE_QUERY`). The graph chip's rows, a new empty entity, what a canvas
 * keeps as an entity's graph, and its Save and Save graph as. Light: only types and the tags' tidy are imported, so the outlet carries it. DOM-free.
 * Will, plan 746 E3, E4 · TRAP T-a-graph-is-a-view-of-a-type
 *
 * Map:
 * - NEW_GRAPH — The graph chip's New graph… row: its value, which names no entity.
 * - GraphOf — A View's `graph`: the type of entity its canvas shows.
 * - OpenGraph — The graph View on screen: its View, its type, and the entity on its canvas.
 * - GraphWords — The words the graph chip's rows are headed with, a preset's note, and the New row.
 * - GraphChoice — One row of the graph chip: an entity, or New graph….
 * - graphRows — The graph chip's rows: the type's presets, then the reader's own, then New graph….
 * - openOf — The entity a graph View opens: the one named, when the list holds it; else the first.
 * - PAGE_QUERY — The graph type of a page's Query: its graphs are the app's pages, read live, never entities.
 * - GraphPage — One page whose Query a `query` graph View draws: its Context's name, its nav label and its Views.
 * - pagesOf — The pages a `query` graph View offers: every Context with a definition, in the app's order.
 * - pageViewOf — The page and View a Page chip's row names: `<page>/<view>`, or a bare page.
 * - pageRows — The graph chip's rows over the pages: a section each, a row per View, none a copy, and no New graph….
 * - freeId — An id from a name: kebab-case, free among those taken.
 * - newGraph — A new, empty entity of a type, saved through the shelf under a free id, name and tags.
 * - graphOfWorkflow — What a canvas's workflow keeps as an entity's graph: its own nodes, its connections, ties and frames.
 * - saveGraph — Save the graph on a canvas as the open entity's, its own tags if given: a preset is refused.
 * - saveGraphAs — Save the graph on a canvas as a COPY of an entity: the reader's own, named and tagged, under a free id.
 */
import { withBody, type Entity, type EntityBody, type EntityGraph } from './entity.js';
import { isGroupEnd, layoutParts } from './graph-layout.js';
import { tidyTags } from './tags.js';
import type { EntityType } from './entity-types.js';
import type { EntityShelf, EntitySummary } from './entity-shelf.js';
import type { WorkflowDefinition } from './workflow.js';

/** The graph chip's New graph… row: its value, which names no entity. */
export const NEW_GRAPH = '#new';

/** A View's `graph`: the type of entity its canvas shows. */
export interface GraphOf {
  type: string;
}

/** The graph View on screen: its View, its type, and the entity on its canvas. */
export interface OpenGraph {
  view: string;
  type: string;
  /** None while the type has no entity. */
  id: string | null;
  origin?: 'preset' | 'mine';
}

/** The words the graph chip's rows are headed with, a preset's note, and the New row. */
export interface GraphWords {
  presets: string;
  mine: string;
  readOnly: string;
  new: string;
}

const WORDS: GraphWords = { presets: 'Presets', mine: 'My graphs', readOnly: 'Read only', new: 'New graph…' };

/** One row of the graph chip: an entity, or New graph…. */
export interface GraphChoice {
  value: string;
  label: string;
  selected?: boolean;
  section?: string;
  note?: string;
}

/** The graph chip's rows, from one type's list: its presets, read only, then the reader's own, then New graph…. */
export function graphRows(list: readonly EntitySummary[], current: string | null, words: GraphWords = WORDS): GraphChoice[] {
  const row = (e: EntitySummary): GraphChoice => ({
    value: e.id, label: e.label,
    ...(e.origin === 'preset' ? { section: words.presets, note: words.readOnly } : { section: words.mine }),
    ...(e.id === current ? { selected: true } : {}),
  });
  const presets = list.filter((e) => e.origin === 'preset');
  return [...presets.map(row), ...list.filter((e) => e.origin !== 'preset').map(row), { value: NEW_GRAPH, label: words.new }];
}

/** The entity a graph View opens: the one named, when the list holds it; else the first. */
export function openOf(list: readonly EntitySummary[], id: string | null | undefined): EntitySummary | undefined {
  return list.find((e) => e.id === id) ?? list[0];
}

/** The graph type of a page's Query: its graphs are the app's pages, read live, never entities. TRAP T-a-graph-is-a-view-of-a-type */
export const PAGE_QUERY = 'query';

/** One page whose Query a `query` graph View draws: its Context's name, its nav label and its Views. */
export interface GraphPage {
  id: string;
  label: string;
  /** Its Views, its presets first, then the reader's own: a row each in the Page chip (plan 960 U4.8b). */
  views?: readonly { id: string; label: string; origin: 'preset' | 'mine' }[];
}

/** The pages a `query` graph View offers: every Context with a definition, in the app's order. */
export function pagesOf(contexts: Readonly<Record<string, { label: string; definition?: string }>>): GraphPage[] {
  return Object.entries(contexts).flatMap(([id, c]) => (c.definition ? [{ id, label: c.label }] : []));
}

/** The page and View a Page chip's row names: `<page>/<view>`, or a bare page, which names none. */
export function pageViewOf(value: string): { page: string; view?: string } {
  const at = value.indexOf('/');
  return at < 0 ? { page: value } : { page: value.slice(0, at), view: value.slice(at + 1) };
}

/** The graph chip's rows over the pages: a section each, and under it a row per View, its presets read only; a page with
 *  no Views is one row. None is a copy, and there is no New graph…. */
export function pageRows(pages: readonly GraphPage[], current: string | null, words: Pick<GraphWords, 'readOnly'> = WORDS): GraphChoice[] {
  const row = (value: string, label: string, more: Partial<GraphChoice> = {}): GraphChoice => ({ value, label, ...more, ...(value === current ? { selected: true } : {}) });
  return pages.flatMap((p) => (p.views?.length
    ? p.views.map((v) => row(`${p.id}/${v.id}`, v.label, { section: p.label, ...(v.origin === 'preset' ? { note: words.readOnly } : {}) }))
    : [row(p.id, p.label)]));
}

/** An id from a name: kebab-case, free among those taken. */
export function freeId(label: string, taken: readonly string[], type: string): string {
  const slug = label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const base = /^[a-z]/.test(slug) ? slug : `${type}${slug ? `-${slug}` : ''}`;
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** A new, empty entity of a type: the type's own settings to start, its name or "New <type>", and a
 *  free id from it. Saved through the shelf, so it is checked. The id it was kept under, or none. */
export async function newGraph(shelf: EntityShelf, type: Pick<EntityType, 'id' | 'label' | 'defaults'>, named: { label?: string; description?: string; tags?: readonly string[] } = {}): Promise<string | undefined> {
  const taken = shelf.list();
  const asked = named.label?.trim();
  let label = asked || `New ${type.label}`;
  // A name of its own is the reader's; the default is numbered, so two read apart.
  if (!asked) for (let n = 2; taken.some((e) => e.type === type.id && e.label === label); n++) label = `New ${type.label} ${n}`;
  const id = freeId(label, taken.map((e) => e.id), type.id);
  const description = named.description?.trim();
  const entity: Entity = {
    v: 3, type: type.id, id, label, ...(description ? { description } : {}), ...(tidyTags(named.tags).length ? { tags: tidyTags(named.tags) } : {}),
    graph: { nodes: [], connections: [] },
    ...(type.defaults ? { settings: structuredClone(type.defaults) } : {}),
  };
  return await shelf.save(entity) ? id : undefined;
}

/** What a canvas's workflow keeps as an entity's graph: its own nodes and its Start (not `#in` and `#out`), its connections, ties and frames. */
export function graphOfWorkflow(workflow: Pick<WorkflowDefinition, 'nodes' | 'connections' | 'ties' | 'frames' | 'stages' | 'lanes' | 'beforeLanes'>): EntityGraph {
  return {
    // Its stages and swimlanes, as its frames: a Save that dropped them lost them on the next load (TODO 933).
    // The Start is kept as any node; a Group Input and Output are placed from the graph (TODO 955).
    nodes: workflow.nodes.filter((n) => !isGroupEnd(n.id)), connections: workflow.connections ?? [], ...layoutParts(workflow),
  };
}

/** Save a canvas's body as the open entity's: what its lens wrote back (`bodyOf(answer.definition)`), a graph or a query, in
 *  place of the one it had; and its own tags when given (the editor's `tags()`, TODO 828). A preset is refused, as the
 *  shelf refuses it: it is read only. */
export async function saveGraph(shelf: EntityShelf, id: string, body: EntityBody, own: { tags?: readonly string[] } = {}): Promise<boolean> {
  const was = shelf.get(id);
  return !!was && shelf.save({ ...withBody(was, body), ...(own.tags ? { tags: tidyTags(own.tags) } : {}) });
}

/** Save a canvas's body as a COPY of an entity, a preset's too: the reader's own, under the name and description given
 *  and a free id, through the one Clone (plan 972c). The copy's id, or none. */
export async function saveGraphAs(shelf: EntityShelf, id: string, body: EntityBody, named: { label: string; description?: string; tags?: readonly string[]; category?: string }): Promise<string | undefined> {
  const was = shelf.get(id);
  const label = named.label.trim();
  if (!was || !label) return undefined;
  const copy = freeId(label, shelf.list().map((e) => e.id), was.type);
  const description = named.description?.trim();
  // Tags given are the copy's; none given, it keeps the ones it was copied from.
  const tags = named.tags && tidyTags(named.tags);
  // A category given is the copy's: Custom Nodes is none (plan 936).
  const category = named.category && named.category !== 'Custom Nodes' ? { category: named.category } : {};
  // Loaded when asked: the outlet carries this module, and a Save as is rare.
  const { clone } = await import('./entity-versions.js');
  const made = await clone(shelf, id, { id: copy, label, description: description || undefined, ...(tags ? { tags } : {}), ...category, body });
  return 'id' in made ? made.id : undefined;
}
