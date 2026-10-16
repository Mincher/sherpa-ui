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
a variable. **The verify gates below are mandatory — do not skip
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
  the reference recipe (§4b or §4).

---

## 2. The variable architecture (read live from Figma, 2026-10-16)

These names were read live on 2026-10-16 from Button (11:2463), App Header (150:3690), Filter Chip (atom) (154:3904), Badge (145:3385), Container (24:234) and Switch (18:146). The export (`src/styles/tokens/figma.tokens.json`) can be older than Figma. When the two disagree, Figma is correct. `V()` (§3) throws on a name that is not there, so let it fail. Do not guess a name.

### The binding rule

PRINCIPLES 8 (`docs/PRINCIPLES.md`): **"A colour binds the Style name Figma binds; a state is a mode pin in `state-pins.yaml`, never a colour rule. `/* theme-direct */` where Figma binds Theme too."**

Build rules, Rule 8 (`docs/DEF-TO-FIGMA-BUILD-RULES.md`, § Figma): **"every property binds the variable that resolves to its value."** Bind a stroke only where a stroke exists. Skip an off-scale value. Never touch an instance's internals.

In Figma, that means:

1. **Colour binds Style.** Fill, stroke, text, icon and shadow colour all bind `style-surface/*`, `style-border/*`, `style-content/*` or `style-indicator/accent`.
2. **A state, a look and a status are mode pins.** Never bind a different colour variable to show one.
3. **Geometry binds Display Mode.** Use `space/*`, `border/rounding/*` and `border/width/*`. A component that can sit in a group binds Grouping for its corners and edges.
4. **Text binds the Theme `content/*` atoms.** Its fill is a Style colour.
5. **Never bind Primitives. Never leave a raw value where a step matches.** An off-scale value stays unbound, and you report it (Rule 8).
6. **A new component binds no Theme colour, except where Figma has no Style variable (a link, §3).** In code, `lint:css theme-colour` counts each component's Theme colour reads that are NOT marked `/* theme-direct */`, against a baseline that may only fall. A new component starts at 0, so its only Theme colours are marked reads, where Figma binds Theme too.

### Collections (12 base, 13 override)

| Collection | Kind | Modes | Holds | A component binds it when |
|---|---|---|---|---|
| `Primitives` | base | `value` | raw `color/*`, `border/radius/*`, `scale/*`, `effects/*`, `motion/*` | never |
| `Display Mode` | base | `light`, `dark` | `space/*`, `size/*`, `border/width/*`, `border/rounding/*`, `fonts/*`, `color/*` | padding, gap, stroke weight, radius (Rule 8). Never bind its `color/*` |
| `compact`, `comfortable` | override of Display Mode | `light`, `dark` | `space/*` and `size/*`, one step down / up | never. The page picks density. Never pin it on a component |
| `Theme` | base | `Sherpa` | text atoms `content/{font, size, line-height, weight, letter-spacing, paragraph-spacing}`, `content/body/*`, `size/icon/*`, `padding/*`, `gap/*`, `surface/*`, `border/*`, `data-viz/*` | text atoms, icon size, container padding and gap ("Not settled", below). Never for a colour |
| `Style` | base | `default`, `info`, `critical`, `warning`, `urgent`, `success`, `active`, `inactive` | `style-surface/{base, base +1, base +2, …}`, `style-border/{base, base +1, …}`, `style-content/{base, secondary, inverse, …}`, `style-indicator/accent` | every colour. The mode is the state or the status |
| `Transparent`, `Saturated` | override of Style | the 8 Style modes | the two looks | pin one on a component or instance to give it that look |
| `Elevation` | base | `passthrough`, `sm`, `md`, `lg` | `offset-x`, `offset-y`, `blur`, `spread` | the drop shadow's shape. `passthrough` is no shadow |
| `Grouping` | base | `solo`, `start`, `mid`, `end` | `border/{top, bottom, left, right}`, `rounding/{top-left, top-right, bottom-left, bottom-right}` | corners and edges of a control or container that can sit in a group. The mode is its POSITION |
| `vertical`, `grid-top`, `grid-mid`, `grid-bottom` | override of Grouping | `solo`, `start`, `mid`, `end` | the same, for a column or a grid row | pin one on an instance placed in a column or grid |
| `Structure` | base | `default`, `2xs`, `xs`, `sm`, `lg`, `xl` | `height`, `icon-size`, `structure-space/{padding, gap, …}`, `structure-font/{size, line-height, weight}` | a sized control: the Button (Rule 6). The Switch binds its `gap`. The mode is the size |
| `Switch` | base | `standard`, `simple` | `switch-size/{width, height, padding, thumb}`, `switch-radius/{track, thumb}`, `hasLabel` | the Switch only |
| `Input` | base | `default`, `validation` | `hasValidation` | the text input only |
| `Navigation` | base | `default`, `collapsed`, `hover`, `pinned`, `settings` | `nav-shadow/*`, `nav-surface/default`, `nav-layout/width`, `nav-item-tier-1`…`3`, `isVisible`, `isHidden`, `headerState` | the nav and the nav item only |
| `Layout` | base | `mobile`, `tablet`, `desktop`, `wide` | `layout-grid/*`, `breakpoint` | page grids, not components |
| `Calendar D`, `Calendar M/Y`, `App Shell` | override of Layout (`Calendar M/Y` extends `Calendar D`) | as Layout | their own grids | the calendar; the app shell |
| `Data Viz` | base | `sequence 1` … `sequence 5` | `series/*`, `border` | a chart's series (copy what an existing chart binds) |
| `Status`, `Set 2` | override of Data Viz | as Data Viz | other series palettes | a chart only. **This `Status` is NOT a component status.** A status is a Style mode |

