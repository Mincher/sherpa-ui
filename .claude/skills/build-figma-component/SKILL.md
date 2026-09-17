---
name: build-figma-component
description: Build a Sherpa-UI component in the Figma file (UnBEepLWb6d7b9ykm33j2s) with correct variable binding, page placement, and mode wiring. Use whenever reverse-engineering a sherpa-* web component into a real Figma component. Strict checklist with mandatory verify gates.
---

# Build a Sherpa-UI component in Figma

Reverse-engineer one `sherpa-*` web component into a real Figma component on its own
page, binding every visual property to a design-system variable and wiring status /
elevation / size via extended-collection modes.

This skill exists because ad-hoc builds drifted: components landed on the wrong page,
`combineAsVariants` failed silently, and CSS values were hardcoded instead of bound to
the component-scoped collection. **The verify gates below are mandatory — do not skip
them.** Each gate catches a specific failure that has actually happened.

Target file: `UnBEepLWb6d7b9ykm33j2s` (Sherpa-UI). All work is via
`mcp__figma-console__figma_execute` (Plugin API JS, async context).

**Official Figma skills** (read on demand via `mcp__claude_ai_Figma__get_figma_skill`, no
OAuth needed for these resource reads): `skill://figma/figma-use/SKILL.md` (Plugin API
rules) and `.../references/variable-patterns.md` (variable create/bind/alias/scope) codify
the same API surface this bridge uses. Read them THERE — the vendored copies under
`.claude/skills/figma-*` were deleted 2026-09-17, and `FIGMA-CONSOLE-MAP.md` beside this
file translates their `use_figma` calls to the figma-console bridge. They confirm our hard-won rules and add: **always
set `variable.scopes` explicitly** (default `ALL_SCOPES` pollutes every picker — use
`["TEXT_FILL"]`, `["GAP"]`, `["CORNER_RADIUS"]`, `["FRAME_FILL","SHAPE_FILL"]`, etc.);
COLOR *variable values* take `{r,g,b,a}` but *paint* colors take `{r,g,b}` (opacity at
paint level); `resize()` resets sizing modes to FIXED so call it BEFORE setting them;
scripts are **atomic** (a thrown error changes nothing — fix then retry, never blind-retry).
Note: the official docs do NOT cover extension collections — that gap is filled below.

---

## 0. Preflight (run once per session)

```js
// Confirm bridge is live and the ACTIVE FILE is Sherpa-UI, not a drifted file.
```
1. `figma_get_status` → bridge connected? If not, ask the user to reopen the Desktop
   Bridge plugin. Do not proceed.
2. Confirm the open file is Sherpa-UI. If it drifted, `figma_navigate({url, lock:true})`
   to pin it.
3. `await figma.loadAllPagesAsync()` at the top of **every** `figma_execute` call. Dynamic
   page access is on; nodes/pages are otherwise unreachable.

---

## 1. Read the source component FIRST

Read all three files in `components/sherpa-<name>/`:
- `.html` — the anatomy (slots, structure, cloning prototypes). This is your build spec.
- `.css` — every visual property → tells you which token each element consumes.
- `.ts` — variant axes (`data-variant`, `data-size`, `data-status`), boolean props.

Map the anatomy to a Figma node tree before writing any build code. Decide:
- Is this a **single component** or a **component set** (real variant axes: State, Style, Size)?
- Which parts are **slots** vs **text props** vs static structure?
- Is it a **Control** (button/input/tag) or a **Container** (callout/panel/card)? This picks
  the base collection (§3).

---

## 2. The variable architecture (ground truth — audited from Tag/Button/Container/Switch)

Collections, in tier order. **Never bind `--core-*`/Primitives directly. Bind the lowest
appropriate tier.**

