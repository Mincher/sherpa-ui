/**
 * type-stores.ts — the stores of an app's types, by id, each from the rows its `data` file names (`typeStore`), which the
 * outlet hands its pages beside the app's own. A browser's: it reads files. Will, plan 960 U3
 *
 * Map:
 * - typeStores — The stores of an app's types that name their rows (`data`), by the type's id, and when each seed is in.
 */
import { typeStore } from './idb-store.js';
import { report } from '../data/report.js';
import type { Row, Store } from '../data/store.js';
import type { TypeDefinition } from '../data/type-definition.js';

/** The stores of an app's types that name their rows (`data`: a JSON list, from the app's folder), by the type's id; a
 *  file that cannot be read is reported and its type has none. `ready` settles once every seed is in. */
export async function typeStores(
  types: Readonly<Record<string, TypeDefinition>>, url: (path: string) => string | URL,
): Promise<{ stores: Record<string, Store>; ready: Promise<void> }> {
  const made = await Promise.all(Object.values(types).filter((t) => t.data).map(async (type) => {
    try {
      const response = await fetch(new URL(url(type.data!), document.baseURI));
      if (!response.ok) throw new Error(`${response.status}`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error('it is not a list of rows');
      return [type.id, typeStore(type, { rows: rows as Row[] })] as const;
    } catch (error) {
      report({ code: 'type-data', message: `typeStores: the rows of the type "${type.id}" (${type.data}) could not be read (${error instanceof Error ? error.message : String(error)}), so it has no store.`, at: { type: type.id } });
      return undefined;
    }
  }));
  const kept = made.filter((m) => !!m);
  return { stores: Object.fromEntries(kept.map(([id, { store }]) => [id, store])), ready: Promise.all(kept.map(([, { ready }]) => ready)).then(() => undefined) };
}
