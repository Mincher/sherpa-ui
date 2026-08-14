/**
 * sherpa-tree — a hierarchical tree view.
 *
 * Renders a forest from populate([{ value, label, children?, expanded?, icon? }])
 * by cloning a <template class="node-tpl"> prototype recursively — the only
 * structural DOM this component creates (data-driven rows, which the golden rules
 * allow). Branches expand/collapse via a chevron; leaves are selectable.
 *
 * data-selection = none | single | multi (default single). Single-select emits
 * tree-select { value, path }; multi-select (checkboxes) emits change { value }.
 * All visibility is CSS off data-* on each .node — JS only sets attributes.
 *
 * @fires tree-select — detail: { value, path }
 * @fires tree-expand — detail: { value, expanded }
 * @fires change      — detail: { value } (multi)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface TreeNode {
  value: string;
  label?: string;
  children?: TreeNode[];
  expanded?: boolean;
  icon?: string;
  disabled?: boolean;
}

/** Runtime metadata per rendered node. */
interface NodeMeta {
  node: TreeNode;
  path: string[];
  el: HTMLElement; // the .node treeitem
  branch: boolean;
}

export class SherpaTree extends SherpaElement {
  static override css = new URL('./sherpa-tree.css', import.meta.url);
  static override html = new URL('./sherpa-tree.html', import.meta.url);
  static override observed = ['data-selection'];

  #nodes: TreeNode[] = [];
  #byValue = new Map<string, NodeMeta>();
  #selected = new Set<string>();

  get selectionMode(): 'none' | 'single' | 'multi' {
    const m = this.dataset['selection'];
    return m === 'multi' || m === 'none' ? m : 'single';
  }

  override onRender(): void {
    // One delegated listener for the whole tree — rows come and go, this stays.
    this.$('.tree')?.addEventListener('click', this.#onClick);
    if (this.#nodes.length) this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-selection') this.#render();
  }

  /** populate([{ value, label, children?, expanded?, icon? }]) — the node forest. */
  protected override renderData(data: unknown): void {
    this.#nodes = Array.isArray(data) ? (data as TreeNode[]) : [];
    this.#render();
  }

  /* ── Render ────────────────────────────────────────────────────── */

  #render(): void {
    const tree = this.$('.tree');
    const tpl = this.$<HTMLTemplateElement>('template.node-tpl');
    if (!tree || !tpl) return;

    this.#byValue.clear();
    tree.querySelectorAll(':scope > .node').forEach((n) => n.remove());

    const empty = this.#nodes.length === 0;
    this.toggleAttribute('data-empty', empty);
    if (empty) return;

    for (const node of this.#nodes) this.#buildNode(node, [], 0, tpl, tree);
    this.#applySelection();
  }

  /** Clone the prototype for one node, populate it, recurse into children. */
  #buildNode(node: TreeNode, parentPath: string[], level: number, tpl: HTMLTemplateElement, mount: ParentNode): void {
    const item = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const row = item.querySelector<HTMLElement>('.row')!;
    const value = String(node.value);
    const path = [...parentPath, value];
    const branch = Array.isArray(node.children) && node.children.length > 0;

    item.dataset['value'] = value;
    row.style.setProperty('--_level', String(level));
    item.querySelector('.label')!.textContent = node.label ?? value;

    const icon = item.querySelector('.icon')!;
    if (node.icon) icon.textContent = node.icon;

    if (branch) {
      item.setAttribute('data-branch', '');
      const open = node.expanded ? 'true' : 'false';
      item.dataset['expanded'] = open;
      item.setAttribute('aria-expanded', open);
    }
    if (node.disabled) item.setAttribute('aria-disabled', 'true');

    this.#byValue.set(value, { node, path, el: item, branch });
    mount.appendChild(item);

    if (branch && node.children) {
      const children = item.querySelector('.children')!;
      for (const child of node.children) this.#buildNode(child, path, level + 1, tpl, children);
    }
  }

  /* ── Selection ─────────────────────────────────────────────────── */

  /** Reflect #selected onto data-selected (single) / data-checked (multi). */
  #applySelection(): void {
    const multi = this.selectionMode === 'multi';
    this.#byValue.forEach((m, value) => {
      const on = this.#selected.has(value);
      if (multi) {
        m.el.dataset['checked'] = on ? 'true' : 'false';
      } else {
        m.el.dataset['selected'] = on ? 'true' : 'false';
        m.el.setAttribute('aria-selected', on ? 'true' : 'false');
      }
    });
  }

  #selectSingle(m: NodeMeta): void {
    this.#selected = new Set([String(m.node.value)]);
    this.#applySelection();
    this.emit('tree-select', { value: m.node.value, path: m.path });
  }

  #toggleCheck(m: NodeMeta): void {
    const value = String(m.node.value);
    if (this.#selected.has(value)) this.#selected.delete(value);
    else this.#selected.add(value);
    this.#applySelection();
    this.emit('change', { value: [...this.#selected] });
  }

  /* ── Expand / collapse ─────────────────────────────────────────── */

  #setExpanded(m: NodeMeta, expanded: boolean): void {
    if (!m.branch) return;
    m.el.dataset['expanded'] = expanded ? 'true' : 'false';
    m.el.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    this.emit('tree-expand', { value: m.node.value, expanded });
  }

  #isExpanded(m: NodeMeta): boolean {
    return m.el.dataset['expanded'] === 'true';
  }

  /* ── Interaction ───────────────────────────────────────────────── */

  #onClick = (event: Event): void => {
    // Resolve the clicked node from the composed path (crosses no boundary here,
    // but closest() over the real target is the robust way to find the row).
    const target = event.composedPath().find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('node'),
    );
    const value = target?.dataset['value'];
    if (!value) return;
    const m = this.#byValue.get(value);
    if (!m || m.node.disabled) return;

    // A click on the chevron toggles the branch.
    const hitToggle = event
      .composedPath()
      .some((n) => n instanceof HTMLElement && n.classList.contains('toggle'));
    if (hitToggle && m.branch) {
      this.#setExpanded(m, !this.#isExpanded(m));
      return;
    }

    if (this.selectionMode === 'multi') {
      this.#toggleCheck(m);
      return;
    }
    if (m.branch) {
      this.#setExpanded(m, !this.#isExpanded(m));
      return;
    }
    if (this.selectionMode === 'single') this.#selectSingle(m);
  };
}

customElements.define('sherpa-tree', SherpaTree);
