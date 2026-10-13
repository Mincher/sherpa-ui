/**
 * Stamp an icon into a wrapper as a fitted SVG.
 *
 * The viewBox is the drawing's own INK bbox — which the `.svg` FILES do not
 * carry: all 214 say `viewBox="0 0 14 14"`, and 206 have a tighter real box.
 * That is why this module is generated rather than the files being loaded.
 * `preserveAspectRatio` then puts the
 * art's LONGEST axis at exactly 100% of the square wrapper, keeps it 1:1, and
 * makes overflow impossible at any wrapper size.
 * TRAP T-icon-box-is-not-the-glyph
 *
 * Each icon is its OWN module, loaded the first time it is drawn: a page pays
 * for the icons it shows. TRAP T-an-icon-loads-when-first-drawn
 *
 * Map:
 * - hasIcon — Is this a name the icon set actually holds?
 * - renderIcon — Replace `el`'s contents with the icon's SVG: now, or once its module has loaded.
 * - upgradeIcons — turn every icon in a freshly stamped tree into a fitted SVG
 * - iconsLoading — every icon module still loading, for `settled()`
 */
import { ICON_NAMES, type IconArt } from './icon-names.js';
import { ownHtml } from './trusted-html.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

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

/** Each icon drawn so far, and each still loading. */
const loaded = new Map<string, IconArt>();
const loading = new Map<string, Promise<IconArt | undefined>>();
/** The icon each element last asked for: only that one draws. */
const wanted = new WeakMap<Element, string>();

/** An icon's module, loaded once. A module that fails draws nothing. */
function load(name: string): Promise<IconArt | undefined> {
  let pending = loading.get(name);
  if (!pending) {
    pending = import(`./icons/${name}.js`).then((m: { default: IconArt }) => {
      loaded.set(name, m.default);
      return m.default;
    }, () => undefined);
    loading.set(name, pending);
  }
  return pending;
}

/** Every icon module still loading, for `settled()`. */
export function iconsLoading(): Promise<unknown> {
  return Promise.all(loading.values());
}

/**
 * Replace `el`'s contents with the icon's SVG: now, or once its module has
 * loaded. An unknown name leaves the wrapper EMPTY rather than drawing the
 * wrong thing — a blank box is at least visible to a test, where
 * TRAP T-fa-pro-renders-nothing was not — and cancels a draw still loading.
 */
export function renderIcon(el: Element, value: string): void {
  const name = iconName(value);
  wanted.delete(el);
  if (name === null || !ICON_NAMES.has(name)) return;
  const art = loaded.get(name);
  if (art) {
    draw(el, art);
    return;
  }
  wanted.set(el, name);
  void load(name).then((ready) => {
    if (!ready || wanted.get(el) !== name) return;
    wanted.delete(el);
    draw(el, ready);
  });
}

/** Append the icon's fitted SVG. */
function draw(el: Element, icon: IconArt): void {
  // createElementNS, not createElement: an <svg> built in the HTML namespace
  // paints nothing at all. TRAP T-icon-box-is-not-the-glyph
  const svg = document.createElementNS(SVG_NS, 'svg');
  /* THE FRAME, not the ink. In Figma every icon sits in a square frame with no
     fill or border — a pure bounding box — and the art is drawn to design
     inside it, at whatever size that design calls for. Re-fitting the art to
     the frame throws that design away: `triangle-down` is drawn 7 wide in a 14
     frame and rendered at 14, twice its size.
     TRAP T-icon-box-is-not-the-glyph */
  svg.setAttribute('viewBox', icon.frame);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  // The body is markup with its own fills — a polychrome icon is several
  // shapes, and `status-ok` is a disc with a white tick knocked out of it.
  // innerHTML on an SVG element parses IN the SVG namespace.
  svg.innerHTML = ownHtml(icon.body);
  el.appendChild(svg);
}

/**
 * Turn every icon element in a freshly stamped tree into a fitted SVG, so a
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
