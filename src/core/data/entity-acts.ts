/**
 * entity-acts.ts — a graph type's own acts, through the shelf: find, read, add, change and remove its entities, and
 * publish or roll back their versions (plan 964 N3c; plan 972). A definition's body is no row, so these go through the
 * shelf, never a Store: each write is a Save — checked as Save checks it, refused in its words, kept as a DRAFT. A use in a
 * graph it is given follows a version, each node stands in a stage, and a graph that gains nodes is laid out by the editor
 * the first time it shows it. DOM-free.
 *
 * Map:
 * - graphActs — A graph type's own acts: find, read, add, change and remove through the shelf; publish and roll back.
 */
import type { Act, ActAnswer, ActCall, ActContext } from './acts.js';
import { createNode, deleteNode, updateNode, type NodeAnswer, type NodeChange } from './custom-nodes.js';
import { categoryOf, type Entity, type EntityGraph } from './entity.js';
import type { EntityShelf } from './entity-shelf.js';
import { draftChanged, newestOf, publish, rollBack, type VersionAnswer } from './entity-versions.js';
import { followUses } from './node-library.js';
import { stageNodes } from './node-stages.js';
import type { Row } from './store.js';
import type { StoredField, TypeDefinition } from './type-definition.js';

const ID = /^[a-z][a-z0-9-]*$/;
/** What an entity's write may give, said once: its envelope, its settings, and one body. */
const ENVELOPE: Readonly<Record<string, StoredField>> = {
  label: { label: 'Name' },
  description: { label: 'Description' },
  tags: { label: 'Tags', description: 'Words that file it: a list, or one text with commas.' },
  category: { label: 'Category' },
  settings: { type: 'object', label: 'Settings', description: 'Its settings, by field, as its type says them.' },
  graph: { type: 'object', label: 'Graph', description: 'What it does: its nodes and connections, and its stages.' },
};
/** A Filter's body in place of a graph, where its type keeps one (plan 960 U4.4b). */
const QUERY: StoredField = { type: 'object', label: 'Query', description: 'A where, in place of a graph: { "field": { "eq": 1 } }.' };

/** Tags given as a list, or as one text with commas. */
const tagsOf = (given: unknown): string[] => (Array.isArray(given) ? given : String(given).split(','))
  .map((t) => String(t).trim()).filter(Boolean);

/** An entity as a find lists it: its envelope, where it came from, its newest published version and whether its draft
 *  changed since. No body. */
const summaryOf = (e: Entity): Row => ({
  id: e.id, label: e.label, description: e.description ?? '', tags: [...(e.tags ?? [])], category: categoryOf(e),
  origin: e.origin ?? 'mine', version: newestOf(e)?.number, changed: draftChanged(e),
});

/** A graph a writer gave, as Save should keep it: each use following a version, each node in a stage, and laid out by the
 *  editor the first time it shows it where it gains nodes. */
function graphGiven(graph: EntityGraph, held: EntityGraph | undefined, shelf: EntityShelf): EntityGraph {
  const nodes = followUses(stageNodes(graph.stages, graph.nodes), held?.nodes, shelf.library());
  const had = new Set((held?.nodes ?? []).map((n) => n.id));
  const gains = nodes.some((n) => !had.has(n.id));
  return { ...graph, nodes: [...nodes], ...(gains ? { unfurl: true } : {}) };
}

/** What a door answered, as an act says it: refused in its faults' words. */
const refusal = (verb: string, answer: NodeAnswer): ActAnswer | undefined =>
  ('faults' in answer ? { refused: `${verb}: ${answer.faults.join('; ')}.` } : undefined);

/**
 * A graph type's own acts, through the shelf (`ctx.entities`), each refused in the shelf's words: find (its entities, by a
 * search and a tag), read (one, as JSON: its body as kept, its settings, its versions' numbers), add (a new one, as a
 * draft at version 1; its undo removes it), change (one's envelope, settings or body, as a draft; its undo puts it back)
 * and remove (refused while another uses it; its undo puts each back with its versions); and publish and roll back.
 */
