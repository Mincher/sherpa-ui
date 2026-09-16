/**
 * Keep a DataSource's view state across a page reload.
 *
 * An accidental refresh throws away every filter, sort and page a person set,
 * and they start again. This is the smallest thing that stops that.
 *
 *   const off = persistViewState(source, 'records');
 *
 * It is a HELPER, not a feature of `DataSource`. Where a view state is kept —
 * and whether it should survive a reload at all — is the host's decision: a
 * dashboard may want it, a wizard may not, and a saved-views table on a server
 * is a third answer. A source that wrote to storage itself would make that
 * choice for every app that ever binds one.
 *
 * `sessionStorage` BY DEFAULT, and that is the important part: two tabs on the
 * same screen filtered differently is a feature, not a bug, and `localStorage`
 * would make them fight. Pass `{ shared: true }` for the rarer case where a
 * filter genuinely belongs to the person rather than to the tab.
 */
import type { DataSource, ViewState } from './data-source.js';

export interface PersistOptions {
  /**
   * Share the state across TABS via localStorage rather than keeping it per
   * tab. Off by default — see the note above.
   */
  shared?: boolean;
}

/** The key prefix, so a host's own storage keys cannot collide with these. */
const PREFIX = 'sherpa:view:';

/**
 * Web Storage throws in a private window, with site data blocked, and during
 * preview or thumbnail capture — so every access is wrapped. A failure means
 * the state is not kept, never that the page breaks.
 */
function storage(shared: boolean): Storage | null {
  try {
    return shared ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Restore `source` from storage, then keep it saved.
 *
 * Returns a function that stops saving — call it when the view is torn down,
 * the same way `bind()`'s return value is used.
 */
export function persistViewState(
  source: DataSource,
  name: string,
  options: PersistOptions = {},
): () => void {
  const store = storage(options.shared ?? false);
  const key = PREFIX + name;
  if (!store) return () => {};

  // RESTORE FIRST, so the source loads once with the remembered state rather
  // than loading empty and then loading again.
  try {
    const raw = store.getItem(key);
    if (raw) source.setState(JSON.parse(raw) as Partial<ViewState>);
  } catch {
    // Unreadable or not JSON — a state that cannot be restored is one the user
    // starts without, which is exactly where they were before this existed.
    try { store.removeItem(key); } catch { /* storage unavailable */ }
  }

  // …then save on every change. `change` fires after a load completes, which is
  // the only moment the state is both settled and known to be loadable.
  const save = (): void => {
    try {
      store.setItem(key, JSON.stringify(source.state));
    } catch {
      // Quota, or storage revoked mid-session. Not keeping the state is a
      // smaller problem than throwing inside an event handler.
    }
  };
  source.addEventListener('change', save);

  return () => source.removeEventListener('change', save);
}

/** Forget a saved view state — what a "reset this view" action does. */
export function clearViewState(name: string, options: PersistOptions = {}): void {
  try {
    storage(options.shared ?? false)?.removeItem(PREFIX + name);
  } catch {
    /* storage unavailable */
  }
}
