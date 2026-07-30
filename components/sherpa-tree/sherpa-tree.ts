/**
 * sherpa-tree.ts — Hierarchical tree primitive.
 *
 * Renders a forest of nodes from a data model with expand/collapse, full
 * keyboard navigation, and optional single- or multi-select (checkboxes
 * with indeterminate parent state). Built entirely from a cloning prototype
 * (`<template class="node-tpl">`) — no createElement / structural innerHTML.
 *
 * The same primitive powers both the Advanced SelectBox (dropped into a
 * dropdown) and a standalone Treeview (dropped into any container) — there
 * is no separate treeview component. "Structured Flexibility."
 *
 * @element sherpa-tree
 * @category content
 * @description A hierarchical tree of expandable nodes. Feed it a JSON forest via
 *   data-nodes or setNodes(). Set data-selection="single" for one selectable leaf, or
 *   "multi" for checkbox selection with indeterminate parents. Full WAI-ARIA tree keyboard
 *   support (arrows, Home/End, Left/Right expand-collapse, type-ahead, Enter/Space). Drop it
 *   into a dropdown for an Advanced SelectBox, or into any container for a standalone treeview.
 *
 * @attr {json}    data-nodes       — Forest: Array<{value, label?, children?, disabled?, icon?, expanded?}>
 * @attr {enum}    data-selection   — none | single | multi (default: single)
 * @attr {json}    data-value       — Selected value(s): string (single) or string[] (multi)
 * @attr {boolean} data-empty       — Reflected when the forest is empty (drives empty state)
 *
 * @fires tree-select   — A node was activated/selected
 *   bubbles: true, composed: true
 *   detail: { value: string, path: string[], node: TreeNode }
 * @fires tree-expand   — A branch was expanded or collapsed
 *   bubbles: true, composed: true
 *   detail: { value: string, expanded: boolean }
 * @fires change        — Selection changed (multi: full value[]; single: value)
 *   bubbles: true, composed: true
 *   detail: { value: string | string[], path?: string[] }
 *
 * @method setNodes(nodes) — Set the forest imperatively (JSON-serialised to data-nodes)
 * @method getValue()      — Current selection (string for single, string[] for multi)
 * @method setValue(v)     — Set selection programmatically
 * @method expandAll()     — Expand every branch
 * @method collapseAll()   — Collapse every branch
 *
 * @slot empty — Custom empty-state content (falls back to a default message)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import type { EventHandler } from "../utilities/types.js";

/** A single tree node in the data forest. */
export interface TreeNode {
  value: string;
  label?: string;
  children?: TreeNode[];
  disabled?: boolean;
  icon?: string;
  expanded?: boolean;
}

/** Runtime metadata tracked per rendered node. */
interface NodeMeta {
  node: TreeNode;
  path: string[];
  el: HTMLElement; // the .tree-node treeitem
  branch: boolean;
}

export class SherpaTree extends SherpaElement {
  static override get cssUrl(): string { return new URL("./sherpa-tree.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-tree.html", import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "data-nodes", "data-selection", "data-value"];
  }

  public els = this.cacheElements({
    tree: { selector: ".tree", type: HTMLElement },
  });

  /** value → metadata for every rendered node. */
  #byValue = new Map<string, NodeMeta>();
  /** Selected values (multi). Single-select keeps at most one. */
  #selected = new Set<string>();
  /** Type-ahead buffer + timer. */
  #typeBuffer = "";
  #typeTimer = 0;
  #bound = false;

  /* ── Lifecycle ─────────────────────────────────────────────────── */

