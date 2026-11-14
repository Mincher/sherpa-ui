/**
 * references.ts — a text names what it means inline, `{{kind:id}}`: a node's value, a store, a field, a model, an Output's
 * action, an input, an output, a step, any entity by its type, or a kind an app registers. Node text and prompts read it
 * the same, and a name that names nothing is said in words (Will, TODO 956: "A"; plan 956). DOM-free.
 * TRAP T-a-text-names-what-it-means
 *
 * Map:
 * - RefKind — A kind a reference may name: what it is, in words, and how its id is read.
 * - Reference — One reference in a text: its kind, its id, how it is written and where it stands.
 * - RefRead — One reference read: its name, or why it names nothing.
 * - RefFacts — What there is to read a reference against.
 * - REF_FORM — The form a reference is written in, `{{kind:id}}`: its kind and its id.
 * - ref — The reference to one thing, as a text writes it.
 * - refsIn — Every reference in a text, in order, each where it stands.
 * - refsOf — Each reference in a text once, in order.
 * - registerRefKinds — Register kinds a reference may name, read live: an app's, the entity types'.
 * - refKinds — Every kind a reference may name: the library's, then each registered.
 * - readRefs — Each reference in a text once, read: the name of what it names, or why it names nothing.
 */
/** What there is to read a reference against: a list, or labels by id. */
type Known = readonly string[] | Readonly<Record<string, string>>;

/** What there is to read a reference against. Each kind reads its own: `<kind>s`, by default; a field by its last part. */
export interface RefFacts {
  /** An entity's label by its type and id: the shelf's. */
  entity?(type: string, id: string): string | undefined;
  [list: string]: Known | ((type: string, id: string) => string | undefined) | undefined;
}

/** A kind a reference may name: what it is, in words, and how its id is read (none: from the facts' `<kind>s`). */
export interface RefKind {
  what: string;
  read?(id: string, facts: RefFacts): string | undefined;
}

/** One reference in a text: its kind, its id, how it is written and where it stands. */
export interface Reference {
  kind: string;
  id: string;
  written: string;
  at: number;
  end: number;
}

/** One reference read: its name, or why it names nothing, in words. */
export type RefRead = Pick<Reference, 'kind' | 'id' | 'written'> & ({ name: string } | { missing: string });

/** The form a reference is written in, `{{kind:id}}`: its kind and its id. */
export const REF_FORM = /\{\{\s*([a-z][a-z-]*):([^{}]+?)\s*\}\}/;

const REF = new RegExp(REF_FORM.source, 'g');

/** A name from what is known: a list holds the id itself, a record its label. */
const known = (list: unknown, id: string): string | undefined =>
  Array.isArray(list) ? (list.includes(id) ? id : undefined) : list && typeof list === 'object' ? (list as Record<string, string>)[id] : undefined;

/** The library's own kinds. A node's value is `<node>.<name>`; a field is read by its last part, as `location.building`. */
const OWN: Readonly<Record<string, RefKind>> = {
  value: { what: 'a value a node sends' },
  store: { what: 'a store of rows' },
  field: { what: 'a field of a row', read: (id, facts) => known(facts['fields'], id.split('.').at(-1) ?? id) },
  model: { what: 'an AI model' },
  action: { what: 'what an Output does' },
  input: { what: 'what comes in' },
  output: { what: 'what is sent on' },
  step: { what: 'a step' },
};

const sources = new Set<() => Readonly<Record<string, RefKind>>>();

/** The reference to one thing, as a text writes it: `{{kind:id}}`. */
export const ref = (kind: string, id: string): string => `{{${kind}:${id}}}`;

/** Every reference in a text, in order, each where it stands. */
export function refsIn(text: unknown): Reference[] {
  if (typeof text !== 'string') return [];
  return [...text.matchAll(REF)].map((m) => ({ kind: m[1]!, id: m[2]!.trim(), written: m[0], at: m.index, end: m.index + m[0].length }));
}

/** Each reference in a text once, in order. */
export function refsOf(text: unknown): Reference[] {
  const seen = new Map<string, Reference>();
  for (const r of refsIn(text)) if (!seen.has(r.written)) seen.set(r.written, r);
  return [...seen.values()];
}

/** Register kinds a reference may name, read live: an app's own (a customer), or every entity type; the call that takes
 *  them back. */
export function registerRefKinds(read: () => Readonly<Record<string, RefKind>>): () => void {
  sources.add(read);
  return () => { sources.delete(read); };
}

/** Every kind a reference may name: the library's, then each registered, in the order registered. */
export function refKinds(): Readonly<Record<string, RefKind>> {
  return Object.assign({}, OWN, ...[...sources].map((read) => read())) as Record<string, RefKind>;
}

/** Each reference in a text once, read: the name of what it names, or why it names nothing, in words. */
export function readRefs(text: unknown, facts: RefFacts = {}): RefRead[] {
  const kinds = refKinds();
  return refsOf(text).map(({ kind, id, written }) => {
    const of = kinds[kind];
    if (!of) return { kind, id, written, missing: `"${kind}" is no kind a reference names: ${Object.keys(kinds).join(', ')}` };
    const name = of.read ? of.read(id, facts) : known(facts[`${kind}s`], id);
    return name === undefined ? { kind, id, written, missing: `there is no ${of.what.replace(/^an? /, '')} "${id}"` } : { kind, id, written, name: String(name) };
  });
}
