/**
 * view-drafts.ts — a DRAFT per View: the filters a reader left on it, unsaved.
 *
 * A View pick puts that View's own filters on, so what a reader had set on the
 * View they left was gone. A draft keeps it, by page and View, for the tab —
 * and across sessions where asked, so a crash loses nothing.
 * TRAP T-a-view-keeps-a-draft
 *
 * Map:
 * - DraftMode — `off`, for this tab (`session`), or across sessions too (`always`).
 * - draftSig — what a View defines, as a string: a draft made over another definition is stale
 * - loadDraft — The draft a reader left on one View, or undefined.
 * - saveDraft — Keep what is on screen as one View's draft.
 * - clearDraft — Forget one View's draft, or every draft of a page.
 */
import type { QueryDefaults } from '../data/query.js';
import { isPlainObject, readJson, removeKey, writeJson, type StorageKind } from './web-storage.js';

/** `off`, for this tab (`session`), or across sessions too (`always`). */
export type DraftMode = 'off' | 'session' | 'always';

/** One page's drafts, by View id. */
type Drafts = Record<string, { query: QueryDefaults; sig: string }>;

const PREFIX = 'sherpa:drafts:';

const read = (kind: StorageKind, page: string): Drafts =>
  readJson<Drafts>(kind, PREFIX + page, {}, (v): v is Drafts => isPlainObject(v));

/** Write a page's drafts, or drop the key when none is left. */
function write(kind: StorageKind, page: string, drafts: Drafts): void {
  if (Object.keys(drafts).length) writeJson(kind, PREFIX + page, drafts);
  else removeKey(kind, PREFIX + page);
}

/** A page's drafts, less one View's. */
const without = (drafts: Drafts, view: string): Drafts =>
  Object.fromEntries(Object.entries(drafts).filter(([id]) => id !== view));

/** What a View defines, as a string: a draft made over another definition is stale. */
export function draftSig(view: { query?: unknown } | undefined): string {
  return JSON.stringify(view?.query ?? null);
}

/**
 * The draft a reader left on one View, or undefined. The tab's own first; the
 * shared one only in `always`. One made over a DIFFERENT definition of the
 * View is dropped: a changed preset must not hide behind an old draft.
 */
export function loadDraft(page: string, view: string, sig: string, mode: DraftMode): QueryDefaults | undefined {
  if (mode === 'off') return undefined;
  for (const kind of (mode === 'always' ? ['session', 'local'] : ['session']) as StorageKind[]) {
    const drafts = read(kind, page);
    const kept = drafts[view];
    if (!kept) continue;
    if (kept.sig === sig && isPlainObject(kept.query) && kept.query.v === 1) return kept.query;
    write(kind, page, without(drafts, view));
  }
  return undefined;
}

/** Keep what is on screen as one View's draft. `session` keeps no shared copy. */
export function saveDraft(page: string, view: string, query: QueryDefaults, sig: string, mode: DraftMode): void {
  if (mode === 'off') return clearDraft(page);
  for (const kind of ['session', 'local'] as StorageKind[]) {
    const drafts = read(kind, page);
    if (kind === 'local' && mode !== 'always') {
      // The reader turned "across sessions" off: nothing of this page stays shared.
      if (Object.keys(drafts).length) removeKey(kind, PREFIX + page);
      continue;
    }
    drafts[view] = { query, sig };
    write(kind, page, drafts);
  }
}

/** Forget one View's draft — a Reset, a Save, a Delete — or every draft of a page. */
export function clearDraft(page: string, view?: string): void {
  for (const kind of ['session', 'local'] as StorageKind[]) {
    if (view == null) {
      removeKey(kind, PREFIX + page);
      continue;
    }
    const drafts = read(kind, page);
    if (view in drafts) write(kind, page, without(drafts, view));
  }
}
