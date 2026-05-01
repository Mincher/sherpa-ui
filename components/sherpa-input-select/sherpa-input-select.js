/**
 * @element sherpa-input-select
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
 * @method setOptions(options) — Set option list: Array<{ value, label, disabled? }>
 * @method setTree(nodes)      — (tree) Set the node forest
 */

import { SherpaInputBase } from "../utilities/sherpa-input-base/sherpa-input-base.js";

export class SherpaInputSelect extends SherpaInputBase {
  static get cssUrl() {
    return new URL("./sherpa-input-select.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-input-select.html", import.meta.url).href;
  }

  #selectEl = null;
  #pendingOptions = null;
  #outsideHandler = null;
  #pathByValue = new Map();

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-template', 'data-tree'];
  }

  get templateId() {
    return this.dataset.template === 'tree' ? 'tree' : 'default';
  }

  getInputElement() {
    return this.$(".input-field");
  }

  async onInputRender() {
    this.#selectEl = this.getInputElement();
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
  }

  onInputDisconnect() {
    if (this.#outsideHandler) {
      document.removeEventListener('pointerdown', this.#outsideHandler, true);
      this.#outsideHandler = null;
    }
  }

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);
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
   * @param {Array<{value: string, label: string, disabled?: boolean}>} options
   */
  setOptions(options) {
    if (!this.#selectEl) {
      // Component hasn't finished rendering yet — queue the call so
      // onInputRender() can flush it once the inner <select> exists.
      this.#pendingOptions = options ? [...options] : [];
      return;
    }
    // Keep placeholder, remove the rest
    const placeholder = this.#selectEl.querySelector('option[value=""]');
    this.#selectEl.replaceChildren();
    if (placeholder) this.#selectEl.appendChild(placeholder);

    for (const opt of options || []) {
      const el = document.createElement("option");
      el.value = opt.value ?? "";
      el.textContent = opt.label || opt.value || "";
      if (opt.disabled) el.disabled = true;
      this.#selectEl.appendChild(el);
    }
    // Re-apply pending value from host attribute (if any) now that the
    // matching <option> exists in the DOM.
    const hostValue = this.getAttribute("value");
    if (hostValue && this.#selectEl.value !== hostValue) {
      this.#selectEl.value = hostValue;
    }
  }

  /* ── Internal ───────────────────────────────────────────────── */

  #adoptOptions() {
    if (!this.#selectEl) return;
    // Move <option> children from the host light DOM into the shadow <select>
    const options = this.querySelectorAll("option");
    for (const opt of options) {
      this.#selectEl.appendChild(opt.cloneNode(true));
    }
  }

  #ensurePlaceholder() {
    if (!this.#selectEl) return;
    const ph = this.getAttribute("placeholder");
    let placeholderOpt = this.#selectEl.querySelector('option[value=""]');

    if (ph) {
      if (!placeholderOpt) {
        placeholderOpt = document.createElement("option");
        placeholderOpt.value = "";
        this.#selectEl.prepend(placeholderOpt);
      }
      placeholderOpt.textContent = ph;
      placeholderOpt.disabled = true;
      placeholderOpt.hidden = true;
      if (!this.#selectEl.value) {
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
    this.#outsideHandler = (e) => {
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
