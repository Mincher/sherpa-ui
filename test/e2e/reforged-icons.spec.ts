import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every Font Awesome class in the repo must actually RENDER.
 *
 * This exists because a PRO class in the free webfont fails SILENTLY: no glyph,
 * no fallback box, no console warning — `content: none` and zero width, so the
 * button ships blank and looks like a spacing bug. Two shipped that way before
 * anyone noticed:
 *
 *   fa-bell-on    (app header notifications) — Figma's `bell-ring`
 *   fa-sliders-up (filter toolbar configure) — Figma's `sliders-up`
 *
 * Both are real icons; both are Pro. The class name gives no hint, which is why
 * this has to be MEASURED rather than reviewed.
 *
 * The test scans the source itself rather than taking a hand-kept list, so a new
 * icon is covered the moment it is written.
 */

const HARNESS = '/test/reforged/harness.html';

const ROOT = join(import.meta.dirname, '../..');
const SCAN = ['src', 'examples'];
const EXT = /\.(html|ts|js|css)$/;
const FA = /fa-(?:solid|regular|brands) fa-[a-z0-9-]+/g;

/** Every `fa-<style> fa-<name>` pair written anywhere in the scanned trees. */
function collectClasses(): string[] {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (EXT.test(entry)) {
        for (const m of readFileSync(path, 'utf8').matchAll(FA)) found.add(m[0]);
      }
    }
  };
  for (const d of SCAN) walk(join(ROOT, d));
  return [...found].sort();
}

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('every Font Awesome class in the repo renders a real glyph', async ({ page }) => {
  const classes = collectClasses();
  // A scan that finds nothing would pass vacuously.
  expect(classes.length).toBeGreaterThan(20);

  const broken = await page.evaluate(async (list: string[]) => {
    // Measured inside a COMPONENT's shadow root, not the document: the Font
    // Awesome sheet is adopted through SherpaElement.sharedStyles and is not in
    // the harness document at all, so probing there reports every class missing.
    const btn = document.createElement('sherpa-button') as HTMLElement & {
      rendered?: Promise<void>;
    };
    btn.setAttribute('data-type', 'icon');
    document.getElementById('root')!.appendChild(btn);
    await btn.rendered;
    await document.fonts.ready;

    const i = btn.shadowRoot!.querySelector('i.icon-start')!;
    const bad: { cls: string; content: string }[] = [];
    for (const cls of list) {
      i.className = `icon icon-start ${cls}`;
      // Force a style recalculation between probes.
      void (i as HTMLElement).offsetWidth;
      const content = getComputedStyle(i, '::before').content;
      // `none` means NO RULE MATCHED — the class does not exist in this font.
      //
      // NOT a test for `""`: a working glyph also reports `""`, because its
      // codepoint is in a private-use area that does not print. Checking for an
      // empty string flags every icon in the repo as broken.
      if (content === 'none') bad.push({ cls, content });
    }
    return bad;
  }, classes);

  expect(broken, `Font Awesome classes that render NOTHING (likely Pro-only):\n${
    broken.map((b) => `  ${b.cls}`).join('\n')
  }`).toEqual([]);
});
