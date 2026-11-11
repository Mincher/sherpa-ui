/**
 * ai-catalog.ts — what the AI nodes pick from: the host app's providers and their models, its runbooks and its skills.
 * Sherpa ships none: model names change, and Sherpa knows no app. Registered once, at load, as Output types are. Pure: no
 * DOM. Will, plan 926 D1 A
 *
 * Map:
 * - AiCatalog — The providers, models, runbooks and skills an app offers its AI nodes.
 * - NEW_CHOICE — The value of a Runbook's or a Skill's New, whose instructions are its own.
 * - registerAiCatalog — Add an app's providers, runbooks and skills, beside any added before.
 * - aiCatalog — Everything registered: what the AI nodes' picks list.
 * - providerChoices — A Provider row's list: each provider registered.
 * - modelChoices — A Model row's list: the models of one provider.
 * - runbookChoices — A Runbook row's list: each runbook registered, then New runbook.
 * - skillChoices — A Skill row's list: each skill registered, then New skill.
 * - runbookGraphs — The definitions the runbooks name: reached through a Runbook node, never placed as Custom Nodes.
 * - aiWords — A provider's or a model's words, by its id: what a row it is joined to says.
 */
import type { RowChoice } from './node-kinds.js';

/** One runbook or skill: its words, its line, and a runbook's sub-graph — a definition in the app's node library. */
interface CatalogEntry {
  label: string;
  help?: string;
  /** A runbook's sub-graph: the id of a preset Custom Node in the app's library. Drill in opens it, read only (D3 A). */
  graph?: string;
}

/** The providers, models, runbooks and skills an app offers its AI nodes, each by id. */
export interface AiCatalog {
  providers?: Readonly<Record<string, { label: string; models: Readonly<Record<string, string>> }>>;
  runbooks?: Readonly<Record<string, CatalogEntry>>;
  skills?: Readonly<Record<string, CatalogEntry>>;
}

/** The value of a Runbook's or a Skill's New: its instructions are its own. */
export const NEW_CHOICE = 'new';

let held: Required<AiCatalog> = { providers: {}, runbooks: {}, skills: {} };

/** Add an app's providers, runbooks and skills, beside any added before; one of an id added before replaces it. The
 *  undo takes them away again. */
export function registerAiCatalog(catalog: AiCatalog): () => void {
  const was = held;
  held = {
    providers: { ...held.providers, ...catalog.providers },
    runbooks: { ...held.runbooks, ...catalog.runbooks },
    skills: { ...held.skills, ...catalog.skills },
  };
  return () => { held = was; };
}

/** Everything registered: what the AI nodes' picks list. */
export function aiCatalog(): Readonly<Required<AiCatalog>> {
  return held;
}

const listed = (entries: Readonly<Record<string, { label: string; help?: string }>>): RowChoice[] =>
  Object.entries(entries).map(([value, e]) => ({ value, label: e.label, ...(e.help ? { title: e.help } : {}) }));

/** A Provider row's list: each provider registered. */
export function providerChoices(): RowChoice[] {
  return listed(held.providers);
}

/** A Model row's list: the models of one provider; none joined, or one not registered, none. */
export function modelChoices(provider: unknown): RowChoice[] {
  const models = typeof provider === 'string' ? held.providers[provider]?.models : undefined;
  return Object.entries(models ?? {}).map(([value, label]) => ({ value, label }));
}

/** A Runbook row's list: each runbook registered, then New runbook, whose instructions are its own. */
export function runbookChoices(): RowChoice[] {
  return [...listed(held.runbooks), { value: NEW_CHOICE, label: 'New runbook' }];
}

/** A Skill row's list: each skill registered, then New skill. */
export function skillChoices(): RowChoice[] {
  return [...listed(held.skills), { value: NEW_CHOICE, label: 'New skill' }];
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
