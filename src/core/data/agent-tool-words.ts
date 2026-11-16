/**
 * agent-tool-words.ts — each tool the library offers an agent, said once: its name, its words, its input (a JSON Schema) and
 * whether it changes data. DOM-free, so the MCP says a tool both have in the same words (plan 1008 G1, D3 A); the utility
 * layer's `agentTools` carries them out.
 *
 * Map:
 * - AgentTool — one tool as an agent is told it
 * - agentToolWords — the tools, their `context` naming this app's Contexts
 */
import { OP_LABELS } from './store.js';

/** One tool as an agent is told it. */
export interface AgentTool {
  readonly name: string;
  readonly description: string;
  /** Its input, a JSON Schema. */
  readonly input: Readonly<Record<string, unknown>>;
  readonly changes: boolean;
}

type Schema = Record<string, unknown>;

const id: Schema = { type: 'string', minLength: 1, maxLength: 80 };
const plain: Schema = { anyOf: [{ type: 'string', maxLength: 500 }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }] };
const value: Schema = { anyOf: [plain, { type: 'array', maxItems: 50, items: plain }] };
const object = (properties: Schema, required: readonly string[] = []): Schema => ({ type: 'object', properties, required, additionalProperties: false });
/** A page's `where`: each field's condition by its op, as a filter takes it. */
const where: Schema = {
  type: 'object', minProperties: 1, maxProperties: 12,
  additionalProperties: object({ ...Object.fromEntries(Object.keys(OP_LABELS).map((op) => [op, value])), unit: { type: 'string', enum: ['day', 'week', 'month', 'year'] } }),
};

/** The tools, their `context` naming these Contexts. */
export function agentToolWords(contexts: readonly string[]): AgentTool[] {
  const context: Schema = { type: 'string', enum: [...contexts] };
  return [
    {
      name: 'get_app',
      description: 'The app\'s pages (Contexts), each with its Views, what is on screen now (the page, its View, and on a graph View the graph it shows, with any unsaved changes the reader has made to it), and every act the app offers: its id, its words, its input and where it applies.',
      input: object({}),
      changes: false,
    },
    {
      name: 'on_screen',
      description: 'What the reader sees and works on now, read without changing anything: the page and its View, its filters, the row they are on and the rows they picked, the panels and dialogs open, the graph and the nodes picked on a graph View, the acts of the page, and the last thing they pressed. Call it first when the reader says "this", "these", "here" or "it".',
      input: object({}),
      changes: false,
    },
    {
      name: 'describe_page',
      description: 'A page, read without opening it: its fields with their values, its filter scopes and presets, its saved Filters, its Views and the key field of its records. With no `context`, the page on screen, with the filters it shows now.',
      input: object({ context }),
      changes: false,
    },
    {
      name: 'read_rows',
      description: 'A page\'s rows, read without changing the screen: `limit` of them from `offset`, narrowed by `where` (each field\'s condition by its op, e.g. {"status":{"in":["trial"]},"score":{"lt":60}}), in `sort` order, with only `fields` when given. The answer says how many match in all. With no `context`, the page on screen, after the filters it shows; another page\'s rows start from all its records.',
      input: object({
        context, where,
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        offset: { type: 'integer', minimum: 0 },
        fields: { type: 'array', maxItems: 20, items: id },
        sort: id,
        direction: { type: 'string', enum: ['asc', 'desc'] },
      }),
      changes: false,
    },
    {
      name: 'summarize',
      description: 'Totals over a page\'s rows, read without changing the screen, by the values of one field: each value\'s row count and the sum of each `sum` field. Largest first. `context` and `where` as read_rows takes them.',
      input: object({ context, where, by: id, sum: { type: 'array', maxItems: 6, items: id }, top: { type: 'integer', minimum: 1, maximum: 100 } }, ['by']),
      changes: false,
    },
    {
      name: 'open_page',
      description: 'Take the reader to a page (Context), and one of its Views when given. Only when the reader asks to see it: every other tool works on a page without opening it. Ids come from get_app.',
      input: object({ context, view: id }, ['context']),
      changes: false,
    },
    {
      name: 'filter',
      description: 'Filter what the page on screen shows. `where` names each field\'s condition by its op, e.g. {"status":{"in":["trial"]},"score":{"lt":60},"created":{"last":3,"unit":"month"}}. Ops: eq ne contains notcontains startswith endswith gt gte lt lte between notbetween (a [low, high] pair) last next (with unit) in notin (a list). `replace` clears the other filters first.',
      input: object({ where, replace: { type: 'boolean' } }, ['where']),
      changes: false,
    },
    {
      name: 'use_preset',
      description: 'Turn one of the page\'s presets or Filters (filter:<id>) on, or off. Ids come from describe_page.',
      input: object({ id, on: { type: 'boolean' } }, ['id']),
      changes: false,
    },
    {
      name: 'arrange',
      description: 'Sort, group or search the page\'s rows. A `sort` of null stops the sort; a `group` of null stops the grouping; an empty `search` clears it.',
      input: object({
        sort: { anyOf: [id, { type: 'null' }] },
        direction: { type: 'string', enum: ['asc', 'desc'] },
        group: { anyOf: [id, { type: 'null' }] },
        search: { type: 'string', maxLength: 200 },
      }),
      changes: false,
    },
    {
      name: 'clear_filters',
      description: 'Clear every filter, sort and grouping on the page on screen.',
      input: object({}),
      changes: false,
    },
    {
      name: 'node_kinds',
      description: 'The kinds of node a graph may hold, and the Custom Nodes it may place. With no `kinds`, each kind\'s name and words, and each Custom Node with its `custom` facts: its id, type, sockets, and whether it is the reader\'s own. With `kinds`, those kinds whole: their types, sockets and values. A graph places a Custom Node by its `kind`.',
      input: object({ kinds: { type: 'array', maxItems: 8, items: id } }),
      changes: false,
    },
  ];
}
