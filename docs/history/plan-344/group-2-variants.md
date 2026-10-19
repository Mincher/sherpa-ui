# Group 2 plan, improved: default variant attributes written by TS

I changed nothing: no edits, builds, tests or stash. I checked every cited file:line against the code.

## What the critique changed

- [FIXED] **nav.css size gate.** `check:size` counts `split('\n')`, so nav.css is already 449 lines, which is its baseline. The plan added one header line, which makes 450, and the hook blocks that. Put the citation into the existing line 102 instead.
- [FIXED] **`check:weight` was missed.** It fails on any byte of growth. Nine longer selectors add about 250 bytes to nav's inlined CSS. Every entry that imports the nav grows (nav, app-shell, outlet, the package). The growth must be recorded on purpose.
- [FIXED] **App-shell microtask.** Its only job was to wait for the rail's own default write. That write is now gone, so the microtask goes too, and the comment with it.
- [FIXED] **App-shell behaviour change was missed.** At rest the shell no longer gets `data-nav-state`. It got it today only when the rail rendered before the microtask ran. There is no visual change.
- [FIXED] **Gates list.** `spec:check --staged` also needs the app-shell spec to be fresh, because a comment edit touches that component.
- [FIXED] **Where the rule is written.** `DEF-TO-FIGMA-BUILD-RULES.md` says it "states no rule a second time". So the rule goes once into PRINCIPLES 17. The build rules get a one-line recipe that points to it.
- [FIXED] **Chat-message `theme-direct` claim was wrong.** `lint:css` skips any line marked `/* theme-direct */`. Deleting the assistant block lowers no count.
- [FIXED] **Tooltip `kind`.** The change to `behaviour` is required, not optional. The CSS no longer reads `data-placement`, and PRINCIPLES 9 says a `kind: style` prop gets no JS branch.
- [FIXED] **Tooltip hardening.** A one-line `SIDES.find` replaces the cast and `includes`.
- [FIXED] **Calendar spec effect.** If line 124 becomes a `:not()` list, the spec loses its `day` and `not-view` states, because `css-reader.mjs` cannot parse that form. That is accepted below, with the reason.
- [FIXED] **Tests.** I folded them into existing tests where those already cover the case. The tooltip test now also proves `""`.
- [FIXED] **Dev builds.** A dev build no longer flashes the rail open (320px) and then shrinks it.
- [FIXED] I dropped the "working tree" remark. Commits dda9a57a and 2ca76c5a hold TODO 344/345, and the tree is clean.

---

## 2a. Nav: `data-nav-state="collapsed"`

### 1. Current code
- `src/components/sherpa-nav/sherpa-nav.ts:90`: `if (!this.dataset['navState']) this.set('data-nav-state', 'collapsed');`
- Reader at `:131`: `return (this.dataset['navState'] as NavState) ?? 'collapsed';`
- `#setState` (178-185) returns early when the state does not change.

### 2. Why it is in TS
- 59504f2c (2026-09-10) added it with the comment "The rail starts collapsed unless the author pinned it up front."
- The projected region (`sherpa-nav.css` 6-22) puts Figma's primary mode `default` on the bare `:host`. That mode is 320px and open, with the pin `active`.
- But the rail is meant to rest collapsed, and the JS bridged that gap.
- The `.html` header (`collapsed (default)`), the spec default and both reference pages say collapsed.

### 3. Options
- **A: let the bare `:host` be the default.** Rejected. Every bare `<sherpa-nav>` would rest 320px open. The pin would read pressed. The shell does not inset for `default`, so the rail would cover 280px of the Context.
- **C: make `collapsed` Figma's first mode.** Rejected. That is a Figma edit, which is Will's call, and it changes the default of every Figma instance.
- **B: no attribute draws collapsed, in CSS.** Chosen.

### 4. Edits for B

