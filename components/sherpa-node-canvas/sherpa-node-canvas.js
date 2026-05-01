/**
 * sherpa-node-canvas.js — Pan/zoom canvas hosting sherpa-node children.
 *
 * Owns:
 *   - viewport {x, y, zoom}: pan via middle-mouse OR space+left-drag,
 *     zoom via wheel (cursor-anchored, clamp 0.1–2.5).
 *   - edges:  Array<{ from:{nodeId,portName}, to:{nodeId,portName},
 *                     control?:boolean }> rendered as bezier curves.
 *   - drag-to-connect: pointerdown on a slotted <sherpa-node-socket>
 *     starts an edge drag; pointerup over another socket completes it.
 *   - drag-to-redirect: pointerdown on an input socket that already has
 *     edge(s) picks up the end nearest the click. Drop on empty space
 *     deletes; drop on another valid socket updates.
 *   - hover/select state for edges (token-coloured), with hit-testing
 *     via 32-segment bezier polyline + 6 px perpendicular threshold.
 *   - multi-input sockets: connection count is mirrored to
 *     data-connection-count on the socket; endpoints are spaced evenly
 *     across the socket's vertical extent.
 *   - crosshair grid drawn beneath edges.
 *
 * @element sherpa-node-canvas
 *
 * @attr {enum} data-grid — "crosshair" (default) | "none"
 *
 * @fires sherpa-edge-create
 *   bubbles: true, composed: true
 *   detail: { from:{nodeId,portName}, to:{nodeId,portName}, control:boolean }
 * @fires sherpa-edge-update
 *   bubbles: true, composed: true
 *   detail: { edgeIdx, edge }
 * @fires sherpa-edge-delete
 *   bubbles: true, composed: true
 *   detail: { edgeIdx }
 * @fires sherpa-edge-select
 *   bubbles: true, composed: true
 *   detail: { edgeIdx | null }
 * @fires sherpa-viewport-change
 *   bubbles: true, composed: true
 *   detail: { x, y, zoom }
 *
 * Public API:
 *   addNode(opts), removeNode(nodeId), getNode(nodeId)
 *   setEdges(edges), addEdge(edge), removeEdge(idx), getEdges()
 *   getSelectedEdge(), setSelectedEdge(idx|null)
 *   getViewport(), setViewport({x,y,zoom})
 *   fitToContent({padding})
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import "../sherpa-view-header/sherpa-view-header.js";
import "../sherpa-breadcrumbs/sherpa-breadcrumbs.js";

const HIT_R = 18;            // px (screen) — port hit radius
const EDGE_HIT_PX = 6;       // px (screen) — perpendicular threshold for edge hover
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 2.5;
const WHEEL_K = 0.0025;
const BEZIER_SAMPLES = 32;   // polyline segments per edge for hit-test

export class SherpaNodeCanvas extends SherpaElement {
  static get cssUrl() { return new URL("./sherpa-node-canvas.css", import.meta.url).href; }
  static get htmlUrl() { return new URL("./sherpa-node-canvas.html", import.meta.url).href; }

  /** Adopt the sherpa-node family tokens into every shadow root. */
  static get sharedStyles() {
    return [
      ...super.sharedStyles,
      new URL("../sherpa-node/sherpa-node-tokens.css", import.meta.url).href,
    ];
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-grid",
      "data-heading",
      "data-show-header",
      "data-export-title",
    ];
  }

  /* ── State ─────────────────────────────────────────────────────── */

  #viewport = { x: 0, y: 0, zoom: 1 };
  #edges = [];                     // Array<Edge>
  #portCache = new Map();          // nodeId → Map<portName, {x,y,side,multi,count,height}>
  #spaceDown = false;
  #pan = null;                     // {x0,y0,vx0,vy0}
  #drag = null;                    // {fromNodeId,fromPortName,fromSide,redirectIdx?,redirectFixedEnd?,cursorX,cursorY}
  #nodeDrag = null;                // {nodeId, x0, y0, nx0, ny0}
  #rafPending = false;
  #hoverEdgeIdx = -1;
  #selectedEdgeIdx = -1;
  #selectedNodeId = null;
  #lastClientX = 0;
  #lastClientY = 0;

  // Drill-down state — internal stack of {parentId, label, snapshot}
  // frames. Each frame holds a serialised picture of the canvas at
  // the moment we drilled into a sub-graph; popping restores it.
  #drillStack = [];

  // Cached snapshots of CHILD sub-graphs, keyed by parent node id.
  // Captured on popSubgraph so a subsequent pushSubgraph(sameParent)
  // restores the work the user did inside, rather than starting fresh.
  #subgraphs = new Map();

  // DOM refs
  #rootEl = null;
  #surfaceEl = null;
  #bodyEl = null;
  #gridCanvas = null;
  #edgesCanvas = null;
  #gridCtx = null;
  #edgesCtx = null;
  #ro = null;
  #slotEl = null;
  #colorProbe = null;
  #viewHeaderEl = null;

  /* ── Lifecycle ─────────────────────────────────────────────────── */

  onRender() {
    this.#rootEl     = this.$(".root");
    // .canvas-body is now a flex row hosting the canvas stack and a
    // trailing side-panel slot; the canvas's own size — used for
    // pointer math, ResizeObserver, and the layer canvases — must
    // come from the stack alone, not the row that includes the panel.
    this.#bodyEl     = this.$(".canvas-stack") ?? this.$(".canvas-body");
    this.#surfaceEl  = this.$(".surface");
    this.#gridCanvas = this.$(".layer.grid");
    this.#edgesCanvas = this.$(".layer.edges");
    this.#slotEl     = this.$('slot:not([name])');
    this.#gridCtx    = this.#gridCanvas.getContext("2d");
    this.#edgesCtx   = this.#edgesCanvas.getContext("2d");
    this.#viewHeaderEl = this.$("sherpa-view-header.canvas-header");
    this.#applyTransform();
    this.#syncHeader();
  }

  onConnect() {
    if (!this.hasAttribute("data-grid")) this.setAttribute("data-grid", "crosshair");

    this.addEventListener("wheel", this.#onWheel, { passive: false });
    this.addEventListener("pointerdown", this.#onPointerDown);
    window.addEventListener("pointermove", this.#onPointerMove);
    window.addEventListener("pointerup",   this.#onPointerUp);
    window.addEventListener("keydown", this.#onKeyDown);
    window.addEventListener("keyup",   this.#onKeyUp);

    this.addEventListener("sherpa-socket-pointerdown", this.#onSocketPointerDown);
    this.addEventListener("sherpa-node-pointerdown",   this.#onNodePointerDown);
    this.addEventListener("sherpa-node-value-change",  this.#onNodeValueChange);
    this.addEventListener("sherpa-node-drilldown",     this.#onNodeDrillDown);
    this.#viewHeaderEl?.addEventListener("view-header-back", this.#onViewHeaderBack);

    this.#slotEl?.addEventListener("slotchange", this.#onSlotChange);
    this.#listenToNodes();

    this.#ro = new ResizeObserver(() => this.#resizeCanvases());
    // Observe the canvas stack so a slotted side-panel collapsing
    // (changing the stack width without changing the host width)
    // still triggers a layer-canvas resize.
    this.#ro.observe(this.#bodyEl ?? this);
    this.#resizeCanvases();
  }

  onDisconnect() {
    this.removeEventListener("wheel", this.#onWheel);
    this.removeEventListener("pointerdown", this.#onPointerDown);
    window.removeEventListener("pointermove", this.#onPointerMove);
    window.removeEventListener("pointerup",   this.#onPointerUp);
    window.removeEventListener("keydown", this.#onKeyDown);
    window.removeEventListener("keyup",   this.#onKeyUp);
    this.removeEventListener("sherpa-socket-pointerdown", this.#onSocketPointerDown);
    this.removeEventListener("sherpa-node-pointerdown",   this.#onNodePointerDown);
    this.removeEventListener("sherpa-node-value-change",  this.#onNodeValueChange);
    this.removeEventListener("sherpa-node-drilldown",     this.#onNodeDrillDown);
    this.#viewHeaderEl?.removeEventListener("view-header-back", this.#onViewHeaderBack);
    this.#slotEl?.removeEventListener("slotchange", this.#onSlotChange);
    this.#ro?.disconnect();
  }

  onAttributeChanged(name) {
    if (name === "data-grid") this.#scheduleDraw();
    if (name === "data-heading" || name === "data-export-title") this.#syncHeader();
  }

  /* ── Public API ────────────────────────────────────────────────── */

  getViewport() { return { ...this.#viewport }; }
  setViewport({ x, y, zoom }) {
    if (Number.isFinite(x))    this.#viewport.x = x;
    if (Number.isFinite(y))    this.#viewport.y = y;
    if (Number.isFinite(zoom)) this.#viewport.zoom = this.#clampZoom(zoom);
    this.#applyTransform();
    this.#scheduleDraw();
    this.#emitViewport();
  }

  getEdges() { return this.#edges.map((e) => ({ ...e })); }
  setEdges(edges) {
    this.#edges = (edges || []).map((e) => this.#normEdge(e));
    this.#selectedEdgeIdx = -1;
    this.#hoverEdgeIdx = -1;
    this.#schedulePropagate();
    this.#scheduleDraw();
  }
  addEdge(edge) {
    this.#edges.push(this.#normEdge(edge));
    this.#schedulePropagate();
    this.#scheduleDraw();
  }
  removeEdge(idx) {
    if (idx < 0 || idx >= this.#edges.length) return;
    this.#edges.splice(idx, 1);
    if (this.#selectedEdgeIdx === idx) this.#selectedEdgeIdx = -1;
    else if (this.#selectedEdgeIdx > idx) this.#selectedEdgeIdx--;
    this.#hoverEdgeIdx = -1;
    this.#schedulePropagate();
    this.#scheduleDraw();
  }
  getSelectedEdge() {
    return this.#selectedEdgeIdx >= 0 ? this.#selectedEdgeIdx : null;
  }

  /**
   * Convert client (screen) coordinates to world coordinates. Useful
   * for callers that need to drop a node at a cursor position (e.g. a
   * drag-from-palette flow): pass `event.clientX`/`event.clientY` and
   * place the new node at the returned `{x, y}`.
   */
  screenToWorld(sx, sy) { return this.#screenToWorld(sx, sy); }

  /* ── Node selection ───────────────────────────────────────────── */
  getSelectedNode() { return this.#selectedNodeId; }
  setSelectedNode(nodeId) {
    const next = nodeId || null;
    if (next === this.#selectedNodeId) return;
    if (this.#selectedNodeId) {
      this.#nodeById(this.#selectedNodeId)?.removeAttribute("data-selected");
    }
    this.#selectedNodeId = next;
    if (next) {
      // Selecting a node clears any selected edge (mutually exclusive).
      this.setSelectedEdge(null);
      this.#nodeById(next)?.setAttribute("data-selected", "");
    }
    this.dispatchEvent(new CustomEvent("sherpa-node-select", {
      bubbles: true, composed: true,
      detail: { nodeId: next },
    }));
  }

  /**
   * Remove a node and any edges that reference it. Fires
   * `sherpa-edge-delete` for each removed edge and `sherpa-node-delete`
   * for the node itself.
   */
  removeNode(nodeId) {
    if (!nodeId) return;
    // Locked nodes (e.g. the Trigger / Output boundary nodes inside a
    // group sub-graph) cannot be removed — they represent the
    // surrounding parent's input / output sockets.
    const target = this.#nodeById(nodeId);
    if (target?.hasAttribute("data-locked")) return;
    // Remove edges referencing the node (iterate from the back so
    // splice indices stay valid).
    for (let i = this.#edges.length - 1; i >= 0; i--) {
      const e = this.#edges[i];
      if (e.from?.nodeId === nodeId || e.to?.nodeId === nodeId) {
        this.dispatchEvent(new CustomEvent("sherpa-edge-delete", {
          bubbles: true, composed: true,
          detail: { edgeIdx: i },
        }));
        this.#edges.splice(i, 1);
        if (this.#selectedEdgeIdx === i) this.#selectedEdgeIdx = -1;
        else if (this.#selectedEdgeIdx > i) this.#selectedEdgeIdx--;
      }
    }
    const node = this.#nodeById(nodeId);
    if (node) node.remove();
    if (this.#selectedNodeId === nodeId) this.#selectedNodeId = null;
    this.#hoverEdgeIdx = -1;
    this.#invalidatePortCache(nodeId);
    this.dispatchEvent(new CustomEvent("sherpa-node-delete", {
      bubbles: true, composed: true,
      detail: { nodeId },
    }));
    this.#schedulePropagate();
    this.#scheduleDraw();
  }
  setSelectedEdge(idx) {
    const next = (typeof idx === "number" && idx >= 0 && idx < this.#edges.length) ? idx : -1;
    if (next === this.#selectedEdgeIdx) return;
    this.#selectedEdgeIdx = next;
    if (next !== -1 && this.#selectedNodeId) {
      // Edge selection clears node selection (mutually exclusive).
      this.#nodeById(this.#selectedNodeId)?.removeAttribute("data-selected");
      this.#selectedNodeId = null;
      this.dispatchEvent(new CustomEvent("sherpa-node-select", {
        bubbles: true, composed: true,
        detail: { nodeId: null },
      }));
    }
    this.dispatchEvent(new CustomEvent("sherpa-edge-select", {
      bubbles: true, composed: true,
      detail: { edgeIdx: next === -1 ? null : next },
    }));
    this.#scheduleDraw();
  }

  /* ── Slot / node tracking ──────────────────────────────────────── */

  #onSlotChange = () => {
    this.#listenToNodes();
    this.#invalidatePortCache();
    this.#scheduleDraw();
  };

  #listenToNodes() {
    const nodes = this.querySelectorAll("sherpa-node");
    for (const n of nodes) {
      if (n.__sherpaCanvasBound) continue;
      n.__sherpaCanvasBound = true;
      const ro = new ResizeObserver(() => {
        this.#invalidatePortCache(n.dataset.nodeId);
        this.#scheduleDraw();
      });
      ro.observe(n);
    }
  }

  /* ── Coordinate helpers ────────────────────────────────────────── */

  /**
   * Bounding rect of the canvas *body* (the area that hosts the grid /
   * edges layers + the surface). Falls back to the host's rect before
   * `onRender` has resolved the body element. All screen-space math
   * routes through this so that an embedded view-header above the
   * body doesn't shift node / edge alignment.
   */
  #bodyRect() {
    return (this.#bodyEl ?? this).getBoundingClientRect();
  }

  #screenToWorld(sx, sy) {
    const r = this.#bodyRect();
    return {
      x: (sx - r.left - this.#viewport.x) / this.#viewport.zoom,
      y: (sy - r.top  - this.#viewport.y) / this.#viewport.zoom,
    };
  }

  /**
   * World-space position of a node port. For multi sockets the caller
   * may pass `lane` (0-based index of this connection inside the
   * multi-socket) and `count` (total connections at the socket) so we
   * spread endpoints evenly along the socket's vertical extent.
   *
   * Reads the socket's actual on-screen rect and unprojects through the
   * current viewport — this is invariant under zoom/pan because the
   * unprojection cancels whatever transform the surface has applied.
   */
  #portWorld(nodeId, portName, lane = 0, count = 1) {
    const node = this.#nodeById(nodeId);
    if (!node) return null;
    const sock = node.querySelector(
      `sherpa-node-socket[data-port-name="${CSS.escape(portName)}"]`
    );
    if (!sock) return null;
    const canvasRect = this.#bodyRect();
    const r = sock.getBoundingClientRect();
    const { x: vx, y: vy, zoom } = this.#viewport;
    const cx = (r.left + r.right) / 2 - canvasRect.left;
    const cy = (r.top  + r.bottom) / 2 - canvasRect.top;
    let wx = (cx - vx) / zoom;
    let wy = (cy - vy) / zoom;
    const side = sock.dataset.direction === "out" ? "out" : "in";
    const status = sock.dataset.status || "";
    const multi = sock.hasAttribute("data-multi");
    if (multi && count > 1) {
      // Spread lanes vertically across the socket's world-space height.
      const heightWorld = r.height / zoom;
      const top = wy - heightWorld / 2;
      wy = top + ((lane + 0.5) / count) * heightWorld;
    }
    return { x: wx, y: wy, side, status };
  }

  #nodeById(nodeId) {
    return this.querySelector(`sherpa-node[data-node-id="${CSS.escape(nodeId)}"]`);
  }

  #findSocket(nodeId, portName) {
    const node = this.#nodeById(nodeId);
    if (!node) return null;
    return node.querySelector(
      `sherpa-node-socket[data-port-name="${CSS.escape(portName)}"]`,
    );
  }

  /**
   * Return the value type a socket emits / accepts:
   *   "number" — numeric value
   *   "text"   — string value
   *   "any"    — universal (status branches, util outputs, headers
   *              with no controllable type)
   *
   * Resolution order:
   *   1. Explicit `data-value-type` on the socket wins.
   *   2. If the socket lives in a sherpa-node-row, infer from the
   *      sibling slot="control" element's tag name.
   *   3. Otherwise infer from the parent node's kind/subtype:
   *        math.*           → number
   *        variable.number  → number
   *        variable.text    → text
   *        anything else    → any
   */
  #socketType(sock) {
    if (!sock) return "any";
    if (sock.dataset.valueType) return sock.dataset.valueType;

    const row = sock.closest("sherpa-node-row");
    if (row) {
      const ctrl = row.querySelector(":scope > [slot='control']");
      if (ctrl) {
        const t = ctrl.localName;
        if (t === "sherpa-input-number") return "number";
        if (t === "sherpa-input-text"
         || t === "sherpa-input-select"
         || t === "sherpa-input-time"
         || t === "sherpa-input-date") return "text";
      }
    }

    const node    = sock.closest("sherpa-node");
    const kind    = node?.dataset?.kind || "";
    const subtype = node?.dataset?.subtype || "";
    if (kind === "math") return "number";
    if (kind === "variable") {
      if (subtype === "number") return "number";
      if (subtype === "text")   return "text";
    }
    return "any";
  }

  #typesCompatible(fromType, toType) {
    if (fromType === "any" || toType === "any") return true;
    return fromType === toType;
  }

  #invalidatePortCache(nodeId) {
    if (nodeId) this.#portCache.delete(nodeId);
    else this.#portCache.clear();
  }

  /* ── Zoom / pan ────────────────────────────────────────────────── */

  #clampZoom(z) { return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); }

  #onWheel = (e) => {
    e.preventDefault();
    // Trackpad pinch gestures are reported as wheel events with
    // ctrlKey=true (synthetic). Treat those — and the explicit
    // Ctrl/Cmd-modifier — as zoom. Plain two-finger scroll pans.
    const isZoom = e.ctrlKey || e.metaKey;
    if (!isZoom) {
      this.#viewport.x -= e.deltaX;
      this.#viewport.y -= e.deltaY;
      this.#applyTransform();
      this.#scheduleDraw();
      this.#emitViewport();
      return;
    }
    const factor = Math.exp(-e.deltaY * WHEEL_K);
    const newZoom = this.#clampZoom(this.#viewport.zoom * factor);
    if (newZoom === this.#viewport.zoom) return;
    const r = this.#bodyRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const k = newZoom / this.#viewport.zoom;
    this.#viewport.x = cx - (cx - this.#viewport.x) * k;
    this.#viewport.y = cy - (cy - this.#viewport.y) * k;
    this.#viewport.zoom = newZoom;
    this.#applyTransform();
    this.#scheduleDraw();
    this.#emitViewport();
  };

  #onPointerDown = (e) => {
    // Middle-mouse OR space+left = pan.
    if (e.button === 1 || (e.button === 0 && this.#spaceDown)) {
      e.preventDefault();
      this.#pan = {
        x0: e.clientX, y0: e.clientY,
        vx0: this.#viewport.x, vy0: this.#viewport.y,
      };
      this.setAttribute("data-grabbing", "");
      this.setPointerCapture?.(e.pointerId);
      return;
    }

    // Plain left-click: select edge under cursor, or clear selection.
    if (e.button === 0) {
      // If the click originated inside a <sherpa-node>, the
      // node-level handler (#onNodePointerDown) has already taken
      // care of selection / drag-start. Don't run the canvas
      // background logic — otherwise we would immediately clear the
      // selection we just made.
      const path = e.composedPath ? e.composedPath() : [];
      for (const n of path) {
        if (n === this) break;
        if (n?.localName === "sherpa-node") return;
      }
      const idx = this.#findEdgeAt(e.clientX, e.clientY);
      if (idx >= 0) {
        this.setSelectedNode(null);
        this.setSelectedEdge(idx);
      } else {
        // Click on bare canvas — clear both edge and node selection.
        this.setSelectedEdge(null);
        this.setSelectedNode(null);
      }
    }
  };

  #onPointerMove = (e) => {
    this.#lastClientX = e.clientX;
    this.#lastClientY = e.clientY;

    if (this.#pan) {
      this.#viewport.x = this.#pan.vx0 + (e.clientX - this.#pan.x0);
      this.#viewport.y = this.#pan.vy0 + (e.clientY - this.#pan.y0);
      this.#applyTransform();
      this.#scheduleDraw();
      return;
    }
    if (this.#nodeDrag) {
      const dx = (e.clientX - this.#nodeDrag.x0) / this.#viewport.zoom;
      const dy = (e.clientY - this.#nodeDrag.y0) / this.#viewport.zoom;
      const node = this.#nodeById(this.#nodeDrag.nodeId);
      if (node) {
        node.dataset.x = String(this.#nodeDrag.nx0 + dx);
        node.dataset.y = String(this.#nodeDrag.ny0 + dy);
      }
      this.#scheduleDraw();
      return;
    }
    if (this.#drag) {
      const w = this.#screenToWorld(e.clientX, e.clientY);
      this.#drag.cursorX = w.x;
      this.#drag.cursorY = w.y;
      this.#scheduleDraw();
      return;
    }

    // Idle hover — update hovered edge.
    const idx = this.#findEdgeAt(e.clientX, e.clientY);
    if (idx !== this.#hoverEdgeIdx) {
      this.#hoverEdgeIdx = idx;
      this.style.cursor = idx >= 0 ? "pointer" : "";
      this.#scheduleDraw();
    }
  };

  #onPointerUp = (e) => {
    if (this.#pan) {
      this.#pan = null;
      this.removeAttribute("data-grabbing");
      this.#emitViewport();
    }
    if (this.#nodeDrag) {
      this.#nodeDrag = null;
    }
    if (this.#drag) {
      const drop = this.#findDropTarget(e.clientX, e.clientY);
      const drag = this.#drag;
      this.#drag = null;

      if (drag.redirectIdx != null) {
        // Re-attach mode.
        if (!drop) {
          // Dropped on empty canvas → delete the edge.
          this.dispatchEvent(new CustomEvent("sherpa-edge-delete", {
            bubbles: true, composed: true,
            detail: { edgeIdx: drag.redirectIdx },
          }));
          this.#edges.splice(drag.redirectIdx, 1);
          if (this.#selectedEdgeIdx === drag.redirectIdx) this.#selectedEdgeIdx = -1;
        } else if (drop.side === drag.fromSide && drop.nodeId !== drag.redirectFixedEnd.nodeId) {
          // Dropped on a same-side socket on a different node → re-attach.
          const edge = { ...this.#edges[drag.redirectIdx] };
          if (drag.fromSide === "in") {
            edge.to = { nodeId: drop.nodeId, portName: drop.portName };
          } else {
            edge.from = { nodeId: drop.nodeId, portName: drop.portName };
          }
          // Same type-compat gate as fresh connections.
          const fromSock = this.#findSocket(edge.from.nodeId, edge.from.portName);
          const toSock   = this.#findSocket(edge.to.nodeId,   edge.to.portName);
          if (!this.#typesCompatible(this.#socketType(fromSock), this.#socketType(toSock))) {
            this.#scheduleDraw();
            return;
          }
          this.#edges[drag.redirectIdx] = edge;
          this.dispatchEvent(new CustomEvent("sherpa-edge-update", {
            bubbles: true, composed: true,
            detail: { edgeIdx: drag.redirectIdx, edge },
          }));
        }
        // Otherwise: invalid drop → snap back (no-op).
      } else {
        // Fresh-connection mode.
        if (drop && drop.nodeId !== drag.fromNodeId && drop.side !== drag.fromSide) {
          const a = { nodeId: drag.fromNodeId, portName: drag.fromPortName, side: drag.fromSide };
          const b = drop;
          const out = a.side === "out" ? a : b;
          const inn = a.side === "out" ? b : a;
          // Type-compatibility gate: a `text` output cannot feed a
          // `number` input (and vice-versa). `any` is universal.
          const fromSock = this.#findSocket(out.nodeId, out.portName);
          const toSock   = this.#findSocket(inn.nodeId, inn.portName);
          if (!this.#typesCompatible(this.#socketType(fromSock), this.#socketType(toSock))) {
            this.#scheduleDraw();
            return;
          }
          const edge = {
            from: { nodeId: out.nodeId, portName: out.portName },
            to:   { nodeId: inn.nodeId, portName: inn.portName },
            control: false,
          };
          this.dispatchEvent(new CustomEvent("sherpa-edge-create", {
            bubbles: true, composed: true,
            detail: edge,
          }));
        }
      }
      this.#scheduleDraw();
    }
  };

  #onKeyDown = (e) => {
    if (e.code === "Space" && !this.#spaceDown) {
      this.#spaceDown = true;
      this.setAttribute("data-space-down", "");
    }
    // Delete selected edge.
    if ((e.code === "Delete" || e.code === "Backspace") && this.#selectedEdgeIdx >= 0) {
      if (this.#focusInsideEditableControl()) return;
      const idx = this.#selectedEdgeIdx;
      this.dispatchEvent(new CustomEvent("sherpa-edge-delete", {
        bubbles: true, composed: true,
        detail: { edgeIdx: idx },
      }));
      this.#edges.splice(idx, 1);
      this.#selectedEdgeIdx = -1;
      this.#hoverEdgeIdx = -1;
      this.#scheduleDraw();
      return;
    }
    // Delete selected node (and any edges touching it).
    if ((e.code === "Delete" || e.code === "Backspace") && this.#selectedNodeId) {
      // Don't intercept the key when the user is actually editing a
      // control inside a node (text input, textarea, contentEditable,
      // or any sherpa-input-* host whose shadow root has focus).
      if (this.#focusInsideEditableControl()) return;
      e.preventDefault();
      this.removeNode(this.#selectedNodeId);
    }
  };
  #onKeyUp = (e) => {
    if (e.code === "Space") {
      this.#spaceDown = false;
      this.removeAttribute("data-space-down");
    }
  };

  /** True when the deepest focused element is a text-editable control
   *  (native input/textarea/contentEditable) — including ones inside
   *  the shadow DOM of a sherpa-input-* component. Used to suppress
   *  delete-key node/edge removal while typing. */
  #focusInsideEditableControl() {
    let el = document.activeElement;
    // Walk into nested shadow roots to find the real focus target.
    while (el?.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      const type = (el.type || "text").toLowerCase();
      // Buttons / boxes don't consume the delete key for text editing.
      return !["button", "checkbox", "radio", "submit", "reset", "image", "file"].includes(type);
    }
    return false;
  }

  /* ── Edge drag / re-attach ─────────────────────────────────────── */

  #onSocketPointerDown = (e) => {
    const { direction, portName, originalEvent } = e.detail;
    const socket = e.composedPath().find((n) => n?.localName === "sherpa-node-socket");
    const node = socket?.closest("sherpa-node");
    if (!node) return;
    const nodeId = node.dataset.nodeId;
    if (!nodeId) return;

    // If this is an INPUT socket and an existing edge ends here, enter
    // re-attach mode for the closest one (by endpoint Y).
    if (direction === "in") {
      const candidate = this.#findEdgeEndingAt(nodeId, portName, originalEvent.clientX, originalEvent.clientY);
      if (candidate) {
        const edge = this.#edges[candidate.idx];
        const fixed = edge.from; // we picked up the "to" end
        const w = this.#screenToWorld(originalEvent.clientX, originalEvent.clientY);
        this.#drag = {
          redirectIdx: candidate.idx,
          redirectFixedEnd: fixed,
          fromNodeId: fixed.nodeId,
          fromPortName: fixed.portName,
          fromSide: "in",          // we are dragging the "in" end
          cursorX: w.x,
          cursorY: w.y,
        };
        this.setPointerCapture?.(originalEvent.pointerId);
        this.#scheduleDraw();
        return;
      }
    }

    const w = this.#screenToWorld(originalEvent.clientX, originalEvent.clientY);
    this.#drag = {
      fromNodeId: nodeId,
      fromPortName: portName,
      fromSide: direction,
      cursorX: w.x,
      cursorY: w.y,
    };
    this.setPointerCapture?.(originalEvent.pointerId);
    this.#scheduleDraw();
  };

  #onNodePointerDown = (e) => {
    const { nodeId, originalEvent } = e.detail;
    if (!nodeId || this.#spaceDown) return;
    const node = this.#nodeById(nodeId);
    if (!node) return;
    // Click on a node selects it (and clears any selected edge).
    this.setSelectedNode(nodeId);
    this.#nodeDrag = {
      nodeId,
      x0: originalEvent.clientX,
      y0: originalEvent.clientY,
      nx0: parseFloat(node.dataset.x || "0") || 0,
      ny0: parseFloat(node.dataset.y || "0") || 0,
    };
  };

  #findDropTarget(clientX, clientY) {
    const w = this.#screenToWorld(clientX, clientY);
    const hitR = HIT_R / this.#viewport.zoom;
    let best = null;
    let bestD = Infinity;
    const sockets = this.querySelectorAll("sherpa-node sherpa-node-socket[data-port-name]");
    for (const sock of sockets) {
      const node = sock.closest("sherpa-node");
      const id = node?.dataset?.nodeId;
      if (!id) continue;
      const portName = sock.dataset.portName;
      const pos = this.#portWorld(id, portName);
      if (!pos) continue;
      const d = Math.hypot(pos.x - w.x, pos.y - w.y);
      if (d < hitR && d < bestD) {
        best = { nodeId: id, portName, side: pos.side };
        bestD = d;
      }
    }
    return best;
  }

  /** Find an edge whose "to" end matches (nodeId, portName), preferring
   *  the one whose endpoint Y is closest to (clientX, clientY). */
  #findEdgeEndingAt(nodeId, portName, clientX, clientY) {
    const w = this.#screenToWorld(clientX, clientY);
    const candidates = [];
    for (let i = 0; i < this.#edges.length; i++) {
      const e = this.#edges[i];
      if (e.to.nodeId === nodeId && e.to.portName === portName) {
        candidates.push(i);
      }
    }
    if (!candidates.length) return null;
    if (candidates.length === 1) return { idx: candidates[0] };
    // Compute spread positions to pick closest by Y.
    const count = candidates.length;
    let bestIdx = candidates[0];
    let bestD = Infinity;
    for (let lane = 0; lane < count; lane++) {
      const idx = candidates[lane];
      const pos = this.#portWorld(nodeId, portName, lane, count);
      if (!pos) continue;
      const d = Math.hypot(pos.x - w.x, pos.y - w.y);
      if (d < bestD) { bestD = d; bestIdx = idx; }
    }
    return { idx: bestIdx };
  }

  /* ── Edge hit-testing ──────────────────────────────────────────── */

  #findEdgeAt(clientX, clientY) {
    const r = this.#bodyRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    let best = -1;
    let bestD = EDGE_HIT_PX;
    for (let i = 0; i < this.#edges.length; i++) {
      const pts = this.#edgeScreenSamples(i);
      if (!pts) continue;
      for (let k = 1; k < pts.length; k++) {
        const d = pointSegDist(sx, sy, pts[k - 1].x, pts[k - 1].y, pts[k].x, pts[k].y);
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    return best;
  }

  /** Return Array<{x,y}> of polyline samples for an edge in screen space. */
  #edgeScreenSamples(edgeIdx) {
    const edge = this.#edges[edgeIdx];
    if (!edge) return null;
    const counts = this.#multiCounts();
    const fromKey = edge.from.nodeId + "\0" + edge.from.portName;
    const toKey   = edge.to.nodeId   + "\0" + edge.to.portName;
    const fromInfo = counts.get(fromKey);
    const toInfo   = counts.get(toKey);
    const fromLane = fromInfo ? fromInfo.lanes.get(edgeIdx) ?? 0 : 0;
    const fromCount = fromInfo ? fromInfo.lanes.size : 1;
    const toLane = toInfo ? toInfo.lanes.get(edgeIdx) ?? 0 : 0;
    const toCount = toInfo ? toInfo.lanes.size : 1;
    const a = this.#portWorld(edge.from.nodeId, edge.from.portName, fromLane, fromCount);
    const b = this.#portWorld(edge.to.nodeId,   edge.to.portName,   toLane,   toCount);
    if (!a || !b) return null;
    const { x: vx, y: vy, zoom } = this.#viewport;
    const x0 = a.x * zoom + vx, y0 = a.y * zoom + vy;
    const x1 = b.x * zoom + vx, y1 = b.y * zoom + vy;
    const dx = Math.max(40, Math.abs(x1 - x0) * 0.5);
    const c1x = x0 + dx, c1y = y0;
    const c2x = x1 - dx, c2y = y1;
    const out = [];
    for (let i = 0; i <= BEZIER_SAMPLES; i++) {
      const t = i / BEZIER_SAMPLES;
      out.push(cubic(t, x0, y0, c1x, c1y, c2x, c2y, x1, y1));
    }
    return out;
  }

  /* ── Multi-socket lane assignment ──────────────────────────────── */

  /**
   * Walk #edges and, per (nodeId,portName), build:
   *   {lanes: Map<edgeIdx, lane>, multi:bool}
   * Also writes data-connection-count onto the corresponding socket.
   */
  #multiCounts() {
    const map = new Map(); // key → {lanes:Map<edgeIdx,lane>}
    const touch = (nodeId, portName, edgeIdx) => {
      const k = nodeId + "\0" + portName;
      let entry = map.get(k);
      if (!entry) {
        entry = { lanes: new Map(), nodeId, portName };
        map.set(k, entry);
      }
      const nextLane = entry.lanes.size;
      entry.lanes.set(edgeIdx, nextLane);
    };
    for (let i = 0; i < this.#edges.length; i++) {
      touch(this.#edges[i].from.nodeId, this.#edges[i].from.portName, i);
      touch(this.#edges[i].to.nodeId,   this.#edges[i].to.portName,   i);
    }
    // Mirror count to sockets.
    const seen = new Set();
    for (const { nodeId, portName, lanes } of map.values()) {
      const node = this.#nodeById(nodeId);
      if (!node) continue;
      const sock = node.querySelector(`sherpa-node-socket[data-port-name="${CSS.escape(portName)}"]`);
      if (!sock) continue;
      const count = lanes.size;
      seen.add(sock);
      const cur = sock.getAttribute("data-connection-count");
      if (cur !== String(count)) sock.setAttribute("data-connection-count", String(count));
      if (!sock.hasAttribute("data-connected")) sock.setAttribute("data-connected", "");
    }
    // Reset sockets that no longer have any connection.
    for (const sock of this.querySelectorAll("sherpa-node-socket[data-connected]")) {
      if (!seen.has(sock)) {
        sock.removeAttribute("data-connected");
        sock.setAttribute("data-connection-count", "0");
      }
    }
    return map;
  }

  /* ── Rendering ─────────────────────────────────────────────────── */

  #applyTransform() {
    if (!this.#surfaceEl) return;
    const { x, y, zoom } = this.#viewport;
    this.#surfaceEl.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
  }

  #scheduleDraw() {
    if (this.#rafPending) return;
    this.#rafPending = true;
    requestAnimationFrame(() => {
      this.#rafPending = false;
      this.#draw();
    });
  }

  /* ── Value propagation ─────────────────────────────────────────── */

  // Tracks every input we've driven so we can clear those that are no
  // longer connected. Keyed by `${nodeId}|${portName}`.
  #drivenInputs = new Set();
  #propagatePending = false;

  #onNodeValueChange = () => { this.#schedulePropagate(); };

  #schedulePropagate() {
    if (this.#propagatePending) return;
    this.#propagatePending = true;
    queueMicrotask(() => {
      this.#propagatePending = false;
      this.#propagateValues();
    });
  }

  /**
   * Walk the graph and copy each edge's source output value into the
   * matching downstream input control. Iterates until values stabilise
   * (or a hard cap is reached) so chains like `Variable → Math → Math`
   * settle in one user action.
   */
  #propagateValues() {
    // 1. Build node lookup once.
    const nodeMap = new Map();
    for (const n of this.querySelectorAll("sherpa-node")) {
      const id = n.dataset.nodeId;
      if (id) nodeMap.set(id, n);
    }
    // 2. Group edges by target nodeId for fast lookup of incoming values.
    const incomingByNode = new Map();   // nodeId → Map<portName, value | value[]>
    const targetKeys = new Set();       // "nodeId|portName" of every connected input
    for (const e of this.#edges) {
      if (!e?.from || !e?.to) continue;
      targetKeys.add(`${e.to.nodeId}|${e.to.portName}`);
    }

    // 3. Iterate to a fixed point (max 8 passes — graph depth is small).
    const MAX_PASSES = 8;
    let prevSnapshot = "";
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      // Reset incoming map each pass; re-resolve from current node state.
      incomingByNode.clear();
      for (const e of this.#edges) {
        if (!e?.from || !e?.to) continue;
        const src = nodeMap.get(e.from.nodeId);
        if (!src) continue;
        // Source's own incoming map for this pass (may be empty on
        // pass 0 but populated on subsequent passes).
        const srcIncoming = this.#asPlainIncoming(incomingByNode.get(e.from.nodeId));
        const value = src.getOutputValue?.(e.from.portName, srcIncoming) ?? null;

        let bucket = incomingByNode.get(e.to.nodeId);
        if (!bucket) { bucket = new Map(); incomingByNode.set(e.to.nodeId, bucket); }

        const existing = bucket.get(e.to.portName);
        if (existing === undefined) {
          bucket.set(e.to.portName, value);
        } else if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          bucket.set(e.to.portName, [existing, value]);
        }
      }

      // Apply incoming values to target inputs.
      const nextDriven = new Set();
      for (const [nodeId, bucket] of incomingByNode) {
        const node = nodeMap.get(nodeId);
        if (!node) continue;
        for (const [port, value] of bucket) {
          // Multi-input ports (data-multi sockets like math.average) don't
          // map to a single row control — they're consumed by the node's
          // own getOutputValue. Skip the writeback for those.
          const v = Array.isArray(value) ? value[value.length - 1] : value;
          node.setInputValue?.(port, v);
          nextDriven.add(`${nodeId}|${port}`);
        }
      }

      // Snapshot for fixed-point detection.
      const snapshot = JSON.stringify([...incomingByNode].map(
        ([k, m]) => [k, [...m]],
      ));
      if (snapshot === prevSnapshot) break;
      prevSnapshot = snapshot;
    }

    // 4. Clear inputs we previously drove that are no longer connected.
    for (const key of this.#drivenInputs) {
      if (targetKeys.has(key)) continue;
      const [nodeId, port] = key.split("|");
      nodeMap.get(nodeId)?.clearInputValue?.(port);
    }
    this.#drivenInputs = targetKeys;
  }

  #asPlainIncoming(bucket) {
    if (!bucket) return {};
    const out = {};
    for (const [k, v] of bucket) out[k] = v;
    return out;
  }

  #resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.#bodyRect();
    for (const cv of [this.#gridCanvas, this.#edgesCanvas]) {
      if (!cv) continue;
      cv.width  = Math.max(1, Math.floor(r.width  * dpr));
      cv.height = Math.max(1, Math.floor(r.height * dpr));
    }
    this.#gridCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.#edgesCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.#scheduleDraw();
  }

  #draw() {
    this.#drawGrid();
    this.#drawEdges();
  }

  #drawGrid() {
    const ctx = this.#gridCtx;
    if (!ctx) return;
    const r = this.#bodyRect();
    ctx.clearRect(0, 0, r.width, r.height);
    if (this.dataset.grid === "none") return;

    const { x: vx, y: vy } = this.#viewport;
    const css = getComputedStyle(this);
    // Step is in *screen* pixels — fixed visual density regardless of
    // zoom. Pan still slides the crosshairs so the grid feels attached
    // to the canvas, but each cell is always the same size on screen.
    const step = parseFloat(css.getPropertyValue("--sherpa-node-canvas-grid-step")) || 72;
    const arm = parseFloat(css.getPropertyValue("--sherpa-node-canvas-grid-arm")) || 3;
    const color = this.#resolveColor("--sherpa-node-canvas-grid-color", "rgba(127,127,127,0.35)");

    if (step < 6) return;

    const startX = ((vx % step) + step) % step;
    const startY = ((vy % step) + step) % step;

    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let sy = startY; sy < r.height; sy += step) {
      for (let sx = startX; sx < r.width; sx += step) {
        ctx.moveTo(sx - arm, sy);
        ctx.lineTo(sx + arm, sy);
        ctx.moveTo(sx, sy - arm);
        ctx.lineTo(sx, sy + arm);
      }
    }
    ctx.stroke();
  }

  /**
   * Resolve a CSS custom property to a concrete colour string by
   * applying it to a probe element and reading back the computed
   * `color` value. This is necessary because
   * `getPropertyValue('--foo')` returns the *specified* value, which
   * for our tokens is still a `var(...)` chain — unusable as a
   * canvas strokeStyle. The probe forces the cascade to resolve.
   */
  #resolveColor(varName, fallback) {
    let probe = this.#colorProbe;
    if (!probe) {
      probe = document.createElement("span");
      probe.className = "color-probe";
      this.shadowRoot.appendChild(probe);
      this.#colorProbe = probe;
    }
    probe.style.color = `var(${varName}, ${fallback})`;
    const c = getComputedStyle(probe).color;
    return c || fallback;
  }

  #drawEdges() {
    const ctx = this.#edgesCtx;
    if (!ctx) return;
    const r = this.#bodyRect();
    ctx.clearRect(0, 0, r.width, r.height);

    const counts = this.#multiCounts();

    const css = getComputedStyle(this);
    const colorDefault  = this.#resolveColor("--sherpa-node-edge-color",          "#7a8194");
    const colorHover    = this.#resolveColor("--sherpa-node-edge-color-hover",    colorDefault);
    const colorSelected = this.#resolveColor("--sherpa-node-edge-color-selected", colorDefault);
    const colorControl  = this.#resolveColor("--sherpa-node-edge-color-control",  "#ff8a00");
    const colorTrue     = this.#resolveColor("--sherpa-node-edge-color-true",     "#1f9d55");
    const colorFalse    = this.#resolveColor("--sherpa-node-edge-color-false",    "#cc1f1a");
    const colorGhost    = this.#resolveColor("--sherpa-node-edge-color-ghost",    "#3b82f6");
    const widthDefault  = parseFloat(css.getPropertyValue("--sherpa-node-edge-width"))          || 1.5;
    const widthHover    = parseFloat(css.getPropertyValue("--sherpa-node-edge-width-hover"))    || 2.25;
    const widthSelected = parseFloat(css.getPropertyValue("--sherpa-node-edge-width-selected")) || 2.5;

    const palette = {
      default: colorDefault,
      hover: colorHover,
      selected: colorSelected,
      control: colorControl,
      true: colorTrue,
      false: colorFalse,
    };

    const { x: vx, y: vy, zoom } = this.#viewport;

    // First pass: defaults
    for (let i = 0; i < this.#edges.length; i++) {
      if (i === this.#hoverEdgeIdx || i === this.#selectedEdgeIdx) continue;
      this.#strokeEdge(ctx, i, counts, this.#edgeColor(i, palette, "default"), widthDefault);
    }
    if (this.#hoverEdgeIdx >= 0 && this.#hoverEdgeIdx !== this.#selectedEdgeIdx) {
      this.#strokeEdge(ctx, this.#hoverEdgeIdx, counts,
        this.#edgeColor(this.#hoverEdgeIdx, palette, "hover"), widthHover);
    }
    if (this.#selectedEdgeIdx >= 0) {
      this.#strokeEdge(ctx, this.#selectedEdgeIdx, counts,
        this.#edgeColor(this.#selectedEdgeIdx, palette, "selected"), widthSelected);
    }

    // Live drag preview
    if (this.#drag) {
      let a;
      if (this.#drag.redirectIdx != null) {
        const fixed = this.#drag.redirectFixedEnd;
        a = this.#portWorld(fixed.nodeId, fixed.portName);
      } else {
        a = this.#portWorld(this.#drag.fromNodeId, this.#drag.fromPortName);
      }
      if (a) {
        const ax = a.x * zoom + vx;
        const ay = a.y * zoom + vy;
        const bx = this.#drag.cursorX * zoom + vx;
        const by = this.#drag.cursorY * zoom + vy;
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = colorGhost;
        ctx.lineWidth = widthDefault;
        const dx = Math.max(40, Math.abs(bx - ax) * 0.5);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.bezierCurveTo(ax + dx, ay, bx - dx, by, bx, by);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /**
   * Pick the colour for an edge given a state (default / hover / selected).
   * Status edges (true/false outputs) and control edges always win over
   * the default colour, but hover/selected colours still override them.
   */
  #edgeColor(edgeIdx, palette, state) {
    const edge = this.#edges[edgeIdx];
    if (!edge) return palette.default;
    if (state === "hover")    return palette.hover;
    if (state === "selected") return palette.selected;
    if (edge.control) return palette.control;
    // Read the from-socket's data-status to colour true/false outputs.
    const node = this.#nodeById(edge.from.nodeId);
    const sock = node?.querySelector(
      `sherpa-node-socket[data-port-name="${CSS.escape(edge.from.portName)}"]`
    );
    const status = sock?.dataset?.status;
    if (status === "true")  return palette.true;
    if (status === "false") return palette.false;
    return palette.default;
  }

  #strokeEdge(ctx, edgeIdx, counts, color, width) {
    const edge = this.#edges[edgeIdx];
    if (!edge) return;
    const fromKey = edge.from.nodeId + "\0" + edge.from.portName;
    const toKey   = edge.to.nodeId + "\0" + edge.to.portName;
    const fromInfo = counts.get(fromKey);
    const toInfo   = counts.get(toKey);
    const fromLane = fromInfo ? fromInfo.lanes.get(edgeIdx) ?? 0 : 0;
    const fromCount = fromInfo ? fromInfo.lanes.size : 1;
    const toLane = toInfo ? toInfo.lanes.get(edgeIdx) ?? 0 : 0;
    const toCount = toInfo ? toInfo.lanes.size : 1;
    const a = this.#portWorld(edge.from.nodeId, edge.from.portName, fromLane, fromCount);
    const b = this.#portWorld(edge.to.nodeId,   edge.to.portName,   toLane,   toCount);
    if (!a || !b) return;
    const { x: vx, y: vy, zoom } = this.#viewport;
    const x0 = a.x * zoom + vx, y0 = a.y * zoom + vy;
    const x1 = b.x * zoom + vx, y1 = b.y * zoom + vy;
    const dx = Math.max(40, Math.abs(x1 - x0) * 0.5);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0 + dx, y0, x1 - dx, y1, x1, y1);
    ctx.stroke();
  }

  /* ── Drill-down (sub-graph navigation) ─────────────────────────── */

  /**
   * Snapshot the current frame, clear the canvas, and notify the
   * outside world that we've entered a sub-graph for the given parent
   * node. The header label, back-button visibility, and breadcrumb
   * trail update automatically.
   *
   * Consumers should listen for `sherpa-canvas-subgraph-enter` and
   * populate the canvas with the sub-graph contents (or a starter
   * graph if no cached snapshot exists).
   *
   * @fires sherpa-canvas-subgraph-enter
   *   bubbles: true, composed: true
   *   detail: { parentId, label, depth, cached:boolean }
   */
  pushSubgraph(parentId, label) {
    if (!parentId) return;
    const snapshot = this.#snapshot();
    const resolvedLabel = label ?? this.#labelForNode(parentId) ?? parentId;
    this.#drillStack.push({ parentId, label: resolvedLabel, snapshot });
    this.#clearFrame();
    const cached = this.#subgraphs.get(parentId);
    if (cached) this.#restore(cached);
    this.#syncHeader();
    this.dispatchEvent(new CustomEvent("sherpa-canvas-subgraph-enter", {
      bubbles: true, composed: true,
      detail: { parentId, label: resolvedLabel, depth: this.#drillStack.length, cached: !!cached },
    }));
  }

  /**
   * Pop the top of the drill stack and restore the previous frame.
   * Returns the popped frame ({ parentId, label, snapshot }) or null
   * if the stack is empty.
   *
   * @fires sherpa-canvas-subgraph-exit
   *   bubbles: true, composed: true
   *   detail: { parentId, label, depth }
   */
  popSubgraph() {
    if (!this.#drillStack.length) return null;
    const frame = this.#drillStack.pop();
    // Cache whatever the user did inside the sub-graph so the next
    // pushSubgraph(sameParent) restores it.
    this.#subgraphs.set(frame.parentId, this.#snapshot());
    this.#clearFrame();
    this.#restore(frame.snapshot);
    this.#syncHeader();
    this.dispatchEvent(new CustomEvent("sherpa-canvas-subgraph-exit", {
      bubbles: true, composed: true,
      detail: { parentId: frame.parentId, label: frame.label, depth: this.#drillStack.length },
    }));
    return frame;
  }

  /** Drop any cached child snapshot for the given parent (e.g. after
   *  the parent group node is deleted). */
  forgetSubgraph(parentId) {
    if (!parentId) return;
    this.#subgraphs.delete(parentId);
  }

  /** Drop the entire drill stack + child cache and return to root. */
  resetDrill() {
    this.#drillStack.length = 0;
    this.#subgraphs.clear();
    this.#syncHeader();
  }

  /** Current drill depth (0 = root). */
  getDepth() { return this.#drillStack.length; }

  /** Read-only copy of the drill stack: top of stack is last. */
  getDrillStack() {
    return this.#drillStack.map((f) => ({ parentId: f.parentId, label: f.label }));
  }

  /** Convenience: top frame, or null. */
  getCurrentSubgraph() {
    if (!this.#drillStack.length) return null;
    const top = this.#drillStack[this.#drillStack.length - 1];
    return { parentId: top.parentId, label: top.label };
  }

  #onNodeDrillDown = (e) => {
    const nodeId = e.detail?.nodeId;
    if (!nodeId) return;
    const label = e.detail?.label ?? this.#labelForNode(nodeId);
    this.pushSubgraph(nodeId, label);
  };

  #onViewHeaderBack = () => {
    this.popSubgraph();
  };

  /**
   * Capture the current frame so it can be restored later. Walks
   * <input>/<select>/<textarea> and bakes their `.value` into the
   * `value` attribute so the cloned subtree round-trips faithfully.
   */
  #snapshot() {
    const liveNodes = [...this.children].filter((el) => el.tagName?.toLowerCase() === "sherpa-node");
    const cloned = liveNodes.map((node) => {
      const liveControls = node.querySelectorAll("input, select, textarea");
      const clone = node.cloneNode(true);
      const cloneControls = clone.querySelectorAll("input, select, textarea");
      for (let i = 0; i < liveControls.length && i < cloneControls.length; i++) {
        const src = liveControls[i];
        const tgt = cloneControls[i];
        if (src.type === "checkbox" || src.type === "radio") {
          if (src.checked) tgt.setAttribute("checked", "");
          else tgt.removeAttribute("checked");
        } else {
          tgt.setAttribute("value", src.value);
          if (tgt.tagName === "TEXTAREA") tgt.textContent = src.value;
        }
      }
      return clone;
    });
    return {
      nodes: cloned,
      edges: this.getEdges(),
      viewport: this.getViewport(),
    };
  }

  /** Remove all <sherpa-node> children + clear edges. Viewport untouched. */
  #clearFrame() {
    const live = [...this.children].filter((el) => el.tagName?.toLowerCase() === "sherpa-node");
    for (const n of live) n.remove();
    this.setEdges([]);
    this.setSelectedNode(null);
  }

  /** Inverse of #snapshot: append cloned nodes, restore edges + viewport. */
  #restore(snap) {
    if (!snap) return;
    for (const n of snap.nodes) this.appendChild(n);
    if (snap.edges) this.setEdges(snap.edges);
    if (snap.viewport) this.setViewport(snap.viewport);
  }

  #labelForNode(nodeId) {
    const node = this.#nodeById?.(nodeId) ?? this.querySelector(`sherpa-node[data-node-id="${nodeId}"]`);
    if (!node) return null;
    // Prefer the slotted [slot="title"] text on the node header.
    const title = node.querySelector('[slot="title"]');
    if (title?.textContent?.trim()) return title.textContent.trim();
    return node.dataset.label || node.dataset.nodeId || null;
  }

  /** Sync embedded view-header attrs + breadcrumb trail from drill stack. */
  #syncHeader() {
    // Reflect the current drill depth on the host so consumers can
    // style nested-frame state (e.g. hide root-only header actions).
    const depth = this.#drillStack.length;
    this.setAttribute("data-depth", String(depth));
    const header = this.#viewHeaderEl;
    if (!header) return;
    const stack = this.#drillStack;
    const rootHeading = this.getAttribute("data-heading") || "";
    const exportTitle = this.getAttribute("data-export-title");
    if (exportTitle != null) header.setAttribute("data-export-title", exportTitle);
    else header.removeAttribute("data-export-title");
    // Heading: top of stack label, falling back to data-heading at root.
    if (stack.length) {
      header.setAttribute("data-label", stack[stack.length - 1].label);
      header.setAttribute("data-back-button", "true");
    } else {
      if (rootHeading) header.setAttribute("data-label", rootHeading);
      else header.removeAttribute("data-label");
      header.removeAttribute("data-back-button");
    }
    // Breadcrumbs: ancestor trail (root + intermediate frames). Skip
    // when at root.
    for (const old of header.querySelectorAll(':scope > sherpa-breadcrumbs[data-canvas-breadcrumbs]')) {
      old.remove();
    }
    if (stack.length) {
      const crumbs = document.createElement("sherpa-breadcrumbs");
      crumbs.setAttribute("slot", "breadcrumbs");
      crumbs.setAttribute("data-canvas-breadcrumbs", "");
      // Trail: [root?, ...ancestor frame labels]. The current frame
      // (top of stack) is rendered as the view-header label, not as a
      // crumb. Each crumb is an <a> so sherpa-breadcrumbs makes it
      // clickable; the href is a sentinel — we handle navigation via
      // the `breadcrumb-click` event.
      const trail = [];
      if (rootHeading) trail.push({ label: rootHeading, depth: 0 });
      for (let i = 0; i < stack.length - 1; i++) {
        trail.push({ label: stack[i].label, depth: i + 1 });
      }
      for (const { label, depth: targetDepth } of trail) {
        const a = document.createElement("a");
        a.href = "#";
        a.textContent = label;
        a.dataset.targetDepth = String(targetDepth);
        crumbs.appendChild(a);
      }
      crumbs.addEventListener("breadcrumb-click", this.#onBreadcrumbClick);
      header.appendChild(crumbs);
    }
  }

  /**
   * Pop drill frames until reaching the depth associated with the
   * clicked crumb. Each frame is popped via the public `popSubgraph`
   * API so per-frame snapshots are cached the same way as a back-button
   * click — re-entering the parent later restores the work.
   */
  #onBreadcrumbClick = (e) => {
    e.preventDefault?.();
    const trail = this.#viewHeaderEl?.querySelector(
      ':scope > sherpa-breadcrumbs[data-canvas-breadcrumbs]'
    );
    if (!trail) return;
    const idx = e.detail?.index;
    if (typeof idx !== "number") return;
    const link = trail.querySelectorAll("a")[idx];
    const target = Number(link?.dataset.targetDepth);
    if (!Number.isFinite(target)) return;
    while (this.#drillStack.length > target) this.popSubgraph();
  };

  /* ── Utilities ─────────────────────────────────────────────────── */

  #normEdge(e) {
    return {
      from: { nodeId: e.from.nodeId, portName: e.from.portName },
      to:   { nodeId: e.to.nodeId,   portName: e.to.portName },
      control: !!e.control,
    };
  }

  #emitViewport() {
    this.dispatchEvent(new CustomEvent("sherpa-viewport-change", {
      bubbles: true, composed: true,
      detail: this.getViewport(),
    }));
  }
}

/* ── Geometry helpers ─────────────────────────────────────────────── */

function cubic(t, x0, y0, x1, y1, x2, y2, x3, y3) {
  const u = 1 - t;
  const uu = u * u, uuu = uu * u;
  const tt = t * t, ttt = tt * t;
  return {
    x: uuu * x0 + 3 * uu * t * x1 + 3 * u * tt * x2 + ttt * x3,
    y: uuu * y0 + 3 * uu * t * y1 + 3 * u * tt * y2 + ttt * y3,
  };
}

function pointSegDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x0) * dx + (py - y0) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x0 + t * dx, cy = y0 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function edgeColor(edge, base, control) {
  return edge.control ? control : base;
}

if (!customElements.get("sherpa-node-canvas")) {
  customElements.define("sherpa-node-canvas", SherpaNodeCanvas);
}
