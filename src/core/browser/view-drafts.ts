/**
 * view-drafts.ts — a DRAFT per View: the filters a reader left on it, unsaved.
 *
 * A View pick puts that View's own filters on, so what a reader had set on the
 * View they left was gone. A draft keeps it, by page and View, for the TAB only:
 * a filter setup crosses tabs, windows and sessions only once the reader saves
 * it (Will, 2026-10-20). TRAP T-a-view-keeps-a-draft
 *
 * Map:
 * - DraftMode — `off`, or for this tab (`session`).
 * - draftSig — what a View defines, as a string: a draft made over another definition is stale
 * - loadDraft — The draft a reader left on one View, or undefined.
 * - saveDraft — Keep what is on screen as one View's draft.
 * - clearDraft — Forget one View's draft, or every draft of a page.
 */
import type { QueryDefaults } from '../data/query.js';
import { isPlainObject, readJson, removeKey, writeJson } from './web-storage.js';

/** `off`, or for this tab (`session`). */
export type DraftMode = 'off' | 'session';

/** One page's drafts, by View id. */
type Drafts = Record<string, { query: QueryDefaults; sig: string }>;

const PREFIX = 'sherpa:drafts:';

const read = (page: string): Drafts =>
  readJson<Drafts>('session', PREFIX + page, {}, (v): v is Drafts => isPlainObject(v));

/** Write a page's drafts, or drop the key when none is left. */
function write(page: string, drafts: Drafts): void {
  if (Object.keys(drafts).length) writeJson('session', PREFIX + page, drafts);
  else removeKey('session', PREFIX + page);
}

/** A page's drafts, less one View's. */
const without = (drafts: Drafts, view: string): Drafts =>
  Object.fromEntries(Object.entries(drafts).filter(([id]) => id !== view));

/** What a View defines, as a string: a draft made over another definition is stale. */
export function draftSig(view: { query?: unknown } | undefined): string {
  return JSON.stringify(view?.query ?? null);
}

/**
 * The draft a reader left on one View in this tab, or undefined. One made over
 * a DIFFERENT definition of the View is dropped: a changed preset must not hide
 * behind an old draft.
 */
export function loadDraft(page: string, view: string, sig: string, mode: DraftMode): QueryDefaults | undefined {
  if (mode === 'off') return undefined;
  const drafts = read(page);
  const kept = drafts[view];
  if (!kept) return undefined;
  if (kept.sig === sig && isPlainObject(kept.query) && kept.query.v === 1) return kept.query;
  write(page, without(drafts, view));
  return undefined;
}

/** Keep what is on screen as one View's draft, for this tab. */
export function saveDraft(page: string, view: string, query: QueryDefaults, sig: string, mode: DraftMode): void {
  if (mode === 'off') return clearDraft(page);
  const drafts = read(page);
  drafts[view] = { query, sig };
  write(page, drafts);
  // A shared copy an older build kept across sessions goes.
  removeKey('local', PREFIX + page);
}

/** Forget one View's draft — a Reset, a Save, a Delete — or every draft of a page. */
export function clearDraft(page: string, view?: string): void {
  removeKey('local', PREFIX + page);
  if (view == null) {
    removeKey('session', PREFIX + page);
    return;
  }
  const drafts = read(page);
  if (view in drafts) write(page, without(drafts, view));
}
