/**
 * ResizeBehavior — Mixin for grid-resizable containers.
 *
 * Provides column/row span adjustment via menu events dispatched by
 * the `data-event` mechanism on `sherpa-overlay-item` elements.
 *
 * On connect, the mixin injects a `<template data-menu>` into the
 * host's light DOM containing Width and Height menu groups.
 * The button's composed-tree template collection picks them up
 * automatically when the overflow menu opens.
 *
 * Consumed events (auto-dispatched from menu items via data-event):
 *   container-increase-cols — Step up to the next column stop
 *   container-decrease-cols — Step down to the previous column stop
 *   container-increase-rows — Increment row span (max 6)
 *   container-decrease-rows — Decrement row span (min 1)
 *
 * Column stops: 3, 6, 9, 12
 * Row span range: 1–6
 *
 * Usage:
 *   import { ResizeBehavior } from '../utilities/resize-behavior.js';
 *   class MyContainer extends ResizeBehavior(SherpaElement) { ... }
 */

/* ── Constants ─────────────────────────────────────────────────── */

const COL_STOPS = [3, 6, 9, 12];
const MIN_ROW_SPAN = 1;
const MAX_ROW_SPAN = 6;

/* ── Type Definitions ─────────────────────────────────────────────── */

/** ResizeBehavior interface for type safety */
export interface ResizeBehaviorInterface {
  _resizeMenuTpl: HTMLTemplateElement | null;
}

/* ── Menu template (inlined) ────────────────────────────────────── */

const RESIZE_MENU_HTML = `
  <sherpa-overlay-item data-type="heading">Width</sherpa-overlay-item>
  <ul data-group="width">
    <li><sherpa-overlay-item data-event="container-decrease-cols" data-icon="fa-solid fa-minus">Decrease</sherpa-overlay-item></li>
    <li><sherpa-overlay-item data-event="container-increase-cols" data-icon="fa-solid fa-plus">Increase</sherpa-overlay-item></li>
  </ul>
  <sherpa-overlay-item data-type="heading">Height</sherpa-overlay-item>
  <ul data-group="height">
    <li><sherpa-overlay-item data-event="container-decrease-rows" data-icon="fa-solid fa-minus">Decrease</sherpa-overlay-item></li>
    <li><sherpa-overlay-item data-event="container-increase-rows" data-icon="fa-solid fa-plus">Increase</sherpa-overlay-item></li>
  </ul>
`;


/* ── Mixin ─────────────────────────────────────────────────────── */

import type { Constructor } from './types.js';

/**
 * ResizeBehavior mixin - adds grid resize functionality to containers
 */
export function ResizeBehavior<T extends Constructor<HTMLElement>>(
  Base: T
): T & Constructor<ResizeBehaviorInterface> {
  class ResizeBehaviorClass extends Base implements ResizeBehaviorInterface {
    /** Injected resize menu template */
    _resizeMenuTpl: HTMLTemplateElement | null = null;

    /* ── Lifecycle ──────────────────────────────────────────────── */

    onRender(): void {
      (Base.prototype as unknown as { onRender?: () => void }).onRender?.call(this);
      this._injectResizeMenu();
      this.addEventListener("container-increase-cols", this._onIncreaseCols as EventListener);
      this.addEventListener("container-decrease-cols", this._onDecreaseCols as EventListener);
      this.addEventListener("container-increase-rows", this._onIncreaseRows as EventListener);
      this.addEventListener("container-decrease-rows", this._onDecreaseRows as EventListener);
    }

    /* ── Menu template injection ────────────────────────────────── */

    /**
     * Insert a `<template data-menu>` containing resize items into
     * the host's light DOM. The button's composed-tree template
     * collection picks this up when the overflow menu opens.
     */
    _injectResizeMenu(): void {
      if (this.querySelector(":scope > template[data-menu-resize]")) return;

      const tpl = document.createElement("template");
      tpl.setAttribute("data-menu", "");
      tpl.setAttribute("data-menu-resize", "");
      tpl.innerHTML = RESIZE_MENU_HTML;
      this.prepend(tpl);
      this._resizeMenuTpl = tpl;
    }

    /* ── Resize handlers ────────────────────────────────────────── */

    _onIncreaseCols = (): void => {
      const current = parseInt((this as any).dataset['colSpan'], 10) || COL_STOPS[0]!;
      const idx = COL_STOPS.indexOf(current);
      if (idx !== -1 && idx < COL_STOPS.length - 1) {
        const nextValue = COL_STOPS[idx + 1];
        if (nextValue !== undefined) {
          (this as any).dataset['colSpan'] = String(nextValue);
        }
      }
    };

    _onDecreaseCols = (): void => {
      const current = parseInt((this as any).dataset['colSpan'], 10) || COL_STOPS[0]!;
      const idx = COL_STOPS.indexOf(current);
      if (idx !== -1 && idx > 0) {
        const prevValue = COL_STOPS[idx - 1];
        if (prevValue !== undefined) {
          (this as any).dataset['colSpan'] = String(prevValue);
        }
      }
    };

    _onIncreaseRows = (): void => {
      const current = parseInt((this as any).dataset['rowSpan'], 10) || MIN_ROW_SPAN;
      if (current < MAX_ROW_SPAN) {
        (this as any).dataset['rowSpan'] = String(current + 1);
      }
    };

    _onDecreaseRows = (): void => {
      const current = parseInt((this as any).dataset['rowSpan'], 10) || MIN_ROW_SPAN;
      if (current > MIN_ROW_SPAN) {
        (this as any).dataset['rowSpan'] = String(current - 1);
      }
    };
  }

  return ResizeBehaviorClass as T & Constructor<ResizeBehaviorInterface>;
}
