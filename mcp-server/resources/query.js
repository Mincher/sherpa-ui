/**
 * query.js — the query tier's resources: the kinds every node graph is drawn from.
 * Read from the one registry, never listed here. TRAP T-one-node-registry
 *
 *   sherpa://node-kinds   every node kind, as NODE_KINDS says it: its header, rows, sockets, model and graphs
 *   sherpa://graph-rules  how an agent wires a graph, in words made from the kinds (graphRules, TODO 1005)
 *
 * Map:
 * - register — register the query resources on an MCP server
 */
import { imported } from '../lib/sherpa.js';

const JSON_TYPE = 'application/json';

export function register(server) {
  server.registerResource('node kinds', 'sherpa://node-kinds', {
    title: 'The node kinds',
    description: 'Every node kind sherpa-ui ships, as `NODE_KINDS` in `sherpa-ui/data` says it, by name: its heading, icon and description, its header\'s sockets (`input`, `output`), its rows (each `name`, `label`, `control` and sockets), the data layer\'s `model` for it, and the `graphs` it is drawn in — a page\'s Query, a workflow or both',
    mimeType: JSON_TYPE,
  }, async (uri) => {
    const { NODE_KINDS } = await imported('sherpa-ui/data');
    return { contents: [{ uri: uri.href, mimeType: JSON_TYPE, text: JSON.stringify(NODE_KINDS, null, 2) }] };
  });
  server.registerResource('graph rules', 'sherpa://graph-rules', {
    title: 'How to wire a graph',
    description: 'How an agent wires a node graph, in words made from the kinds (`graphRules` in `sherpa-ui/data`): a node\'s and a connection\'s shape, the Start and a Route, then each kind of a workflow with its own words, its types and a type\'s own words. Read it before making or changing a graph',
    mimeType: 'text/plain',
  }, async (uri) => {
    const { graphRules } = await imported('sherpa-ui/data');
    return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: graphRules() }] };
  });
}
