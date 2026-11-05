/**
 * entity-files.ts — an app's preset entities from a file: JSON (schemas/entities.v1.json), named by
 * app.json `entities`. The presets are read only; the reader's own live in the page keeper. Each is
 * checked alone: the bad reported in `checkEntity`'s words, the rest kept. Will, plan 746 E2
 * TRAP T-an-entity-is-an-envelope-and-a-type
 *
 * Map:
 * - readEntities — Entities read from JSON, each checked alone over those already kept; the bad reported, the rest kept.
 * - loadEntityLibrary — an app's preset entities from a JSON file, each checked
 */
import { report } from '../data/report.js';
import { isEntity, type Entity, type EntityLibrary } from '../data/entity.js';
import { entityFaults, type EntityFacts } from '../data/entity-types.js';

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Entities read from JSON (entities.v1). Each is checked alone, over those already kept and the
 *  `known` ones around it, so one bad one is reported and the rest still load; a use of one defined
 *  later is tried again once that one is in. The key of each must be its id. */
export function readEntities(read: unknown, facts: EntityFacts = {}): EntityLibrary {
  const given = isObject(read) && read['v'] === 1 && isObject(read['entities']) ? read['entities'] : undefined;
  if (!given) {
    report({ code: 'entity', message: 'loadEntityLibrary: it is not an entity library: a v1 with its entities by id.', at: {} });
    return { v: 1, entities: {} };
  }
  const kept: Record<string, Entity> = {};
  let waiting = Object.entries(given);
  let faults = new Map<string, string[]>();
  for (let moved = true; moved && waiting.length;) {
    moved = false;
    faults = new Map();
    const next: typeof waiting = [];
    for (const [key, entity] of waiting) {
      const found = !isEntity(entity) ? ['it is not an entity: a v1 with a type, an id, a name and a graph']
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
  return { v: 1, entities: kept };
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
    return { v: 1, entities: {} };
  }
  return readEntities(read, facts);
}
