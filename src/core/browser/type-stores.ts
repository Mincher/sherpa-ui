/**
 * type-stores.ts — a type's store: local records made from the type and seeded with its rows, the seed's version made
 * from the rows, so changed rows are a new seed and no one bumps a number; and the stores of an app's types, by id,
 * which the outlet hands its pages beside the app's own. Will, plan 960 U3 · TRAP T-local-records-seed-themselves
 *
 * Map:
 * - seedVersionOf — A number made from rows: the same rows, the same number.
 * - typeStore — A type's store: local records made from it, seeded with its rows, its status fields worked out.
 * - typeStores — The stores of an app's types that name their rows (`data`), by the type's id, and when each seed is in.
 */
import { localRecords } from './idb-store.js';
import { report } from '../data/report.js';
import { statusFields } from '../data/status-field.js';
import type { Row, Store } from '../data/store.js';
import { typeStatusFields, typeStoreOptions, type TypeDefinition } from '../data/type-definition.js';

/** A number made from rows: the same rows, the same number. FNV-1a over their JSON: a version, never a secret. */
export function seedVersionOf(rows: readonly Row[]): number {
  const text = JSON.stringify(rows);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}

/** A type's store: local records made from it (its key, time and rules), seeded with its rows, its status fields worked
 *  out. `ready` settles once the seed is in. Its name, the type's id unless given. */
export function typeStore(type: TypeDefinition, { rows = [], name = type.id }: { rows?: readonly Row[]; name?: string } = {}): { store: Store; ready: Promise<void> } {
  const { store, ready } = localRecords({ name, ...typeStoreOptions(type), seed: rows, seedVersion: seedVersionOf(rows) });
  const status = typeStatusFields(type);
  return { store: Object.keys(status).length ? statusFields(store, status) : store, ready };
}

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
