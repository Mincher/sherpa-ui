/**
 * node-messages.ts — a MESSAGE field's values: each `{node.name}` in its text names a value of a node its connections come from,
 * a row or property it sends, or a field of the rows a Source sends. DOM-free. Will, plan 891.
 *
 * Map:
 * - MessagePart — One value a text names: its key, its node and name, and where it stands in the text.
 * - valuesIn — Each value a text names, in order.
 * - MessageValue — One value a message can name: its key, its name, its words and what it is.
 * - MessageSource — A node a message can name values of: its id, its heading and its values.
 * - valuesAt — The values a node's messages can name: each node its connections come from, nearest first.
 * - unreachedValues — What is wrong with each value a text names that no connection gives, in words.
 * - filled — A text with each value it names put in; one with no value, kept as it was.
 */
import { kindOfNode, socketOf, type NodeKind, type NodeConnection } from './node-kinds.js';

/** One value a text names: `{node.name}`, its node and name, and where it stands. */
export interface MessagePart {
  key: string;
  node: string;
  name: string;
  at: number;
  end: number;
}

const VALUE = /\{([\w-]+)\.([\w.-]+)\}/g;

/** Each value a text names, in order: `{s1.name}` is the field `name` of the rows Source `s1` sends. */
export function valuesIn(text: unknown): MessagePart[] {
  if (typeof text !== 'string') return [];
  return [...text.matchAll(VALUE)].map((m) => ({ key: m[0], node: m[1]!, name: m[2]!, at: m.index, end: m.index + m[0].length }));
}

/** One value a message can name: its key, its row's or field's name, its words and what it is. */
export interface MessageValue {
  key: string;
  name: string;
  label: string;
  /** What it is: a row's `gives` or socket type, or a field's type. */
  of?: string;
}

/** A node a message can name values of: its id, its heading and its values. */
export interface MessageSource {
  node: string;
  heading: string;
  values: MessageValue[];
}

type Node = { id: string; kind: string; heading?: string; values?: Readonly<Record<string, unknown>> };
type Fields = Readonly<Record<string, Readonly<Record<string, { label?: string; type?: string }>>>>;

/** The values a node's messages can name: each node its connections come from, nearest first — the rows and properties it sends,
 *  and a Source's fields, where `fieldsOf` knows its store; a node that sends none, with none. A set of rows is no value a
 *  message can say. */
export function valuesAt(nodes: readonly Node[], connections: readonly NodeConnection[], id: string, kinds: Readonly<Record<string, NodeKind>>, fieldsOf: Fields = {}): MessageSource[] {
  const held = new Map(nodes.map((n) => [n.id, n]));
  const from = new Map<string, string[]>();
  for (const r of connections) {
    const [a, b] = [socketOf(r.from).node, socketOf(r.to).node];
    from.set(b, [...(from.get(b) ?? []), a]);
  }
  const seen = new Set([id]);
  const order: string[] = [];
  for (let queue = [id]; queue.length;) {
    const next: string[] = [];
    for (const at of queue) for (const up of from.get(at) ?? []) if (!seen.has(up)) { seen.add(up); order.push(up); next.push(up); }
    queue = next;
  }
  return order.flatMap((nodeId) => {
    const node = held.get(nodeId);
    const kind = kindOfNode(kinds, node);
    if (!node || !kind) return [];
    const value = (name: string, label: string, of?: string): MessageValue => ({ key: `{${nodeId}.${name}}`, name, label, ...(of ? { of } : {}) });
    const rows = kind.rows.filter((r) => r.output && r.gives !== 'rows').map((r) => value(r.name, r.label, r.gives ?? r.output));
    const store = kind.rows.some((r) => r.control === 'store') ? node.values?.['store'] : undefined;
    const fields = typeof store === 'string' && fieldsOf[store] ? Object.entries(fieldsOf[store]).filter(([name]) => !rows.some((v) => v.name === name)).map(([name, f]) => value(name, f.label ?? name, f.type)) : [];
    return [{ node: nodeId, heading: node.heading ?? kind.heading, values: [...rows, ...fields] }];
  });
}

/** What is wrong with each value a text names that no connection gives, in words: a node no connection brings, or a value its node
 *  does not send. A Source whose fields are not known takes any field. */
export function unreachedValues(text: unknown, sources: readonly MessageSource[], nodes: readonly Node[], kinds: Readonly<Record<string, NodeKind>>, fieldsKnown = true): string[] {
  return [...new Set(valuesIn(text).flatMap((part) => {
    const source = sources.find((s) => s.node === part.node);
    const node = nodes.find((n) => n.id === part.node);
    if (!node) return [`"${part.key}" names no node`];
    const heading = node.heading ?? kinds[node.kind]?.heading ?? node.id;
    if (!source) return [`"${part.key}" has no value here: no connection brings ${heading} to this node`];
    if (source.values.some((v) => v.name === part.name)) return [];
    const open = !fieldsKnown && kindOfNode(kinds, node)?.rows.some((r) => r.control === 'store');
    return open ? [] : [`"${part.key}" has no value here: ${heading} sends no "${part.name}"`];
  }))];
}

/** A text with each value it names put in, by its key; one `value` does not know is kept as it was. */
export function filled(text: unknown, value: (key: string) => unknown): string {
  if (typeof text !== 'string') return '';
  return text.replace(VALUE, (key) => {
    const v = value(key);
    return v == null ? key : Array.isArray(v) ? v.join(', ') : String(v);
  });
}
