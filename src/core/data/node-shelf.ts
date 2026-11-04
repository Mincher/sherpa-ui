/**
 * node-shelf.ts — where an app's Custom Nodes come together: the presets a file ships, read
 * only, and the reader's own, app-wide (D13). A custom id may not clash with a preset or a
 * shipped kind: a custom node overrides nothing. DOM-free. Plan 713 §9.4, M12
 *
 * Map:
 * - NodeShelf — What an editor is handed: the library as it is now, save one, remove one.
 * - isNodeEntry — Whether a stored value has the SHAPE of a definition; the persist guard.
 * - joinLibrary — The presets and the reader's nodes as one library; a clash with a preset or the given kinds is left out.
 */
import type { NodeKind } from './node-kinds.js';
import type { NodeDefinition, NodeLibrary } from './node-library.js';

/** What an editor is handed: the library as it is now (presets and the reader's), save one,
 *  remove one. Save and remove answer whether it was done; the reason is reported. */
export interface NodeShelf {
  library(): NodeLibrary;
  save(id: string, definition: NodeDefinition): Promise<boolean>;
  remove(id: string): boolean;
  /** Called with the library whenever it changes here, and when another tab changes it. Stops on the signal. */
  watch(handler: (library: NodeLibrary) => void, signal?: AbortSignal): void;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Whether a stored value has the SHAPE of a definition: a v1 with a name and its lists. */
export function isNodeEntry(value: unknown): boolean {
  return isObject(value) && value['v'] === 1 && typeof value['label'] === 'string' && !!value['label'].trim()
    && Array.isArray(value['inputs']) && Array.isArray(value['outputs']) && Array.isArray(value['nodes']);
}

/** The presets and the reader's nodes as one library. A preset is marked read only; a custom
 *  node whose id a preset or one of the given kinds holds is left out, so it overrides nothing
 *  (a shipped kind's id is refused at save, and `kindsOf` leaves it out). */
export function joinLibrary(presets: NodeLibrary | undefined, mine: Readonly<Record<string, NodeDefinition>> = {}, kinds: Readonly<Record<string, NodeKind>> = {}): NodeLibrary {
  const given = presets?.nodes ?? {};
  const own = Object.entries(mine).filter(([id]) => !(id in given) && !(id in kinds && kinds[id]!.model !== 'graph'));
  return {
    v: 1,
    // The presets first, as the file orders them, then the reader's.
    nodes: { ...Object.fromEntries(Object.entries(given).map(([id, d]) => [id, { ...d, preset: true as const }])), ...Object.fromEntries(own) },
  };
}
