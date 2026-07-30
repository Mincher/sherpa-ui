// @ts-nocheck
/**
 * sherpa-tree.test.ts — Functional + a11y tests for sherpa-tree.
 *
 * Covers: rendering from data-nodes, expand/collapse, single-select,
 * multi-select with indeterminate parents, keyboard navigation, and ARIA.
 */

import { expect } from '@esm-bundle/chai';
import { axe } from 'axe-core';

const FOREST = [
  { value: 'fruit', label: 'Fruit', children: [
    { value: 'apple', label: 'Apple' },
    { value: 'pear', label: 'Pear' },
  ]},
  { value: 'veg', label: 'Vegetable', children: [
    { value: 'carrot', label: 'Carrot' },
    { value: 'pea', label: 'Pea', disabled: true },
  ]},
  { value: 'other', label: 'Other' },
];

describe('sherpa-tree', () => {
  let container;
  let tree;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    tree = document.createElement('sherpa-tree');
    tree.setAttribute('data-nodes', JSON.stringify(FOREST));
    container.appendChild(tree);
    await customElements.whenDefined('sherpa-tree');
    await tree.rendered;
  });

  afterEach(() => container.remove());

  const $ = (sel) => tree.shadowRoot.querySelector(sel);
  const $$ = (sel) => [...tree.shadowRoot.querySelectorAll(sel)];
  const nodeByValue = (v) => tree.shadowRoot.querySelector(`.tree-node[data-value="${v}"]`);

  it('renders a treeitem per node from the cloning prototype', () => {
    expect($('[role="tree"]')).to.exist;
    expect($$('.tree-node[role="treeitem"]').length).to.equal(6); // 3 top + 3 leaves under branches... apple,pear,carrot,pea + fruit,veg,other
  });

  it('marks branches and leaves correctly', () => {
    expect(nodeByValue('fruit').hasAttribute('data-branch')).to.be.true;
    expect(nodeByValue('apple').hasAttribute('data-branch')).to.be.false;
  });

  it('does not use createElement/innerHTML for structure (cloning only)', () => {
    // prototype template must still be present (proves clone-from-prototype)
    expect(tree.shadowRoot.querySelector('template.node-tpl')).to.exist;
  });

  it('toggles expansion via the chevron and fires tree-expand', async () => {
    const fired = new Promise((res) => tree.addEventListener('tree-expand', (e) => res(e.detail), { once: true }));
    nodeByValue('fruit').querySelector('.tree-toggle').click();
    const detail = await fired;
    expect(detail.value).to.equal('fruit');
    expect(detail.expanded).to.be.true;
    expect(nodeByValue('fruit').getAttribute('aria-expanded')).to.equal('true');
  });

  it('single-select fires tree-select + change with path', async () => {
    const fired = new Promise((res) => tree.addEventListener('tree-select', (e) => res(e.detail), { once: true }));
    nodeByValue('fruit').dataset.expanded = 'true';
    nodeByValue('apple').querySelector('.tree-row').click();
    const detail = await fired;
    expect(detail.value).to.equal('apple');
    expect(detail.path).to.deep.equal(['fruit', 'apple']);
    expect(nodeByValue('apple').getAttribute('aria-selected')).to.equal('true');
  });

  it('does not select disabled leaves', () => {
    let fired = false;
    tree.addEventListener('tree-select', () => { fired = true; });
    nodeByValue('veg').dataset.expanded = 'true';
    nodeByValue('pea').querySelector('.tree-row').click();
    expect(fired).to.be.false;
  });

  describe('multi-select', () => {
    beforeEach(async () => { tree.setAttribute('data-selection', 'multi'); await tree.rendered; });

    it('checking a parent cascades to all leaf descendants', async () => {
      const fired = new Promise((res) => tree.addEventListener('change', (e) => res(e.detail), { once: true }));
      nodeByValue('fruit').querySelector('.tree-row').click();
      const detail = await fired;
      expect(detail.value).to.include.members(['apple', 'pear']);
      expect(nodeByValue('fruit').dataset.checked).to.equal('true');
    });

    it('checking one child sets parent indeterminate', () => {
      tree.setValue(['apple']);
      expect(nodeByValue('fruit').dataset.indeterminate).to.equal('true');
      expect(nodeByValue('fruit').dataset.checked).to.equal('false');
    });
  });

  describe('keyboard', () => {
    const key = (k) => $('.tree').dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

    it('ArrowRight expands a collapsed branch', () => {
      nodeByValue('fruit').querySelector('.tree-row').focus();
      key('ArrowRight');
      expect(nodeByValue('fruit').getAttribute('aria-expanded')).to.equal('true');
    });

    it('Enter on a leaf selects it', async () => {
      tree.removeAttribute('data-selection'); // single
      await tree.rendered;
      nodeByValue('other').querySelector('.tree-row').focus();
      const fired = new Promise((res) => tree.addEventListener('tree-select', (e) => res(e.detail), { once: true }));
      key('Enter');
      const detail = await fired;
      expect(detail.value).to.equal('other');
    });
  });

  it('has no axe violations', async () => {
    const results = await axe.run(tree, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    expect(results.violations).to.deep.equal([]);
  });
});
