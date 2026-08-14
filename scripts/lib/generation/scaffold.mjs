/**
 * scaffold.mjs — produce a starter def for a new component.
 * Gives an AI the right shape to fill in, per COMPONENT-DEFINITION-STANDARD.
 */

const CATEGORY_DEFAULTS = {
  control: { baseCollection: 'Control', statusToken: 'status', containerAlias: false },
  container: { baseCollection: 'Container', statusToken: 'container', containerAlias: true },
  content: { baseCollection: 'Style (Sherpa)', statusToken: null, containerAlias: false },
  data: { baseCollection: 'Data Viz', statusToken: null, containerAlias: false },
  nav: { baseCollection: 'Navigation', statusToken: null, containerAlias: false },
  chart: { baseCollection: 'Data Viz', statusToken: null, containerAlias: false },
};

/**
 * @param {string} name  sherpa-<kebab>
 * @param {string} category  control|container|content|data|nav|chart
 * @returns {object} a starter def with TODO markers
 */
export function scaffoldDef(name, category = 'control') {
  if (!/^sherpa-[a-z-]+$/.test(name)) {
    throw new Error(`name must be sherpa-<kebab>, got "${name}"`);
  }
  const cat = CATEGORY_DEFAULTS[category] ?? CATEGORY_DEFAULTS.control;
  const figmaName = name.replace(/^sherpa-/, '').split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join(' ');
  const surfaceTok = cat.containerAlias
    ? { override: 'status-surface', fallback: 'container-surface-default' }
    : { override: 'status-surface', fallback: 'control-surface-default' };
  const borderTok = cat.containerAlias
    ? { override: 'status-border', fallback: 'container-border-default' }
    : { override: 'status-border', fallback: 'control-border-default' };

  return {
    $schema: 'https://sherpa-ui.dev/schema/component-definition/v2.json',
    generated: false,
    name,
    figmaName,
    category,
    description: `TODO: one-line description of ${name}.`,
    anatomy: {
      root: {
        el: 'div',
        class: 'root',
        part: 'root',
        figma: { node: 'FRAME', layout: 'HORIZONTAL', hugHeight: true },
        children: [
          {
            el: 'span',
            class: 'label',
            slot: '',
            figma: { node: 'TEXT', prop: 'label', role: 'default' },
            _todo: 'bind Typography vars + a content colour (Rule 2)',
          },
        ],
      },
    },
    props: [
      {
        name: 'data-status',
        type: 'enum',
        values: ['info', 'success', 'warning', 'critical', 'urgent'],
        default: null,
        kind: 'content',
        description: 'Status colour via the [data-status] cascade.',
      },
    ],
    templates: ['default'],
    slots: [{ name: '', accepts: ['content'], description: 'TODO' }],
    parts: ['root'],
    nested: [],
    events: [],
    tokens: {
      'root.background': surfaceTok,
      'root.borderColor': borderTok,
      'root.borderWidth': cat.containerAlias ? 'container-border-width' : 'control-border-width',
      'root.borderRadius': 'core-border-rounding-base',
      'root.gap': cat.containerAlias ? 'container-space-gap-sm' : 'control-space-gap-sm',
      'root.padding': cat.containerAlias ? 'container-space-padding-md' : 'control-space-padding-sm',
      // Content colour = neutral content ramp (inverts by mode). NOT status-content
      // (that causes the light-on-light bug on light surfaces — Rule 4).
      'label.color': 'content-title-base',
    },
    figma: {
      _status: 'new',
      figmaName,
      baseCollection: cat.baseCollection,
      variantAxes: [],
      booleanProps: [],
      textProps: ['label'],
      modePins: { Status: { mode: 'info' }, Elevation: { mode: 'none' } },
    },
    _todo: [
      'Rule 1: reuse existing components (list_components) — do not invent primitives.',
      'Rule 2: every text node binds Typography vars + a content colour.',
      'Rule 6: any owned sherpa-button sets data-size (size mode).',
      'Rule 9: every geometry value uses token_for(property, value).',
      'Run validate_def until it passes.',
    ],
  };
}
