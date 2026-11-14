/**
 * graph-drafts.ts — where a tab keeps the reader's unsaved draft of a graph: the editor writes it, an act reads it.
 * TRAP T-a-draft-hides-a-save
 *
 * Map:
 * - keepDraft — Keep a graph's draft for this tab, across a reload: its pointer, with a draft kept before restored.
 * - draftOf — The reader's unsaved draft of a graph in this tab, from before a reload too; none, none.
 */
import type { WorkflowDefinition } from '../data/workflow.js';
import type { SessionStore } from './session.js';

const pointerOf = (id: string): string => `/workflows/${id}`;
/** A draft of this graph: its id, v3 and its nodes. */
const isDraftOf = (id: string) => (v: unknown): v is WorkflowDefinition => {
  const d = v as { v?: unknown; id?: unknown; nodes?: unknown } | null;
  return !!d && typeof d === 'object' && d.v === 3 && d.id === id && Array.isArray(d.nodes);
};

/** Keep a graph's draft for this tab, across a reload: its pointer, with a draft kept before restored. */
export function keepDraft(session: SessionStore | undefined, id: string): string {
  const pointer = pointerOf(id);
  session?.persist(pointer, { shared: false, guard: isDraftOf(id) });
  return pointer;
}

/** The reader's unsaved draft of a graph in this tab, from before a reload too; none, none. */
export function draftOf(session: SessionStore, id: string): WorkflowDefinition | undefined {
  // Nothing held yet this load: a draft kept before the reload is restored, as the editor would.
  if (session.get(pointerOf(id)) === undefined) keepDraft(session, id);
  const draft = session.get(pointerOf(id));
  return isDraftOf(id)(draft) ? draft : undefined;
}
