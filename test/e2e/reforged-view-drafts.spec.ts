import { test, expect } from '@playwright/test';

test('a draft made over another definition of its View is dropped, not applied', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  const r = await page.evaluate(async () => {
    const d = await import('/dist/core/browser/view-drafts.js') as {
      saveDraft(p: string, v: string, q: unknown, sig: string, m: string): void;
      loadDraft(p: string, v: string, sig: string, m: string): unknown;
      clearDraft(p: string, v?: string): void;
      draftSig(view: unknown): string;
    };
    const query = { v: 1, scopes: { view: { holds: ['region'], readings: { region: { picked: ['EMEA'] } } } } };
    const sig = d.draftSig({ query: { v: 1, scopes: {} } });
    d.saveDraft('page', 'risk', query, sig, 'always');
    const same = d.loadDraft('page', 'risk', sig, 'always');
    // The View's own definition changed: the old draft must not hide it.
    const changed = d.loadDraft('page', 'risk', d.draftSig({ query: { v: 1, scopes: { view: { holds: [] } } } }), 'always');
    const after = d.loadDraft('page', 'risk', sig, 'always');
    // Off reads nothing; a write while off forgets the page.
    d.saveDraft('page', 'all', query, sig, 'always');
    const off = d.loadDraft('page', 'all', sig, 'off');
    d.saveDraft('page', 'all', query, sig, 'off');
    return { same, changed, after, off, gone: d.loadDraft('page', 'all', sig, 'always'),
      stored: [sessionStorage.getItem('sherpa:drafts:page'), localStorage.getItem('sherpa:drafts:page')] };
  });
  expect(r.same).toEqual({ v: 1, scopes: { view: { holds: ['region'], readings: { region: { picked: ['EMEA'] } } } } });
  expect(r.changed).toBeUndefined();
  expect(r.after).toBeUndefined();
  expect(r.off).toBeUndefined();
  expect(r.gone).toBeUndefined();
  expect(r.stored).toEqual([null, null]);
});
