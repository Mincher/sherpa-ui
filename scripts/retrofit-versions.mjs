#!/usr/bin/env node
/**
 * retrofit-versions.mjs — ONE-OFF (plan 972): each shipped entity file to the entity.v3 envelope, its version 1 kept,
 * and each use in a shipped graph following version 1. Will: never convert at run time, so the files are written once.
 * Reads dist/, so build first. Delete this script once every app's files are written.
 *
 *   node scripts/retrofit-versions.mjs <file.json> […]   # an entity, an entities.v3 library, or a list of entities
 *
 * Map:
 * - retrofit — One entity at v3: its version 1, and each use it places following version 1.
 */
import { readFile, writeFile } from 'node:fs/promises';

const { definitionPart } = await import(new URL('../dist/core/data/entity.js', import.meta.url));
const { hashOfDefinition } = await import(new URL('../dist/core/data/entity-versions.js', import.meta.url));
const AT = process.env.AT ?? new Date().toISOString();

const isEntity = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.type === 'string' && typeof v.id === 'string' && 'v' in v;

/** One entity at v3: its version 1, and each use it places following version 1. One at v3 already is left as it is. */
export function retrofit(entity) {
  if (!isEntity(entity) || entity.v !== 2) return entity;
  const nodes = (entity.graph?.nodes ?? []).map((n) => (typeof n.version === 'string' ? { ...n, version: 1 } : n));
  const next = { ...entity, v: 3, ...(entity.graph ? { graph: { ...entity.graph, nodes } } : {}) };
  if (typeof next.$schema === 'string') next.$schema = next.$schema.replace('entity.v2.json', 'entity.v3.json');
  const definition = definitionPart(next);
  return { ...next, versions: [{ number: 1, at: AT, by: 'shipped', hash: hashOfDefinition(definition), definition }] };
}

let changed = 0;
for (const file of process.argv.slice(2)) {
  const read = JSON.parse(await readFile(file, 'utf8'));
  const out = Array.isArray(read) ? read.map(retrofit)
    : isEntity(read) && read.v === 2 ? retrofit(read)
      : read?.entities ? { ...read, entities: Object.fromEntries(Object.entries(read.entities).map(([id, e]) => [id, retrofit(e)])) }
        : read;
  const text = `${JSON.stringify(out, null, 2)}\n`;
  if (text !== `${JSON.stringify(read, null, 2)}\n`) {
    await writeFile(file, text);
    changed++;
    console.log(`written: ${file}`);
  }
}
console.log(`retrofit-versions: ${changed} file(s) written.`);
