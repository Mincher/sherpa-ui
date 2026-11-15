/**
 * graph-text.ts — a graph READ AS TEXT (plan 960 U5, the text lens): its steps in words, stage by stage, as `graphSteps`
 * orders and numbers them; a test of one value with where its Pass and Fail go, a split of a column with where its rows go,
 * and the errors and retries those make. Each kind says its own words: the library's in one table, an app's by
 * `registerStepWords`. It names what it means inline, `{{kind:id}}`. A text form round it (an app's prompt) is the app's.
 * DOM-free. TRAP T-a-text-names-what-it-means
 *
 * Map:
 * - TextGraph — What a graph read as text needs: its nodes, connections and stages.
 * - StepWords — An app's words for a node of its kind, or none to leave it to the library's.
 * - graphKey — A short key of what a graph does: its nodes, values, connections and stages; not their places.
 * - registerStepWords — Say an app's kind, or a use of its entity type, in words; the call that takes it back.
 * - outputWords — An Output's line: its action, the app's own words after it, who it goes to, and what it says.
 * - stepWords — A node in words: its own line, else what its kind and values say.
 * - GraphText — A graph read as text: the stages' lines, the errors and retries, and its steps.
 * - graphText — A graph read as text, by its steps.
 * - conditionWords — A condition tree in words, each field by its label: "Score is less than 60 or Open tickets is at least 5".
 */
import { graphSteps, type GraphStep, type StepGoes } from './graph-steps.js';
import type { NodeConnection } from './node-kinds.js';
import type { NodeStage } from './node-stages.js';
import { ref } from './references.js';
import { groupOf, type Condition, type ConditionLeaf, type Duration } from './store.js';
import type { WorkflowNode } from './workflow.js';

/** What a graph read as text needs: its nodes, connections and stages. */
export interface TextGraph {
  nodes?: readonly WorkflowNode[];
  connections?: readonly NodeConnection[];
  stages?: readonly NodeStage[] | undefined;
}

/** An app's words for a node of its kind, or none to leave it to the library's. */
export type StepWords = (node: WorkflowNode, graph: TextGraph) => string | undefined;

/** A short key of what a graph does: its nodes (kind, values, heading, line), connections and stages. Its places are left
 *  out: a node moved does not change what it says. */
