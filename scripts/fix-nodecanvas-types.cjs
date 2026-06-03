#!/usr/bin/env node
/**
 * Adds explicit types to sherpa-node-canvas.ts.
 * Edge, Viewport, DragState, NodeDragState, PanState, DrillFrame interfaces already exist.
 */

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../components/sherpa-node-canvas/sherpa-node-canvas.ts');
let src = fs.readFileSync(file, 'utf8');

// ---------- function params ----------
const paramFixes = [
  [/setSelectedNode\(nodeId\)\s*\{/, 'setSelectedNode(nodeId: string | null): void {'],
  [/removeNode\(nodeId\)\s*\{/, 'removeNode(nodeId: string): void {'],
  [/setSelectedEdge\(idx\)\s*\{/, 'setSelectedEdge(idx: number): void {'],
  [/#socketType\(sock\)\s*\{/, '#socketType(sock: HTMLElement): string {'],
  [/#findEdgeEndingAt\(nodeId, portName, clientX, clientY\)\s*\{/, '#findEdgeEndingAt(nodeId: string, portName: string, clientX: number, clientY: number): number {'],
  [/#findEdgeAt\(clientX, clientY\)\s*\{/, '#findEdgeAt(clientX: number, clientY: number): number {'],
  [/#edgeScreenSamples\(edgeIdx\)\s*\{/, '#edgeScreenSamples(edgeIdx: number): Array<[number, number]> {'],
  [/#subgraphHasSourceToOutput\(snap\)\s*\{/, '#subgraphHasSourceToOutput(snap: unknown): boolean {'],
  [/#resolveColor\(varName, fallback\)\s*\{/, '#resolveColor(varName: string, fallback: string): string {'],
  [/#edgeColor\(edgeIdx, palette, state\)\s*\{/, '#edgeColor(edgeIdx: number, palette: Record<string, string>, state: string): string {'],
  [/#strokeEdge\(ctx, edgeIdx, counts, color, width\)\s*\{/, '#strokeEdge(ctx: CanvasRenderingContext2D, edgeIdx: number, counts: Map<string, number>, color: string, width: number): void {'],
  [/pushSubgraph\(parentId, label\)\s*\{/, 'pushSubgraph(parentId: string, label: string): void {'],
  [/forgetSubgraph\(parentId\)\s*\{/, 'forgetSubgraph(parentId: string): void {'],
  [/getSubgraphCache\(parentId\)\s*\{/, 'getSubgraphCache(parentId: string): unknown {'],
  [/setSubgraphCache\(parentId, snapshot\)\s*\{/, 'setSubgraphCache(parentId: string, snapshot: unknown): void {'],
  [/#labelForNode\(nodeId\)\s*\{/, '#labelForNode(nodeId: string): string {'],
  [/#restore\(snap\)\s*\{/, '#restore(snap: unknown): void {'],
];

for (const [pattern, replacement] of paramFixes) {
  src = src.replace(pattern, replacement);
}

// ---------- module-level free functions ----------
// cubic, pointSegDist, edgeColor
src = src.replace(
  /^function cubic\(t, x0, y0, cx1, cy1, cx2, cy2, x1, y1\)/m,
  'function cubic(t: number, x0: number, y0: number, cx1: number, cy1: number, cx2: number, cy2: number, x1: number, y1: number): [number, number]'
);
src = src.replace(
  /^function pointSegDist\(px, py, x0, y0, x1, y1\)/m,
  'function pointSegDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number'
);
src = src.replace(
  /^function edgeColor\(edge, base, control\)/m,
  'function edgeColor(edge: Edge, base: string, control: string): string'
);

// ---------- sock.dataset accesses ----------
src = src.replace(/\bsock\.dataset\["direction"\]/g, '(sock as HTMLElement).dataset["direction"]');
src = src.replace(/\bsock\.dataset\["portName"\]/g, '(sock as HTMLElement).dataset["portName"]');
src = src.replace(/\bsock\.dataset\["socket"\]/g, '(sock as HTMLElement).dataset["socket"]');
src = src.replace(/\bsock\.getBoundingClientRect\(\)/g, '(sock as HTMLElement).getBoundingClientRect()');

// ---------- n.dataset / n.localName on EventTarget / Node ----------
src = src.replace(/\bn\.dataset\b/g, '(n as HTMLElement).dataset');
src = src.replace(/\bn\.localName\b/g, '(n as HTMLElement).localName');
src = src.replace(/\bn\.tagName\b/g, '(n as HTMLElement).tagName');

// ---------- snap typed accesses ----------
// snap.nodes, snap.edges, snap.viewport
src = src.replace(/\(snap as any\)\.(nodes|edges|viewport)/g, '(snap as Record<string, unknown>)["$1"]');
src = src.replace(/\bsnap\.(nodes|edges|viewport)\b/g, '(snap as Record<string, unknown>)["$1"]');

// ---------- e.from / e.to typed accesses ----------
// Edge already has `from: EdgeEndpoint; to: EdgeEndpoint`
// e.from.nodeId should work once setEdges param is typed

// ---------- #drivenInputs items ----------
src = src.replace(/this\.#drivenInputs = new Set\(\)/g, 'this.#drivenInputs = new Set<string>()');

// ---------- colorProbeEl typed ----------
src = src.replace(/\b#colorProbeEl;/g, '#colorProbeEl: HTMLElement | null = null;');
src = src.replace(/\bthis\.#colorProbeEl = /g, 'this.#colorProbeEl = ');

// ---------- private #multiCounts inner function ----------
src = src.replace(/const counts = new Map\(\)/, 'const counts = new Map<string, number>()');

// ---------- setEdges / setNodes param types ----------
src = src.replace(/\bsetEdges\(edges\)\s*\{/, 'setEdges(edges: Edge[]): void {');
src = src.replace(/\bsetNodes\??\(nodes\)\s*\{/, 'setNodes(nodes: HTMLElement[]): void {');

// ---------- getContext for canvas ----------
src = src.replace(
  /this\.els\.gridCanvas\b([^.]*?)\.getContext\("2d"\)/g,
  'this.els.gridCanvas$1?.getContext("2d") ?? null'
);
src = src.replace(
  /this\.els\.edgesCanvas\b([^.]*?)\.getContext\("2d"\)/g,
  'this.els.edgesCanvas$1?.getContext("2d") ?? null'
);

fs.writeFileSync(file, src);
console.log('node-canvas types applied');
