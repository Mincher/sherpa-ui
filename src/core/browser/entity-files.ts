/**
 * entity-files.ts — an app's preset entities and their types from a file: JSON (schemas/entities.v3.json), named by
 * app.json `entities`. The presets are read only; the reader's own live in the page keeper. Each is
 * checked alone: the bad reported in `checkEntity`'s words, the rest kept. Will, plan 746 E2
 * TRAP T-an-entity-is-an-envelope-and-a-type
 *
 * Map:
 * - readEntities — Entities read from JSON, each checked alone over those already kept; the bad reported, the rest kept.
 * - loadEntityLibrary — an app's preset entities from a JSON file, each checked
 * - loadTypes — an app's types from their JSON files (app.json `types`), each registered by its id; those it registered
 */
import { report } from '../data/report.js';
import { isEntity, type Entity, type EntityLibrary } from '../data/entity.js';
import { entityFaults, type EntityFacts } from '../data/entity-check.js';
import { registerEntityType, type EntityType } from '../data/entity-types.js';
import type { TypeDefinition } from '../data/type-definition.js';

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A type registered by its key, which is its id; one whose id is another is reported and left out. registerEntityType
 *  reports one typeFaults refuses. Whether it was registered. */
function registerByKey(key: string, type: unknown, who: string): boolean {
  if (isObject(type) && type['id'] === key) return !!registerEntityType(type as unknown as EntityType);
  report({ code: 'entity-type', message: `${who}: the type under "${key}" has the id ${JSON.stringify(isObject(type) ? type['id'] ?? null : null)}, so it is left out.`, at: { type: key } });
  return false;
}

/** Entities read from JSON (entities.v3), its types registered first. Each is checked alone, over those already kept and the
 *  `known` ones around it, so one bad one is reported and the rest still load; a use of one defined
 *  later is tried again once that one is in. The key of each must be its id. */
export function readEntities(read: unknown, facts: EntityFacts = {}): EntityLibrary {
  const given = isObject(read) && read['v'] === 3 && isObject(read['entities']) ? read['entities'] : undefined;
  if (!given) {
    report({ code: 'entity', message: 'loadEntityLibrary: it is not an entity library: a v3 with its entities by id.', at: {} });
    return { v: 3, entities: {} };
  }
  // Its types first, each a type.v1 (plan 960 U2): its entities may be of them. A type's key is its id.
  if (isObject(read) && isObject(read['types'])) {
    for (const [key, type] of Object.entries(read['types'])) registerByKey(key, type, 'loadEntityLibrary');
  }
  const kept: Record<string, Entity> = {};
  let waiting = Object.entries(given);
  let faults = new Map<string, string[]>();
  for (let moved = true; moved && waiting.length;) {
    moved = false;
    faults = new Map();
    const next: typeof waiting = [];
    for (const [key, entity] of waiting) {
      const found = !isEntity(entity) ? ['it is not an entity: a v2 with a type, an id, a name and a graph']
        : entity.id !== key ? [`its key is "${key}", but its id is "${entity.id}"`]
          : entityFaults(entity, { ...facts, entities: [...(facts.entities ?? []), ...Object.values(kept)] });
      if (found.length) {
        faults.set(key, found);
        next.push([key, entity]);
        continue;
      }
      const { $schema: _schema, origin: _origin, ...rest } = entity as Entity;
      kept[key] = rest;
      moved = true;
    }
    waiting = next;
  }
  for (const [key, found] of faults) {
    for (const fault of found) report({ code: 'entity', message: `loadEntityLibrary: ${fault}, so "${key}" is left out.`, at: { entity: key } });
  }
  return { v: 3, entities: kept };
}

/** An app's preset entities from a JSON file. One that fails the checks is reported and left out; a
 *  file that cannot be read answers none. `facts.entities` are the others around them (the Custom
 *  Node presets), for what a graph places. */
export async function loadEntityLibrary(url: string | URL, facts?: EntityFacts): Promise<EntityLibrary> {
  let read: unknown;
  try {
    const response = await fetch(new URL(url, document.baseURI));
    if (!response.ok) throw new Error(`${response.status}`);
    read = await response.json();
  } catch (error) {
    report({ code: 'entity', message: `loadEntityLibrary: the file could not be read (${error instanceof Error ? error.message : String(error)}).`, at: { url: String(url) } });
    return { v: 3, entities: {} };
  }
  return readEntities(read, facts);
}

/** An app's types from their JSON files (app.json `types`: id → its type.v1), each registered by its id, so a page that
 *  names one has its fields' words and an entity may be of one, in the order `files` lists them. One that cannot be read
 *  is reported and left out. Those it registered, by id: the outlet makes their stores. Plan 960 U2, U3 */
export async function loadTypes(files: Readonly<Record<string, string | URL>>): Promise<Record<string, TypeDefinition>> {
  const read = await Promise.all(Object.entries(files).map(async ([key, url]) => {
    try {
      const response = await fetch(new URL(url, document.baseURI));
      if (!response.ok) throw new Error(`${response.status}`);
      return [key, await response.json() as unknown] as const;
    } catch (error) {
      report({ code: 'entity-type', message: `loadTypes: the type "${key}" could not be read (${error instanceof Error ? error.message : String(error)}).`, at: { type: key } });
      return undefined;
    }
  }));
  // Registered in app.json's order, not as each file arrives: every list made from entityTypes() is stable.
  const kept: Record<string, TypeDefinition> = {};
  for (const [key, type] of read.filter((entry) => entry !== undefined)) {
    if (registerByKey(key, type, 'loadTypes')) kept[key] = type as TypeDefinition;
  }
  return kept;
}
