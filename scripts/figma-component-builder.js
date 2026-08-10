/**
 * figma-component-builder.js — Declarative Sherpa component builder for the
 * figma-console bridge.  VALIDATED 2026-08-08 against Container Header.
 *
 * NOT run with Node. The BODY of SHERPA_BUILDER() is injected as a preamble
 * into a `figma_execute` call, then you call B = await SHERPA_BUILDER() and
 * drive it with a spec. The figma-console sandbox is fresh per call, so the
 * builder + spec travel together in ONE execute.
 *
 * WHY: component builds were ~80 lines of repeated plumbing each (font loads,
 * token-by-name resolution, fill/stroke/padding/gap/radius binding, slots,
 * prop wiring, verify). This collapses a build to a compact spec object and
 * resolves each token ONCE (cached) — big MCP/token-cost saving.
 *
 * ── HARD-WON RULES baked in ────────────────────────────────────────────────
 *  • Figma nodes are NOT extensible — never stash props on a node (`node._x=…`
 *    throws "object is not extensible"). Pass state through returns/args.
 *  • layoutSizing (FILL/HUG) must be applied AFTER the node is parented and its
 *    children exist → _applySizing runs at the end of _make, from the spec.
 *  • Fonts: loadFontAsync at the TOP of the SAME execute (loads don't persist).
 *  • Empty SLOT frames default to 100px height and inflate the parent → set
 *    collapseEmpty to hug them to ~1px.
 *  • Token names are PREFIXED per collection: `containers-space/gap-sm`,
 *    `nav-item-surface`, `button-size/height`. Foundations unprefixed.
 *  • V() WARNS on a miss (pushes to warnings[]) instead of throwing — always
 *    check the returned `warnings` array; a MISSING VAR means a silent
 *    hardcoded value, which is the #1 defect this builder exists to catch.
 *
 * ── SPEC ───────────────────────────────────────────────────────────────────
 *  buildComponent({
 *    name:'Container Header', page:'Container Header',
 *    fonts:[['Inter','Regular'],['Inter','Semi Bold']],
 *    replace:true,                 // delete existing same-named component first
 *    root: NODE,                   // see _make() header for NODE shape
 *    props:[ {name,type,default, ref:'nodeName', on:'characters'|'visible'} … ],
 *    verify:true,
 *  })
 *  VAR = { c:'CollectionName', v:'variable/name' }
 * ───────────────────────────────────────────────────────────────────────────
 */

