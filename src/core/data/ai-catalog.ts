/**
 * ai-catalog.ts — what the AI nodes and the Triggers pick from: the host app's providers and their models, its runbooks and
 * skills; its events, tasks, agents and endpoints. Sherpa ships none: model names change, and Sherpa knows no app.
 * Registered once, at load, as Output types are. Pure: no DOM. Will, plans 926 D1 A, 941
 *
 * Map:
 * - AiCatalog — The providers, models, runbooks and skills an app offers its AI nodes.
 * - TriggerCatalog — The events, tasks, agents and endpoints an app's Triggers can listen for.
 * - NEW_CHOICE — The value of a Runbook's or a Skill's New, whose instructions are its own.
 * - registerAiCatalog — Add an app's providers, runbooks and skills, beside any added before.
 * - registerTriggerCatalog — Add an app's events, tasks, agents and endpoints, beside any added before.
 * - aiCatalog — Everything registered: what the AI nodes' and the Triggers' picks list.
 * - catalogChoices — A row's list from the catalog, by its control; none, it is no catalog row, or a Trigger's is typed text.
 * - runbookGraphs — The definitions the runbooks name: reached through a Runbook node, never placed as Custom Nodes.
 * - aiWords — A provider's or a model's words, by its id: what a row it is joined to says.
 */
import type { RowChoice } from './node-kinds.js';

/** One entry by id: its words, its line, and a runbook's sub-graph — a definition in the app's node library. */
interface CatalogEntry {
  label: string;
  help?: string;
  /** A runbook's sub-graph: the id of a preset Custom Node in the app's library. Drill in opens it, read only (D3 A). */
  graph?: string;
}
type Entries = Readonly<Record<string, CatalogEntry>>;

/** The providers, models, runbooks and skills an app offers its AI nodes, each by id. */
export interface AiCatalog {
  providers?: Readonly<Record<string, { label: string; models: Readonly<Record<string, string>> }>>;
  runbooks?: Entries;
  skills?: Entries;
}

/** The events, tasks, agents and endpoints an app's Triggers can listen for, each by id. Plan 941 */
export interface TriggerCatalog {
  events?: Entries;
  tasks?: Entries;
  agents?: Entries;
  endpoints?: Entries;
}

/** The value of a Runbook's or a Skill's New: its instructions are its own. */
export const NEW_CHOICE = 'new';

type Held = Required<AiCatalog> & Required<TriggerCatalog>;
let held: Held = { providers: {}, runbooks: {}, skills: {}, events: {}, tasks: {}, agents: {}, endpoints: {} };

/** Each list given beside the one held; an id given before is replaced. The undo puts the catalog back. */
function merge(catalog: AiCatalog & TriggerCatalog): () => void {
  const was = held;
  held = Object.fromEntries(Object.entries(held).map(([list, entries]) => [list, { ...entries, ...catalog[list as keyof Held] }])) as Held;
  return () => { held = was; };
}

/** Add an app's providers, runbooks and skills, beside any added before; one of an id added before replaces it. The
 *  undo takes them away again. */
export function registerAiCatalog(catalog: AiCatalog): () => void {
  return merge(catalog);
}

/** Add an app's events, tasks, agents and endpoints, beside any added before, as `registerAiCatalog` does. Plan 941 */
export function registerTriggerCatalog(catalog: TriggerCatalog): () => void {
  return merge(catalog);
}

/** Everything registered: what the AI nodes' and the Triggers' picks list. */
export function aiCatalog(): Readonly<Held> {
  return held;
}

const listed = (entries: Readonly<Record<string, { label: string; help?: string }>>): RowChoice[] =>
  Object.entries(entries).map(([value, e]) => ({ value, label: e.label, ...(e.help ? { title: e.help } : {}) }));

/** The Trigger rows that read a list, by control (plan 941): none registered, the row is typed text. */
const HEARD: Readonly<Record<string, keyof TriggerCatalog>> = { event: 'events', task: 'tasks', agent: 'agents', endpoint: 'endpoints' };

/** A row's list from the catalog, by its control: a provider's, a model's (of the `provider` joined), a runbook's or a
 *  skill's (then New), a Trigger's. None, it is no catalog row — or a Trigger's with none registered, typed text. */
export function catalogChoices(control: string | undefined, provider?: unknown): RowChoice[] | undefined {
  if (control === 'provider') return listed(held.providers);
  if (control === 'model') {
    const models = typeof provider === 'string' ? held.providers[provider]?.models : undefined;
    return Object.entries(models ?? {}).map(([value, label]) => ({ value, label }));
  }
  if (control === 'runbook') return [...listed(held.runbooks), { value: NEW_CHOICE, label: 'New runbook' }];
  if (control === 'skill') return [...listed(held.skills), { value: NEW_CHOICE, label: 'New skill' }];
  const list = control ? HEARD[control] : undefined;
  return list && Object.keys(held[list]).length ? listed(held[list]) : undefined;
}

/** The definitions the runbooks name: reached through a Runbook node, never placed as Custom Nodes (plan 926 D3). */
export function runbookGraphs(): ReadonlySet<string> {
  return new Set(Object.values(held.runbooks).flatMap((r) => (r.graph ? [r.graph] : [])));
}

/** A provider's or a model's words, by its id: what a row it is joined to says, "Claude Opus 5.5" for `opus`. */
export function aiWords(needs: 'provider' | 'model', id: unknown): string | undefined {
  if (typeof id !== 'string') return undefined;
  if (needs === 'provider') return held.providers[id]?.label;
  return Object.values(held.providers).find((p) => p.models[id])?.models[id];
}
