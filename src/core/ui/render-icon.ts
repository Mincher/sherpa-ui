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
 */
import { ICON_PATHS } from './icon-paths.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A name the set holds: ONE token. Anything else is not an icon name. */
function iconName(value: string): string | null {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  return tokens.length === 1 ? (tokens[0] ?? null) : null;
}

/** Is this a name the icon set actually holds? */
export function hasIcon(value: string): boolean {
  const name = iconName(value);
  return name !== null && name in ICON_PATHS;
}

/**
 * Replace `el`'s contents with the icon's SVG. An unknown name leaves the
 * wrapper EMPTY rather than drawing the wrong thing — a blank box is at least
 * visible to a test, where TRAP T-fa-pro-renders-nothing was not.
 */
export function renderIcon(el: Element, value: string): void {
  const name = iconName(value);
  const icon = name === null ? undefined : ICON_PATHS[name];
  if (!icon) return;

  const [x, y, w, h] = icon.ink;
  // createElementNS, not createElement: an <svg> built in the HTML namespace
  // paints nothing at all. TRAP T-icon-box-is-not-the-glyph
  const svg = document.createElementNS(SVG_NS, 'svg');
  // The INK box, not the icon's frame: that is what fills the wrapper exactly.
  svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  // The body is markup with its own fills — a polychrome icon is several
  // shapes, and `status-ok` is a disc with a white tick knocked out of it.
  // innerHTML on an SVG element parses IN the SVG namespace.
  svg.innerHTML = icon.body;
  el.appendChild(svg);
}

/**
 * Turn every icon element in a freshly stamped tree into a fitted SVG, so a
 * template's own icon behaves exactly like one `writeIcon` writes. Runs once
 * per stamp; an element that already holds its SVG is skipped.
 */
export function upgradeIcons(root: ParentNode): void {
  for (const el of root.querySelectorAll('[data-icon]')) {
    if (el.querySelector('svg')) continue;
    const name = iconName(el.getAttribute('data-icon') ?? '');
    if (name === null || !(name in ICON_PATHS)) continue;
    el.classList.add('sherpa-icon-box');
    renderIcon(el, name);
  }
}
