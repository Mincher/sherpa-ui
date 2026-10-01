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
