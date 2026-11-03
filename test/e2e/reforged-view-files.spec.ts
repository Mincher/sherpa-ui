import { test, expect } from './harness';

/**
 * A PAGE'S VIEWS FROM FILES — Will, TODO 185: views are JSON, and "should
 * point to an HTML file, in the same folder, that contains the template.
 * Target the template via ID." TRAP T-a-views-markup-lives-in-a-template
 */
test('a view that names a template gets its markup as content; a missing one is reported', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { loadViewLibrary, onReport } = await import('/dist/index.js') as unknown as {
      loadViewLibrary(url: string): Promise<Record<string, { content?: string; label: string }>>;
      onReport(sink: ((issue: { code: string }) => void) | null): () => void;
    };
    const heard: string[] = [];
    const stop = onReport((issue) => heard.push(issue.code));
    const views = await loadViewLibrary('/test/reforged/views/demo-views.json');
    stop();
    return {
      labels: Object.values(views).map((v) => v.label),
      capacity: views['capacity']!.content?.includes('id="c-hist"'),
      all: 'content' in views['all']!,
      lost: 'content' in views['lost']!,
      heard,
    };
  });
  expect(r.labels).toEqual(['All', 'Capacity', 'Lost']);
  expect(r.capacity).toBe(true);
  expect([r.all, r.lost]).toEqual([false, false]);
  expect(r.heard).toEqual(['unknown-template']);
});

/** The library's schema is views.v1.json: its own `$schema` is no View, and one
 *  that is not a View is reported and left out. Plan 695 D1 */
test('a views file may name its schema; a view with no label is reported and left out', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { loadViewLibrary, onReport } = await import('/dist/index.js') as unknown as {
      loadViewLibrary(url: string): Promise<Record<string, { label: string }>>;
      onReport(sink: ((issue: { code: string; at?: Record<string, unknown> }) => void) | null): () => void;
    };
    const heard: unknown[] = [];
    const stop = onReport((issue) => heard.push([issue.code, issue.at?.['view']]));
    const views = await loadViewLibrary('/test/reforged/views/broken-views.json');
    stop();
    return { ids: Object.keys(views), heard };
  });
  expect(r.ids).toEqual(['ok']);
  expect(r.heard).toEqual([['view-invalid', 'nameless']]);
});
