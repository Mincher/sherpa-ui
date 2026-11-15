/**
 * entity-store.ts — a graph type's entities read through the Store door, so a grid lists Coworkers as it lists Devices:
 * each entity a row of its type — its id, label, description and tags, each settings field the type names, each field
 * its graph holds (`from`) — kept in step with the shelf; a write goes back through the shelf, so it is checked. And a
 * type's seed entities put on the shelf as the reader's own. DOM-free. Will, plan 960 U3 (sherpa-demos-67's points 4, 5)
 *
 * Map:
 * - EntityRowOf — The values the app works out for an entity's row, beside what its type says.
 * - entityStore — A store over the shelf's entities of a type: each a row, kept in step, written back through the shelf.
 * - SeedMarks — Where the seed's marks are kept between runs: what was put, per entity.
 * - seedEntities — A type's seed entities on the shelf as the reader's own, once per seed version, a reader's change left.
 */
import { definitionPart, entityGraph, type Entity } from './entity.js';
import { draftChanged, newestOf, nextVersion, versionsOf } from './entity-versions.js';
import type { EntityShelf } from './entity-shelf.js';
import { seedVersionOf } from './seed-version.js';
import { placesOf, withPlaces, withoutPlaces } from './graph-layout.js';
import { statusFields } from './status-field.js';
import { ArrayStore } from './stores.js';
import type { Row, Store } from './store.js';
import { readFrom, typeSchema, typeStatusFields, type StoredField, type TypeDefinition } from './type-definition.js';
import { ValidationError, validateField } from './validate.js';
import { wrapStore } from './wrap-store.js';

/** The fields every entity has, from its envelope: a row says them, and a write of one changes the envelope. */
const ENVELOPE = ['label', 'description', 'tags'] as const;
/** What a row says of its published versions (plan 972): worked out, so never written. */
const VERSION = ['version', 'changed'] as const;
/** The envelope's and the versions' words, as a page over the store reads them. */
const ENVELOPE_WORDS = {
  label: { label: 'Name' }, description: { label: 'Description' }, tags: { label: 'Tags' },
  version: { label: 'Version', type: 'number' }, changed: { label: 'Draft changed' },
} as const;
/** How long the shelf's changes wait to be taken as one: a seed of twelve saves is one reload (TODO 948). */
const SETTLE_MS = 30;

/** The values the app works out for an entity's row (a Coworker's Runs), beside what its type says; their words are the
 *  type's fields. */
export type EntityRowOf = (entity: Entity, row: Row) => Row;

/**
 * A store over the shelf's entities of a type: each a row — `id`, `label`, `description`, `tags`, its newest published
 * `version` and whether its draft `changed` since, each settings field the type names, each `from` field read from the
 * graph, and what `row` adds — taken at once, then kept in step with the shelf, its changes taken as one. A write of a
 * settings field or the envelope saves the entity's draft through the shelf, so it is checked; a field its graph holds,
 * a status or a version is never written; a remove is the shelf's, refused while another entity uses it; a row is never
 * inserted: an entity is made in its editor.
 */
