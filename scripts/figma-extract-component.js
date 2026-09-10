/**
 * figma-extract-component.js — Figma PLUGIN-API snippet (not a Node script).
 *
 * Paste the body into `figma_execute` (figma-console MCP, file UnBEepLWb6d7b9ykm33j2s)
 * after setting NODE_IDS. It walks each component / component set and prints ONE
 * compact line per node with the data that drives CSS parity:
 *
 *   name [TYPE] · lay H F/A pad T/R/B/L gap N al X/Y · WxH H/F · rad R
 *   · fill #hex ←Collection::var · stroke #hex ←Collection::var wN INSIDE
 *   · bound{ prop=Collection::var→resolved; … } · text Family Style Npx lh N "…"
 *   · fx … · HIDDEN · pins{Collection=mode, …} · inst→Master · props {…}
 *
 * Read the RESOLVED values (→) under the variant's own pins; for values that read
 * `null` (an extension pin blocks resolveForConsumer) use the raw painted hex or the
 * extension cache (src/styles/tokens/figma.extensions.json). Never judge colour from
 * a screenshot — this is the ground truth the component CSS is diffed against.
 *
 * Gotchas: bound vars whose collection was deleted still resolve by id (e.g.
 * `style-surface/dark`, `style-content/light`, the old `Typography::*`) — treat those
 * as Figma-side drift to flag, not as design intent.
 */
// eslint-disable-next-line no-unused-vars
const NODE_IDS = ['18:146'];
// eslint-disable-next-line no-unused-vars
const INSTANCE_DEPTH = 2; // how deep to descend into nested instances

/* ---- paste from here into figma_execute ---- */
await figma.loadAllPagesAsync();
const hex = (c, o = 1) =>
  '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('') +
  (o < 1 ? Math.round(o * 255).toString(16).padStart(2, '0') : '');
const cn = {};
const collName = async (id) => (cn[id] ??= (await figma.variables.getVariableCollectionByIdAsync(id))?.name);
const vv = async (id) => figma.variables.getVariableByIdAsync(id);
const fmtRes = (rv) => (rv == null ? 'null' : typeof rv.value === 'object' ? hex(rv.value, rv.value.a ?? 1) : rv.value);
async function paint(arr) {
  if (!Array.isArray(arr)) return 'mixed';
  const vis = arr.filter((p) => p.visible !== false);
  if (!vis.length) return 'none';
  return (
    await Promise.all(
      vis.map(async (p) => {
        if (p.type !== 'SOLID') return p.type;
        const id = p.boundVariables?.color?.id;
        const v = id ? await vv(id) : null;
        return hex(p.color, p.opacity ?? 1) + (v ? ` ←${await collName(v.variableCollectionId)}::${v.name}` : ' RAW');
      }),
    )
  ).join(' | ');
}
async function dump(root, instDepth = INSTANCE_DEPTH) {
  const rows = [];
  const walk = async (n, d) => {
    const f = [`${'  '.repeat(d)}${n.name} [${n.type}]`];
    if ('layoutMode' in n && n.layoutMode !== 'NONE')
      f.push(`lay ${n.layoutMode[0]} ${n.primaryAxisSizingMode[0]}/${n.counterAxisSizingMode[0]} pad ${n.paddingTop}/${n.paddingRight}/${n.paddingBottom}/${n.paddingLeft} gap ${n.itemSpacing} al ${n.primaryAxisAlignItems}/${n.counterAxisAlignItems}`);
    f.push(`${Math.round(n.width)}x${Math.round(n.height)}${n.layoutSizingHorizontal ? ` ${n.layoutSizingHorizontal[0]}/${n.layoutSizingVertical[0]}` : ''}`);
    if ('cornerRadius' in n) {
      const r = n.cornerRadius === figma.mixed ? [n.topLeftRadius, n.topRightRadius, n.bottomRightRadius, n.bottomLeftRadius].join('/') : n.cornerRadius;
      if (r !== 0 && r !== '0/0/0/0') f.push(`rad ${r}`);
    }
    if ('fills' in n) { const p = await paint(n.fills); if (p !== 'none') f.push(`fill ${p}`); }
    if ('strokes' in n && n.strokes.length) {
      const w = n.strokeWeight === figma.mixed ? [n.strokeTopWeight, n.strokeRightWeight, n.strokeBottomWeight, n.strokeLeftWeight].join('/') : n.strokeWeight;
      f.push(`stroke ${await paint(n.strokes)} w${w} ${n.strokeAlign}`);
    }
    const bv = n.boundVariables || {};
    const b = [];
    for (const [k, val] of Object.entries(bv)) {
      if (['fills', 'strokes', 'componentProperties', 'textRangeFills', 'effects'].includes(k)) continue;
      const ids = Array.isArray(val) ? val.map((x) => x.id) : [val.id];
      for (const id of ids) { const v = await vv(id); if (!v) continue; b.push(`${k}=${await collName(v.variableCollectionId)}::${v.name}→${fmtRes(v.resolveForConsumer(n))}`); }
    }
    if (b.length) f.push(`bound{ ${b.join('; ')} }`);
    if (n.type === 'TEXT') f.push(`text ${n.fontName === figma.mixed ? 'mixed' : n.fontName.family + ' ' + n.fontName.style} ${n.fontSize}px lh ${n.lineHeight?.value} "${n.characters.slice(0, 24)}"`);
    if (n.effects?.some((e) => e.visible)) f.push(`fx ${n.effects.filter((e) => e.visible).map((e) => `${e.type} ${e.offset?.x},${e.offset?.y} b${e.radius} s${e.spread} ${e.color ? hex(e.color, e.color.a) : ''}`).join(',')}`);
    if (n.visible === false) f.push('HIDDEN');
    if (n.explicitVariableModes && Object.keys(n.explicitVariableModes).length) {
      const p = [];
      for (const [cid, mid] of Object.entries(n.explicitVariableModes)) { const c = await figma.variables.getVariableCollectionByIdAsync(cid); p.push(`${c?.name}=${c?.modes.find((m) => m.modeId === mid)?.name}`); }
      f.push(`pins{${p.join(', ')}}`);
    }
    if (n.type === 'INSTANCE') {
      const mc = await n.getMainComponentAsync();
      f.push(`inst→${mc?.parent?.type === 'COMPONENT_SET' ? mc.parent.name + '/' : ''}${mc?.name}`);
      if (Object.keys(n.componentProperties || {}).length) f.push(`props ${JSON.stringify(Object.fromEntries(Object.entries(n.componentProperties).map(([k, v]) => [k.split('#')[0], v.value])))}`);
    }
    rows.push(f.join(' · '));
    if ('children' in n && d < 7 && n.type !== 'INSTANCE') for (const c of n.children) await walk(c, d + 1);
    else if (n.type === 'INSTANCE' && d < instDepth) for (const c of n.children) await walk(c, d + 1);
  };
  await walk(root, 0);
  return rows;
}
const out = {};
for (const id of NODE_IDS) { const n = await figma.getNodeByIdAsync(id); out[n.name] = await dump(n); }
return out;
