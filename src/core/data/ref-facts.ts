/**
 * ref-facts.ts — what a `{{kind:id}}` reference is read against, from where its rows are: a graph type's entities from
 * the shelf, a row type's rows from its store (PRINCIPLES 25). DOM-free. Will, TODO 988 · TRAP T-only-a-store-reads-data
 *
 * Map:
 * - RefPlaces — Where a reference's things are: the app's stores, and the shelf.
 * - refFacts — The facts these texts' references are read against: each thing they name, read once, through its store.
 */
import { entityTypes } from './entity-types.js';
import { refsOf, type RefFacts } from './references.js';
import { report } from './report.js';
import { storeOfType, titleOf } from './type-definition.js';
import type { EntityShelf } from './entity-shelf.js';
import type { Row, Store } from './store.js';

/** Where a reference's things are: the app's stores, and the shelf. */
export interface RefPlaces {
  stores: Readonly<Record<string, Store>>;
  entities?: EntityShelf;
}

/** A row by its key, the key as written or, all digits, as a number. */
async function rowOf(store: Store, id: string): Promise<Row | undefined> {
  return (await store.byKey(id)) ?? (/^\d+$/.test(id) ? store.byKey(Number(id)) : undefined);
}

/**
 * The facts these texts' references are read against, for `readRefs`: each thing they name, read once — a graph type's
 * entity from the shelf, a row type's row from its store, by its key — and the stores by name. A row named is answered
 * by its title. A row its store could not read is reported, and reads as its id: a check refuses only what is not there.
 */
export async function refFacts(places: RefPlaces, texts: readonly unknown[]): Promise<RefFacts> {
  const types = entityTypes();
  const named = new Map<string, string>();
  const asked = refsOf(texts.filter((t) => typeof t === 'string').join('\n')).filter((r) => types[r.kind] && !types[r.kind]!.graph);
  await Promise.all(asked.map(async ({ kind, id }) => {
    const type = types[kind]!;
    const store = storeOfType(places.stores, kind);
    if (!store) return;
    try {
      const row = await rowOf(store, id);
      if (row) named.set(`${kind}:${id}`, String(row[titleOf(type)] ?? id));
    } catch (error) {
      report({
        code: 'ref-read',
        message: `refFacts: the ${type.label} "${id}" could not be read (${error instanceof Error ? error.message : String(error)}), so it reads as named.`,
        at: { kind, id },
      });
      named.set(`${kind}:${id}`, id);
    }
  }));
  return {
    stores: Object.keys(places.stores),
    entity: (type, id) => {
      if (!types[type]?.graph) return named.get(`${type}:${id}`);
      const entity = places.entities?.get(id);
      return entity?.type === type ? entity.label : undefined;
    },
  };
}