- **Overrides are on the COLLECTION.** An override collection uses its parent's variables, keyed by the parent's mode ids. Read its values from `collection.variableOverrides`, not from a variable's `valuesByMode`, which shows only the parent's values (TRAP `T-an-override-collection-is-keyed-by-its-parent`, TRAP `T-a-look-override-is-not-on-the-variable`). `Transparent` and `Saturated` still hold entries for two deleted variables (`style-surface/dark`, `style-content/light`), so read only the ids in the parent's `variableIds`.
- **Hidden orphans.** `getLocalVariableCollectionsAsync()` does not return 56 collections that nodes still pin: 54 extensions and 2 bases, `Typography` and `Snapping`. 42 of them hold no variables. Some share a live name: hidden `Saturated`, `Transparent`, `secondary` and `tertiary` extend Structure, and a hidden `Status` base has its own `Saturated`. 6,138 text nodes pin one, including the text in current components (the Button label, the Container title), and 5,613 of those pin a mode id that no longer exists. All 18 local text styles bind variables in the hidden `Typography`. Make new text nodes. Do not copy a text node from an existing component, do not use a text style, and never resolve a collection by name from a node's `explicitVariableModes`.

### Mistakes in the live file: do not copy them

- Badge `Type=count` binds its radius to `Primitives/border/radius/150`, a primitive. Bind Display Mode `border/rounding/*`, as `Type=dot` does (`border/rounding/full`).
- App Header `Content` binds its padding to `Theme/gap/md`. Never use a gap as padding, or a padding as a gap.
- Filter Chip (atom) `State=simple` takes its corners from Grouping but its edges from Display Mode `border/width/sm`. Bind corners and edges from the same family, as the `State=menu` `Left` frame does.
- Four instance overrides bind deleted variables. The Badge stroke in both Filter Chip variants binds `Theme/_old_border/base`. Both Container Footer buttons bind their radii to `Structure/structure-rounding/*`. And the Switch `Value=on` main binds its track fill to the deleted `Style/style-surface/dark`.
- Some text and icons bind a Theme colour. The App Header title binds `content/body/+1`. The Container's title, description and body bind `content/body/base` or `+1`, and its header icon's vector binds `content/body/+1`. The Switch `Value=on` label binds `content/body/inverse-fixed`. New text binds Style `style-content/*`.
- Most effects bind their colour to `Elevation/color`. That variable is not in Elevation's 4-variable list (§3, Elevation).

### Not settled

- **Padding and gap.** Rule 8 names Display Mode `space/*`. Containers bind Theme `padding/*` and `gap/*`. The `Container Footer` main binds `padding/md` at the top and `padding/sm` on the other sides, and the Dialog's footer instance inherits it. Copy what the nearest existing sibling binds, and report which one you used.

### Retired: never look these up

