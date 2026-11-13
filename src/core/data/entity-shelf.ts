/**
 * entity-shelf.ts — where an app's entities come together: the presets a file ships, read only,
 * and the reader's own, app-wide, of every type. ONE door: list, get, save, remove (refused while
 * another entity uses it), export, import, watch. It holds no storage: the keeper gives
 * it a port, so a test, a server and a browser share the one set of rules. Its `library` is every entity as the
 * Custom Node it offers; a Custom Node is kept through the doors (custom-nodes.ts, plan 942). DOM-free. Will, plan 746 E2, E5
 * TRAP T-an-entity-is-an-envelope-and-a-type · TRAP T-an-entity-is-used-as-a-node
 *
 * Map:
 * - EntitySummary — One entity as a list shows it: cheap, no graph.
 * - EntityShelf — What an editor is handed: list, get, save (and why not), remove (and why not), export, import, watch, library.
 * - EntityPort — What a shelf needs of its keeper: the presets, the reader's own, keeping them, and hearing a change.
 * - joinEntities — The presets and the reader's entities as one list; a clash with a preset or an earlier id is left out.
 * - makeShelf — The shelf over a port. Each save keeps the final graph, checked by `checkEntity`, loaded when first asked.
 */
import { report } from './report.js';
import { definitionPart, entityGraph, isEntity, usesOf, ENTITY_SCHEMA, type Entity, type EntityVersion } from './entity.js';
import { nextVersion, versionsOf } from './entity-versions.js';
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

/** What an editor is handed. Save, remove and import answer whether it was done; the reason is reported. A preset is read
 *  only: a Clone (entity-versions.ts, plan 972c) makes the reader's own copy. */
export interface EntityShelf {
  /** Every entity, presets first, as a summary; of one type when given. */
  list(type?: string): EntitySummary[];
  /** The whole entity, with its `origin`. */
  get(id: string): Entity | undefined;
  save(entity: Entity): Promise<boolean>;
  /** Why `save` would refuse it, in words, by the same check; it reports nothing. None when it would be kept. */
  faults(entity: Entity): Promise<string[]>;
  /** The reader's own only, and refused while another entity uses it. */
  remove(id: string): boolean;
  /** Why `remove` would keep an entity, in words: a preset, or another entity uses it; none when it would go. */
  whyKept(id: string): string | undefined;
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
  const uses = usesOf(entityGraph(entity), all.filter((e) => e.id !== entity.id));
  const { uses: _uses, tags, ...plain } = rest;
  return { ...plain, ...(tags === undefined || (Array.isArray(tags) && !tags.length) ? {} : { tags }), ...(uses.length ? { uses } : {}) };
}

/** Do these versions keep the stored ones, unedited, at their tail, every number newer than the one after it? */
function extendsVersions(given: readonly EntityVersion[], stored: readonly EntityVersion[]): boolean {
  const tail = given.slice(given.length - stored.length);
  return given.length >= stored.length && stored.every((v, i) => v.number === tail[i]!.number && v.hash === tail[i]!.hash)
    && given.every((v, i) => i === 0 || given[i - 1]!.number > v.number);
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

  /** The ONE check, for `save` and `faults`: why a save would refuse it, in words, or the entity as it would be kept. */
  const check = async (entity: Entity): Promise<{ faults: string[]; next?: Entity }> => {
    if (!isEntity(entity)) return { faults: ['it is not an entity: a v3 with a type, an id, a name and one body, a graph or a query'] };
    const here = all();
    const held = here.find((e) => e.id === entity.id);
    if (held?.origin === 'preset') return { faults: [`"${entity.id}" is a preset, which is read only: clone it to make your own`] };
    if (held && held.type !== entity.type) return { faults: [`"${entity.id}" is already a ${held.type}: an id names one entity`] };
    const [{ entityFaults }, { finalGraph }] = await Promise.all([import('./entity-check.js'), import('./workflow.js')]);
    // Its graph as Save writes it: what a node keeps for its other types stays behind. A query body is kept as it is.
    const draft = kept(entity.graph ? { ...entity, graph: finalGraph(entity.graph, facts().kinds) } : entity, here);
    /* Its versions (plan 972): none given keeps the stored ones; given, they may only ADD newer ones at the front, so a
       save never edits or drops a version. A new id's first save publishes version 1. */
    const stored = held ? versionsOf(held) : [];
    const given = entity.versions;
    if (given && !extendsVersions(given, stored)) {
      return { faults: [`"${entity.id}"'s versions must keep the ones it has (${stored.map((v) => v.number).join(', ')}) and only add newer ones in front`] };
    }
    const versions = given?.length ? given : stored.length ? stored : [nextVersion({}, definitionPart(draft))];
    const next = { ...draft, versions };
    const faults = entityFaults(next, { ...facts(), entities: here.filter((e) => e.id !== next.id) });
    return faults.length ? { faults } : { faults, next };
  };

  const shelf: EntityShelf = {
    list: (type) => all().filter((e) => !type || e.type === type).map(summary),
    get: (id) => all().find((e) => e.id === id),

    async save(entity) {
      const { faults, next } = await check(entity);
      const said = entity as { id?: unknown; type?: unknown };
      for (const fault of faults) report({ code: codeOf(String(said?.type ?? '')), message: `save: ${fault}.`, at: { entity: String(said?.id ?? '') } });
      if (!next) return false;
      port.keep({ ...port.mine(), [next.id]: next });
      return true;
    },

    faults: async (entity) => (await check(entity)).faults,

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
      const by = here.filter((e) => e.id !== id && [...(e.uses ?? []), ...usesOf(entityGraph(e), [entity])].some((u) => u.id === id));
      return by.length ? `"${entity.label}" is used by ${named(by.map((e) => e.label))}, so it stays: take it out of them first.` : undefined;
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
        refuse('entity', 'import: it is not an entity: a v3 with a type, an id, a name and a graph.', '');
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