| Collection | Kind | Modes | Holds | Bind from a component when… |
|---|---|---|---|---|
| `Primitives` | base | Value | raw values | never |
| `Alias` | base | Value | `space/*`, `size/*`, `border/rounding/*`, `border/width/*`, `color/*` | geometry with no component-scoped override |
| `Apex 2.0` | base | Light, Dark | `content/*`, `surface/*`, `border/*` (semantic) | **neutral content/text/dividers** |
| `Typeface` | base | Value | `family/*`, `weight/*` | via text styles only (not direct) |
| `Controls` | base | Default, Active, Inactive | `surface/*`, `border`, `content/*`, `border/radius`, `border/width`, `space/padding`, `space/gap`, `surface/accent` | control geometry + look |
| `Controls › {primary,secondary,tertiary,tertiary-on-color}` | **ext** | (inherits) | re-valued per variant | pin on a control variant |
| `Containers` | base | default | `surface/*`, `border`, `border/inactive`, `content/default`, `border/radius`, `border/width`, `space/padding`, `space/gap` | container geometry |
| `Containers › {primary,secondary,tertiary}` | **ext** | default | re-valued per variant | pin on a container variant |
| `Status` | base | Filled, Outline | `surface/*`, `border/default`, `content/default`, `content/inverse`, `shadow/color` | **fill/border/status-text of any status-aware component** |
| `Status › {info,critical,warning,urgent,success}` | **ext** | (inherits Filled/Outline) | re-valued per status | pin to set the component's status |
| `Elevation` | base | none, sm, md, lg | `offset-x/y`, `blur`, `spread`, `color` | drop-shadow (bind all 5, default `none`) |
| `Icon` | base | base, sm, lg, xl | `size` | icon width/height |
| `<Component>` (e.g. `Tag`, `Button`, `Switch`, `Checkbox`) | base | 1+ | component-scoped aliases + overrides | **the component binds HERE first** |

### The golden binding rule (this is what drifted)

**A component binds to ITS OWN component-scoped collection where one exists**, and that
collection aliases upward. Tag binds `Tag::fill`, `Tag::border`, `Tag::size/icon`,
`Tag::space/padding-*`. Button binds `Button::surface/default`, `Button::size/height`,
`Button::space/*`. You do **not** reach past the component collection to bind
`Alias::color/...` directly for anything the component collection already abstracts.

Create a component-scoped collection when the component has:
- an enum axis better modeled as **modes** than variants (Tag colours, Button sizes), or
- geometry/values it needs to **override** from Controls/Containers in one or more modes.

If the component is a plain consumer with no overrides (e.g. a simple status container),
it may bind `Status`/`Containers`/`Apex 2.0` directly — but prefer a scoped collection if
you foresee size/density variants.

---

## 2.5. Auto-layout sizing — GET THIS RIGHT or the component clips (biggest failure)

The worst defect this skill was written to prevent: a component **frozen at 10px tall**
that clips its content and renders a phantom stroked bar above the real content. Cause:
confusing `primaryAxisSizingMode` / `counterAxisSizingMode` with width/height.

**The axes are relative to `layoutMode`, not to screen width/height:**
- `primaryAxisSizingMode` = the sizing along the layout direction.
- `counterAxisSizingMode` = the sizing across it.

| layoutMode | primary axis | counter axis |
|---|---|---|
| `HORIZONTAL` | **width** | **height** |
| `VERTICAL` | **height** | **width** |

`FIXED` = locked to the current pixel size. `AUTO` = HUG contents.

**Almost every component wants: fixed width, hug height.** So:
```js
// VERTICAL component (card, callout, section-header, empty-state, accordion, tabs):
node.layoutMode = 'VERTICAL';
node.counterAxisSizingMode = 'FIXED'; node.resize(360, node.height); // width = 360, FIXED
node.primaryAxisSizingMode  = 'AUTO';                                 // height HUGS

// HORIZONTAL component (message row, toolbar):
node.layoutMode = 'HORIZONTAL';
node.primaryAxisSizingMode  = 'FIXED'; node.resize(360, node.height); // width = 360, FIXED
node.counterAxisSizingMode  = 'AUTO';                                 // height HUGS
```
**NEVER** `resize(w, 10)` + `counterAxisSizingMode='FIXED'` on a VERTICAL node — that
locks height to 10. If you need a fixed width, set it with `resize`, not by freezing the
wrong axis. Gate D catches this only if you *read the height* — a component whose height
equals its content is correct; `h:10` with overflowing children is the bug.

Child sizing: any child that should span the parent must be `layoutSizingHorizontal='FILL'`
(text labels, content columns). Icons/close buttons are `FIXED`. A HUG child inside a FILL
row that should stretch = lopsided layout.

## 3. Binding recipes (copy these exactly)

**Variable naming (2026-08-07):** post-Apex collections prefix their vars with the
collection name — `status-surface/default`, `controls-content/default`,
`nav-item-surface/hover`, `button-size/height` (kebab-collection merged into the first
segment). Foundations stay unprefixed: Primitives, Alias, Apex 2.0, Density (Alias),
Typeface, Icon, Elevation. Look up vars by these prefixed names (e.g.
`V('Status','status-surface/default')`), and name any NEW var in a prefixed collection the
same way from the start.

