import { test, expect } from '@playwright/test';

/**
 * THE TEMPLATER — Will, TODO 68 and 27. A component's markup and sheets come
 * from one imported helper, not the base class: fetched once, a consumer's own
 * when given (their sheets AFTER the component's, so they win), and fetched
 * again on a reload — a sheet in place, the markup stamped again.
 * TRAP T-a-templater-owns-the-files
 *
 * The files are served by `page.route`, so a reload has something new to find.
 */
const HARNESS = '/test/reforged/harness.html';

const TAG = `<template id="default">
  <span class="pill sherpa-border-edges" part="pill">
    <span class="icon" part="icon" aria-hidden="true"><slot name="icon"><i class="glyph"></i></slot></span>
    <span><slot></slot></span><b class="mine">WORDS</b>
  </span>
</template>
<template id="dismissible"><span class="pill" part="pill"><slot></slot></span></template>`;

test('your own markup and sheets: yours drawn, yours last, and what it lacks is reported', async ({ page }) => {
  let css = ':host { outline: 3px solid rgb(1, 2, 3); }';
  let html = TAG.replace('WORDS', 'one');
  await page.route('**/own/tag.css', (route) => route.fulfill({ contentType: 'text/css', body: css }));
  await page.route('**/own/tag.html', (route) => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);

  const read = () => page.evaluate(() => {
    const el = document.querySelector('#root sherpa-tag')!;
    const sheets = el.shadowRoot!.adoptedStyleSheets;
    return {
      words: el.shadowRoot!.querySelector('.mine')?.textContent ?? null,
      outline: getComputedStyle(el).outlineColor,
      last: sheets.at(-1)?.cssRules[0]?.cssText ?? '',
      count: sheets.length,
    };
  });

  const r = await page.evaluate(async () => {
    const { useTemplate } = await import('/dist/core/ui/templater.js') as unknown as {
      useTemplate(tag: string, files: { html?: string; css?: string }): void;
    };
    const { onReport } = await import('/dist/data.js') as unknown as {
      onReport(fn: (r: { code: string; at?: Record<string, string> }) => void): () => void;
    };
    const reports: { code: string; at?: Record<string, string> }[] = [];
    onReport((rep) => reports.push(rep));
    useTemplate('sherpa-tag', { html: '/own/tag.html', css: '/own/tag.css' });
    const el = document.createElement('sherpa-tag');
    el.textContent = 'Pro';
    document.getElementById('root')!.appendChild(el);
    await (el as HTMLElement & { rendered: Promise<void> }).rendered;
    await new Promise((res) => setTimeout(res, 50));
    return { reports };
  });
  const first = await read();
  expect(first.words).toBe('one');
  expect(first.outline).toBe('rgb(1, 2, 3)');
  expect(first.last).toContain('outline');
  // Its dismissible template lost its icon and its close button: reported, not thrown.
  expect(r.reports.map((x) => x.code)).toEqual(['template-missing']);
  expect(r.reports[0]!.at!['missing']).toContain('dismissible: part=icon');
  expect(r.reports[0]!.at!['missing']).toContain('dismissible: .close');

  // A RELOAD: the sheet changes in place; the markup is stamped again.
  css = ':host { outline: 3px solid rgb(4, 5, 6); }';
  html = TAG.replace('WORDS', 'two');
  await page.evaluate(async () => {
    const { SherpaElement } = await import('/dist/core/ui/sherpa-element.js') as unknown as {
      SherpaElement: { reload(tag?: string): Promise<void> };
    };
    await SherpaElement.reload('sherpa-tag');
  });
  const second = await read();
  expect(second).toEqual({ ...first, words: 'two', outline: 'rgb(4, 5, 6)', last: expect.stringContaining('4, 5, 6') });
});

test('a component with no files of yours is drawn as before, from one fetch per file', async ({ page }) => {
  const fetched: string[] = [];
  page.on('request', (req) => { if (/sherpa-badge\.(html|css)$/.test(req.url())) fetched.push(req.url().split('/').at(-1)!); });
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const els = [1, 2, 3].map((n) => {
      const el = document.createElement('sherpa-badge');
      el.setAttribute('data-value', String(n));
      root.appendChild(el);
      return el as HTMLElement & { rendered: Promise<void> };
    });
    await Promise.all(els.map((el) => el.rendered));
    const sheets = els.map((el) => el.shadowRoot!.adoptedStyleSheets);
    // ONE sheet object each, shared by all three.
    return { same: sheets.every((s) => s.length === sheets[0]!.length && s.every((x, i) => x === sheets[0]![i])), drawn: els.every((el) => el.shadowRoot!.children.length > 0) };
  });
  expect(r).toEqual({ same: true, drawn: true });
  expect(fetched.sort()).toEqual(['sherpa-badge.css', 'sherpa-badge.html']);
});