**`scripts/project-tokens.mjs`**
- Line 118-119, ROUTING:
```js
  // Navigation scopes the RAIL; items read its indent tiers by cascade. The rail
  // RESTS collapsed with no attribute. TRAP T-no-attribute-is-the-default-variant
  navigation: { target: { scoped: 'sherpa-nav' }, attr: 'data-nav-state', unset: 'collapsed' },
```
- Line 513: add `route.unset` as the last argument of `buildScopedPartial(...)`.
- Line 563: `function buildScopedPartial(slug, comp, attr, leaves, renameMap, unset) {`
- Lines 596-598:
```js
  const modeBlocks = Object.entries(byMode).map(([mode, lines]) => {
    const on = `[${attr}="${mode}"]`;
    // The mode an ABSENT attribute means, when it is not Figma's primary one.
    return `:host(${mode === unset ? `:is(${on}, :not([${attr}]))` : on}) {\n${lines.join('\n')}\n}`;
  });
```
- Doc comment at 558-562: add "`unset` names the mode no attribute means."
- `input` and `switch` set no `unset`, so their output does not change. Navigation has no `alsoClass`, so the regex rewrite at 518-521 does not apply.

**Run `node scripts/project-tokens.mjs`.**
- The only diff must be `sherpa-nav.css:24`: `  :host(:is([data-nav-state="collapsed"], :not([data-nav-state]))) {`
- Specificity is (0,2,0), as before, and the block keeps its place.
- If any other file diffs, the export has moved. Stop and report.

**`sherpa-nav.css`, authored region**
- Lines 235, 245, 356, 397, 426, 435, 440 and 446: change `:host([data-nav-state="collapsed"])` to `:host(:is([data-nav-state="collapsed"], :not([data-nav-state])))`. This is the same form as `sherpa-calendar.css:124`.
- [FIXED] Rewrite line 102 in place, with no new line:
  ` * as `:host([data-nav-state=...])`; none is collapsed. TRAP T-no-attribute-is-the-default-variant`
- The line count stays at 449.

**`sherpa-nav.ts`**
- Delete line 90 and the blank line 91.
- Keep `get state()` as it is.

**`sherpa-app-shell.ts:38-39`** [FIXED]
- Replace both lines with `    this.#adoptRailState();`
- The deferral waited only for the deleted write. The shell's `onRender` already runs after its async bootstrap, so a write the page made in the same turn is already there. Later changes come through `nav-state-change`.
- Fallback: if a reviewer wants no timing change at all, keep `queueMicrotask` and change only the comment.

### 5. Behaviour change
- **Visible:** none, in a production build.
- **Dev build:** [FIXED] the rail can no longer paint 320px for one frame and then animate to 40px. The styles land before the template, and today the collapsed write came only at stamp.
- **API:** at rest, `getAttribute('data-nav-state')` is `null`, but `nav.state` is still `'collapsed'`. The first move (hover, pin, `state =`) writes the attribute.
- **Shell:** [FIXED] at rest, `shell.dataset.navState` is now `undefined`. The shell CSS reads only `pinned` and `settings`, so nothing moves.
- **Empty value:** `data-nav-state=""` now draws Figma's `default` look until the first pointer leave. It is invalid markup, and `check-usage.mjs:72` reports it. No code in the four projects writes it. Do not add `[data-nav-state=""]`.
- One redundant `onChange` → `#applyState` call goes away. No event changes: the old write emitted none.

### 6. Tests
**sherpa-ui, must change: `test/e2e/reforged-nav.spec.ts`**
- 137 and 925: `state: nav.dataset['navState']` → `state: (nav as HTMLElement & { state?: string }).state`.
- Also add `attr: nav.getAttribute('data-nav-state')`.
- 152 and 927: keep `toBe('collapsed')` and add `expect(r.attr).toBeNull()`.
- The 40px and density widths are the real proof. They stay.

**These are fine as they are,** because each sets the state or reads it after a move:
- `reforged-nav.spec.ts` 193-261 and 494-940
- `reforged-app-shell.spec.ts` 149-275. The overlay test compares the overlay rect to the frame rect, so it passes either way.
- `reforged-a-moved-element-keeps-its-listeners.spec.ts:75`
- `reforged-layout-grid.spec.ts:628`
- `reforged-border-edges.spec.ts:27`

**Demos, must change: `../Sherpa Demos/test/e2e/reforged-nav-pin-persist.spec.ts`**
- `railReady` (36-40) waits for the attribute. With no stored pin, nothing writes it now, so every `beforeEach` times out. Change it to `return !!nav?.shadowRoot?.querySelector('.pin');`
- In the comment at 30-34, drop "and no `data-nav-state`".
- `navState` (14-17): change it to `(document.querySelector('sherpa-nav') as HTMLElement & { state?: string })?.state ?? null`. Comment: "The rail's own mode, as `nav.state` reads it: no attribute is collapsed."
- `reforged-settings-overlay.spec.ts:81` expects `settings`, which is written. Fine as it is.