Helper — always guard the variable lookup (silent-fail is the #1 time sink):

```js
const vars = await figma.variables.getLocalVariablesAsync();
const colls = await figma.variables.getLocalVariableCollectionsAsync();
const V = (collName, varName) => {
  const c = colls.find(c => c.name === collName && !c.isExtension);
  const v = vars.find(x => x.name === varName && x.variableCollectionId === c?.id);
  if (!v) throw new Error(`MISSING VAR ${collName}::${varName}`); // fail loud, never silent
  return v;
};
function bindFill(node, v, fallback){ let p={type:'SOLID',color:fallback}; p=figma.variables.setBoundVariableForPaint(p,'color',v); node.fills=[p]; }
function bindStroke(node, v, fallback){ let p={type:'SOLID',color:fallback}; p=figma.variables.setBoundVariableForPaint(p,'color',v); node.strokes=[p]; }
```

**Fill:** `bindFill(node, V('Status','surface/default'), {r:1,g:1,b:1})`

**Stroke colour:** `bindStroke(node, V('Status','border/default'), {..})`

**Stroke weight** — `setBoundVariable('strokeWeight', v)` NO-OPS. Bind the 4 sides:
```js
for (const s of ['strokeTopWeight','strokeBottomWeight','strokeLeftWeight','strokeRightWeight'])
  node.setBoundVariable(s, V('Containers','border/width'));
```

**Corner radius** — bind all 4 corners:
```js
for (const r of ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'])
  node.setBoundVariable(r, V('Containers','border/radius'));
```

**Padding / gap:**
```js
for (const p of ['paddingTop','paddingBottom','paddingLeft','paddingRight'])
  node.setBoundVariable(p, V('Containers','space/padding'));
node.setBoundVariable('itemSpacing', V('Containers','space/gap'));
```

**Text** — use a TEXT STYLE (binds fontFamily→Typeface, fontWeight→Typeface), then bind
the fill separately. Do NOT set raw `fontSize` when a text style exists:
```js
const TS = await figma.getLocalTextStylesAsync();
const st = TS.find(s => s.name === 'body/emphasised/base');
await textNode.setTextStyleIdAsync(st.id);
bindFill(textNode, V('Apex 2.0','content/default/heading'), {r:.1,g:.1,b:.14});
```
Content token choice is **per element**, not blanket, and **per role**. Roles: `heading`,
`label`, `default`(=body), `secondary` — **`body` and `default` are the same role; there
is no `content/body`.**

**Status is the ONLY collection with content aliases.** Everything else binds Apex directly:
- **status-tinted text** → `Status::content/{heading,label,default,secondary}` per element
  (Filled → Apex on-color roles; Outline → neutral Apex roles; status extensions re-tint).
  Bind heading node→`content/heading`, body node→`content/default`, etc.
- **non-status text** (controls, containers, nav, anything not status-aware) → bind
  `Apex 2.0::content/default/{heading,label,body,secondary}` **directly**. Do NOT add or
  route through Controls/Containers content vars — that indirection was tried and removed.
- **links** → `Apex 2.0::content/link/{default,hover,visited}` (default/hover alias
  `content/primary`; visited = muted accent). Links bind Apex link tokens **even inside a
  status component** — a link must read as a link regardless of the status surface, so it
  must NOT flow through `Status::content/*`. (`content/primary/default` still exists for
  primary-action content; use `content/link/*` for text links.)
Binding the same role token everywhere flattens the hierarchy — pick the role per element.

**Icon** — single-level instance of the raw glyph component (from the `Icons` page section).
You CANNOT bind colour through two instance layers, so do not use the Icon *wrapper*
inside components. Size first (width only), then recolour by region-count.
```js
const inst = glyphMaster.createInstance();
inst.layoutSizingHorizontal='FIXED'; inst.layoutSizingVertical='FIXED';
inst.setBoundVariable('width', V('Icon','size')); // BIND WIDTH ONLY
// ⚠ Do NOT also bind height in the same pass — it silently drops the width bind
// (readback shows only height). Icon is a FIXED/FIXED square; width alone suffices.
```
⚠ **Recolour by region count. Do NOT flatten multi-region glyphs.**
```js
const vec = inst.findOne(n => n.type === 'VECTOR');
if (Array.isArray(vec.fills)) {                 // 1-region glyph (tick, chevron, cross) — safe
  bindFill(vec, V('Status','content/default'), {r:0,g:0,b:0});
} else {                                         // figma.mixed = MULTI-REGION status glyph
  // status-info/-warning/… are ONE Vector with 2 regions (badge + "i" counter).
  // Assigning vec.fills=[onePaint] DESTROYS the two-tone look (solid disc) AND corrupts
  // the shared master. Binding a paint onto a mixed instance-vector silently reverts.
  // Recolour PER REGION on the MASTER via setVectorNetworkAsync:
  //   const net = JSON.parse(JSON.stringify(masterVec.vectorNetwork));
  //   net.regions[badge].fills   = [paint bound to Status::border/default];
  //   net.regions[counter].fills = [paint bound to Apex 2.0::content/default/on-color/heading];
  //   await masterVec.setVectorNetworkAsync(net);   // retints ALL instances
}
```
Recovery if a status master got flattened: its `vectorNetwork.regions` still exist —
restore per-region fills with `setVectorNetworkAsync` (badge=status accent, counter=on-color),
then screenshot to confirm the counter reads.

**Elevation (drop-shadow)** — one bound DROP_SHADOW on the base, default mode `none`
(invisible). `radius` = blur:
```js
let e = {type:'DROP_SHADOW',color:{r:0,g:0,b:0,a:0},offset:{x:0,y:0},radius:0,spread:0,visible:true,blendMode:'NORMAL'};
e = figma.variables.setBoundVariableForEffect(e,'color',   V('Elevation','color'));
e = figma.variables.setBoundVariableForEffect(e,'offsetX', V('Elevation','offset-x'));
e = figma.variables.setBoundVariableForEffect(e,'offsetY', V('Elevation','offset-y'));
e = figma.variables.setBoundVariableForEffect(e,'radius',  V('Elevation','blur'));
e = figma.variables.setBoundVariableForEffect(e,'spread',  V('Elevation','spread'));
node.effects = [e];
```

**Mode pins** (set the component's default variant look / status / size):
```js
// pin a Status extension so the component defaults to e.g. info/Outline
const infoExt = colls.find(c => c.isExtension && c.name === 'info' && c.parentVariableCollectionId === V_status_base_id);
comp.setExplicitVariableModeForCollection(infoExt, infoExt.modes.find(m => m.name === 'Outline').modeId);
// pin Containers primary + Elevation none (Container's audited defaults):
comp.setExplicitVariableModeForCollection(containersPrimaryExt, <default modeId>);
comp.setExplicitVariableModeForCollection(elevationColl, <none modeId>);
```

---

## 4. Reference recipe — a status CONTAINER (audited from `Container`)

fill → `Status::surface/default` · stroke → `Status::border/default` ·
radius/width → `Containers::border/radius` / `Containers::border/width` ·
padding/gap → `Containers::space/padding` / `Containers::space/gap` ·
neutral headings → `Apex 2.0::content/default/heading` · body/status text → `Status::content/default` ·
dividers → `Apex 2.0::border/container/default` · one bound drop-shadow (Elevation) ·
mode pins: `Containers›primary = default`, `Elevation = none`, and a `Status` extension for default status.

## 4b. Reference recipe — a CONTROL (audited from `Button`/`Tag`)

Bind the component-scoped collection: `Button::surface/default`, `Button::border/default`,
`Button::size/height`, `Button::space/padding`, `Button::space/gap`; radius/width →
`Controls::border/radius` / `Controls::border/width`; text/icon → `Status::content/default`
(recolours with variant/status). Size axis = **modes** on the component collection
(Button: base/2x-small/…/large), variant look = **Controls extension** pinned per variant.

---

## 5. Component set (variants) — the silent-fail trap

`combineAsVariants` throws **"Grouped nodes must be in the same page as the parent"** if
the variant components aren't already children of the target page. Sequence:

```js
const page = figma.root.children.find(p => p.name === '✅ <Title Case>');
await figma.setCurrentPageAsync(page);          // GATE — see §7
const v1 = figma.createComponent(); page.appendChild(v1); v1.name = 'State=Collapsed';
const v2 = figma.createComponent(); page.appendChild(v2); v2.name = 'State=Expanded';
// ...build both...
const set = figma.combineAsVariants([v1, v2], page);
set.name = 'Accordion';
```
- Variant nodes named `Axis=Value` (e.g. `State=Collapsed`, `Style=Simple, State=On`).
- TEXT / SLOT / variant properties are added on the **COMPONENT_SET**, not a variant.
- Variant axis property naming: descriptive values, axis named `Variant`/`State`/`Style`/`Size`.
- Boolean props named `hasX` / `isX`.

Slots: raw `figma.createSlot()` is unavailable — use MCP tools `figma_create_slot` /
`figma_add_slot_property`. Use a TEXT prop when a slot only ever holds a label; reserve real
Slots for slots accepting component instances.

---

## 6. Placement & naming (non-negotiable)

- Every component lives on its **own page** named `✅ Title Case` — `✅ Button`,
  `✅ Menu`, `✅ Stack`. **Not** `sherpa-<name>`: this doc said that until 2026-09-17
  and the live file has never used it (49 pages use the tick, 1 stray does not).
  One component (or one component set) per page.
- Pages are grouped by `———  SECTION  ———` divider pages: FOUNDATIONS, CONTROLS,
  CONTAINERS, NAVIGATION, DATA GRID, BACKLOG / NOT BUILT, DEPRECATED. Insert a new
  page **next to its closest sibling**, inside the right section:
  ```js
  const names = figma.root.children.map(p => p.name);
  const page = figma.createPage(); page.name = '✅ Stack';
  figma.root.insertChild(names.indexOf('✅ Toolbar') + 1, page);   // beside its sibling
  ```
- The Figma component NODE name is Title Case (`Section Header`), the PAGE is `sherpa-section-header`.
- Set a `description` on every component/set (used by MCP schema parse) referencing the
  `sherpa-<name>` element and its status/variant wiring.

---

## 7. MANDATORY VERIFY GATES

Run these; do not report "done" until all pass.

**Gate A — Page placement (catches the dump-on-wrong-page bug).**
Immediately after creating/combining, assert the node's page:
```js
let pg = node; while (pg.parent && pg.type !== 'PAGE') pg = pg.parent;
if (pg.name !== '✅ <Title Case>') throw new Error(`WRONG PAGE: on ${pg.name}`);
```
And confirm no *other* page gained stray components this call.

**Gate B — Binding readback (catches silent unbound paints).**
Re-read the component tree and assert the critical bindings are present and point at the
intended `Collection::var`. A fill/stroke with `boundVariables:{}` = FAILED bind — fix the
var lookup (wrong name), don't move on. (Reuse the audit walker: read `fills[0].boundVariables.color`,
`node.boundVariables.*`.)

**Gate C — Mode-pin readback.** For status/elevation/variant defaults, read
`comp.explicitVariableModes` and confirm the intended collections are pinned to the intended modes.

**Gate D — Sizing readback (catches the frozen-height clip).** BEFORE screenshotting,
read the component's dimensions and layout sizing. Assert height ≈ content, not a frozen
stub:
```js
// height must HUG: VERTICAL → primaryAxisSizingMode==='AUTO'; HORIZONTAL → counterAxisSizingMode==='AUTO'
const hugsHeight = comp.layoutMode==='VERTICAL' ? comp.primaryAxisSizingMode==='AUTO'
                                                : comp.counterAxisSizingMode==='AUTO';
if (!hugsHeight || comp.height < 20) throw new Error(`FROZEN/CLIPPED: h=${comp.height}`);
```
A component at `h:10` with real content = the frozen-axis bug (§2.5). Fix, don't screenshot around it.

**Gate E — Screenshot & LOOK critically.** `figma_take_screenshot`, then judge it as a
designer, not a linter. Passing A–D does NOT mean it looks right. Explicitly check:
- No **phantom bar / stray stroked frame** above or around the content (= frozen height).
- Text is **not clipped** (descenders intact, all lines visible).
- **Multi-region icons render two-tone** (e.g. status badge shows its "i"/glyph, not a
  solid disc). A solid disc = a flattened glyph (§3 icon recipe).
- FILL vs HUG: nothing lopsided; labels stretch, controls hug.
- Status colour actually shows on fill/border/icon.
If any fails, fix and re-shoot. Iterate ≤3×. Never report "done" off the data alone —
this skill was written because green gates hid visibly broken components.

**Gate F — Cleanup.** Remove any throwaway FRAMEs left from prior one-shot attempts on
this page (old builds used plain frames named `<name>`, `*variants`, `*states`). The page
should contain only the real component + optional preview instances. Also confirm you did
**not** damage a shared asset (e.g. an icon master) while building — if you touched a
master, screenshot an untouched sibling component that uses it.

---

## 8. After the build

- Update memory `sherpa-figma-components-built.md` with the component's variant/prop/binding shape.
- If a new pattern or gotcha emerged, record it (don't duplicate existing memories).
- Never add modes to `Apex 2.0` — themes use **extended collections** by design. Do not
  consolidate theme collections. (Standing user constraint.)

---

## Failure catalogue (each gate maps to a real incident)

| Symptom | Cause | Prevention |
|---|---|---|
| 8 components on one page, 5 pages "empty" | createComponent/combine parented to `currentPage`, not the looked-up page | Gate A + `setCurrentPageAsync(page)` + `page.appendChild` before combine |
| `combineAsVariants` throws "same page as parent" | variants not appended to target page first | §5 sequence |
| Fill/stroke won't bind, no error | wrong var name → `setBoundVariableForPaint` returns unbound paint silently | `V()` throws on miss + Gate B |
| Icon renders as empty/box, or colour won't change | double-nested instance (Icon wrapper) | single-level glyph instance, bind inner Vector |
| strokeWeight ignored | `setBoundVariable('strokeWeight')` no-ops | bind 4 per-side weights |
| Status colour doesn't show | no Status extension pinned | Gate C |
| Half-complete throwaway frames litter pages | prior one-shot never cleaned | Gate E |
| Icon width shows UNBOUND after binding | bound width AND height in one pass → width bind dropped | bind `width` only on a FIXED/FIXED square + Gate B |
| Text uses raw fontSize, unbound from Typeface | set fontSize instead of a text style | always `setTextStyleIdAsync` when a matching style exists + Gate B checks `textStyleId` |
| Component frozen `h:10`, text clipped, phantom stroked bar | `counterAxisSizingMode='FIXED'` + `resize(w,10)` froze the height axis | §2.5 axis table; height HUGS (AUTO) + Gate D |
| Status icon renders as solid disc (no glyph) | assigned one paint to a multi-region (`figma.mixed`) status Vector → flattened it | §3 region-count branch; recolour per region via `setVectorNetworkAsync`, never flatten |
| Icon recolour silently reverts | bound a paint onto a `figma.mixed` instance vector | edit the master per region, not the instance |
| Shared icon master corrupted after a build | wrote a single fill to a shared multi-region master | Gate F: never write single paint to a mixed master; screenshot a sibling |
| Green gates, visibly broken component | Gate D was "check it looks ok" — too soft to fail anything | Gate E forces explicit critical checks (phantom bar, clipping, two-tone icon) |
| Every instance shows the component's DEFAULT text, ignoring the per-instance/set value | a second `node.componentPropertyReferences = {visible: …}` OVERWROTE the earlier `{characters: …}` — the assignment REPLACES the whole refs object, it does not merge | set ALL refs for a node in ONE literal: `node.componentPropertyReferences = { characters: labelKey, visible: isMaxKey }`. Gate B: read back `textNode.componentPropertyReferences` and assert `characters` is present |
| `setProperties` "silently fails" — the BOOLEAN stays false | matched the key with `startsWith('hasLeading')`, which also matches **`hasLeadingControl`** — the wrong property got flipped | match the part before the `#` EXACTLY: `Object.keys(p).find(k => k.split('#')[0] === name)` |
| Content added to a slot, but nothing renders | the slot's own `visible` is driven by a BOOLEAN prop (`hasLeading`) that is false — the child reads `visible:true` inside a hidden SLOT | read `slot.visible`, not just the child's; turn the BOOLEAN on |
| Text in a trailing slot clips | the slot was `layoutSizingHorizontal:'FIXED'` at its default width (16px) and the content is wider | set the slot to HUG after appending |
| An emptied slot still eats space | removing a slot's children does not collapse the slot | `slot.visible = false` |
| A composed dot/pip reads as a hollow ring | the default Tag `Type=dot` binds `Style::style-surface/base` (white) + a border — it is the DEFAULT tag, not an accent one | bind the ink the CODE uses and clear `strokes` |
| `V()` throws on a name that "should" exist | guessed the token name (`content/body/3`); Theme uses a `base` / `+1..+4` range (`content/body/+1`) | read what the EQUIVALENT existing node binds and copy it, rather than guessing a name |
| "Extension override didn't take" (but it did) | read back via base var's `valuesByMode` — extension overrides are NOT stored there (only base-mode keys appear), so it looks unchanged | the write via `setValueForMode(extModeId, …)` DOES work; VERIFY by rendering a swatch pinned to the extension mode (`setExplicitVariableModeForCollection`) + screenshot, never by reading valuesByMode. (`createVariable` inside an extension still genuinely throws — extensions only re-value inherited vars.) |
