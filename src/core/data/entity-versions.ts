/**
 * entity-versions.ts — an entity's PUBLISHED versions, each kept with its number and its definition (Will, plan 972 D1 A:
 * "Save is a draft"). A Save writes the draft; Publish makes the next number from it, and only then do its uses see it;
 * a Roll back publishes an earlier version as the next number, so nothing is lost. Every write is a plain shelf save, which
 * may only add versions at the front. Where a graph is drawn is no part of a version: it is the entity's, the last kept
 * (plan 1001 D1 A). DOM-free. TRAP T-a-place-is-no-edit
 *
 * Map:
 * - VersionFacts — Who publishes, why, and when.
 * - versionsOf — An entity's published versions, newest first; none before its first save.
 * - newestOf — An entity's newest published version, or none.
 * - hashOfDefinition — A definition's content hash, where it is drawn left out: what tells a draft from its newest version.
 * - draftChanged — Does the draft differ from the newest version, as today's hash reads both? None published, it does.
 * - publishedOf — The entity as its newest version says it, drawn where the entity's draft is: what uses and the library read.
 * - nextVersion — The version a publish of this definition would add: the next number, its hash, when and by whom.
 * - VersionAnswer — What Publish and Roll back answer: the number made, or why not, in words.
 * - publish — Publish an entity's draft as its next version, through the shelf.
 * - rollBack — Publish an earlier version as the next one, and put it in the draft; each node stays where it is.
 * - CloneChange — What a Clone may set: the copy's id and words, and a body in place of its source's.
 * - clone — The ONE Clone: the reader's own editable copy of an entity, at version 1, remembering its source.
 * - sourceNewer — The newer version a clone's source has published since, or none.
 */
import { definitionPart, withBody, type Entity, type EntityBody, type EntityDefinition, type EntityVersion } from './entity.js';
import type { EntityShelf } from './entity-shelf.js';
import { contentHash } from './content-hash.js';
import { placesOf, withoutPlaces, withPlaces } from './graph-layout.js';

/** Who publishes, why, and when: free text until the app has a current User (plan 972d). */
export interface VersionFacts {
  by?: string;
  note?: string;
  /** The clock: none, the machine's. */
  now?: Date;
}

/** An entity's published versions, newest first; none before its first save. */
export const versionsOf = (entity: Pick<Entity, 'versions'>): readonly EntityVersion[] => entity.versions ?? [];

/** An entity's newest published version, or none. */
export const newestOf = (entity: Pick<Entity, 'versions'>): EntityVersion | undefined => entity.versions?.[0];

/** A definition's content hash, where it is drawn left out: what tells a draft from its newest version. A move, an Unfurl
 *  or Swimlanes on or off saves itself, so it is no change to publish (Will, TODO 1001). */
export const hashOfDefinition = (definition: EntityDefinition): string =>
  contentHash(definition.graph ? { ...definition, graph: withoutPlaces(definition.graph) } : definition);

/** Each version's hash as today's `hashOfDefinition` reads it: a hash kept by an older one never flags a draft. */
const hashes = new WeakMap<EntityVersion, string>();
const hashNow = (version: EntityVersion): string => {
  let hash = hashes.get(version);
  if (hash === undefined) hashes.set(version, hash = hashOfDefinition(version.definition));
  return hash;
};

/** Does the draft differ from the newest version, as today's hash reads both? None published, it does. */
export function draftChanged(entity: Entity): boolean {
  const newest = newestOf(entity);
  return !newest || hashNow(newest) !== hashOfDefinition(definitionPart(entity));
}

/** The entity as its newest version says it: its id, type and origin, with the version's definition in place of the draft,
 *  drawn where the draft is: a part the draft no longer has keeps the version's place. None published, its draft. What its
 *  uses and the node library read (D1 A: a draft is the reader's alone), and a Roll back writes. */
export function publishedOf(entity: Entity): Entity {
  const newest = newestOf(entity);
  if (!newest) return entity;
  // Its tags and category are its draft's: they file it, and are no part of a version.
  const { label: _label, description: _description, settings: _settings, ...envelope } = entity;
  const { graph, query, ...words } = newest.definition;
  const body = graph ? { graph: entity.graph ? withPlaces(graph, placesOf(entity.graph)) : graph } : query ? { query } : { graph: { nodes: [] } };
  return withBody({ ...envelope, ...words }, body);
}

/** The version a publish of this definition would add: the next number, its hash, when and by whom. */
export function nextVersion(entity: Pick<Entity, 'versions'>, definition: EntityDefinition, facts: VersionFacts = {}): EntityVersion {
  return {
    number: (newestOf(entity)?.number ?? 0) + 1, at: (facts.now ?? new Date()).toISOString(),
    ...(facts.by ? { by: facts.by } : {}), ...(facts.note ? { note: facts.note } : {}),
    hash: hashOfDefinition(definition), definition: structuredClone(definition),
  };
}

