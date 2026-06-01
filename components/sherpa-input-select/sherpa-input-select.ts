/**
 * @element sherpa-input-select
 * @category input
 * @extends SherpaInputBase
 * @description Dropdown select input using native <select>. Options provided
 *   via light DOM <option> elements or programmatically via setOptions().
 *   Inherits label, description, helper, layout, validation from SherpaInputBase.
 *
 * @attr {enum}   [data-template] — default | tree (hierarchical picker)
 * @attr {json}   [data-tree]     — (tree) Node forest [{value,label,children?,disabled?}]
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

/* ── Dataset Interface ─────────────────────────────────────────── */

interface SherpaInputSelectDataset extends DOMStringMap {
  label?: string;
  description?: string;
  helper?: string;
  layout?: 'horizontal' | 'vertical';
  template?: 'default' | 'tree';
  tree?: string;
}

export class SherpaInputSelect extends SherpaInputBase {

  override get dataset(): SherpaInputSelectDataset {
    return super.dataset as SherpaInputSelectDataset;
  }
  static override get cssUrl(): string {
    return new URL("./sherpa-input-select.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-input-select.html", import.meta.url).href;
  }

  els = this.cacheElements({
    select: '.input-field'
  });

  #pendingOptions = null;
  #outsideHandler = null;
  #pathByValue = new Map();

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-template', 'data-tree'];
  }

  override get templateId() {
    return this.dataset.template === 'tree' ? 'tree' : 'default';
  }

  override getInputElement() {
    return this.$(".input-field");
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

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null) {
    super.onAttributeChanged(name: string, oldValue: string | null, newValue: string | null);
    if (name === "placeholder") {
      this.#ensurePlaceholder();
      const display = this.$('.tree-display');
      if (display) display.dataset.placeholder = this.getAttribute('placeholder') || '';
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
  setOptions(options) {
    if (!this.els.select) {
      // Component hasn't finished rendering yet — queue the call so
      // override onInputRender(): void can flush it once the inner <select> exists.
      this.#pendingOptions = options ? [...options] : [];
      return;
    }
    // Keep placeholder, remove the rest
    const placeholder = this.els.select.querySelector('option[value=""]');
    this.els.select.replaceChildren();
    if (placeholder) this.els.select.appendChild(placeholder);

    for (const entry of options || []) {
      if (entry && Array.isArray(entry.options)) {
        const group = document.createElement('optgroup');
        group.label = entry.label || '';
        for (const opt of entry.options) {
          group.appendChild(this.#buildOption(opt));
        }
        this.els.select.appendChild(group);
      } else {
        this.els.select.appendChild(this.#buildOption(entry));
      }
    }
    // Re-apply pending value from host attribute (if any) now that the
    // matching <option> exists in the DOM.
    const hostValue = this.getAttribute("value");
    if (hostValue && this.els.select.value !== hostValue) {
      this.els.select.value = hostValue;
    }
  }

  /* ── Internal ───────────────────────────────────────────────── */

  #buildOption(opt) {
    const el = document.createElement('option');
    el.value = opt?.value ?? '';
    el.textContent = opt?.label || opt?.value || '';
    if (opt?.disabled) el.disabled = true;
    return el;
  }

  #adoptOptions() {
    if (!this.els.select) return;
    // Move <option> and <optgroup> children from the host light DOM into the shadow <select>
    const nodes = this.querySelectorAll(':scope > option, :scope > optgroup');
    for (const node of nodes) {
      this.els.select.appendChild(node.cloneNode(true));
    }
  }

  #ensurePlaceholder() {
    if (!this.els.select) return;
    const ph = this.getAttribute("placeholder");
    let placeholderOpt = this.els.select.querySelector('option[value=""]');

    if (ph) {
      if (!placeholderOpt) {
        placeholderOpt = document.createElement("option");
        placeholderOpt.value = "";
        this.els.select.prepend(placeholderOpt);
      }
      placeholderOpt.textContent = ph;
      placeholderOpt.disabled = true;
      placeholderOpt.setAttribute('hidden', '');
      if (!this.els.select.value) {
        placeholderOpt.selected = true;
      }
    }
  }

  /* ── Tree template ─────────────────────────────────────── */

  setTree(nodes) {
    this.dataset.tree = JSON.stringify(Array.isArray(nodes) ? nodes : []);
  }

  #renderTree() {
    const panel = this.$('.tree-panel');
    if (!panel) return;
    let nodes = [];
    try { nodes = JSON.parse(this.dataset.tree || '[]'); } catch {}
    this.#pathByValue.clear();
    panel.replaceChildren();
    panel.appendChild(this.#buildTree(nodes, []));
  }

  #buildTree(nodes, parentPath) {
    const list = document.createElement('div');
    list.className = 'tree-list';
    list.setAttribute('role', 'group');
    for (const node of nodes || []) {
      const path = [...parentPath, String(node.value)];
      this.#pathByValue.set(String(node.value), { label: node.label || String(node.value), path });
      const wrapper = document.createElement('div');
      wrapper.className = 'tree-node';
      wrapper.setAttribute('role', 'treeitem');
      wrapper.dataset.value = String(node.value);
      const hasChildren = Array.isArray(node.children) && node.children.length > 0;
      if (hasChildren) wrapper.dataset.hasChildren = '';

      const row = document.createElement('div');
      row.className = 'tree-row';
      if (node.disabled) row.setAttribute('aria-disabled', 'true');
      row.dataset.value = String(node.value);
      row.innerHTML = `<span class="tree-toggle" aria-hidden="true"></span><span class="tree-label"></span>`;
      row.querySelector('.tree-label').textContent = node.label || String(node.value);
      wrapper.appendChild(row);

      if (hasChildren) {
        const childWrap = document.createElement('div');
        childWrap.className = 'tree-children';
        childWrap.appendChild(this.#buildTree(node.children, path));
        wrapper.appendChild(childWrap);
      }
      list.appendChild(wrapper);
    }
    return list;
  }

  #wireTree() {
    const button = this.$('.tree-button');
    const panel  = this.$('.tree-panel');
    if (!button || !panel) return;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleAttribute('data-expanded');
      button.setAttribute('aria-expanded', String(this.hasAttribute('data-expanded')));
      this.#bindOutside();
    });

    panel.addEventListener('click', (e) => {
      const toggle = e.target.closest('.tree-toggle');
      if (toggle) {
        const node = toggle.closest('.tree-node');
        if (node?.dataset.hasChildren !== undefined) {
          node.dataset.expanded = node.dataset.expanded === 'true' ? 'false' : 'true';
        }
        e.stopPropagation();
        return;
      }
      const row = e.target.closest('.tree-row');
      if (!row || row.getAttribute('aria-disabled') === 'true') return;
      const node = row.closest('.tree-node');
      if (node?.dataset.hasChildren !== undefined) {
        node.dataset.expanded = node.dataset.expanded === 'true' ? 'false' : 'true';
        return;
      }
      this.#selectTreeValue(row.dataset.value);
    });
  }

  #bindOutside() {
    if (this.#outsideHandler) return;
    this.#outsideHandler = (e: Event) => {
      if (!this.contains(e.target) && !e.composedPath().includes(this)) {
        this.removeAttribute('data-expanded');
        const button = this.$('.tree-button');
        if (button) button.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', this.#outsideHandler, true);
        this.#outsideHandler = null;
      }
    };
    setTimeout(() => {
      if (this.#outsideHandler) {
        document.addEventListener('pointerdown', this.#outsideHandler, true);
      }
    }, 0);
  }

  #selectTreeValue(v) {
    const meta = this.#pathByValue.get(String(v));
    const hidden = this.$('.tree-value');
    if (hidden) hidden.value = v;
    this.setAttribute('value', v);
    this.removeAttribute('data-expanded');
    const button = this.$('.tree-button');
    if (button) button.setAttribute('aria-expanded', 'false');
    this.#syncTreeDisplay();
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true, composed: true,
      detail: { value: String(v), path: meta?.path ?? [String(v)] },
    }));
  }

  #syncTreeDisplay() {
    const display = this.$('.tree-display');
    if (!display) return;
    display.dataset.placeholder = this.getAttribute('placeholder') || '';
    const v = this.getAttribute('value') || '';
    if (!v) { display.textContent = ''; return; }
    const meta = this.#pathByValue.get(v);
    display.textContent = meta?.label || v;
    // Mark selected row
    for (const row of this.$$('.tree-row')) {
      row.setAttribute('aria-selected', row.dataset.value === v ? 'true' : 'false');
    }
  }
}

customElements.define("sherpa-input-select", SherpaInputSelect);
