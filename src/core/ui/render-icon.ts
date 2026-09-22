/**
 * Stamp an icon into a wrapper as a fitted SVG.
 *
 * The viewBox is the drawing's own INK bbox, so `preserveAspectRatio` puts the
 * art's LONGEST axis at exactly 100% of the square wrapper, keeps it 1:1, and
 * makes overflow impossible at any wrapper size.
 * TRAP T-icon-box-is-not-the-glyph
 */
import { ICON_PATHS } from './icon-paths.js';
import { ICON_ALIASES } from './icon-aliases.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * A `fa-*` token that names a STYLE or a modifier, not an icon. The `fa-`
 * syntax is still the value 88 call sites pass; the name inside it is now
 * resolved against the Figma icon set, not a webfont.
 */
const NOT_A_NAME = new Set(['solid', 'regular', 'brands', 'light', 'thin', 'duotone',
  'fw', 'lg', 'sm', 'xs', '2xs', 'xl', '2xl', 'spin', 'pulse', 'border',
  'rotate-90', 'rotate-180', 'rotate-270', 'flip-horizontal', 'flip-vertical']);

/**
 * `"fa-solid fa-filter"` → `"filter"`. A bare `"filter"` is returned as-is.
 * A Font Awesome name resolves through ICON_ALIASES to its Figma drawing.
 */
export function iconName(value: string): string | null {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (!token.startsWith('fa-')) continue;
    const name = token.slice(3);
    if (!NOT_A_NAME.has(name)) return ICON_ALIASES[name] ?? name;
  }
  // No `fa-` prefix anywhere: a plain name, which is what new code should pass.
  if (tokens.length === 1 && tokens[0] !== undefined && !tokens[0].startsWith('fa-')) {
    return ICON_ALIASES[tokens[0]] ?? tokens[0];
  }
  return null;
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
  for (const el of root.querySelectorAll('[class*="fa-"], [data-icon]')) {
    if (el.querySelector('svg')) continue;
    // `data-icon` is the plain Figma name and wins; a `fa-*` class is the
    // legacy spelling. `className` is an object on an SVG element, so the
    // class list is read through classList, which is always strings.
    const declared = el.getAttribute('data-icon');
    const name = iconName(declared ?? [...el.classList].join(' '));
    if (name === null || !(name in ICON_PATHS)) continue;
    for (const cls of [...el.classList]) if (cls.startsWith('fa-')) el.classList.remove(cls);
    el.classList.add('sherpa-icon-box');
    renderIcon(el, name);
  }
}