- **Collections:** `Alias`, `Apex 2.0` (now Theme), `Typeface`, `Typography`, `Hero`, `Mono`, `Icon`, `Density (Alias)`, `Snapping`. `Controls` and `Containers`, with their primary / secondary / tertiary extensions (hidden `secondary` and `tertiary` now extend Structure). The old base `Status` (modes `passthrough`, `info`, `critical`, `warning`, `urgent`, `success`), with its `Saturated` and `Border Only` extensions. The hidden per-status extensions of Style (`info`, `critical`, `warning`, `urgent`, `success`, `anchored-right`, `app-primary`). The `Button`, `Tag` and `Checkbox` collections.
- **Variable names:** the bare names `surface/default`, `border/default`, `content/default/*`, `space/padding`, `border/radius`, `size/height`, and anything with a `Button::` or `Tag::` prefix. Theme `surface/default/*` and `border/default/*`, and Primitives `border/radius/*`, are live, but a component binds none of them (a Theme colour, a primitive).
- **Elevation:** the mode `none` (it is `passthrough` now) and the variable `color`.
- **Text styles:** the 18 local text styles, and `setTextStyleIdAsync`.
- **Doctrine:** "a component binds its own collection first", and build rules 3 and 4.
- **Grouping names:** `data-snap` and `.sherpa-snap-group`.

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
**Exception: the Button**, and any control whose height binds Structure `height`. Its
height is that variable, so it is never HUG (build rules, Rule 6). A `Type=icon` button
binds both width and height to `height`.

**NEVER** `resize(w, 10)` + `counterAxisSizingMode='FIXED'` on a VERTICAL node — that
locks height to 10. If you need a fixed width, set it with `resize`, not by freezing the
wrong axis. Gate D catches this only if you *read the height* — a component whose height
equals its content is correct; `h:10` with overflowing children is the bug.

Child sizing: any child that should span the parent must be `layoutSizingHorizontal='FILL'`
(text labels, content columns). Icons/close buttons are `FIXED`. A HUG child inside a FILL
row that should stretch = lopsided layout.

## 3. Binding recipes (copy these exactly)

**Names.** Look up the full path as Figma shows it:

- Style variables start with `style-`. Note the space in `style-surface/base +1`.
- Structure has `height`, `icon-size`, `structure-space/*` and `structure-font/*`.
- Switch has `switch-size/*` and `switch-radius/*`. Navigation has `nav-*`.
- Display Mode, Theme, Grouping and Elevation names have no prefix.
- `base`, `base +1` and `base +2` are the default, hover and down steps.

Do not guess a name. Read what an equivalent existing node binds, and copy it.

Helpers. Always guard the lookup: a silent miss is the #1 time sink.

```js
const vars  = await figma.variables.getLocalVariablesAsync();
const colls = await figma.variables.getLocalVariableCollectionsAsync();
// A variable in a BASE collection.
const V = (collName, varName) => {
  const c = colls.find(c => c.name === collName && !c.isExtension);
  const v = vars.find(x => x.name === varName && x.variableCollectionId === c?.id);
  if (!v) throw new Error(`MISSING VAR ${collName}::${varName}`); // fail loud, never silent
  return v;
};
// A collection to PIN (base or override), and a mode of it.
const C = name => { const c = colls.find(c => c.name === name); if (!c) throw new Error(`MISSING COLLECTION ${name}`); return c; };
const M = (c, modeName) => { const m = c.modes.find(m => m.name === modeName); if (!m) throw new Error(`MISSING MODE ${c.name}›${modeName}`); return m.modeId; };
const pin = (node, collName, modeName) => { const c = C(collName); node.setExplicitVariableModeForCollection(c, M(c, modeName)); };
function bindFill(node, v, fallback){ let p={type:'SOLID',color:fallback}; p=figma.variables.setBoundVariableForPaint(p,'color',v); node.fills=[p]; }
function bindStroke(node, v, fallback){ let p={type:'SOLID',color:fallback}; p=figma.variables.setBoundVariableForPaint(p,'color',v); node.strokes=[p]; }
// Gate B: a bound id must still be a live variable. A deleted one can stay bound.
const isLive = async id => {
  const v = await figma.variables.getVariableByIdAsync(id);
  const c = v && colls.find(c => c.id === v.variableCollectionId);
  return !!c && c.variableIds.includes(id);
};
```
`C('Status')` returns the **Data Viz** override, not a component status.

