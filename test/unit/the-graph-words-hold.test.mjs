/**
 * THE GRAPH'S WORDS HOLD (plan 934, S7): no file brings back a name the rename retired. A graph's one
 * link is a Connection and the line drawn for it a Connector; "Route" now means a FULL path, Start node
 * to End node (routesOf, routeRead), so the word itself stays: the RETIRED NAMES of its old meaning go.
 * The old schemas are frozen on purpose (a graph saved before reads once through them), and the history,
 * the plan and the lexicon name the old to say what moved.
 * The words: PRINCIPLES 19 and LEXICON 12; the moves: docs/history/plan-934-graph-terms.md.
 *
 *   node --test test/unit/the-graph-words-hold.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Each name the rename retired, and what it is now. */
const RETIRED = [
  [/\b(NodeRoute|FlowRoute|RouteAnswer)\b/, 'NodeConnection, FlowConnection, ConnectionAnswer'],
  [/\b(keptRoutes|routeRequest|markRoutes|pickedRoutes|onReroute|innerRoute)\b/, 'keptConnections, connectionRequest, markConnections, pickedConnections, onReconnect, innerConnection'],
  // The portal's old row names. A private connectionOf(el) in the drawing, the Connection a line belongs to, is the new word.
  [/\bconnectionRow\b|\bconnectionOf\b(?=.*node-portals)|connection rows?\b/, 'addressRow, addressOf, an address row (D1)'],
  [/\b(PathRead|PathFacts|pathRead)\b|node-paths|data-path-why/, 'RouteRead, RouteFacts, routeRead, node-routes, data-route-why'],
  [/data-[a-z-]*routed\b|data-picked-routes|data-unrouted/, 'data-*-connected, data-picked-connections, data-unconnected'],
  [/graph-routes?\b|route-bends|route-path\b|sherpa-node-routes/, 'graph-connectors, graph-connector, connector-bends, connector-path, sherpa-node-connectors'],
  [/\b(workflow|query)-route\b|Cut route/, 'workflow-connection, query-connection, Cut connection'],
  [/\b(graph|workflow|definition|def|drawn|draft|body|entity\.graph)\.routes\b|"routes"\s*:/, 'a graph\'s connections'],
];
/** Kept on purpose: a frozen schema, the record, and the words that say what moved. */
const KEPT = [/^schemas\/(entity|entities|entity-node|entity-filter)\.v1\.json$/, /^schemas\/workflow\.v2\.json$/, /^docs\/history\//,
  /^docs\/(LEXICON|TODO)\.md$/, /^test\/unit\/the-graph-words-hold\.test\.mjs$/];
const ROOTS = ['src', 'schemas', 'mcp-server', 'scripts', 'test', 'docs', 'custom-elements.json', 'vscode.html-data.json'];
const TEXT = /\.(ts|js|mjs|json|html|css|md|yaml)$/;

function* walk(path) {
  if (/node_modules|dist|test-results/.test(path)) return;
  if (statSync(path).isDirectory()) for (const name of readdirSync(path)) yield* walk(join(path, name));
  else if (TEXT.test(path)) yield path;
}

test('no file brings back a name the graph rename retired', () => {
  const back = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      if (KEPT.some((k) => k.test(file))) continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        for (const [rx, now] of RETIRED) if (rx.test(line)) back.push(`${file}:${i + 1}: ${line.trim().slice(0, 100)} — now ${now}`);
      });
    }
  }
  assert.deepEqual(back, []);
});
