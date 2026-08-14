import { test, expect } from '@playwright/test';

/** sherpa-tree — nested nodes from populate(); expand/collapse toggles children; single-select fires tree-select. */

const HARNESS = '/test/reforged/harness.html';

const FOREST = [
  {
    value: 'src',
    label: 'src',
    expanded: true,
    children: [
      { value: 'core', label: 'core', children: [{ value: 'el', label: 'element.ts' }] },
      { value: 'index', label: 'index.ts' },
    ],
  },
  { value: 'readme', label: 'README.md' },
];

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renders a nested forest with branch/leaf markers', async ({ page }) => {
  const r = await page.evaluate(async (forest) => {
    const el = document.createElement('sherpa-tree') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(forest);
    await new Promise((res) => setTimeout(res, 10));
    const sr = el.shadowRoot!;
    return {
      topNodes: sr.querySelectorAll('.tree > .node').length,
      branches: sr.querySelectorAll('.node[data-branch]').length,
      srcExpanded: sr.querySelector('.node[data-value="src"]')?.getAttribute('data-expanded'),
    };
  }, FOREST);
  expect(r.topNodes).toBe(2); // src (branch) + readme (leaf)
  expect(r.branches).toBeGreaterThanOrEqual(2); // src + core
  expect(r.srcExpanded).toBe('true');
});

test('clicking the chevron collapses a branch (children hidden)', async ({ page }) => {
  const r = await page.evaluate(async (forest) => {
    const el = document.createElement('sherpa-tree') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(forest);
    await new Promise((res) => setTimeout(res, 10));

    const src = el.shadowRoot!.querySelector<HTMLElement>('.node[data-value="src"]')!;
    const childrenVisible = () => getComputedStyle(src.querySelector('.children')!).display !== 'none';
    const before = childrenVisible();

    src.querySelector<HTMLElement>('.toggle')!.click();
    await new Promise((res) => setTimeout(res, 10));
    const after = childrenVisible();

    return { before, after, expanded: src.getAttribute('data-expanded') };
  }, FOREST);
  expect(r.before).toBe(true);
  expect(r.after).toBe(false); // collapsed
  expect(r.expanded).toBe('false');
});

test('clicking a leaf selects it and fires tree-select', async ({ page }) => {
  const r = await page.evaluate(async (forest) => {
    const el = document.createElement('sherpa-tree') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(forest);
    await new Promise((res) => setTimeout(res, 10));

    let picked: string | null = null;
    el.addEventListener('tree-select', (e) => (picked = (e as CustomEvent).detail.value));

    const leaf = el.shadowRoot!.querySelector<HTMLElement>('.node[data-value="index"] .row')!;
    leaf.click();
    await new Promise((res) => setTimeout(res, 10));

    return { picked, selected: el.shadowRoot!.querySelector('.node[data-value="index"]')?.hasAttribute('data-selected') };
  }, FOREST);
  expect(r.picked).toBe('index');
  expect(r.selected).toBe(true);
});