**Fill:** `bindFill(node, V('Style','style-surface/base'), {r:1,g:1,b:1})`.
- A hover variant binds `style-surface/base +1`. A down variant binds `base +2`.
- An on state is NOT `+1`. It is the `active` mode's `base` (see Mode pins).

**Stroke colour:** `bindStroke(node, V('Style','style-border/base +1'), {..})`.
- Button, Filter Chip (atom) and Container bind `base +1`. Badge and Switch bind `base`.
- Copy the nearest sibling.

**Stroke weight.** `setBoundVariable('strokeWeight', v)` does nothing (NO-OPS). Bind the 4 sides.
```js
// A component that never sits in a group:
for (const s of ['strokeTopWeight','strokeBottomWeight','strokeLeftWeight','strokeRightWeight'])
  node.setBoundVariable(s, V('Display Mode','border/width/sm'));
// A control or container that can sit in a group: each side from Grouping.
const side = {strokeTopWeight:'top', strokeBottomWeight:'bottom', strokeLeftWeight:'left', strokeRightWeight:'right'};
for (const [f, k] of Object.entries(side)) node.setBoundVariable(f, V('Grouping', `border/${k}`));
```

**Corner radius.** Bind all 4 corners, from the same family as the edges.
```js
// Never in a group:
for (const r of ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'])
  node.setBoundVariable(r, V('Display Mode','border/rounding/sm'));
// Can sit in a group:
const corner = {topLeftRadius:'top-left', topRightRadius:'top-right', bottomLeftRadius:'bottom-left', bottomRightRadius:'bottom-right'};
for (const [f, k] of Object.entries(corner)) node.setBoundVariable(f, V('Grouping', `rounding/${k}`));
```
- A grouped component pins `Grouping` = `solo` at its root.
- The modes already do the joins. A shared edge goes one step down the width ramp, on both
  sides. A corner is round only when both of its edges are outer edges. Never set a joint
  by hand (TRAP `T-a-shared-edge-is-halved-on-both-sides`).

**Padding / gap.** Bind the Display Mode step whose value equals the CSS value (Rule 8).
If no step matches, skip it and report it. The MCP's `token_for` and `check_bindings`, and
`scripts/audit-bindings.mjs`, find the step.
```js
for (const p of ['paddingTop','paddingBottom','paddingLeft','paddingRight'])
  node.setBoundVariable(p, V('Display Mode','space/xs'));
node.setBoundVariable('itemSpacing', V('Display Mode','space/2xs'));
```
- A Button binds Structure for these (§4b).
- A container binds Theme `padding/*` and `gap/*` today (§2, "Not settled").
- Spacing sits on the 4px grid (TRAP `T-the-grid-is-two-grids`).

