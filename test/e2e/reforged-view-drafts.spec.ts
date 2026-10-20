import { test, expect } from './fixture';

test('a draft made over another definition of its View is dropped, not applied', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  const r = await page.evaluate(async () => {
    const d = await import('/dist/core/browser/view-drafts.js') as {
      saveDraft(p: string, v: string, q: unknown, sig: string, m: string): void;
      loadDraft(p: string, v: string, sig: string, m: string): unknown;
      clearDraft(p: string, v?: string): void;
      draftSig(view: unknown): string;
    };
    const query = { v: 1, scopes: { view: { holds: ['region'], where: { region: { eq: 'EMEA' } } } } };
    const sig = d.draftSig({ query: { v: 1, scopes: {} } });
    d.saveDraft('page', 'risk', query, sig, 'session');
    const same = d.loadDraft('page', 'risk', sig, 'session');
    // The View's own definition changed: the old draft must not hide it.
    const changed = d.loadDraft('page', 'risk', d.draftSig({ query: { v: 1, scopes: { view: { holds: [] } } } }), 'session');
    const after = d.loadDraft('page', 'risk', sig, 'session');
    // Off reads nothing; a write while off forgets the page.
    d.saveDraft('page', 'all', query, sig, 'session');
    const off = d.loadDraft('page', 'all', sig, 'off');
    d.saveDraft('page', 'all', query, sig, 'off');
    return { same, changed, after, off, gone: d.loadDraft('page', 'all', sig, 'session'),
      stored: [sessionStorage.getItem('sherpa:drafts:page'), localStorage.getItem('sherpa:drafts:page')] };
  });
  expect(r.same).toEqual({ v: 1, scopes: { view: { holds: ['region'], where: { region: { eq: 'EMEA' } } } } });
  expect(r.changed).toBeUndefined();
  expect(r.after).toBeUndefined();
  expect(r.off).toBeUndefined();
  expect(r.gone).toBeUndefined();
  expect(r.stored).toEqual([null, null]);
});

/* A draft is the TAB's: a filter setup crosses tabs and sessions only once it is
   saved (Will, 2026-10-20). A shared copy an older build left is never read, and
   goes at the next write. TRAP T-a-view-keeps-a-draft */
test('a draft is the tab\'s alone: a shared copy is never read, and goes', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  const r = await page.evaluate(async () => {
    const d = await import('/dist/core/browser/view-drafts.js') as {
      saveDraft(p: string, v: string, q: unknown, sig: string, m: string): void;
      loadDraft(p: string, v: string, sig: string, m: string): unknown;
      draftSig(view: unknown): string;
    };
    const sig = d.draftSig({ query: { v: 1, scopes: {} } });
    const query = { v: 1, scopes: { view: { holds: ['region'] } } };
    localStorage.setItem('sherpa:drafts:shared', JSON.stringify({ risk: { query, sig } }));
    const read = d.loadDraft('shared', 'risk', sig, 'session');
    d.saveDraft('shared', 'all', query, sig, 'session');
    return { read, shared: localStorage.getItem('sherpa:drafts:shared'), tab: !!sessionStorage.getItem('sherpa:drafts:shared') };
  });
  expect(r).toEqual({ read: undefined, shared: null, tab: true });
});