**Gallery:** the "no data-nav-state" variant looks the same. Nothing changes.

### 7. Docs
- `../Sherpa Demos/docs/TRAPS.md`, `T-a-shadow-root-precedes-its-template` (152-180):
  - Cut "and the component's own attributes — the ones a default is written into — later still".
  - Change "no `.pin` and no `data-nav-state`" to "no `.pin`".
  - The snippet waits on `.pin` only.
- Regenerate the spec. The default stays `collapsed`, and a new state `not-nav-state` appears.

### 8. Risks
- **Projector run:** see step 4.
- **Engines:** `:host(:is(…, :not(…)))` already passes in all three, in calendar and chat-message.
- **Light DOM:** a page rule `sherpa-nav[data-nav-state="collapsed"]` stops matching at rest. There are none in sherpa-ui, Demos, Gallery or Starter.
- **CSP and Trusted Types:** not affected.
- **Weight:** see Gates.

---

## 2b. Chat-message: `sherpa-chat-message.ts:22`
`if (!this.dataset['type']) this.set('data-type', 'assistant');`

- **Why it is there:** it was a leftover of the `data-role` rename (40e8d7a9). Only the test at `reforged-chat-message.spec.ts:28` holds it.
- **Why it is redundant:**
  - The bare `:host` (css 9-18) sets the assistant `--_surface` and `--_ink`.
  - The avatar hides only for `user` and `system` (102).
  - No JS reads the type.
- **Change:**
  - Delete line 22, so `onRender()` is just `this.#sync();`.
  - Delete css 92-99, the `:host([data-type="assistant"])` block and its blank line. Its own comment says it only restates the bare `:host`.
  - [FIXED] This changes no `theme-colour` count, because the `theme-direct` line was already exempt.
- **Behaviour:** none visible. `dataset.type` is `undefined` at rest, and one duplicate `#sync()` goes away. The example and Demos set `data-type="assistant"` explicitly, and that still draws the same.
- **Test, must change:** [FIXED] `reforged-chat-message.spec.ts:28-37`. The avatar is already covered by "assistant shows the avatar" (89), which uses a bare element. Replace the test with:
```ts
test('with no data-type it draws as the assistant, and writes nothing', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const draw = async (type?: string) => {
      const el = document.createElement('sherpa-chat-message') as WithRender;
      el.setAttribute('data-message', 'hello');
      if (type) el.setAttribute('data-type', type);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return { attr: el.getAttribute('data-type'), bg: getComputedStyle(el.shadowRoot!.querySelector('.bubble')!).backgroundColor };
    };
    return { bare: await draw(), assistant: await draw('assistant') };
  });
  expect(r.bare.attr).toBeNull();
  expect(r.bare.bg).toBe(r.assistant.bg);
});
```
- **Spec:** regenerate. The default stays `assistant`, from the header. The `assistant` state goes.

## 2b. Calendar: `sherpa-calendar.ts:73`
`if (!this.dataset['view']) this.set('data-view', 'day');`

- **Why it is there:** it dates from df9640e5. The CSS has handled a missing attribute since then (`css:124`).
- **Redundant:** the `#view` reader (131-134) returns `day` for anything that is not month or year. Every zoom writes the attribute (461, 471, 481, 560). Nothing outside the calendar reads it.
- **A side effect today:** the write runs `onChange` → `#render()` + `#syncForm()` once, before `#projectHeader`. The render at line 87 gives the same end state.
- **Change:**
  - Delete line 73.
  - Change css 124 to `:host(:not([data-view="month"], [data-view="year"])) .cal-days { display: grid; }`
- **Why the CSS change is right:** it is HTML's rule for enumerated attributes, where both a missing and an invalid value mean the default. The CSS then agrees with `#view` exactly.
- **Spec cost:** [FIXED] `parseStates` cannot read a `:not()` list. So the spec's `day` and `not-view` states vanish. `month` and `year` stay. The manifest keeps only `:state()` entries, so it does not change. No tool reads spec states except the MCP, which passes the spec through.
- **Behaviour:**
  - None for a missing value, `day`, `month` or `year`.
  - `""` still shows the day grid, as the old write gave it.
  - An unknown value such as `"week"` now shows the day grid with weekdays, to match its label. Today it shows no grid. That is a fix.
  - One redundant render and form sync go away.