**Text.** Do not use a text style: all 18 are dead. Bind the Theme atoms on the node, then
bind the fill.
```js
await figma.loadFontAsync(text.fontName);              // and the font the bound family resolves to
const A = n => V('Theme', `content/${n}`);
text.setBoundVariable('fontFamily',       A('font/body'));          // a value or a count: 'font/monospaced'
text.setBoundVariable('fontSize',         A('size/base'));          // steps seen: small, base, large
text.setBoundVariable('lineHeight',       A('line-height/base'));   // the same step as the size
text.setBoundVariable('letterSpacing',    A('letter-spacing/base'));
text.setBoundVariable('fontWeight',       A('weight/regular'));     // or 'weight/medium' for a Container Header title
text.setBoundVariable('paragraphSpacing', A('paragraph-spacing'));
bindFill(text, V('Style','style-content/base'), {r:.1,g:.1,b:.14});
```
- **Fill by role.** Main text binds `style-content/base`. Secondary text binds
  `style-content/secondary`. The mode pinned above the text (status, state, look) gives
  the right ink, so text on a pinned surface still binds `style-content/base`.
  `style-content/inverse` is for a part drawn on a content-coloured fill (the Switch's off
  thumb, a status glyph's counter).
- **A role's atoms are canonical** (Rule 2a). A variant reuses the atoms the default variant
  gives each role (label, value, description).
- **The Button is the exception.** Its size, line height and weight bind Structure
  `structure-font/*` (§4b).
- **Links.** Style has no link variable. A link binds Theme `content/link/base`, with
  `+1` and `+2` for hover and down (all live, 2026-10-16). That is a Theme colour, so the
  code marks it `/* theme-direct */`.
- Text sits on the 2px grid.

**Icon.** Use a single-level instance of the raw glyph component (from the `Icons` page
section). You cannot bind colour through two instance layers, so do not use the Icon
*wrapper*. Set the size first (width only), then recolour by region count.
```js
const inst = glyphMaster.createInstance();
inst.layoutSizingHorizontal='FIXED'; inst.layoutSizingVertical='FIXED';
inst.setBoundVariable('width', V('Theme','size/icon/xs')); // BIND WIDTH ONLY
// ⚠ Do NOT also bind height in the same pass — it silently drops the width bind.
```
- `size/icon/*` aliases `content/size/*`, one step offset: `2xs`→`xs`, `xs`→`base`,
  `sm`→`large`, `md`→`h2`, `lg` and `xl`→`h1`. So an icon beside `base` text is
  `size/icon/xs`. Some live icons bind `content/size/base` directly, which is the same
  value as `size/icon/xs`: the Container Header's icon binds its width, and the Filter
  Chip's icon binds its height.
- Inside a sized control, the control sets the size: the Button binds `V('Structure','icon-size')`.
- The square frame is the layout box. The art renders at the size it was drawn: the frame
  is the viewBox.
- Check an icon swap by its main component's name (Rule 5), not by a screenshot.

⚠ **Recolour by region count. Do NOT flatten multi-region glyphs.**
```js
const vec = inst.findOne(n => n.type === 'VECTOR');
if (Array.isArray(vec.fills)) {                 // 1-region glyph (tick, chevron, cross) — safe
  bindFill(vec, V('Style','style-content/base'), {r:0,g:0,b:0});
} else {                                         // figma.mixed = MULTI-REGION status glyph
  // One Vector with 2 regions (badge + counter); status-warning has 4. vec.fills=[onePaint]
  // DESTROYS the two-tone look AND corrupts the shared master. A paint on a mixed
  // instance-vector silently reverts. Recolour PER REGION on the MASTER:
  //   const net = JSON.parse(JSON.stringify(masterVec.vectorNetwork));
  //   net.regions[badge].fills   = [paint bound to a Style colour];
  //   net.regions[counter].fills = [paint bound to style-content/inverse];   // all 7 status masters bind it live
  //   await masterVec.setVectorNetworkAsync(net);   // retints ALL instances
  // First read what the master's regions bind now, and keep it if it is Style. Live, no master
  // binds style-indicator/accent: critical, ok, urgent, warning and warning-ok bind a REMOTE
  // library variable (surface/status/<status>/strong/default) that V() cannot find;
  // status-neutral binds style-surface/base +2; status-info binds Theme content/info/+2.
}
```
If a status master got flattened, its `vectorNetwork.regions` still exist. Restore the
per-region fills with `setVectorNetworkAsync`, then take a screenshot to confirm the
counter shows.

**Elevation (drop shadow).** Put one bound DROP_SHADOW on the base and bind all 5 fields.
`radius` is the blur. Elevation gives the SHAPE. Style gives the COLOUR, so the shadow
takes the status tint.
```js
let e = {type:'DROP_SHADOW',color:{r:0,g:0,b:0,a:0},offset:{x:0,y:0},radius:0,spread:0,visible:true,blendMode:'NORMAL'};
e = figma.variables.setBoundVariableForEffect(e,'color',   V('Style','style-surface/shadow'));
e = figma.variables.setBoundVariableForEffect(e,'offsetX', V('Elevation','offset-x'));
e = figma.variables.setBoundVariableForEffect(e,'offsetY', V('Elevation','offset-y'));
e = figma.variables.setBoundVariableForEffect(e,'radius',  V('Elevation','blur'));
e = figma.variables.setBoundVariableForEffect(e,'spread',  V('Elevation','spread'));
node.effects = [e];
pin(comp, 'Elevation', 'passthrough');  // no shadow by default
```
- Most mains bind the colour to `Elevation/color`. That variable is not in Elevation's
  4-variable list, so do not copy it.
- The Container Footer's effect binds `style-surface/shadow` live: copy that one.

**Mode pins.** These set a component's state, look, status, size and position. Pin with
`setExplicitVariableModeForCollection`, through `pin()`:
```js
pin(comp, 'Style', 'default');           // a root that must not inherit its parent's mode (Badge, Menu)
pin(comp, 'Grouping', 'solo');           // a groupable control
pin(comp, 'Structure', 'default');       // a sized control
pin(inst, 'Transparent', 'default');     // a LOOK: pin the override, not Style
pin(inst, 'Saturated', 'success');       // a look in a mode (state-pins.yaml writes it saturated/success)
pin(onVariant, 'Style', 'active');       // a STATE: on, current, open, pressed
pin(disabledVariant, 'Style', 'inactive'); // disabled. Never opacity
pin(inst, 'Style', 'critical');          // a STATUS: info, critical, warning, urgent, success
```
- **Hover and down are not modes.** They are the `base +1` and `base +2` steps of the mode
  that is pinned.
- **A state with a look** pins the look's collection to the state's mode: `Transparent` = `active`.
- **A pin does not reach a nested instance's own bindings** (Rule 7). Pin the mode on the
  instance itself. Never resize an instance away from its natural size.
- **Never pin a density** (`compact`, `comfortable`) or a Display Mode on a component.
- **A flag is not a pin.** The data grid marks a column `data-status="active"` but pins its
  heading back to `default`.
- **The code copies these pins from `scripts/figma-data/state-pins.yaml`.** When a build adds
  a state, add its row there, for example `'&[data-current]': active` or
  `'&[disabled]': transparent/inactive`. Then run `node scripts/project-tokens.mjs`
  (TRAP `T-a-state-colour-binds-the-style-mode`).
- **To check an override's value,** pin a swatch to the mode and take a screenshot.
  `valuesByMode` shows only the parent's values.

---

## 4. Reference recipe — a CONTAINER (read live from `Container`, 24:234)

- **Root.** Fill → `Style::style-surface/base`. Stroke → `Style::style-border/base +1`.
  Corners and edges → Grouping `rounding/*` and `border/*`. One shadow: Elevation shape
  plus a Style colour (§3). The live root binds the dead `Elevation/color`, so do not copy
  it. Pin `Style` = `default`.
- **Header** (`Container Header`, an instance pinned `Elevation` = `passthrough`).
  - Padding → Theme `padding/md`. Gap → Theme `gap/sm`.
  - Bottom stroke: weight → Display Mode `border/width/sm`, colour → `style-border/base +1`.
  - Title: Theme atoms at `base`, weight `medium`, fill `style-content/base` (live binds
    Theme `content/body/base`, a mistake).
  - Description: Theme atoms at `small`, weight `regular`, fill `style-content/secondary`
    (live binds Theme `content/body/+1`, a mistake).
  - Its icon buttons are instances pinned `Structure` = `xs` or `sm`, and `Transparent` or
    `Style` = `default`.
- **Content slot.** Padding → Theme `padding/lg`. Gap → Theme `gap/lg`. Body text: Theme
  atoms at `base`, fill `style-content/base` or `secondary` (live binds Theme
  `content/body/+1`, a mistake).
- **Footer** (`Container Footer`, an instance pinned `Elevation` = `passthrough`).
  - Padding → Theme `padding/md` at the top, `padding/sm` on the other sides. Gap → Theme
    `gap/sm`.
  - Top stroke: weight → Display Mode `border/width/sm`, colour → `style-border/base +1`.
- **A status container** pins `Style` to the status mode on the instance. Change nothing
  else: every Style variable moves together.
- **Disabled** pins `Style` = `inactive`.

## 4b. Reference recipe — a CONTROL (read live from `Button`, 11:2463)

- **Variants:** `Type=label` (the default) and `Type=icon`.
- **Pins on the main:** `Structure` = `default`, `Style` = `default`, `Grouping` = `solo`.
- **Size** → Structure.
  - Height → `height`. A `Type=icon` button binds width and height to `height`.
  - Left and right padding → `structure-space/padding`. Top and bottom padding stay unbound,
    because the height sets them.
  - Gap (`itemSpacing`) → `structure-space/gap`.
  - Never HUG it, and never give it a raw px (Rule 6).
- **Corners and edges:** Grouping `rounding/*` ×4 and `border/*` ×4.
- **Colour:** fill → `style-surface/base`, stroke → `style-border/base +1`, plus one shadow (§3).
- **Icons** (`icon-start` and `icon-end`, single-level instances): width and height →
  Structure `icon-size`. Vector fill → `style-content/base`.
- **Label text:**
  - Size, line height and weight → Structure `structure-font/size`, `line-height` and `weight`.
  - Family → Theme `content/font/body`. Letter spacing → `content/letter-spacing/base`.
    Paragraph spacing → `content/paragraph-spacing`.
  - Fill → `style-content/base`.
- **Size axis = the Structure mode, pinned on the instance:** `2xs`, `xs`, `sm`, `default`,
  `lg`, `xl`. The App Header pins `xs` and `sm`.
- **Look = an override pin on the instance.** The App Header's icon buttons pin
  `Transparent` = `default`. One Container Footer button pins `Saturated` = `default`.
- **State = a mode of the look's collection.** Pressed or open is `active`, disabled is
  `inactive`. The `sherpa-button` rows in `state-pins.yaml` are the code side.

**Switch (18:146), the other audited control:**
- Variants: `Value=off` (the default) and `Value=on`.
- Pins: both variants pin `Structure` = `xs` and `Switch` = `standard`. `Value=off` pins
  `Style` = `default`. `Value=on` pins `Saturated` = `success` (state-pins.yaml
  `'&[checked]': saturated/success`).
- Geometry:
  - Size → `Switch::switch-size/{width, height, padding}`. Radius → `switch-radius/track`.
  - Gap → Structure `structure-space/gap`.
  - Edges → Display Mode `border/width/sm`, because a Switch never sits in a group.
- Colour: stroke → `style-border/base`. Track fill: `Value=off` → `style-surface/base +2`.
  `Value=on` binds the deleted `style-surface/dark`, so do not copy it.
- Thumb: width → `switch-size/thumb`, radius → `switch-radius/thumb`. Fill: `Value=off` →
  `style-content/inverse`, `Value=on` → `style-content/base`.
- Label: Theme atoms at `small`, weight `regular`. Fill: `Value=off` → `style-content/base`.
  `Value=on` binds Theme `content/body/inverse-fixed`, a mistake.
- The label's `visible` follows the `hasLabel` component property. That property's default
  is bound to `Switch::hasLabel`, so `simple` hides the label.
- The data bar's instance pins `Switch` = `simple`, `Structure` = `xs` and `Saturated` = `success`.

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
- The Figma component NODE name is Title Case (`Section Header`). A new component's PAGE uses the same name with the tick: `✅ Section Header`. Not every existing page does (`Filter Chip (atom)` is on `✅ Quick Filter Chip`, `Container` and `Dialog` on `✅ Containers`, `Filter Toolbar` on `✅ Quick Filter Toolbar`), so find an existing component by its node, not by its page name.
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
var lookup (wrong name), don't move on. A bound id must also still be live: `isLive()` (§3),
because a deleted variable can stay bound. (Reuse the audit walker: read `fills[0].boundVariables.color`,
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
- Never add modes to `Theme`. It has one mode, `Sherpa`. Themes use **extended collections** by design. Do not consolidate theme collections. (Standing user constraint.)

---

## Failure catalogue (each gate maps to a real incident)

| Symptom | Cause | Prevention |
|---|---|---|
| 8 components on one page, 5 pages "empty" | createComponent/combine parented to `currentPage`, not the looked-up page | Gate A + `setCurrentPageAsync(page)` + `page.appendChild` before combine |
| `combineAsVariants` throws "same page as parent" | variants not appended to target page first | §5 sequence |
| Fill/stroke won't bind, no error | wrong var name → `setBoundVariableForPaint` returns unbound paint silently | `V()` throws on miss + Gate B |
| Icon renders as empty/box, or colour won't change | double-nested instance (Icon wrapper) | single-level glyph instance, bind inner Vector |
| strokeWeight ignored | `setBoundVariable('strokeWeight')` no-ops | bind 4 per-side weights |
| Status colour doesn't show | no Style mode pinned | Gate C |
| Half-complete throwaway frames litter pages | prior one-shot never cleaned | Gate E |
| Icon width shows UNBOUND after binding | bound width AND height in one pass → width bind dropped | bind `width` only on a FIXED/FIXED square + Gate B |
| Text uses raw fontSize, unbound | set fontSize by hand | bind the Theme `content/*` atoms (§3, Text) + Gate B reads each text binding. The 18 text styles bind a hidden collection: do not use them |
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
