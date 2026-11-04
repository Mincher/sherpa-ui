/**
 * Stamp an icon into a wrapper: its symbol's shapes, cloned from the one sprite,
 * `icons.svg`, into an `<svg>` drawn against the icon's frame. The sprite loads
 * once, the first time an icon is drawn. TRAP T-an-icon-loads-when-first-drawn
 *
 * Map:
 * - hasIcon — Is this a name the icon set actually holds?
 * - renderIcon — Append the icon's SVG to `el`: now, or once the sprite has loaded.
 * - upgradeIcons — turn every icon in a freshly stamped tree into its SVG
 * - iconsLoading — the sprite while it loads, for `rendered` and `settled()`
 */
import { ICON_NAMES } from './icon-names.js';
import { ownHtml } from './trusted-html.js';
import { report } from '../data/report.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SPRITE = new URL('./icons.svg', import.meta.url).href;

/** A name the set holds: ONE token. Anything else is not an icon name. */
function iconName(value: string): string | null {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  return tokens.length === 1 ? (tokens[0] ?? null) : null;
}

/** Is this a name the icon set actually holds? */
export function hasIcon(value: string): boolean {
  const name = iconName(value);
  return name !== null && ICON_NAMES.has(name);
}

/** The sprite, parsed, once it has loaded; and the load while it runs. */
let sprite: Document | undefined;
let loading: Promise<Document | undefined> | undefined;
/** The icon each element last asked for: only that one draws. */
const wanted = new WeakMap<Element, string>();

/** The sprite, loaded once. A load that fails draws nothing, and the next draw tries again. */
function load(): Promise<Document | undefined> {
  loading ??= fetch(SPRITE)
    .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`HTTP ${response.status}`))))
    .then((text) => (sprite = new DOMParser().parseFromString(ownHtml(text), 'image/svg+xml')), (error: unknown) => {
      report({ code: 'icons-failed', message: `The icon sprite did not load from ${SPRITE}: ${String(error)}`, at: {} });
      return undefined;
    })
    .finally(() => { loading = undefined; });
  return loading;
}

/** The sprite while it loads, for `rendered` and `settled()`. */
export function iconsLoading(): Promise<unknown> {
  return loading ?? Promise.resolve();
}

/**
 * Append the icon's SVG to `el`: now, or once the sprite has loaded. An unknown
 * name leaves the wrapper EMPTY rather than drawing the wrong thing — a blank
 * box is at least visible to a test — and cancels a draw still loading.
 */
export function renderIcon(el: Element, value: string): void {
  const name = iconName(value);
  wanted.delete(el);
  if (name === null || !ICON_NAMES.has(name)) return;
  if (sprite) {
    draw(el, sprite, name);
    return;
  }
  wanted.set(el, name);
  void load().then((ready) => {
    if (!ready || wanted.get(el) !== name) return;
    wanted.delete(el);
    draw(el, ready, name);
  });
}

/** Append the icon's SVG: the symbol's own shapes, in the symbol's frame. */
function draw(el: Element, from: Document, name: string): void {
  const symbol = from.getElementById(name);
  if (!symbol) return;
  // createElementNS, not createElement: an <svg> built in the HTML namespace
  // paints nothing at all. TRAP T-icon-box-is-not-the-glyph
  const svg = document.createElementNS(SVG_NS, 'svg');
  /* THE FRAME, not the ink. In Figma every icon sits in a square frame with no
     fill or border — a pure bounding box — and the art is drawn to design
     inside it, at whatever size that design calls for. Re-fitting the art to
     the frame throws that design away: `triangle-down` is drawn 7 wide in a 14
     frame and rendered at 14, twice its size.
     TRAP T-icon-box-is-not-the-glyph */
  svg.setAttribute('viewBox', symbol.getAttribute('viewBox') ?? '');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  // The shapes with their own fills — a polychrome icon is several, and
  // `status-ok` is a disc with a white tick knocked out of it.
  for (const shape of symbol.children) svg.appendChild(document.importNode(shape, true));
  el.appendChild(svg);
}

/**
 * Turn every icon element in a freshly stamped tree into its SVG, so a
 * template's own icon behaves exactly like one `writeIcon` writes. Runs once
 * per stamp; an element that already holds its SVG is skipped.
 */
export function upgradeIcons(root: ParentNode): void {
  for (const el of root.querySelectorAll('[data-icon]')) {
    /* A sherpa-* ELEMENT with data-icon owns its own icon — it is that
       component's public API, not a marker on a plain node. Rendering into it
       replaced its children with an SVG and made the whole component a 14px
       icon box: a composed sherpa-container-header collapsed to a square and
       dropped the search field slotted inside it.
       TRAP T-a-component-with-data-icon-draws-its-own */
    if (el.tagName.startsWith('SHERPA-')) continue;
    if (el.querySelector('svg')) continue;
    const name = iconName(el.getAttribute('data-icon') ?? '');
    if (name === null || !ICON_NAMES.has(name)) continue;
    el.classList.add('sherpa-icon-box');
    renderIcon(el, name);
  }
}
