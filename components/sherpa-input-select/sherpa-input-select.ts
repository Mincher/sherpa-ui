/**
 * @element sherpa-input-select
 * @category input
 * @extends SherpaInputBase
 * @description Dropdown select backed by a native <select> element. Use for choosing from a
 *   predefined list when there are more than ~6 options or the list is dynamic. Supply options
 *   via light DOM <option> elements or programmatically via setOptions(). For hierarchical
 *   category/subcategory selection use the tree template (data-template="tree"). The change
 *   event includes the selected value and, in tree mode, the full ancestry path.
 *
 * @attr {enum}   data-template — default | tree (hierarchical picker)
 * @attr {json}   data-tree     — (tree) Node forest [{value,label,children?,disabled?}]
 *
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { value: string, path?: string[] }
 *
 * @method setOptions(options) — Set option list. Accepts either:
 *   • Flat:    Array<{ value, label, disabled? }>
 *   • Grouped: Array<{ label, options: Array<{ value, label, disabled? }> }>
 *   Grouped entries become native <optgroup> elements.
 * @method setTree(nodes)      — (tree) Set the node forest
 */

import { SherpaInputBase } from "../utilities/sherpa-input-base/sherpa-input-base.js";
import "../sherpa-tree/sherpa-tree.js";

/** A flat option or an <optgroup> with nested options. */
interface OptionDef {
  value?: string;
  label?: string;
  disabled?: boolean;
  options?: OptionDef[];
}

/** A node in the hierarchical tree-select variant. */
interface TreeNode {
  value: string;
  label?: string;
  disabled?: boolean;
  children?: TreeNode[];
}

/** Cached label + ancestry path for a tree value. */
interface TreePathEntry {
  label: string;
  path: string[];
}

export class SherpaInputSelect extends SherpaInputBase {

  static override get cssUrl(): string {
    return new URL("./sherpa-input-select.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-input-select.html", import.meta.url).href;
  }

  public els = this.cacheElements({
    select: { selector: '.input-field', type: HTMLSelectElement },
  });

