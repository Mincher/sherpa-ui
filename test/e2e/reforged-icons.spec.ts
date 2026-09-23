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

/**
 * NO COMPONENT RENDERS AN ICON NAME AS TEXT.
 *
 * The failure this catches is silent by construction: a name is a valid string
 * to print, so a component that picks the wrong branch shows a plausible word
 * instead of a drawing and every assertion still passes. That is exactly how
 * `sherpa-nav`'s brand tile came to display "group".
 * TRAP T-an-icon-is-known-by-the-set-not-its-spelling
 *
 * Deliberately broad: it walks every shadow root rather than naming components,
 * so a new one is covered without being listed.
 */
test('no rendered leaf is an icon name in plain text', async ({ page }) => {
  const wordy = await page.evaluate(async () => {
    const mod = await import('/dist/render-icon.js').catch(() =>
      import('/dist/core/ui/render-icon.js'),
    ) as { hasIcon: (v: string) => boolean };

    const root = document.getElementById('root')!;
    root.replaceChildren();
    // One of each component that takes an icon through a different path.
    root.innerHTML = [
      '<sherpa-button data-icon-start="gear">Go</sherpa-button>',
      '<sherpa-chip data-icon="price-tag" data-label="Tag"></sherpa-chip>',
      '<sherpa-tag data-icon="star" data-label="Star"></sherpa-tag>',
      '<sherpa-container-header data-icon="home" data-heading="Home"></sherpa-container-header>',
      '<sherpa-nav></sherpa-nav>',
    ].join('');
    const navEl = root.querySelector('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>; populate?: (d: unknown) => void;
    };
    await Promise.all(
      [...root.querySelectorAll('*')].map(
        (el) => (el as HTMLElement & { rendered?: Promise<void> }).rendered,
      ),
    );
    navEl.populate?.({ product: { name: 'Acme', icon: 'group' }, sections: [] });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const bad: string[] = [];
    const walk = (node: ParentNode, path: string): void => {
      for (const el of node.querySelectorAll('*')) {
        if (el.children.length === 0) {
          const text = (el.textContent ?? '').trim();
          // A LEAF whose entire text is a known icon name is a drawing that
          // rendered as a word.
          if (text && text.length < 40 && mod.hasIcon(text)) {
            bad.push(`${path}>${el.localName}: "${text}"`);
          }
        }
        if (el.shadowRoot) walk(el.shadowRoot, `${path}>${el.localName}`);
      }
    };
    walk(document.body, '');
    return bad;
  });

  expect(wordy, `icon names rendered as text:\n${wordy.join('\n')}`).toEqual([]);
});
