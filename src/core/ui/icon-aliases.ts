/**
 * Font Awesome name → the Figma icon that means the same thing.
 *
 * The icons are Figma's (`src/icons/`), but components still NAME them in Font
 * Awesome's vocabulary at 88 call sites. Rather than rewrite all of them, the
 * old name resolves to the new drawing. A `fa-` value and a bare Figma name
 * both work, so new code can just say `"triangle-down"`.
 *
 * Hand-written, because each line is a judgement about what two icons mean —
 * `house` is Figma's `home`, `xmark` its `cross`. Not generated.
 */
export const ICON_ALIASES: Readonly<Record<string, string>> = {
  'angle-left': 'chevron-left',
  'angle-right': 'chevron-right',
  'angles-left': 'double-chevron-left',
  'angles-right': 'double-chevron-right',
  'arrow-down-wide-short': 'sort-descending',
  'arrow-up-wide-short': 'sort-ascending',
  'arrows-rotate': 'cw-circle-arrow',
  bell: 'notifications',
  'caret-down': 'triangle-down',
  'circle-check': 'status-ok',
  'circle-info': 'status-info',
  'circle-xmark': 'cross-in-circle',
  'clock-rotate-left': 'ccw-circle-arrow-w-clock',
  cubes: 'group',
  'ellipsis-vertical': 'ellipses-vertical',
  flask: 'beaker',
  grip: 'drag-handle-horizontal',
  'grip-vertical': 'drag-handle-vertical',
  house: 'home',
  'layer-group': 'group',
  pen: 'pencil',
  sliders: 'sliders-up',
  sort: 'sort-none',
  tag: 'price-tag',
  thumbtack: 'pin',
  'up-right-and-down-left-from-center': 'fullscreen',
  'user-gear': 'user-settings',
  xmark: 'cross',
};