async function SHERPA_BUILDER() {
  await figma.loadAllPagesAsync();
  const _colls = await figma.variables.getLocalVariableCollectionsAsync();
  const _allVars = await figma.variables.getLocalVariablesAsync();
  const _isLocal = (id) => /^VariableID:\d+:\d+$/.test(id);
  const _varCache = new Map();
  const warnings = [];

  function V(spec) {
    if (!spec) return null;
    if (spec.id && _isLocal(spec.id)) return spec;
    const key = spec.c + '::' + spec.v;
    if (_varCache.has(key)) return _varCache.get(key);
    const coll = _colls.find(c => c.name === spec.c && !c.isExtension);
    const found = _allVars.find(x => _isLocal(x.id) && x.name === spec.v && x.variableCollectionId === (coll && coll.id));
    if (!found) warnings.push('MISSING VAR ' + key);
    _varCache.set(key, found || null);
    return found || null;
  }
  const _coll = (n) => _colls.find(c => c.name === n && !c.isExtension);
  const _ext = (parentName, extName) => { const p = _coll(parentName); return _colls.find(c => c.isExtension && c.name === extName && c.parentVariableCollectionId === (p && p.id)); };

  function bindFill(node, varSpec, fb) { const v = V(varSpec); let p = { type:'SOLID', color: fb || {r:.5,g:.5,b:.5} }; if (v) p = figma.variables.setBoundVariableForPaint(p, 'color', v); node.fills = [p]; }
  function bindStroke(node, varSpec, fb, weight, sides) { const v = V(varSpec); let p = { type:'SOLID', color: fb || {r:.8,g:.8,b:.83} }; if (v) p = figma.variables.setBoundVariableForPaint(p, 'color', v); node.strokes = [p]; node.strokeAlign = 'INSIDE'; const w = weight || 1; if (sides === 'top') node.strokeTopWeight = w; else for (const s of ['strokeTopWeight','strokeBottomWeight','strokeLeftWeight','strokeRightWeight']) node[s] = w; }
  function bindPadding(node, pad) { if (pad == null) return; const set = (prop, val) => { if (val == null) return; const v = V(val); if (v) node.setBoundVariable(prop, v); else if (typeof val === 'number') node[prop] = val; }; if (typeof pad === 'number' || (pad && pad.c)) { for (const p of ['paddingTop','paddingBottom','paddingLeft','paddingRight']) set(p, pad); } else { set('paddingTop', pad.t); set('paddingBottom', pad.b); set('paddingLeft', pad.l); set('paddingRight', pad.r); } }
  function bindGap(node, gap) { if (gap == null) return; const v = V(gap); if (v) node.setBoundVariable('itemSpacing', v); else if (typeof gap === 'number') node.itemSpacing = gap; }
  function bindRadius(node, rad) { if (!rad) return; const corners = ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']; if (rad.c) { const v = V(rad); if (v) for (const c of corners) node.setBoundVariable(c, v); } else { const map = { topLeftRadius: rad.tl, topRightRadius: rad.tr, bottomLeftRadius: rad.bl, bottomRightRadius: rad.br }; for (const c of corners) { const v = V(map[c]); if (v) node.setBoundVariable(c, v); } } }
  function bindShadow(node, elevationMode) { let e = { type:'DROP_SHADOW', color:{r:0,g:0,b:0,a:.15}, offset:{x:0,y:4}, radius:16, spread:0, visible:true, blendMode:'NORMAL' }; for (const [k, vn] of [['color','color'],['offsetX','offset-x'],['offsetY','offset-y'],['radius','blur'],['spread','spread']]) { const v = V({ c:'Elevation', v: vn }); if (v) e = figma.variables.setBoundVariableForEffect(e, k, v); } node.effects = [e]; if (elevationMode) { const el = _coll('Elevation'); const m = el.modes.find(x => x.name === elevationMode); if (m) node.setExplicitVariableModeForCollection(el, m.modeId); } }
  function pinModes(node, modes) { if (!modes) return; for (const [cn, mn] of modes) { const c = _coll(cn) || _colls.find(x => x.isExtension && x.name === cn); if (!c) { warnings.push('MISSING COLLECTION ' + cn); continue; } const m = c.modes.find(x => x.name === mn); if (m) node.setExplicitVariableModeForCollection(c, m.modeId); else warnings.push('MISSING MODE ' + cn + '::' + mn); } }

  const _iconsPage = figma.root.children.find(p => p.name === 'Icons');
  function _glyphId(setName) { const set = _iconsPage && _iconsPage.findOne(n => n.type === 'COMPONENT_SET' && n.name === setName); if (!set) { warnings.push('MISSING GLYPH ' + setName); return null; } const v = set.children.find(c => c.type === 'COMPONENT' && /Apex 2\.0/.test(c.name)) || set.children[0]; return v.id; }

  const _textStyles = await figma.getLocalTextStylesAsync();
  async function _applyText(node, t) { node.characters = t.value != null ? t.value : ''; if (t.style) { const s = _textStyles.find(x => x.name === t.style); if (s) await node.setTextStyleIdAsync(s.id); } if (t.color) bindFill(node, t.color, t.colorFallback || {r:.1,g:.1,b:.14}); }

  function _applyLayout(node, L) { if (!L) return; if (L.mode) node.layoutMode = L.mode; if (L.align) node.counterAxisAlignItems = L.align; if (L.primaryAlign) node.primaryAxisAlignItems = L.primaryAlign; if (L.wrap) node.layoutWrap = L.wrap; if (L.mode === 'GRID' && L.cols) node.gridColumnCount = L.cols; bindGap(node, L.gap); bindPadding(node, L.padding); if (L.width != null || L.height != null) node.resize(L.width || 100, L.height || node.height || 40); }
  function _applySizing(node, L) {
    L = L || {};
    // DEFAULT auto-layout frames to HUG on both axes unless the spec says otherwise.
    // Figma frames default new frames to a FIXED ~100px on the counter axis, which
    // inflates parents (the recurring trend/actions/values bug). Hug by default.
    // Only auto-size an axis when the spec gave neither an explicit sizing mode
    // nor an explicit dimension on that axis — an explicit width/height means FIXED.
    try { if (L.primary) node.primaryAxisSizingMode = L.primary; else if (node.layoutMode && node.layoutMode !== 'NONE' && L.width == null) node.primaryAxisSizingMode = 'AUTO'; } catch(e){}
    try { if (L.counter) node.counterAxisSizingMode = L.counter; else if (node.layoutMode && node.layoutMode !== 'NONE' && L.height == null) node.counterAxisSizingMode = 'AUTO'; } catch(e){}
    try { if (L.sizingH) node.layoutSizingHorizontal = L.sizingH; } catch(e){}
    try { if (L.sizingV) node.layoutSizingVertical = L.sizingV; } catch(e){}
  }

  /* NODE = { kind:'frame'|'text'|'icon'|'instance', name, layout, fill, stroke, radius,
             effect:{kind:'shadow',elevationMode}, modes, text:{value,style,color},
             glyph, iconColor, swap:'idOrKey', slot:true, collapseEmpty:true,
             children:[…], visible:false } */
  const _slotFrames = []; // {node, spec} — slots to convert after component wrap
  async function _make(ns, parent) {
    let node;
    if (ns.kind === 'text') { node = figma.createText(); parent.appendChild(node); }
    else if (ns.kind === 'icon') { const gid = _glyphId(ns.glyph); const m = gid && await figma.getNodeByIdAsync(gid); node = m ? m.createInstance() : figma.createFrame(); parent.appendChild(node); try { node.layoutSizingHorizontal='FIXED'; node.layoutSizingVertical='FIXED'; const sz = V({c:'Icon',v:'size'}); if (sz) node.setBoundVariable('width', sz); } catch(e){} const vec = node.findOne && node.findOne(n => n.type==='VECTOR'); if (vec && Array.isArray(vec.fills) && ns.iconColor) bindFill(vec, ns.iconColor, {r:.4,g:.4,b:.45}); }
    else if (ns.kind === 'instance') { const m = await figma.getNodeByIdAsync(ns.swap); node = m.createInstance(); parent.appendChild(node); }
    else { node = figma.createFrame(); parent.appendChild(node); node.fills = []; }
    node.name = ns.name || ns.kind;
    _applyLayout(node, ns.layout);
    if (ns.fill !== undefined) { if (ns.fill === null) node.fills = []; else bindFill(node, ns.fill.var || ns.fill, (ns.fill && ns.fill.fallback) || {r:1,g:1,b:1}); }
    if (ns.stroke) bindStroke(node, ns.stroke.var || ns.stroke, ns.stroke.fallback, ns.stroke.weight, ns.stroke.sides);
    if (ns.radius) bindRadius(node, ns.radius);
    if (ns.effect && ns.effect.kind === 'shadow') bindShadow(node, ns.effect.elevationMode);
    if (ns.modes) pinModes(node, ns.modes);
    if (ns.text && node.type === 'TEXT') await _applyText(node, ns.text);
    if (ns.children) for (const ch of ns.children) await _make(ch, node);
    _applySizing(node, ns.layout);
    if (ns.visible === false) node.visible = false;
    if (ns.slot) _slotFrames.push({ node, spec: ns });
    return node;
  }

  // Build a whole component: create COMPONENT, realize root children into it,
  // convert marked frames to slots (via MCP figma_add_slot_property afterward —
  // returns slotFrames so the caller can wire them), wire props, verify.
  async function buildComponent(cfg) {
    for (const [fam, style] of (cfg.fonts || [['Inter','Regular'],['Inter','Semi Bold']])) { try { await figma.loadFontAsync({ family: fam, style }); } catch(e){} }
    // Find the page by its bare name OR any decorated form (✅ Name · built …). Auto-create if absent.
    const bare = cfg.page;
    const pageMatches = n => n === bare || n.replace(/^✅\s*/,'').replace(/\s*·\s*built\s*\d{4}-\d{2}-\d{2}\s*$/,'').trim() === bare;
    let page = figma.root.children.find(p => pageMatches(p.name));
    if (!page) { page = figma.createPage(); }
    await figma.setCurrentPageAsync(page);
    // Datestamp: ✅ Name · built YYYY-MM-DD  (cfg.date required — sandbox Date is unreliable)
    if (cfg.date) page.name = '✅ ' + bare + ' · built ' + cfg.date;
    if (cfg.replace) { const ex = page.children.find(c => (c.type==='COMPONENT'||c.type==='COMPONENT_SET') && c.name === cfg.name); if (ex) ex.remove(); }
    const comp = figma.createComponent(); page.appendChild(comp); comp.name = cfg.name; comp.x = 0; comp.y = 0;
    // realize the root spec ONTO the component (component IS the root frame)
    const R = cfg.root;
    _applyLayout(comp, R.layout);
    if (R.fill !== undefined) { if (R.fill === null) comp.fills = []; else bindFill(comp, R.fill.var || R.fill, (R.fill && R.fill.fallback) || {r:1,g:1,b:1}); }
    if (R.stroke) bindStroke(comp, R.stroke.var || R.stroke, R.stroke.fallback, R.stroke.weight, R.stroke.sides);
    if (R.radius) bindRadius(comp, R.radius);
    if (R.effect && R.effect.kind === 'shadow') bindShadow(comp, R.effect.elevationMode);
    if (R.modes) pinModes(comp, R.modes);
    if (R.children) for (const ch of R.children) await _make(ch, comp);
    _applySizing(comp, R.layout);
    if (cfg.description) comp.description = cfg.description;

    // props (TEXT/BOOLEAN wiring; SLOT/INSTANCE_SWAP handled by caller via MCP)
    const propKeys = {};
    for (const p of (cfg.props || [])) {
      if (p.type === 'TEXT' || p.type === 'BOOLEAN') {
        const key = comp.addComponentProperty(p.name, p.type, p.default != null ? p.default : (p.type==='BOOLEAN'?false:''));
        propKeys[p.name] = key;
        if (p.ref) { const target = comp.findOne(n => n.name === p.ref); if (target) { const refs = target.componentPropertyReferences || {}; refs[p.on || (p.type==='TEXT'?'characters':'visible')] = key; target.componentPropertyReferences = refs; if (p.type==='BOOLEAN' && p.default===false) target.visible = false; } else warnings.push('MISSING REF ' + p.ref); }
      }
    }
    // Richer verify: resolved fill RGB + bound var per node, so fidelity can be
    // sanity-checked from the return value without a screenshot round-trip.
    const bindings = [];
    const _cn = id => { const c = _colls.find(x => x.id === id); return c ? c.name : null; };
    async function _walk(n) {
      try {
        const f = n.fills && n.fills[0];
        if (f && f.type === 'SOLID') {
          let varName = null; if (f.boundVariables && f.boundVariables.color) { const v = await figma.variables.getVariableByIdAsync(f.boundVariables.color.id); varName = v ? _cn(v.variableCollectionId) + '::' + v.name : null; }
          bindings.push({ node: n.name, rgb: `${Math.round(f.color.r*255)},${Math.round(f.color.g*255)},${Math.round(f.color.b*255)}`, fillVar: varName || '(UNBOUND)' });
        }
      } catch(e){}
      if ('children' in n) for (const c of n.children) await _walk(c);
    }
    await _walk(comp);
    const unbound = bindings.filter(b => b.fillVar === '(UNBOUND)').map(b => b.node);
    const verify = { height: Math.round(comp.height), width: Math.round(comp.width), warnings: warnings.slice(), bindings, unboundFills: unbound, pageName: page.name };
    return { id: comp.id, name: comp.name, pageName: page.name, warnings, verify, slotFrames: _slotFrames.map(s => ({ id: s.node.id, name: s.node.name, collapseEmpty: !!s.spec.collapseEmpty })), propKeys };
  }

  /* ── COLLECTION PROVISIONING ────────────────────────────────────────────
   * Create/extend variable collections a component needs. Encodes the
   * variation-system patterns + gotchas (see docs/VARIATION-SYSTEM.md and
   * memory sherpa-figma-variation-system). Call BEFORE buildComponent so the
   * tokens exist for V() to resolve.
   *
   * spec.collections = [
   *   { name:'Nav Container', modes:['collapsed','hover','pinned','settings'],
   *     vars:[
   *       { name:'nav-container-fill/default', type:'COLOR',
   *         byMode:{ collapsed:{alias:{c:'Apex 2.0',v:'surface/app/primary/default'}},
   *                  settings:{alias:{c:'Apex 2.0',v:'surface/app/secondary/default'}} } },
   *       { name:'nav-container-size/width', type:'FLOAT',
   *         byMode:{ collapsed:40, hover:320, pinned:320, settings:320 } },
   *     ],
   *     extensions:[
   *       { name:'app-primary', revalue:[ { var:'containers-surface/default', alias:{c:'Apex 2.0',v:'surface/app/primary/default'} } ] },
   *     ]
   *   }
   * ]
   * A byMode value is a raw number/string/bool, or { alias:{c,v} } to bind to
   * another variable. Modes not listed inherit the collection default.
   * Returns { created:[], reused:[], warnings }.
   * ─────────────────────────────────────────────────────────────────────── */
  async function provisionCollections(specs) {
    const created = [], reused = [];
    // refresh caches each call (collections may have just been made)
    let colls = await figma.variables.getLocalVariableCollectionsAsync();
    let allVars = await figma.variables.getLocalVariablesAsync();
    const isLocal = id => /^VariableID:\d+:\d+$/.test(id);
    const findColl = n => colls.find(c => c.name === n && !c.isExtension);
    const findVar = (collId, n) => allVars.find(v => isLocal(v.id) && v.name === n && v.variableCollectionId === collId);
    const resolveAlias = a => { const c = colls.find(x => x.name === a.c && !x.isExtension); const v = allVars.find(x => isLocal(x.id) && x.name === a.v && x.variableCollectionId === (c && c.id)); if (!v) warnings.push('MISSING ALIAS ' + a.c + '::' + a.v); return v; };
    const setVal = (variable, modeId, val) => {
      if (val && typeof val === 'object' && val.alias) { const t = resolveAlias(val.alias); if (t) variable.setValueForMode(modeId, { type:'VARIABLE_ALIAS', id:t.id }); }
      else variable.setValueForMode(modeId, val);
    };

    for (const cs of (specs || [])) {
      let coll = findColl(cs.name);
      if (!coll) { coll = figma.variables.createVariableCollection(cs.name); created.push('collection ' + cs.name); }
      else reused.push('collection ' + cs.name);

      // MODES: rename the default single mode to the first requested, add the rest.
      if (cs.modes && cs.modes.length) {
        const existing = coll.modes;
        coll.renameMode(existing[0].modeId, cs.modes[0]);
        for (let i = 1; i < cs.modes.length; i++) { if (!coll.modes.find(m => m.name === cs.modes[i])) coll.addMode(cs.modes[i]); }
      }
      const modeId = name => { const m = coll.modes.find(x => x.name === name); return m ? m.modeId : coll.defaultModeId; };

      // VARIABLES
      allVars = await figma.variables.getLocalVariablesAsync();
      for (const vspec of (cs.vars || [])) {
        let variable = findVar(coll.id, vspec.name);
        if (!variable) { variable = figma.variables.createVariable(vspec.name, coll, vspec.type || 'COLOR'); if (vspec.scopes) variable.scopes = vspec.scopes; }
        if (vspec.byMode) for (const [mn, val] of Object.entries(vspec.byMode)) setVal(variable, modeId(mn), val);
        else if (vspec.value !== undefined) setVal(variable, coll.defaultModeId, vspec.value);
      }

      // EXTENSIONS — create via extend() FIRST, then re-value, then (if base got
      // temp multi-modes only for the extension) collapse. extend() inherits the
      // base's CURRENT modes; a whole figma_execute is atomic so a mid-script
      // throw rolls everything back — order matters (see memory).
      colls = await figma.variables.getLocalVariableCollectionsAsync();
      for (const ext of (cs.extensions || [])) {
        let extColl = colls.find(c => c.isExtension && c.name === ext.name && c.parentVariableCollectionId === coll.id);
        if (!extColl) { extColl = coll.extend(ext.name); created.push('extension ' + cs.name + '::' + ext.name); }
        else reused.push('extension ' + cs.name + '::' + ext.name);
        allVars = await figma.variables.getLocalVariablesAsync();
        for (const rv of (ext.revalue || [])) {
          // re-value a base variable within this extension's mode(s)
          const variable = allVars.find(v => isLocal(v.id) && v.name === rv.var && v.variableCollectionId === coll.id);
          if (!variable) { warnings.push('MISSING EXT VAR ' + rv.var); continue; }
          const targetModes = rv.mode ? [extColl.modes.find(m => m.name === rv.mode)].filter(Boolean) : extColl.modes;
          for (const m of targetModes) setVal(variable, m.modeId, rv.alias ? { alias: rv.alias } : rv.value);
        }
      }
    }
    return { created, reused, warnings };
  }

  return { V, _coll, _ext, _glyphId, warnings, bindFill, bindStroke, bindPadding, bindGap, bindRadius, bindShadow, pinModes, _make, buildComponent, provisionCollections };
}
