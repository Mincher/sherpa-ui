/**
 * type-stores.ts — the stores of an app's types, by id, which the outlet hands its pages beside the app's own: a row
 * type's from the rows its `data` file names (`typeStore`); a graph type's from the shelf (`entityStore`), its `data`
 * file's entities seeded as the reader's own (`seedEntities`). A browser's: it reads files. Will, plan 960 U3
 *
 * Map:
 * - typeStores — The stores of an app's types, by the type's id, and when each seed is in.
 */
import { typeStore } from './idb-store.js';
import type { Entity } from '../data/entity.js';
import type { EntityShelf } from '../data/entity-shelf.js';
import { entityStore, seedEntities, type SeedMarks } from '../data/entity-store.js';
import { report } from '../data/report.js';
import type { Row, Store } from '../data/store.js';
import type { TypeDefinition } from '../data/type-definition.js';

/** A type's `data` file, read as a JSON list; none, reported, when it cannot be. */
async function listOf(type: TypeDefinition, url: (path: string) => string | URL): Promise<unknown[] | undefined> {
  try {
    const response = await fetch(new URL(url(type.data!), document.baseURI));
    if (!response.ok) throw new Error(`${response.status}`);
    const list: unknown = await response.json();
    if (!Array.isArray(list)) throw new Error('it is not a list');
    return list;
  } catch (error) {
    report({ code: 'type-data', message: `typeStores: the rows of the type "${type.id}" (${type.data}) could not be read (${error instanceof Error ? error.message : String(error)}), so it has ${type.graph ? 'no seed' : 'no store'}.`, at: { type: type.id } });
    return undefined;
  }
}

/**
 * The stores of an app's types, by the type's id: a row type that names its rows (`data`: a JSON list, from the app's
 * folder) has local records seeded with them; a graph type has its entities on the shelf as rows, its `data` file's
 * entities seeded as the reader's own once per seed (`marks` keeps what was put, per type). `ready` settles once every
 * row seed is in. A graph type has none with no shelf.
 */
export async function typeStores(
  types: Readonly<Record<string, TypeDefinition>>, url: (path: string) => string | URL,
  { shelf, marks, signal }: { shelf?: EntityShelf; marks?: (type: string) => SeedMarks; signal?: AbortSignal } = {},
): Promise<{ stores: Record<string, Store>; ready: Promise<void> }> {
  const stores: Record<string, Store> = {};
  const seeds: Promise<void>[] = [];
  await Promise.all(Object.values(types).map(async (type) => {
    if (type.graph) {
      if (!shelf) return;
      const list = type.data ? await listOf(type, url) : undefined;
      if (list && marks) await seedEntities(shelf, list as Entity[], marks(type.id));
      stores[type.id] = entityStore(shelf, type, signal ? { signal } : {});
      return;
    }
    const rows = type.data ? await listOf(type, url) : undefined;
    if (!rows) return;
    const made = typeStore(type, { rows: rows as Row[] });
    stores[type.id] = made.store;
    seeds.push(made.ready);
  }));
  return { stores, ready: Promise.all(seeds).then(() => undefined) };
}
