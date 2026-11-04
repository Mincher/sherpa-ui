/**
 * node-files.ts — an app's preset Custom Nodes from a file: JSON (schemas/nodes.v1.json), named
 * by app.json `nodes`. The presets are read only; the reader's own live in the page keeper.
 * TRAP T-a-custom-node-is-an-instance
 *
 * Map:
 * - readLibrary — A library read from JSON, each definition checked alone: the bad reported, the rest kept.
 * - loadNodeLibrary — an app's preset Custom Nodes from a JSON file, each checked, each marked read only
 */
import { report } from '../data/report.js';
import { NODE_KINDS, type NodeKind } from '../data/node-kinds.js';
import { nodeLibraryFaults, type NodeDefinition, type NodeLibrary } from '../data/node-library.js';
import { isNodeEntry } from '../data/node-shelf.js';

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** A library read from JSON. Each definition is checked alone, over those already kept, so one
 *  bad one is reported in the checks' own words and the rest still load; a use of one defined
 *  later is tried again once that one is in. `preset` marks them read only. */
export function readLibrary(read: unknown, kinds: Readonly<Record<string, NodeKind>> = NODE_KINDS, { preset = false }: { preset?: boolean } = {}): NodeLibrary {
  const nodes = isObject(read) && read['v'] === 1 && isObject(read['nodes']) ? read['nodes'] : undefined;
  if (!nodes) {
    report({ code: 'node-library', message: 'loadNodeLibrary: it is not a Custom Node library: a v1 with its nodes by id.', at: {} });
    return { v: 1, nodes: {} };
  }
  const kept: Record<string, NodeDefinition> = {};
  let waiting = Object.entries(nodes);
  let faults = new Map<string, string[]>();
  for (let moved = true; moved && waiting.length;) {
    moved = false;
    faults = new Map();
    const next: typeof waiting = [];
    for (const [id, definition] of waiting) {
      const found = isNodeEntry(definition) ? nodeLibraryFaults({ v: 1, nodes: { ...kept, [id]: definition as NodeDefinition } }, kinds) : ['it is not a definition: a v1 with a name, its inputs, outputs and nodes'];
      if (found.length) {
        faults.set(id, found);
        next.push([id, definition]);
        continue;
      }
      const { $schema: _schema, ...rest } = definition as NodeDefinition;
      kept[id] = preset ? { ...rest, preset: true } : rest;
      moved = true;
    }
    waiting = next;
  }
  for (const [id, found] of faults) {
    for (const fault of found) report({ code: 'node-library', message: `loadNodeLibrary: ${fault}, so "${id}" is left out.`, at: { node: id } });
  }
  return { v: 1, nodes: kept };
}


/**
 * An app's preset Custom Nodes from a JSON file, each marked `preset` (read only). A definition
 * that fails the checks is reported in their words and left out, and the rest still load; so
 * does a file that cannot be read, which answers an empty library. `kinds` adds the app's own
 * kinds to the shipped ones, for the bodies' checks.
 */
export async function loadNodeLibrary(url: string | URL, kinds?: Readonly<Record<string, NodeKind>>): Promise<NodeLibrary> {
  let read: unknown;
  try {
    const response = await fetch(new URL(url, document.baseURI));
    if (!response.ok) throw new Error(`${response.status}`);
    read = await response.json();
  } catch (error) {
    report({ code: 'node-library', message: `loadNodeLibrary: the file could not be read (${error instanceof Error ? error.message : String(error)}).`, at: { url: String(url) } });
    return { v: 1, nodes: {} };
  }
  return readLibrary(read, kinds, { preset: true });
}