- **Tests:** [FIXED] in `reforged-calendar.spec.ts:165`, the bare zoom-out test, add `start: { attr: el.getAttribute('data-view'), days: daysVisible() }` before the first click. Expect `{ attr: null, days: true }`. Other view tests set the view explicitly and still pass: 197-235, 600, 767-815, and `reforged-menu-calendar.spec.ts` 317, 387, 458-501.
- **Spec:** regenerate. The default stays `day`.

## 2b. Tooltip: `sherpa-tooltip.ts:26`
`if (!this.dataset['placement']) this.set('data-placement', 'top');`

- **Why it is there:** it dates from e157630e, when the CSS placed the bubble by attribute. Placement is now measured in JS (`T-anchor-cross-root`), and the CSS keys on `:state(side-*)` only.
- **Change:**
  - Delete lines 26-27.
  - [FIXED] Change line 118 to `const preferred: Side = SIDES.find((s) => s === this.dataset['placement']) ?? 'top';`
  - [FIXED] Line 22 must change to `kind: 'behaviour'` (PRINCIPLES 9).
  - Delete the whitespace-only line 20.
- **Behaviour:**
  - None for a missing or valid value.
  - `""` stays on top. Without the hardening, `''` would give `OPPOSITE['']` = undefined, and the bubble would sit centred on the trigger.
  - An unknown value such as `"start"` now goes to the top, where today it is mis-placed. That is a fix.
- **Test, must change:** [FIXED] `reforged-tooltip.spec.ts:89-98`. The "overflow box" test (57) already proves a bare tooltip opens above. Replace with:
```ts
test('with no data-placement, or an empty one, it opens on top and writes nothing', async ({ page }) => {
  for (const attr of ['', ' data-placement=""']) {
    await page.evaluate(async (a) => {
      document.getElementById('root')!.innerHTML = `<sherpa-tooltip data-text="Above"${a} style="position:fixed;inset-block-start:200px;inset-inline-start:200px"><button id="trig">x</button></sherpa-tooltip>`;
      await (document.querySelector('sherpa-tooltip') as HTMLElement & { rendered: Promise<void> }).rendered;
    }, attr);
    await page.locator('#trig').hover();
    const r = await page.evaluate(() => {
      const t = document.querySelector('sherpa-tooltip') as HTMLElement;
      const b = t.shadowRoot!.querySelector('.bubble')!.getBoundingClientRect();
      return { written: t.getAttribute('data-placement') || null, above: b.bottom <= document.getElementById('trig')!.getBoundingClientRect().top, top: t.matches(':state(side-top)') };
    });
    expect(r).toEqual({ written: null, above: true, top: true });
    await page.mouse.move(600, 400);
  }
});
```
- **Spec:** regenerate. `kind` becomes `behaviour`, and the default stays `top`.

---

## Shared

**The rule, stated once** [FIXED]
- `docs/PRINCIPLES.md` rule 17: add one sentence after its first one: "Its default variant and its fixed text are in its `.html` and `.css` as well: with no `data-x`, the bare `:host` or `:host(:not([data-x]))` draws the default, and a component never writes one (Will, 2026-10-19, TODO 344)."
- The 344 owner writes this sentence once, for all five groups.
- `docs/DEF-TO-FIGMA-BUILD-RULES.md`, "The CSS" list: add `- **Default variant:** the bare :host, or :host(:not([data-x])); the component writes no default attribute (PRINCIPLES 17).`

**New TRAP in `docs/TRAPS.md`** (the nav detail only), then run `npm run traps:write`:
```
### T-no-attribute-is-the-default-variant

With no `data-nav-state` the rail is collapsed, and nothing writes the attribute.
The projected region puts Figma's PRIMARY mode, `default` (320px, open), on the
bare `:host`, but the rail RESTS collapsed. So ROUTING's navigation route takes
`unset: 'collapsed'`, the projector writes the collapsed block as
`:is([data-nav-state="collapsed"], :not([data-nav-state]))`, and every authored
collapsed rule matches the same way. `unset` and the `.html` header's
`collapsed (default)` must name the same mode.

At rest the attribute is ABSENT. Read `nav.state`: a test that waits for
`data-nav-state` waits for ever.

- Site: `scripts/project-tokens.mjs`
- Site: `src/components/sherpa-nav/sherpa-nav.css`
```

