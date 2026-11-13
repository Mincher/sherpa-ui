/**
 * entity-shelf.ts — where an app's entities come together: the presets a file ships, read only,
 * and the reader's own, app-wide, of every type. ONE door: list, get, save, remove (refused while
 * another entity uses it), duplicate, export, import, watch. It holds no storage: the keeper gives
 * it a port, so a test, a server and a browser share the one set of rules. Its `library` is every entity as the
 * Custom Node it offers; a Custom Node is kept through the doors (custom-nodes.ts, plan 942). DOM-free. Will, plan 746 E2, E5
 * TRAP T-an-entity-is-an-envelope-and-a-type · TRAP T-an-entity-is-used-as-a-node
 *
 * Map:
 * - EntitySummary — One entity as a list shows it: cheap, no graph.
 * - EntityShelf — What an editor is handed: list, get, save, remove (and why not), duplicate, export, import, watch, library.
 * - EntityPort — What a shelf needs of its keeper: the presets, the reader's own, keeping them, and hearing a change.
 * - joinEntities — The presets and the reader's entities as one list; a clash with a preset or an earlier id is left out.
 * - makeShelf — The shelf over a port. Each save keeps the final graph, checked by `checkEntity`, loaded when first asked.
 */
import { report } from './report.js';
import { isEntity, usesOf, ENTITY_SCHEMA, type Entity } from './entity.js';
import { libraryOf } from './entity-types.js';
import type { EntityFacts } from './entity-check.js';
import type { NodeLibrary } from './node-library.js';

/** One entity as a list shows it: cheap, no graph. */
export interface EntitySummary {
  id: string;
  type: string;
  label: string;
  origin: 'preset' | 'mine';
}

/** What an editor is handed. Save, remove, duplicate and import answer whether it was done; the
 *  reason is reported. A preset is read only: `duplicate` makes a copy of the reader's own. */
export interface EntityShelf {
  /** Every entity, presets first, as a summary; of one type when given. */
  list(type?: string): EntitySummary[];
  /** The whole entity, with its `origin`. */
  get(id: string): Entity | undefined;
  save(entity: Entity): Promise<boolean>;
  /** The reader's own only, and refused while another entity uses it. */
  remove(id: string): boolean;
  /** Why `remove` would keep an entity, in words: a preset, or another entity uses it; none when it would go. */
  whyKept(id: string): string | undefined;
  /** A copy under a new id, "<label> copy" unless `change` names it; `change` may carry the graph on a canvas, its tags, and none for its description. */
  duplicate(id: string, newId: string, change?: { label?: string; description?: string | undefined; tags?: readonly string[]; category?: string; graph?: Entity['graph'] }): Promise<boolean>;
  /** Called with the list whenever it changes here, and when another tab changes it. Stops on the signal. */
  watch(handler: (list: EntitySummary[]) => void, signal?: AbortSignal): void;
  /** The entity as JSON text, with its `$schema` and without its `origin`. */
  export(id: string): string | undefined;
  /** An entity from JSON text, checked, kept as the reader's own. A taken id gets a free one. The id it was kept under, or none. */
  import(json: string): Promise<string | undefined>;
  /** Every entity of a reusable type as the Custom Node it offers, by its use's kind: an editor's library (D1). */
  library(): NodeLibrary;
}

/** What a shelf needs of its keeper: the presets, the reader's own, keeping them, and hearing a change. */
export interface EntityPort {
  presets(): readonly Entity[];
  mine(): Readonly<Record<string, Entity>>;
  keep(next: Record<string, Entity>): void;
  /** Hear the reader's entities change here or in another tab. */
  heard(handler: () => void, signal?: AbortSignal): void;
}

/** The presets and the reader's entities as one list: presets first, marked `preset`; then the reader's,
 *  marked `mine`. A reader's entity whose id a preset holds is left out, so it overrides nothing. */
export function joinEntities(presets: readonly Entity[], mine: Readonly<Record<string, Entity>> = {}): Entity[] {
  const given = new Set(presets.map((e) => e.id));
  return [
    ...presets.map((e) => ({ ...e, origin: 'preset' as const })),
    ...Object.values(mine).filter((e) => !given.has(e.id)).map((e) => ({ ...e, origin: 'mine' as const })),
  ];
}

/** A Custom Node's reports keep their own code; every other type's is `entity`. */
const codeOf = (type: string): string => (type === 'node' ? 'node-library' : 'entity');

/** The entity as it is kept: no `origin`, no empty tags, its `uses` read from its graph among those that exist. */
function kept(entity: Entity, all: readonly Entity[]): Entity {
  const { origin: _origin, $schema: _schema, ...rest } = entity;
  const uses = usesOf(entity.graph, all.filter((e) => e.id !== entity.id));
  const { uses: _uses, tags, ...plain } = rest;
  return { ...plain, ...(tags === undefined || (Array.isArray(tags) && !tags.length) ? {} : { tags }), ...(uses.length ? { uses } : {}) };
}