export function graphActs(type: Pick<TypeDefinition, 'id' | 'label' | 'graph'>): Act[] {
  const { id, label } = type;
  const shelfOf = (ctx: ActContext): EntityShelf | undefined => ctx.entities;
  const none: ActAnswer = { refused: `The app has no ${label} entities here.` };
  const named = (e: Pick<Entity, 'label'>): string => `${label} "${e.label}"`;
  const keysOf = (call: ActCall): string[] => (call.keys ?? []).map(String);
  const given: Record<string, StoredField> = { ...ENVELOPE, ...(type.graph?.query ? { query: QUERY } : {}) };
  /** What a call gives, as the doors take it: each field given; tags as a list; a graph laid out and following its uses. */
  const changeOf = (input: Row, held: EntityGraph | undefined, shelf: EntityShelf): NodeChange & Row => {
    const { graph, tags, id: _id, ...rest } = input;
    return {
      ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)),
      ...(tags !== undefined ? { tags: tagsOf(tags) } : {}),
      ...(graph ? { graph: graphGiven(graph as EntityGraph, held, shelf) } : {}),
    };
  };
  return [
    {
      id: `${id}.find`, label: 'Find', type: id, changes: false,
      description: `The ${label} entities whose name or description holds the search, of a tag where one is given.`,
      input: { search: { label: 'Search' }, tag: { label: 'Tag' }, take: { type: 'number', label: 'How many', min: 1, max: 100 } },
      async run(call, ctx) {
        const shelf = shelfOf(ctx);
        if (!shelf) return none;
        const { search, tag, take } = call.input ?? {};
        const words = String(search ?? '').toLowerCase();
        const found = shelf.list(id).flatMap((s) => shelf.get(s.id) ?? []).filter((e) => (!tag || e.tags?.includes(String(tag)))
          && (!words || `${e.label} ${e.description ?? ''}`.toLowerCase().includes(words)));
        return { done: `${found.length} found.`, result: { rows: found.slice(0, Number(take ?? 25)).map(summaryOf), total: found.length } };
      },
    },
    {
      id: `${id}.read`, label: 'Read', type: id, changes: false,
      description: `One ${label} as JSON: its body as it keeps it, its settings, and its versions' numbers.`,
      async run(call, ctx) {
        const e = shelfOf(ctx)?.get(keysOf(call)[0] ?? '');
        if (!e) return none;
        const { versions, ...own } = e;
        return { done: `Read ${named(e)}.`, result: { ...own, versions: (versions ?? []).map(({ number, at, by, note }) => ({ number, at, ...(by ? { by } : {}), ...(note ? { note } : {}) })) } };
      },
    },
    {
      id: `${id}.add`, label: 'Add', type: id, changes: true,
      description: `A new ${label}, saved as a draft at version 1: its name, and its graph${type.graph?.query ? ' or its query' : ''}.`,
      input: { id: { label: 'Id', pattern: ID.source }, ...given, label: { label: 'Name', required: true } },
      async run(call, ctx) {
        const shelf = shelfOf(ctx);
        if (!shelf) return none;
        const input = call.input ?? {};
        const answer = await createNode(shelf, { ...changeOf(input, undefined, shelf), ...(input['id'] ? { id: input['id'] } : {}), type: id });
        const refused = refusal('Add', answer);
        if (refused || !('id' in answer)) return refused ?? none;
        const made = answer.id;
        return { done: `Added ${named(shelf.get(made)!)}.`, result: { id: made }, undo: async () => { deleteNode(shelf, made); } };
      },
    },
    {
      id: `${id}.change`, label: 'Change', type: id, changes: true,
      description: `Change one ${label}: a field given replaces its own; its body, a graph${type.graph?.query ? ' or a query' : ''}, whole. Saved as a draft.`,
      input: given,
      async run(call, ctx) {
        const shelf = shelfOf(ctx);
        const was = shelf?.get(keysOf(call)[0] ?? '');
        if (!shelf || !was) return none;
        if (!Object.values(call.input ?? {}).some((v) => v !== undefined)) return { refused: 'Change: say what to change.' };
        const refused = refusal('Change', await updateNode(shelf, was.id, changeOf(call.input ?? {}, was.graph, shelf)));
        if (refused) return refused;
        // Its versions are the shelf's to keep: the undo writes the draft back alone.
        const { origin: _origin, versions: _versions, ...own } = was;
        return { done: `Changed ${named(shelf.get(was.id) ?? was)}.`, undo: async () => { await shelf.save(own as Entity); } };
      },
    },
    {
      id: `${id}.remove`, label: 'Remove', type: id, many: true, changes: true,
      description: `Remove ${label} entities: refused while another uses one.`,
      async run(call, ctx) {
        const shelf = shelfOf(ctx);
        if (!shelf) return none;
        const keys = keysOf(call);
        const kept = keys.map((k) => shelf.whyKept(k)).filter(Boolean);
        if (kept.length) return { refused: `Remove: ${kept.join(' ')}` };
        const gone = keys.flatMap((k) => shelf.get(k) ?? []);
        for (const e of gone) deleteNode(shelf, e.id);
        return {
          done: `Removed ${gone.length === 1 ? named(gone[0]!) : `${gone.length} of ${label}`}.`,
          undo: async () => {
            for (const { origin: _origin, ...e } of gone) await shelf.save(e);
          },
        };
      },
    },
    ...versionActs({ id, label }),
  ];
}

/** An entity type's version acts: Publish its draft as the next number; Roll back to an earlier one. Neither has an undo: a
 *  version is never taken away, so a Roll back is how one goes back. Plan 972 */
function versionActs(type: { id: string; label: string }): Act[] {
  const keysOf = (call: ActCall): unknown[] => [...(call.keys ?? [])];
  const shelfOf = (ctx: ActContext): EntityShelf | undefined => ctx.entities;
  const answered = (a: VersionAnswer, done: (n: number) => string): ActAnswer => ('refused' in a ? { refused: a.refused } : { done: done(a.number), result: a });
  return [
    {
      id: `${type.id}.publish`, label: 'Publish', type: type.id, changes: true,
      description: `Publish a ${type.label}'s draft as its next version: only then do its uses see it.`,
      input: { note: { label: 'Note' } },
      async run(call, ctx) {
        const shelf = shelfOf(ctx);
        if (!shelf) return { refused: 'Publish: the app has no entities here.' };
        const note = call.input?.['note'];
        return answered(await publish(shelf, String(keysOf(call)[0]), { ...(note ? { note: String(note) } : {}) }), (n) => `Published version ${n}.`);
      },
    },
    {
      id: `${type.id}.roll-back`, label: 'Roll back', type: type.id, changes: true,
      description: `Roll a ${type.label} back to an earlier version: it is published again as the next one, so nothing is lost.`,
      input: { version: { type: 'number', label: 'Version', min: 1, required: true } },
      async run(call, ctx) {
        const shelf = shelfOf(ctx);
        if (!shelf) return { refused: 'Roll back: the app has no entities here.' };
        const number = Number(call.input?.['version']);
        return answered(await rollBack(shelf, String(keysOf(call)[0]), number), (n) => `Rolled back to version ${number}, published as version ${n}.`);
      },
    },
  ];
}
