/* Harvest every component's COLOUR BINDINGS. Paste after a `const WANT = [...]`.
   Returns { "<Figma name>": { id, rows: [{ at, prop, hex, token }] } }. */
await figma.loadAllPagesAsync();
const all = figma.root.findAllWithCriteria({ types: ['COMPONENT_SET', 'COMPONENT'] });
const tops = all.filter((n) => !(n.parent && n.parent.type === 'COMPONENT_SET'));
const cn = {}, vn = {};
const varPath = async (id) => {
  if (vn[id] !== undefined) return vn[id];
  const v = await figma.variables.getVariableByIdAsync(id);
  if (!v) return (vn[id] = 'DANGLING');
  const c = (cn[v.variableCollectionId] ??=
    await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId));
  return (vn[id] = (c ? c.name : '?') + '::' + v.name);
};
const hex = (c, o = 1) =>
  '#' + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('') +
  (o < 1 ? Math.round(o * 255).toString(16).padStart(2, '0') : '');
const out = {};
for (const name of WANT) {
  const node = tops.find((n) => n.name === name);
  if (!node) { out[name] = { missing: true }; continue; }
  const rows = [], seen = new Set();
  const walk = async (x, path, depth) => {
    if (depth > 5 || rows.length > 160) return;
    const p = path ? path + '>' + x.name : x.name;
    for (const key of ['fills', 'strokes']) {
      const arr = x[key];
      if (!Array.isArray(arr)) continue;
      for (const paint of arr) {
        if (paint.visible === false || paint.type !== 'SOLID') continue;
        const id = paint.boundVariables && paint.boundVariables.color && paint.boundVariables.color.id;
        const row = {
          at: p, prop: key === 'fills' ? 'fill' : 'stroke',
          hex: hex(paint.color, paint.opacity ?? 1),
          token: id ? await varPath(id) : 'RAW',
        };
        const k = row.at + row.prop + row.token + row.hex;
        if (!seen.has(k)) { seen.add(k); rows.push(row); }
      }
    }
    if (x.children) for (const c of x.children) await walk(c, p, depth + 1);
  };
  await walk(node, '', 0);
  out[name] = { id: node.id, rows };
}
return out;
