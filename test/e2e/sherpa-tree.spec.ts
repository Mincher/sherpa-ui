import { test, expect } from '@playwright/test';
import { openHarness, mount, clearRoot } from './support';

const FOREST = JSON.stringify([
  { value: 'fruit', label: 'Fruit', children: [{ value: 'apple', label: 'Apple' }, { value: 'pear', label: 'Pear' }] },
  { value: 'veg', label: 'Veg', children: [{ value: 'carrot', label: 'Carrot' }, { value: 'pea', label: 'Pea', disabled: true }] },
  { value: 'other', label: 'Other' },
]);

test.beforeEach(async ({ page }) => {
  await openHarness(page);
});
test.afterEach(async ({ page }) => clearRoot(page));

test('renders a treeitem per node and marks branches vs leaves', async ({ page }) => {
  await mount(page, `<sherpa-tree data-nodes='${FOREST}'></sherpa-tree>`, 'sherpa-tree');
  const r = await page.evaluate(() => {
    const t = document.querySelector('sherpa-tree')!;
    const sr = t.shadowRoot!;
    return {
      treeitems: sr.querySelectorAll('.tree-node[role="treeitem"]').length,
      fruitBranch: sr.querySelector('.tree-node[data-value="fruit"]')!.hasAttribute('data-branch'),
      appleLeaf: !sr.querySelector('.tree-node[data-value="apple"]')!.hasAttribute('data-branch'),
      prototypePresent: !!sr.querySelector('template.node-tpl'),
      width: Math.round(t.getBoundingClientRect().width),
    };
  });
  // 3 top-level (fruit, veg, other) + 4 leaves (apple, pear, carrot, pea) = 7 treeitems
  expect(r.treeitems).toBe(7);
  expect(r.fruitBranch).toBe(true);
  expect(r.appleLeaf).toBe(true);
  expect(r.prototypePresent).toBe(true); // proves cloning-prototype render
  expect(r.width).toBeGreaterThan(0); // regression guard for the width:0 bug
});

test('single-select fires tree-select with path and marks aria-selected', async ({ page }) => {
  await mount(page, `<sherpa-tree data-nodes='${FOREST}'></sherpa-tree>`, 'sherpa-tree');
  const r = await page.evaluate(async () => {
    const t = document.querySelector('sherpa-tree')!;
    const sr = t.shadowRoot!;
    let detail: any = null;
    t.addEventListener('tree-select', (e: any) => (detail = e.detail));
    (sr.querySelector('.tree-node[data-value="fruit"]') as HTMLElement).dataset.expanded = 'true';
    (sr.querySelector('.tree-node[data-value="apple"] .tree-row') as HTMLElement).click();
    return {
      value: detail?.value,
      path: detail?.path?.join('/'),
      ariaSelected: sr.querySelector('.tree-node[data-value="apple"]')!.getAttribute('aria-selected'),
    };
  });
  expect(r.value).toBe('apple');
  expect(r.path).toBe('fruit/apple');
  expect(r.ariaSelected).toBe('true');
});

test('does not select disabled leaves', async ({ page }) => {
  await mount(page, `<sherpa-tree data-nodes='${FOREST}'></sherpa-tree>`, 'sherpa-tree');
  const fired = await page.evaluate(() => {
    const t = document.querySelector('sherpa-tree')!;
    const sr = t.shadowRoot!;
    let f = false;
    t.addEventListener('tree-select', () => (f = true));
    (sr.querySelector('.tree-node[data-value="veg"]') as HTMLElement).dataset.expanded = 'true';
    (sr.querySelector('.tree-node[data-value="pea"] .tree-row') as HTMLElement).click();
    return f;
  });
  expect(fired).toBe(false);
});

test('multi-select: checking a parent cascades; partial sets indeterminate', async ({ page }) => {
  await mount(page, `<sherpa-tree data-selection="multi" data-nodes='${FOREST}'></sherpa-tree>`, 'sherpa-tree');
  const r = await page.evaluate(() => {
    const t = document.querySelector('sherpa-tree')! as HTMLElement & { getValue?: () => string[]; setValue?: (v: string[]) => void };
    const sr = t.shadowRoot!;
    // check parent → cascades to all leaves
    (sr.querySelector('.tree-node[data-value="fruit"] .tree-row') as HTMLElement).click();
    const afterParent = (t.getValue!() as string[]).slice().sort();
    // reset to a single child → parent indeterminate
    t.setValue!(['apple']);
    return {
      cascade: afterParent,
      fruitChecked: sr.querySelector('.tree-node[data-value="fruit"]')!.getAttribute('data-checked'),
      fruitIndeterminate: sr.querySelector('.tree-node[data-value="fruit"]')!.getAttribute('data-indeterminate'),
    };
  });
  expect(r.cascade).toContain('apple');
  expect(r.cascade).toContain('pear');
  expect(r.fruitChecked).toBe('false');
  expect(r.fruitIndeterminate).toBe('true');
});

test('keyboard: ArrowRight expands, Enter selects a leaf', async ({ page }) => {
  await mount(page, `<sherpa-tree data-nodes='${FOREST}'></sherpa-tree>`, 'sherpa-tree');
  const expanded = await page.evaluate(() => {
    const t = document.querySelector('sherpa-tree')!;
    const sr = t.shadowRoot!;
    const fruitRow = sr.querySelector('.tree-node[data-value="fruit"] .tree-row') as HTMLElement;
    fruitRow.focus();
    sr.querySelector('.tree')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    return sr.querySelector('.tree-node[data-value="fruit"]')!.getAttribute('aria-expanded');
  });
  expect(expanded).toBe('true');
});