/** Names as words: "A", "A and B", "A, B and C". */
const named = (labels: readonly string[]): string => {
  const quoted = labels.map((l) => `"${l}"`);
  return quoted.length < 2 ? (quoted[0] ?? '') : `${quoted.slice(0, -1).join(', ')} and ${quoted.at(-1)}`;
};

/** The shelf over a port. `facts` adds the app's types and kinds to the checks. */
export function makeShelf(port: EntityPort, facts: () => Pick<EntityFacts, 'types' | 'kinds' | 'fieldsOf'> = () => ({})): EntityShelf {
  const all = (): Entity[] => joinEntities(port.presets(), port.mine());
  const summary = ({ id, type, label, origin }: Entity): EntitySummary => ({ id, type, label, origin: origin ?? 'mine' });
  const refuse = (type: string, message: string, id: string): false => {
    report({ code: codeOf(type), message, at: { entity: id } });
    return false;
  };

  const shelf: EntityShelf = {
    list: (type) => all().filter((e) => !type || e.type === type).map(summary),
    get: (id) => all().find((e) => e.id === id),

    async save(entity) {
      if (!isEntity(entity)) return refuse('entity', 'save: it is not an entity: a v2 with a type, an id, a name and a graph.', String((entity as { id?: unknown })?.id ?? ''));
      const here = all();
      const held = here.find((e) => e.id === entity.id);
      if (held?.origin === 'preset') return refuse(entity.type, `save: "${entity.id}" is a preset, which is read only: use "Copy to my entities".`, entity.id);
      if (held && held.type !== entity.type) return refuse(entity.type, `save: "${entity.id}" is already a ${held.type}: an id names one entity.`, entity.id);
      const [{ checkEntity }, { finalGraph }] = await Promise.all([import('./entity-check.js'), import('./workflow.js')]);
      // Its graph as Save writes it: what a node keeps for its other types stays behind.
      const next = kept({ ...entity, graph: finalGraph(entity.graph, facts().kinds) }, here);
      if (!checkEntity(next, { ...facts(), entities: here.filter((e) => e.id !== next.id) })) return false;
      port.keep({ ...port.mine(), [next.id]: next });
      return true;
    },

    remove(id) {
      const entity = all().find((e) => e.id === id);
      if (!entity) return false;
      const why = shelf.whyKept(id);
      if (why) return refuse(entity.type, `remove: ${why}`, id);
      const { [id]: _gone, ...rest } = port.mine();
      port.keep(rest);
      return true;
    },

    whyKept(id) {
      const here = all();
      const entity = here.find((e) => e.id === id);
      if (!entity) return undefined;
      if (entity.origin === 'preset') return `"${id}" is a preset, which is read only.`;
      const by = here.filter((e) => e.id !== id && [...(e.uses ?? []), ...usesOf(e.graph, [entity])].some((u) => u.id === id));
      return by.length ? `"${entity.label}" is used by ${named(by.map((e) => e.label))}, so it stays: take it out of them first.` : undefined;
    },

    async duplicate(id, newId, change = {}) {
      const was = shelf.get(id);
      if (!was) return refuse('entity', `duplicate: "${id}" is not there.`, id);
      const { description, ...rest } = structuredClone(change);
      const { description: had, ...copy } = { ...structuredClone(was), label: `${was.label} copy`, ...rest, id: newId };
      const said = 'description' in change ? description : had;
      return shelf.save({ ...copy, ...(said ? { description: said } : {}) });
    },

    watch(handler, signal) {
      port.heard(() => handler(shelf.list()), signal);
    },

    export(id) {
      const entity = shelf.get(id);
      if (!entity) return undefined;
      const { origin: _origin, ...rest } = entity;
      return JSON.stringify({ $schema: ENTITY_SCHEMA, ...rest }, null, 2);
    },

    async import(json) {
      let read: unknown;
      try {
        read = JSON.parse(json);
      } catch {
        refuse('entity', 'import: it is not JSON.', '');
        return undefined;
      }
      if (!isEntity(read)) {
        refuse('entity', 'import: it is not an entity: a v2 with a type, an id, a name and a graph.', '');
        return undefined;
      }
      const taken = new Set(all().map((e) => e.id));
      const free = (n: number): string => { const next = n === 1 ? `${read.id}-copy` : `${read.id}-copy-${n}`; return taken.has(next) ? free(n + 1) : next; };
      const id = taken.has(read.id) ? free(1) : read.id;
      return await shelf.save({ ...read, id }) ? id : undefined;
    },

    library: () => libraryOf(all()),
  };
  return shelf;
}