  override onRender(): void {
    if (!this.#bound) {
      this.els.tree?.addEventListener("click", this.#onClick);
      this.els.tree?.addEventListener("keydown", this.#onKeyDown);
      this.#bound = true;
    }
    this.#syncSelectionFromAttr();
    this.#render();
  }

  override onAttributeChanged(name: string): void {
    if (name === "data-nodes") this.#render();
    else if (name === "data-selection") this.#render();
    else if (name === "data-value") { this.#syncSelectionFromAttr(); this.#applySelectionState(); }
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get selectionMode(): "none" | "single" | "multi" {
    const m = this.dataset["selection"];
    return m === "multi" || m === "none" ? m : "single";
  }

  public setNodes(nodes: TreeNode[]): void {
    this.dataset["nodes"] = JSON.stringify(nodes ?? []);
  }

  public getValue(): string | string[] {
    return this.selectionMode === "multi" ? [...this.#selected] : (this.#selected.values().next().value ?? "");
  }

  public setValue(v: string | string[]): void {
    this.#selected = new Set(Array.isArray(v) ? v : v ? [v] : []);
    this.#applySelectionState();
  }

  public expandAll(): void { this.#byValue.forEach((m) => { if (m.branch) this.#setExpanded(m, true, false); }); }
  public collapseAll(): void { this.#byValue.forEach((m) => { if (m.branch) this.#setExpanded(m, false, false); }); }

  /* ── Render ────────────────────────────────────────────────────── */

  #render(): void {
    const tree = this.els.tree;
    const tpl = this.$<HTMLTemplateElement>("template.node-tpl");
    if (!tree || !tpl) return;

    let nodes: TreeNode[] = [];
    const raw = this.dataset["nodes"];
    if (raw) {
      try { nodes = JSON.parse(raw); } catch { nodes = []; }
    }

    this.#byValue.clear();
    // Remove previously rendered treeitems (keep the .tree-empty status node)
    tree.querySelectorAll(":scope > .tree-node").forEach((n) => n.remove());

    const empty = !Array.isArray(nodes) || nodes.length === 0;
    this.toggleAttribute("data-empty", empty);
    if (empty) return;

    const frag = document.createDocumentFragment();
    for (const node of nodes) this.#buildNode(node, [], 0, tpl, frag);
    tree.appendChild(frag);

    this.#applySelectionState();
    this.#ensureFocusable();
  }

  /** Clone the prototype for one node, populate it, recurse into children. */
  #buildNode(node: TreeNode, parentPath: string[], level: number, tpl: HTMLTemplateElement, mount: ParentNode): void {
    const clone = tpl.content.cloneNode(true) as DocumentFragment;
    const item = clone.querySelector<HTMLElement>(".tree-node");
    const row = clone.querySelector<HTMLElement>(".tree-row");
    const label = clone.querySelector<HTMLElement>(".tree-label");
    const iconEl = clone.querySelector<HTMLElement>(".tree-icon");
    const children = clone.querySelector<HTMLElement>(".tree-children");
    if (!item || !row || !label || !children) return;

    const value = String(node.value);
    const path = [...parentPath, value];
    const branch = Array.isArray(node.children) && node.children.length > 0;

    item.dataset["value"] = value;
    row.style.setProperty("--_level", String(level));
    row.setAttribute("tabindex", "-1");
    label.textContent = node.label ?? value;

    if (branch) {
      item.setAttribute("data-branch", "");
      item.setAttribute("aria-expanded", node.expanded ? "true" : "false");
      item.dataset["expanded"] = node.expanded ? "true" : "false";
    }
    if (node.disabled) item.setAttribute("aria-disabled", "true");
    if (node.icon && iconEl) { item.dataset["icon"] = node.icon; iconEl.className = `tree-icon ${node.icon}`; }

    this.#byValue.set(value, { node, path, el: item, branch });
    mount.appendChild(item);

    if (branch && node.children) {
      for (const child of node.children) this.#buildNode(child, path, level + 1, tpl, children);
    }
  }

  /* ── Selection ─────────────────────────────────────────────────── */

  #syncSelectionFromAttr(): void {
    const raw = this.dataset["value"];
    if (raw == null) return;
    try {
      const parsed = JSON.parse(raw);
      this.#selected = new Set(Array.isArray(parsed) ? parsed.map(String) : [String(parsed)]);
    } catch {
      this.#selected = new Set(raw ? [raw] : []);
    }
  }

  /** Reflect #selected onto data-selected / data-checked / data-indeterminate. */
  #applySelectionState(): void {
    const multi = this.selectionMode === "multi";
    this.#byValue.forEach((m, value) => {
      const on = this.#selected.has(value);
      if (multi) {
        m.el.dataset["checked"] = on ? "true" : "false";
      } else {
        m.el.dataset["selected"] = on ? "true" : "false";
        m.el.setAttribute("aria-selected", on ? "true" : "false");
      }
    });
    if (multi) this.#recomputeIndeterminate();
  }

  /** Parent branches show indeterminate when some-but-not-all descendants checked. */
  #recomputeIndeterminate(): void {
    this.#byValue.forEach((m) => {
      if (!m.branch) return;
      const leaves = this.#descendantLeaves(m.node);
      const checked = leaves.filter((v) => this.#selected.has(v)).length;
      const all = checked === leaves.length && leaves.length > 0;
      const some = checked > 0 && !all;
      m.el.dataset["checked"] = all ? "true" : "false";
      m.el.dataset["indeterminate"] = some ? "true" : "false";
    });
  }

  #descendantLeaves(node: TreeNode): string[] {
    if (!node.children?.length) return [String(node.value)];
    return node.children.flatMap((c) => this.#descendantLeaves(c));
  }

  /** Toggle a node's checked state (multi), cascading to descendants + parents. */
  #toggleCheck(m: NodeMeta): void {
    const leaves = this.#descendantLeaves(m.node);
    const allChecked = leaves.every((v) => this.#selected.has(v));
    for (const v of leaves) {
      if (allChecked) this.#selected.delete(v);
      else this.#selected.add(v);
    }
    this.#applySelectionState();
    this.emit("change", { value: [...this.#selected] });
  }

  #selectSingle(m: NodeMeta): void {
    if (m.node.disabled) return;
    this.#selected = new Set([m.node.value]);
    this.#applySelectionState();
    this.emit("tree-select", { value: m.node.value, path: m.path, node: m.node });
    this.emit("change", { value: m.node.value, path: m.path });
  }

  /* ── Expand / collapse ─────────────────────────────────────────── */

  #setExpanded(m: NodeMeta, expanded: boolean, notify = true): void {
    if (!m.branch) return;
    m.el.dataset["expanded"] = expanded ? "true" : "false";
    m.el.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (notify) this.emit("tree-expand", { value: m.node.value, expanded });
  }

  #isExpanded(m: NodeMeta): boolean { return m.el.dataset["expanded"] === "true"; }

  /* ── Interaction — pointer ─────────────────────────────────────── */

  #onClick: EventHandler<MouseEvent> = (e: MouseEvent) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>(".tree-node");
    if (!item) return;
    const value = item.dataset["value"];
    if (!value) return;
    const m = this.#byValue.get(value);
    if (!m || m.node.disabled) return;

    // Toggle click hits the chevron
    if ((e.target as HTMLElement).classList.contains("tree-toggle") && m.branch) {
      this.#setExpanded(m, !this.#isExpanded(m));
      this.#focusRow(m);
      return;
    }
    this.#activate(m);
  };

  /** Enter/click behaviour: branches toggle, leaves select (mode-aware). */
  #activate(m: NodeMeta): void {
    this.#focusRow(m);
    if (this.selectionMode === "multi") { this.#toggleCheck(m); return; }
    if (m.branch) { this.#setExpanded(m, !this.#isExpanded(m)); return; }
    if (this.selectionMode === "single") this.#selectSingle(m);
  }

  /* ── Interaction — keyboard (WAI-ARIA tree) ────────────────────── */

  #onKeyDown: EventHandler<KeyboardEvent> = (e: KeyboardEvent) => {
    const rows = this.#visibleRows();
    const first = rows[0];
    if (!first) return;
    const currentEl = (e.target as HTMLElement).closest<HTMLElement>(".tree-node")
      ?? (this.shadow.activeElement as HTMLElement)?.closest?.(".tree-node")
      ?? first.el;
    let idx = rows.findIndex((r) => r.el === currentEl);
    if (idx < 0) idx = 0;
    const m = rows[idx];
    if (!m) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault(); this.#focusRow(rows[Math.min(idx + 1, rows.length - 1)]); break;
      case "ArrowUp":
        e.preventDefault(); this.#focusRow(rows[Math.max(idx - 1, 0)]); break;
      case "Home":
        e.preventDefault(); this.#focusRow(rows[0]); break;
      case "End":
        e.preventDefault(); this.#focusRow(rows[rows.length - 1]); break;
      case "ArrowRight":
        e.preventDefault();
        if (m.branch && !this.#isExpanded(m)) this.#setExpanded(m, true);
        else if (m.branch && this.#isExpanded(m)) this.#focusRow(rows[Math.min(idx + 1, rows.length - 1)]);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (m.branch && this.#isExpanded(m)) this.#setExpanded(m, false);
        else this.#focusParent(m);
        break;
      case "Enter":
      case " ":
        e.preventDefault(); this.#activate(m); break;
      case "*":
        e.preventDefault(); this.expandAll(); break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) this.#typeAhead(e.key, rows, idx);
        break;
    }
  };

  /** Flat list of currently-visible rows (respecting collapsed branches), in DOM order. */
  #visibleRows(): NodeMeta[] {
    const out: NodeMeta[] = [];
    const walk = (items: NodeListOf<HTMLElement> | HTMLElement[]): void => {
      for (const el of items) {
        const value = el.dataset["value"];
        const m = value ? this.#byValue.get(value) : undefined;
        if (!m) continue;
        out.push(m);
        if (m.branch && this.#isExpanded(m)) {
          const kids = el.querySelector<HTMLElement>(":scope > .tree-children");
          if (kids) walk(kids.querySelectorAll<HTMLElement>(":scope > .tree-node"));
        }
      }
    };
    if (this.els.tree) walk(this.els.tree.querySelectorAll<HTMLElement>(":scope > .tree-node"));
    return out;
  }

  #focusRow(m: NodeMeta | undefined): void {
    if (!m) return;
    // Roving tabindex: only the focused row is tabbable
    this.#byValue.forEach((other) => other.el.querySelector<HTMLElement>(":scope > .tree-row")?.setAttribute("tabindex", "-1"));
    const row = m.el.querySelector<HTMLElement>(":scope > .tree-row");
    row?.setAttribute("tabindex", "0");
    row?.focus();
  }

  #focusParent(m: NodeMeta): void {
    const parentPath = m.path.slice(0, -1);
    const parentValue = parentPath[parentPath.length - 1];
    if (parentValue) this.#focusRow(this.#byValue.get(parentValue));
  }

  #ensureFocusable(): void {
    // Make the first top-level row the initial tab target
    const first = this.#visibleRows()[0];
    first?.el.querySelector<HTMLElement>(":scope > .tree-row")?.setAttribute("tabindex", "0");
  }

  #typeAhead(char: string, rows: NodeMeta[], from: number): void {
    if (this.#typeTimer) clearTimeout(this.#typeTimer);
    this.#typeBuffer += char.toLowerCase();
    this.#typeTimer = window.setTimeout(() => { this.#typeBuffer = ""; }, 500);
    const match = (m: NodeMeta): boolean => (m.node.label ?? m.node.value).toLowerCase().startsWith(this.#typeBuffer);
    // search after current, then wrap
    const ordered = [...rows.slice(from + 1), ...rows.slice(0, from + 1)];
    const hit = ordered.find(match);
    if (hit) this.#focusRow(hit);
  }

  override onDisconnect(): void {
    if (this.#typeTimer) clearTimeout(this.#typeTimer);
  }
}

customElements.define("sherpa-tree", SherpaTree);