**Docs that state the old way**
- `CLAUDE.md:238`: change `cache refs, set defaults, wire host listeners` to `cache refs, wire host listeners`.
- `src/core/ui/sherpa-element.ts:1155`: change it to `Shadow DOM is ready. Cache refs, wire host listeners.`
- `docs/TODO.md` 344: mark item 2 ✅ in its section. The ledger row stays 🚧 until all five groups are done.

**Generic mechanism**
- Nothing new goes into SherpaElement or templater. The default belongs to the CSS. `unset` is the generic piece: it serves any projected collection whose resting mode is not Figma's primary one. I checked: input, switch and button rest on their primary modes.
- A base `variant(attr)` reader would serve about 7 sites (nav, calendar ×2, tooltip, button, nav-item, menu). But it needs `default` in TS `props`, which states the default a fourth time, against Will's rule. Not now.

**Gates, in order**
1. `node scripts/project-tokens.mjs`. `git diff --stat` must show only `sherpa-nav.css`, from the projector.
2. `node scripts/generate-component-spec.mjs` for sherpa-nav, sherpa-chat-message, sherpa-calendar, sherpa-tooltip and sherpa-app-shell. [FIXED] App-shell is in the list because `spec:check --staged` checks every component the commit touches.
3. `npm run manifest`, `npm run reference`, `npm run traps:write`.
4. `npm run type-check`, `npm run lint`, `npm run lint:css`, `npm run check:props`.
5. `npm run check:size`. [FIXED] nav.css must stay at 449. Every other changed file shrinks.
6. `npm run map:write` on the changed TS files. No exports change.
7. `npm run build`, so the Demos symlink is current.
8. Queued for Will, with the tests:
   - [FIXED] `check:weight` will fail for the entries that import the nav (about +200-300 bytes). Confirm only those grow, then run `npm run check:weight -- --update-baseline`.
   - Run the sherpa-ui and Demos specs above.
9. Tell Will what to look at on :4200:
   - The rail rests at 40px.
   - Hover opens it.
   - A pin survives a reload.
   - Chat, calendar and tooltips look the same.

**Out of scope: queue these in the TODO**
- `sherpa-nav-item.css` has a stale navigation token region (unitless `320`, no mode blocks). ROUTING no longer projects it. CLAUDE.md and `DEF-TO-FIGMA-BUILD-RULES.md` still say "navigation → sherpa-nav.css and sherpa-nav-item.css".
- Chat-message `data-name`, `data-timestamp` and `data-message` could take `to: '.author'`, `'.time'` and `'.content'`. `.content` is a span beside the slot, so this is safe. Then `onRender`, `onChange`, `#sync` and `#text` all go, with the same behaviour.
- `sherpa-select-card.ts:52` writes `tabindex="0"`. That is a native focus attribute, not a variant, and a template cannot set it on the host. Leave it.

**Files**
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/scripts/project-tokens.mjs
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/src/components/sherpa-nav/sherpa-nav.ts
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/src/components/sherpa-nav/sherpa-nav.css
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/src/components/sherpa-app-shell/sherpa-app-shell.ts
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/src/components/sherpa-chat-message/sherpa-chat-message.ts
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/src/components/sherpa-chat-message/sherpa-chat-message.css
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/src/components/sherpa-calendar/sherpa-calendar.ts
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/src/components/sherpa-calendar/sherpa-calendar.css
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/src/components/sherpa-tooltip/sherpa-tooltip.ts
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/src/core/ui/sherpa-element.ts
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/CLAUDE.md
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/docs/PRINCIPLES.md
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/docs/DEF-TO-FIGMA-BUILD-RULES.md
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/docs/TRAPS.md
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/docs/TODO.md
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/test/e2e/reforged-nav.spec.ts
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/test/e2e/reforged-chat-message.spec.ts
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/test/e2e/reforged-calendar.spec.ts
- /Users/williammincher/Documents/My synced vault/Projects/sherpa-ui/test/e2e/reforged-tooltip.spec.ts
- /Users/williammincher/Documents/My synced vault/Projects/Sherpa Demos/test/e2e/reforged-nav-pin-persist.spec.ts
- /Users/williammincher/Documents/My synced vault/Projects/Sherpa Demos/docs/TRAPS.md