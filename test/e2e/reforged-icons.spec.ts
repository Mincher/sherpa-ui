import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every icon NAME written in the repo must draw something.
 *
 * An unknown name fails SILENTLY: `renderIcon` leaves the wrapper empty rather
 * than drawing the wrong thing, so the button ships blank and reads as a
 * spacing bug. That is the same failure the Font Awesome era had — a Pro class
 * in the free webfont gave `content: none`, zero width and no warning — and
 * `fa-bell-on` and `fa-sliders-up` both shipped that way before anyone noticed.
 *
 * The names are Figma's now (`src/icons/`, baked into `icon-paths.ts` with each
 * drawing's own ink box). The `fa-` spelling and its alias map are gone.
 *
 * The test scans the source itself rather than taking a hand-kept list, so a
 * new icon is covered the moment it is written.
 */

const HARNESS = '/test/reforged/harness.html';

const ROOT = join(import.meta.dirname, '../..');
const SCAN = ['src', 'examples'];
const EXT = /\.(html|ts|js)$/;
/** `data-icon="x"`, `data-icon-start="x"`, `data-icon-end="x"`, `icon: 'x'`. */
const NAMED = /(?:data-icon(?:-start|-end)?=|icon:\s*)['"]([a-z0-9][a-z0-9-]*)['"]/g;

/** Every icon name written anywhere in the scanned trees. */
function collectNames(): string[] {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (EXT.test(entry)) {
        for (const m of readFileSync(path, 'utf8').matchAll(NAMED)) found.add(m[1]!);
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

test('every icon name in the repo draws a real glyph', async ({ page }) => {
  const names = collectNames();
  // A scan that finds nothing would pass vacuously.
  expect(names.length).toBeGreaterThan(20);

  const broken = await page.evaluate(async (list: string[]) => {
    const mod = await import('/dist/core/ui/render-icon.js');
    const box = document.createElement('span');
    document.getElementById('root')!.appendChild(box);

    const bad: string[] = [];
    for (const name of list) {
      box.replaceChildren();
      mod.renderIcon(box, name);
      // An unknown name leaves the wrapper EMPTY — that is the silent failure.
      const path = box.querySelector('svg path, svg circle, svg rect');
      if (!path) bad.push(name);
    }
    return bad;
  }, names);

  expect(broken, `icon names that draw NOTHING:\n${broken.map((b) => `  ${b}`).join('\n')}`)
    .toEqual([]);
});

test('the Font Awesome vocabulary is gone', async () => {
  // The alias map resolved 28 FA names to Figma drawings while call sites were
  // migrated. Every one has been renamed, so a new `fa-` value would resolve to
  // nothing at all rather than silently falling back.
  const FA = /fa-(?:solid|regular|brands) fa-[a-z0-9-]+/g;
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (EXT.test(entry)) {
        for (const m of readFileSync(path, 'utf8').matchAll(FA)) hits.push(`${path}: ${m[0]}`);
      }
    }
  };
  for (const d of SCAN) walk(join(ROOT, d));

  expect(hits, `Font Awesome class pairs left:\n${hits.join('\n')}`).toEqual([]);
});