export function graphKey(graph: TextGraph = {}): string {
  const what = JSON.stringify({
    // A node's stage is what the graph does, its run order (Will, TODO 1001 D2 A): a move into another stage is an edit.
    nodes: (graph.nodes ?? []).map(({ id, kind, heading, description, values, stage }) => [id, kind, heading, description, values, ...(stage ? [stage] : [])]),
    connections: (graph.connections ?? []).map(({ from, to }) => [from, to]),
    stages: (graph.stages ?? []).map(({ label }) => label),
  });
  let h = 2166136261;
  for (let i = 0; i < what.length; i++) h = Math.imul(h ^ what.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

const OPS: Readonly<Record<string, string>> = {
  eq: 'is', ne: 'is not', gt: 'is more than', gte: 'is at least', lt: 'is less than', lte: 'is at most',
  contains: 'contains', notcontains: 'does not contain', startswith: 'starts with', endswith: 'ends with',
  in: 'is one of', notin: 'is not one of', empty: 'is empty', not: 'is not',
  between: 'is between', notbetween: 'is not between', last: 'is in the last', next: 'is in the next',
};
const OUTPUTS: ReadonlySet<string> = new Set(['request', 'notify', 'response', 'result', 'content']);
const added = new Map<string, StepWords>();

const nodeIn = (graph: TextGraph, id: string): WorkflowNode | undefined => (graph.nodes ?? []).find((n) => n.id === id);
const owner = (address: string): string => address.split('/')[0]!;
const text = (v: unknown): string => (v == null ? '' : String(v));
/** A test on a COLUMN — a Field joined to its header — splits rows; any other tests one value (plan 971 §9). */
const testsColumn = (n: WorkflowNode, graph: TextGraph): boolean =>
  (graph.connections ?? []).some((c) => c.to === n.id && nodeIn(graph, owner(c.from))?.kind === 'field');

/** Say an app's kind, or a use of its entity type (`type:id`, by `type`), in words; the call that takes it back. */
export function registerStepWords(kind: string, words: StepWords): () => void {
  added.set(kind, words);
  return () => { if (added.get(kind) === words) added.delete(kind); };
}

/** An Output's line: its action, the app's own words after it (a Ticket's "on the Ops board"), who it goes to, and what it
 *  says. */
export function outputWords(n: WorkflowNode, more: readonly string[] = []): string {
  const v = n.values ?? {};
  const what = text(v['summary'] ?? v['title'] ?? v['message'] ?? n.description);
  return `${n.heading ?? n.kind}: ${[v['type'] ? ref('action', text(v['type'])) : '', ...more, v['to'] ? `to ${text(v['to'])}` : '', what && `"${what}"`].filter(Boolean).join(', ')}.`;
}

/** The library's words for a node: its own line, else what its kind and values say. */
function libraryWords(n: WorkflowNode, graph: TextGraph): string {
  const v = n.values ?? {};
  const heading = n.heading;
  if (n.kind === 'field') return `${heading ? `${heading}: r` : 'R'}ead each row's ${ref('field', text(v['field']))}.`;
  if (n.kind === 'condition') {
    const type = text(v['type']);
    if (type === 'and' || type === 'or') return `${heading ?? (type === 'or' ? 'Either' : 'Both')}: ${n.description ?? `join what comes in (${type === 'or' ? 'any' : 'all'} of it).`}`;
    const field = (graph.connections ?? []).map((c) => (c.to === n.id ? nodeIn(graph, owner(c.from)) : undefined)).find((f) => f?.kind === 'field')?.values?.['field'];
    if (field) return `${heading ? `${heading}: k` : 'K'}eep the rows whose ${ref('field', text(field))} ${OPS[type] ?? type} ${text(v['b'])}.`.replace(/\s+\./, '.');
    // One value: a yes or a no, which sends what it is given one way (plan 971 §9).
    const asks = type === 'empty' ? 'nothing comes in' : `what comes in ${OPS[type] ?? type} ${text(v['b'])}`.trim();
    return `${heading ?? 'Check'}: ${n.description ?? `when ${asks}.`}`;
  }
  // A Fork: each row on by its field's value, the rest at Otherwise (plan 991 D6).
  if (n.kind === 'fork') {
    const field = (graph.connections ?? []).map((c) => (c.to === n.id ? nodeIn(graph, owner(c.from)) : undefined)).find((f) => f?.kind === 'field')?.values?.['field'];
    const ways = [v['ways'] ?? []].flat().map(text);
    return `${heading ?? 'Fork'}: send each row on by its ${field ? ref('field', text(field)) : 'field'}${ways.length ? `: ${ways.join(', ')}` : ''}; the rest, Otherwise.`;
  }
  // A Merge: two sets of rows joined by a field of each (plan 992 O3).
  if (n.kind === 'merge') {
    const on = (to: string): string => {
      const f = (graph.connections ?? []).map((c) => (c.to === to ? nodeIn(graph, owner(c.from)) : undefined)).find((x) => x?.kind === 'field')?.values?.['field'];
      return f ? ref('field', text(f)) : 'a field';
    };
    return `${heading ?? 'Merge'}: join the rows by ${on(n.id)} and ${on(`${n.id}/b`)}.`;
  }
  // The Boolean: what comes in goes on only where it is something (Will, plan 971 §9).
  if (n.kind === 'boolean') return `${heading ?? 'If any'}: go on only when something comes in.`;
  // A Category answer: one of its Categories for each row (plan 992 O6).
  const sorts = (line: string): string => (v['type'] === 'category' ? `${line.replace(/\.$/, '')}; for each row, one of ${[v['categories'] ?? []].flat().map(text).join(', ')}.` : line);
  if (n.kind === 'runbook') return sorts(`${heading ?? 'Agent step'}: ${text(v['instructions'] ?? n.description)}`.trim());
  if (n.kind === 'prompt') return sorts(`${heading ?? 'Ask'}: ask ${v['prompt'] ? `"${text(v['prompt'])}"` : text(n.description)}`.trim());
  if (n.kind === 'math' && v['type'] === 'count') return `${heading ?? 'Count'}: count the rows.`;
  if (OUTPUTS.has(n.kind)) return outputWords(n);
  // A use of another entity: run it.
  if (n.kind.includes(':')) {
    const [type, id] = n.kind.split(':') as [string, string];
    return `${heading ?? type}: run ${ref(type, id)}.`;
  }
  return `${heading ?? n.kind}${n.description ? `: ${n.description}` : '.'}`;
}

/** A node in words: an app's for its kind (or a use's, by its type), else the library's. */
export function stepWords(n: WorkflowNode, graph: TextGraph): string {
  const app = added.get(n.kind) ?? (n.kind.includes(':') ? added.get(n.kind.split(':')[0]!) : undefined);
  return app?.(n, graph) ?? libraryWords(n, graph);
}

/** A graph read as text: the lines of its stages (each "1. Label", then each step, numbered, and a test's PASS and FAIL),
 *  the errors and retries those make, and its steps, as `graphSteps` gives them. */
export interface GraphText {
  stages: string[];
  errors: string[];
  steps: readonly GraphStep[];
}

/** A graph read as text, by its steps: each stage's in order; a test of one value with where its Pass and Fail go (its Fail
 *  an error too); a split of a column with where its rows go; a step's Retries, a retry. */
export function graphText(graph: TextGraph): GraphText {
  const stages = graphSteps({ nodes: graph.nodes ?? [], connections: graph.connections ?? [], ...(graph.stages ? { stages: graph.stages } : {}) });
  const steps = stages.flatMap((st) => st.steps);
  /** Where a step's flow goes, in words: a step by its number, or an output. */
  const words = (goes: readonly StepGoes[] = []): string => (goes.length ? [...new Set(goes.map((g) => {
    if ('output' in g) return `send to ${ref('output', g.output)}`;
    if ('step' in g) {
      const n = nodeIn(graph, g.node);
      return `go to ${ref('step', g.step)} ${n?.heading ?? n?.kind ?? ''}`.trimEnd();
    }
    return 'stop';
  }))].join(' and ') : 'stop');
  /** A way that leads on: to a step or an output, not only a stop. */
  const leads = (goes: readonly StepGoes[] | undefined): boolean => !!goes?.some((g) => !('stop' in g));
  const errors: string[] = [];
  const lines: string[] = [];
  stages.forEach((st, i) => {
    lines.push(`${i + 1}. ${st.label || 'Steps'}`);
    for (const step of st.steps) {
      const n = nodeIn(graph, step.node)!;
      const [pass, fail] = [step.branches?.['pass'], step.branches?.['fail']];
      lines.push(`   ${step.number} ${stepWords(n, graph)}`);
      if (n.kind === 'condition' && !testsColumn(n, graph) && (leads(pass) || leads(fail))) {
        // One value: a yes or a no; Pass and Fail each say where what it was given goes (plan 971 §9).
        if (leads(pass)) lines.push(`       PASS: ${words(pass)}.`);
        if (leads(fail)) {
          lines.push(`       FAIL: ${words(fail)}.`);
          errors.push(`- If not ${(n.heading ?? 'so').replace(/\?$/, '')} (${ref('step', step.number)}): ${words(fail)}.`);
        }
      } else if (leads(pass) && leads(fail)) {
        // A split: the rows that hold go one way, the rest the other (plan 971). A Fail that leads nowhere only filters.
        lines.push(`       PASS: the rows that hold ${words(pass)}.`, `       FAIL: the rest ${words(fail)}.`);
      }
    }
  });
  // A step's Retries setting: tried that many more times when it fails (plan 992 O7).
  for (const st of [...steps].reverse()) {
    const n = nodeIn(graph, st.node);
    const times = Number(n?.values?.['retries'] ?? 0);
    const wait = Number(n?.values?.['retry-wait'] ?? 0);
    const after = wait > 0 ? `, after a ${wait} minute wait` : '';
    if (times > 0) errors.unshift(`- A retry: ${ref('step', st.number)} ${n?.heading ?? st.kind}, up to ${times} more ${times === 1 ? 'time' : 'times'}${after}.`);
  }
  return { stages: lines, errors, steps };
}

/** A condition tree in words, each field by its label: "Score is less than 60 or Open tickets is at least 5". */
export function conditionWords(tree: Condition, label: (field: string) => string = (f) => f): string {
  const said = (part: Condition, inner: boolean): string => {
    const parts = groupOf(part);
    if (parts) {
      const words = parts[1].map((p) => said(p, true)).join(parts[0] === 'and' ? ' and ' : ' or ');
      return inner && parts[1].length > 1 ? `(${words})` : words;
    }
    const { field = '', op, value } = part as ConditionLeaf;
    const span = op === 'last' || op === 'next' ? (value as Duration) : undefined;
    const v = span ? `${span.n} ${span.unit}${span.n === 1 ? '' : 's'}` : Array.isArray(value) ? value.join(op.endsWith('between') ? ' and ' : ', ') : text(value);
    return `${label(field)} ${OPS[op] ?? op} ${v}`.trim();
  };
  return said(tree, false);
}