export function entityStore(shelf: EntityShelf, type: TypeDefinition, { row, signal }: { row?: EntityRowOf; signal?: AbortSignal } = {}): Store {
  const fields = Object.entries(type.fields ?? {}).filter((e): e is [string, StoredField] => e[1].type !== 'status');
  const schema = typeSchema(type);
  const rowOf = (entity: Entity): Row => {
    const own: Row = {
      id: entity.id, label: entity.label, description: entity.description ?? '', tags: [...(entity.tags ?? [])],
      version: newestOf(entity)?.number, changed: draftChanged(entity),
    };
    for (const [name, field] of fields) {
      if (name in own) continue;
      own[name] = field.from ? readFrom(entityGraph(entity), field.from) : entity.settings?.[name];
    }
    return row ? row(entity, own) : own;
  };
  const entities = (): Entity[] => shelf.list(type.id).flatMap((s) => shelf.get(s.id) ?? []);
  const rows = new ArrayStore(entities().map(rowOf), { key: 'id', type: type.id, ...(type.time ? { time: type.time } : {}) });
  const fill = (): void => rows.setRows(entities().map(rowOf));
  let soon: ReturnType<typeof setTimeout> | undefined;
  shelf.watch(() => {
    clearTimeout(soon);
    soon = setTimeout(fill, SETTLE_MS);
  }, signal);

  const refuse = (message: string, field?: string): never => {
    throw new ValidationError([{ message, ...(field ? { path: [field] } : {}) }]);
  };
  const store = wrapStore(rows, {
    // Each field's words, as its type says them, the envelope's too; a row is not dropped for a rule, as a schema would.
    domains: { ...ENVELOPE_WORDS, ...schema.domains },
    async insert() {
      return refuse(`A ${type.label} is made in its editor, not as a row.`);
    },
    async update(key, values) {
      const entity = shelf.get(String(key));
      if (!entity || entity.type !== type.id) return refuse(`There is no ${type.label} "${String(key)}".`);
      const envelope: Partial<Entity> = {};
      const settings: Record<string, unknown> = { ...entity.settings };
      for (const [name, value] of Object.entries(values)) {
        if (name === 'id') continue;
        const field = type.fields?.[name];
        if ((ENVELOPE as readonly string[]).includes(name)) Object.assign(envelope, { [name]: value });
        else if ((VERSION as readonly string[]).includes(name)) refuse(`${name} is worked out from its published versions, so it is never written: Publish makes one.`, name);
        else if (!field || field.type === 'status' || field.from) refuse(`${name} is ${!field ? 'no field a ' + type.label + ' keeps' : field.type === 'status' ? 'worked out from other fields' : 'read from its graph'}, so it is never written.`, name);
        else {
          const wrong = schema.rules[name] ? await validateField(schema.rules[name]!, value) : undefined;
          if (wrong) refuse(wrong, name);
          settings[name] = value;
        }
      }
      const { origin: _origin, ...own } = entity;
      if (!(await shelf.save({ ...own, ...envelope, settings }))) refuse(`The ${type.label} "${entity.id}" was not saved: the shelf said why.`);
      clearTimeout(soon);
      fill();
      return rowOf(shelf.get(entity.id)!);
    },
    async remove(key) {
      const id = String(key);
      if (!shelf.remove(id)) refuse(shelf.whyKept(id) ?? `The ${type.label} "${id}" was not removed.`);
      clearTimeout(soon);
      fill();
    },
  });
  const status = typeStatusFields(type);
  return Object.keys(status).length ? statusFields(store, status) : store;
}

/** Where the seed's marks are kept between runs (a session's local tier, storage): what was put, per entity. */
export interface SeedMarks {
  get(): Readonly<Record<string, { seed: number; put: number }>> | undefined;
  set(marks: Record<string, { seed: number; put: number }>): void;
}

/** What an entity does, as a mark is made from it: no `origin`, and nothing of where its graph is drawn. A place is no
 *  edit (plan 1001 D1 A): a reader who only moves a copy's nodes has not changed it, and a seed that only moves its own
 *  has not moved. TODO 1009 · TRAP T-a-place-is-no-edit */
const markOf = (entity: Entity): number => {
  const { origin: _origin, ...own } = entity;
  return seedVersionOf(own.graph ? { ...own, graph: withoutPlaces(own.graph) } : own);
};

/**
 * A type's seed entities on the shelf as the reader's own (editable, as a Coworker's Schedule saves): one is put the
 * first time, unless one of its id is there, and put again when its seed moves (a hash of what it does) over a copy
 * the reader has not changed since, or has removed, published as the copy's next version, at the copy's places; a
 * reader's change is left as it is, and a move is none. `marks` keeps what was put.
 * Each save is the shelf's, so it is checked. The ids it put.
 */
export async function seedEntities(shelf: EntityShelf, seeds: readonly Entity[], marks: SeedMarks): Promise<string[]> {
  const was = { ...marks.get() };
  const put: string[] = [];
  for (const seed of seeds) {
    const version = markOf(seed);
    const kept = shelf.get(seed.id);
    const mark = was[seed.id];
    // Never put here: put, unless one of its id is there. Put before: again only when its seed moved, over a copy the
    // reader has not changed or has removed; one they removed stays removed while the seed is the same.
    const untouched = !!kept && kept.origin === 'mine' && !!mark && markOf(kept) === mark.put;
    if (!(mark ? mark.seed !== version && (!kept || untouched) : !kept)) continue;
    const { origin: _origin, ...given } = structuredClone(seed) as Entity;
    // Put at the copy's places: a place is the entity's own, the last kept (D1 A).
    const own: Entity = kept?.graph && given.graph ? { ...given, graph: withPlaces(given.graph, placesOf(kept.graph)) } : given;
    // A seed is the app's, published: one with no versions publishes its change over the copy, as its first put does.
    // One with versions must extend the copy's, or the shelf refuses it in words and the copy stays (plan 972).
    const published = kept && !own.versions && draftChanged({ ...own, versions: versionsOf(kept) })
      ? { ...own, versions: [nextVersion(kept, definitionPart(own)), ...versionsOf(kept)] } : own;
    if (!(await shelf.save(published))) continue;
    was[seed.id] = { seed: version, put: markOf(shelf.get(seed.id)!) };
    put.push(seed.id);
  }
  marks.set(was);
  return put;
}