  #pendingOptions: OptionDef[] | null = null;
  #outsideHandler: ((e: Event) => void) | null = null;
  #pathByValue = new Map<string, TreePathEntry>();

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-template', 'data-tree'];
  }

  override get templateId(): string {
    return this.dataset["template"] === 'tree' ? 'tree' : 'default';
  }

  override getInputElement(): HTMLSelectElement | null {
    return this.$<HTMLSelectElement>(".input-field");
  }

  override async onInputRender(): Promise<void> {
    if (this.templateId === 'tree') {
      this.#renderTree();
      this.#wireTree();
      this.#syncTreeDisplay();
      return;
    }
    // Move slotted <option> elements from light DOM to shadow <select>
    this.#adoptOptions();
    // If setOptions() was called before the inner <select> existed,
    // flush the queued list now.
    if (this.#pendingOptions) {
      const queued = this.#pendingOptions;
      this.#pendingOptions = null;
      this.setOptions(queued);
    }
    // Set initial placeholder option
    this.#ensurePlaceholder();
    // Re-apply host value attribute now that <option>s exist in the
    // shadow <select>. Base #syncValue runs before onInputRender, so
    // at that point the matching <option> wasn't there yet and the
    // assignment silently dropped to "" / first option.
    const hostValue = this.getAttribute("value");
    if (hostValue && this.els.select && this.els.select.value !== hostValue) {
      this.els.select.value = hostValue;
    }
  }

  override onInputDisconnect(): void {
    if (this.#outsideHandler) {
      document.removeEventListener('pointerdown', this.#outsideHandler, true);
      this.#outsideHandler = null;
    }
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null): void {
    super.onAttributeChanged(name, oldValue, newValue);
    if (name === "placeholder") {
      this.#ensurePlaceholder();
      const display = this.$<HTMLElement>('.tree-display');
      if (display) display.dataset["placeholder"] = this.getAttribute('placeholder') || '';
    }
    if (name === 'data-template') {
      this.renderTemplate(this.templateId).then(() => this.onInputRender());
    }
    if (name === 'data-tree' && this.templateId === 'tree') {
      this.#renderTree();
      this.#syncTreeDisplay();
    }
    if (name === 'value' && this.templateId === 'tree') {
      this.#syncTreeDisplay();
    }
  }

  /* ── Public API ─────────────────────────────────────────────── */

  /**
   * Programmatically set the option list.
   * Accepts either a flat list of options or a grouped list. A grouped
   * entry is detected by the presence of an `options` array — it is
   * rendered as a native <optgroup>.
   * @param {Array<{value: string, label: string, disabled?: boolean} | {label: string, options: Array}>} options
   */
  public setOptions(options: OptionDef[]): void {
    const select = this.els.select;
    if (!select) {
      // Component hasn't finished rendering yet — queue the call so
      // onInputRender() can flush it once the inner <select> exists.
      this.#pendingOptions = options ? [...options] : [];
      return;
    }
    // Keep placeholder, remove the rest
    const placeholder = select.querySelector('option[value=""]');
    select.replaceChildren();
    if (placeholder) select.appendChild(placeholder);

    for (const entry of options || []) {
      if (entry && Array.isArray(entry.options)) {
        const group = document.createElement('optgroup');
        group.label = entry.label || '';
        for (const opt of entry.options) {
          group.appendChild(this.#buildOption(opt));
        }
        select.appendChild(group);
      } else {
        select.appendChild(this.#buildOption(entry));
      }
    }
    // Re-apply pending value from host attribute (if any) now that the
    // matching <option> exists in the DOM.
    const hostValue = this.getAttribute("value");
    if (hostValue && select.value !== hostValue) {
      select.value = hostValue;
    }
  }

  /* ── Internal ───────────────────────────────────────────────── */

  #buildOption(opt: OptionDef): HTMLOptionElement {
    const el = document.createElement('option');
    el.value = opt?.value ?? '';
    el.textContent = opt?.label || opt?.value || '';
    if (opt?.disabled) el.disabled = true;
    return el;
  }

  #adoptOptions(): void {
    if (!this.els.select) return;
    // Move <option> and <optgroup> children from the host light DOM into the shadow <select>
    const nodes = this.querySelectorAll(':scope > option, :scope > optgroup');
    for (const node of nodes) {
      this.els.select.appendChild(node.cloneNode(true));
    }
  }

  #ensurePlaceholder(): void {
    const select = this.els.select;
    if (!select) return;
    const ph = this.getAttribute("placeholder");
    let placeholderOpt = select.querySelector<HTMLOptionElement>('option[value=""]');

    if (ph) {
      if (!placeholderOpt) {
        placeholderOpt = document.createElement("option");
        placeholderOpt.value = "";
        select.prepend(placeholderOpt);
      }
      placeholderOpt.textContent = ph;
      placeholderOpt.disabled = true;
      placeholderOpt.setAttribute('hidden', '');
      if (!select.value) {
        placeholderOpt.selected = true;
      }
    }
  }

  /* ── Tree template ─────────────────────────────────────── */

  public setTree(nodes: TreeNode[]): void {
    this.dataset["tree"] = JSON.stringify(Array.isArray(nodes) ? nodes : []);
  }

  /** Feed the node forest to the child sherpa-tree and rebuild the path map. */
  #renderTree(): void {
    const tree = this.$<HTMLElement & { setNodes?: (n: TreeNode[]) => void }>('.tree-widget');
    if (!tree) return;
    let nodes: TreeNode[] = [];
    try { nodes = JSON.parse(this.dataset["tree"] || '[]'); } catch { /* intentional */ }
    this.#pathByValue.clear();
    this.#indexPaths(nodes, []);
    // Delegate all node rendering + keyboard a11y to sherpa-tree.
    if (tree.setNodes) tree.setNodes(nodes);
    else tree.setAttribute('data-nodes', JSON.stringify(nodes));
  }

  /** Walk the forest once to cache label + ancestry per value (for display + path). */
  #indexPaths(nodes: TreeNode[], parentPath: string[]): void {
    for (const node of nodes || []) {
      const path = [...parentPath, String(node.value)];
      this.#pathByValue.set(String(node.value), { label: node.label || String(node.value), path });
      if (node.children?.length) this.#indexPaths(node.children, path);
    }
  }

  #wireTree(): void {
    const button = this.$('.tree-button');
    const tree   = this.$('.tree-widget');
    if (!button || !tree) return;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleAttribute('data-expanded');
      button.setAttribute('aria-expanded', String(this.hasAttribute('data-expanded')));
      this.#bindOutside();
    });

    // sherpa-tree owns node interaction + keyboard nav; we react to its selection.
    tree.addEventListener('tree-select', (e) => {
      const detail = (e as CustomEvent<{ value: string }>).detail;
      this.#selectTreeValue(detail?.value ?? '');
    });
  }

  #bindOutside(): void {
    if (this.#outsideHandler) return;
    const handler = (e: Event): void => {
      if (!this.contains(e.target as Node) && !e.composedPath().includes(this)) {
        this.removeAttribute('data-expanded');
        const button = this.$('.tree-button');
        if (button) button.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', handler, true);
        this.#outsideHandler = null;
      }
    };
    this.#outsideHandler = handler;
    setTimeout(() => {
      if (this.#outsideHandler) {
        document.addEventListener('pointerdown', this.#outsideHandler, true);
      }
    }, 0);
  }

  #selectTreeValue(v: string): void {
    const meta = this.#pathByValue.get(String(v));
    const hidden = this.$<HTMLInputElement>('.tree-value');
    if (hidden) hidden.value = v;
    this.setAttribute('value', v);
    this.removeAttribute('data-expanded');
    const button = this.$('.tree-button');
    if (button) button.setAttribute('aria-expanded', 'false');
    this.#syncTreeDisplay();
    this.emit('change', { value: String(v), path: meta?.path ?? [String(v)] });
  }

  #syncTreeDisplay(): void {
    const display = this.$<HTMLElement>('.tree-display');
    if (!display) return;
    display.dataset["placeholder"] = this.getAttribute('placeholder') || '';
    const v = this.getAttribute('value') || '';
    display.textContent = v ? (this.#pathByValue.get(v)?.label || v) : '';
    // Reflect selection into the child sherpa-tree (marks aria-selected there).
    const tree = this.$<HTMLElement & { setValue?: (val: string) => void }>('.tree-widget');
    tree?.setValue?.(v);
  }
}

customElements.define("sherpa-input-select", SherpaInputSelect);