/** What Publish and Roll back answer: the number made, or why not, in words. */
export type VersionAnswer = { number: number } | { refused: string };

/** Publish an entity's draft as its next version, through the shelf: refused for a preset, for one that is not there, for
 *  a draft no different from its newest version, and, in words, for one its checks refuse. */
export async function publish(shelf: EntityShelf, id: string, facts: VersionFacts = {}): Promise<VersionAnswer> {
  const entity = shelf.get(id);
  if (!entity) return { refused: `"${id}" is not there.` };
  if (entity.origin === 'preset') return { refused: `"${entity.label}" is a preset, which is read only: clone it to make your own.` };
  if (!draftChanged(entity)) return { refused: `Nothing to publish: "${entity.label}" is as version ${newestOf(entity)!.number} says.` };
  const version = nextVersion(entity, definitionPart(entity), facts);
  return saveVersion(shelf, { ...entity, versions: [version, ...versionsOf(entity)] }, 'Publish');
}

/** Publish an earlier version as the next one, and put it in the draft, each node where it is now (plan 1001 D1 A):
 *  nothing is lost, and the uses can follow it back. Refused for a preset, for a number it has not got, and, in words,
 *  for a version its checks refuse now. */
export async function rollBack(shelf: EntityShelf, id: string, number: number, facts: VersionFacts = {}): Promise<VersionAnswer> {
  const entity = shelf.get(id);
  if (!entity) return { refused: `"${id}" is not there.` };
  if (entity.origin === 'preset') return { refused: `"${entity.label}" is a preset, which is read only: clone it to make your own.` };
  const was = versionsOf(entity).find((v) => v.number === number);
  if (!was) return { refused: `"${entity.label}" has no version ${number}.` };
  const version = nextVersion(entity, was.definition, { ...facts, note: facts.note ?? `Roll back to version ${number}` });
  const draft = publishedOf({ ...entity, versions: [version] });
  return saveVersion(shelf, { ...draft, versions: [version, ...versionsOf(entity)] }, `Roll back to version ${number}`);
}

/** Save an entity with its new version in front, or say in words why its checks refuse it, the act named: an old version may
 *  hold what is no longer allowed (a kind since gone). */
async function saveVersion(shelf: EntityShelf, next: Entity, act: string): Promise<VersionAnswer> {
  const [fault] = await shelf.faults(next);
  if (fault) return { refused: `${act} is refused: ${fault}.` };
  return await shelf.save(next) ? { number: newestOf(next)!.number } : { refused: `"${next.label}" was not saved: its checks say why.` };
}

/** What a Clone may set: the copy's id, name, words, tags and category, and a body in place of its source's (Save graph as:
 *  the canvas). `description` given as undefined drops it. */
export interface CloneChange {
  id?: string;
  label?: string;
  description?: string | undefined;
  tags?: readonly string[];
  category?: string;
  body?: EntityBody;
}

/** The ONE Clone (plan 972c): the reader's own editable copy of an entity, a preset's or theirs, as the reader has it (or
 *  with the body given), under a free id (`<id>-copy`, `-copy-2`…) and "<label> copy" unless told; a new id, so it starts
 *  at version 1, and it remembers its source and the version it had (`from`). Refused, in words, for one not there or an
 *  id taken. */
export async function clone(shelf: EntityShelf, id: string, change: CloneChange = {}): Promise<{ id: string } | { refused: string }> {
  const was = shelf.get(id);
  if (!was) return { refused: `"${id}" is not there.` };
  const taken = new Set(shelf.list().map((e) => e.id));
  const free = (n: number): string => { const next = n === 1 ? `${id}-copy` : `${id}-copy-${n}`; return taken.has(next) ? free(n + 1) : next; };
  const copyId = change.id ?? free(1);
  if (taken.has(copyId)) return { refused: `"${copyId}" is taken: an id names one entity.` };
  const { origin: _origin, versions: _versions, from: _from, uses: _uses, description: had, ...own } = structuredClone(was);
  const body = change.body ? withBody(own, change.body) : own;
  const description = 'description' in change ? change.description : had;
  const copy: Entity = {
    ...body, id: copyId, label: change.label ?? `${was.label} copy`, ...(description ? { description } : {}),
    ...(change.tags ? { tags: [...change.tags] } : {}), ...(change.category ? { category: change.category } : {}),
    from: { id: was.id, version: newestOf(was)?.number ?? 1 },
  };
  return await shelf.save(copy) ? { id: copyId } : { refused: `The copy of "${was.label}" was not saved: its checks say why.` };
}

/** The newer version a clone's source has published since it was made, or none: what "its source has a newer version"
 *  reads. */
export function sourceNewer(shelf: Pick<EntityShelf, 'get'>, entity: Pick<Entity, 'from'>): number | undefined {
  const from = entity.from;
  const now = from ? newestOf(shelf.get(from.id) ?? {})?.number : undefined;
  return from && now !== undefined && now > from.version ? now : undefined;
}
