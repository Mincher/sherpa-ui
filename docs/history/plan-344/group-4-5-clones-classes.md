# TODO 344, groups 4 and 5: the plan, reviewed

I changed nothing. I read the code and ran no builds or tests.

## What the review changed

1. **4a.** Put the two prototypes beside the `<fieldset>`, not inside `.options`. More than 20 components put prototypes at the top level. A prototype inside a container is lost when code empties that container (see the comment in `sherpa-layout-grid.html`).
2. **4a.** Added two test gaps (`multiple` toggled after populate(), and author-written options surviving populate()). Also found a bug in `#syncDisabled`, which is queued and not fixed here.
3. **5b.** Changed the pick from A to B. A makes a second copy of the item row. B deletes the class and adds no markup.
4. **5c.** The plan missed four things:
   - The `:host { display: grid }` comment in the CSS becomes false.
   - Two test comments must change.
   - One more TRAP sentence must change.
   - `npm run build` re-projects `tokens.css` (`build-reforged.mjs:36`), so the regenerated `tokens.css` must be committed with the projector.
5. **All items.** The plan did not mention `check:weight`. The build puts the HTML into the JS without its comments. So the new prototypes and the longer grid selectors make the JS (and the `tokens.css` that `components.js` and `index.js` fetch) bigger.
6. **5d.** Named the prototype `organise-chip-tpl`, and added a note for group 3 so the same chips are not worked on twice.
7. **4b.** Added `render-icon.ts:125` and `mark-text.ts:63` to the class sweep. Added why a helper-owned `.html` file does not work for `mark-text`.
8. Added a "Found in passing" list (three latent bugs, from reading only) and an order of work that follows Will's rules on testing and on peer agents.

---

## 4a) `sherpa-select-group`: one option per item, from `createElement`

**1. The code now.** `src/components/sherpa-select-group/sherpa-select-group.ts:119-142`:
```ts
  /** Created by TAG: these are design-system components, not structural DOM. */
  #render(): void {
    const tag = this.#childTag();
    const disabled = this.hasAttribute('disabled');
    for (const prev of this.#stamped) prev.remove();
    this.#stamped = [];
    for (const opt of this.#options) {
      const child = document.createElement(tag);
      child.setAttribute('slot', 'options');
      child.setAttribute('value', String(opt.value));
      if (opt.label != null) child.setAttribute('data-label', String(opt.label));
      if (opt.description != null) {
        child.setAttribute('data-description', String(opt.description));
      }
      if (opt.disabled || disabled) child.setAttribute('disabled', '');
      const childName = this.#childName;
      if (childName) child.setAttribute('name', childName);
      this.appendChild(child);
      this.#stamped.push(child);
    }
    this.#drawPicks();
  }
```

**2. Why it is in TS.**
- `docs/PRINCIPLES.md:121-123`, rule 17: "A typed child by tag name is not structure". It names "a select group's children" as one of four such cases.
- The code comment says the same. It came in with 81c0b0bd and was trimmed in f9257d15.
- No TRAP covers it.
- The options go into the host's LIGHT DOM to fill the `options` slot. `#stamped` makes sure a re-render removes only what populate() made, never children an author wrote.

**3. The change.** No new base API. `cloneItem()` (`sherpa-element.ts:816`) already covers "a container outside the shadow root" (TRAP `T-clone-item-is-for-two-destinations`). I looked for a shared light-DOM helper. `sherpa-menu.ts:1427-1434` (remove `.menu-row`, then prepend, with sections and Select all) and `sherpa-quick-filter.ts:145` (`replaceChildren` into its slotted menu) work in different ways, so one helper would serve only this one site.

In `sherpa-select-group.html`, add the two prototypes after `</fieldset>`, inside `<template id="default">`. **[FIXED]** I moved them from inside `.options` to the top level, as more than 20 components do; nothing can then empty them with the container.
```html
  </fieldset>

  <!-- One option each, cloned into the LIGHT DOM: checkboxes when `multiple`, else radios. -->
  <template class="checkbox-tpl">
    <sherpa-select-checkbox slot="options" data-attr-value="value"
      data-attr-data-label="label" data-attr-data-description="description"></sherpa-select-checkbox>
  </template>
  <template class="radio-tpl">
    <sherpa-select-radio slot="options" data-attr-value="value"
      data-attr-data-label="label" data-attr-data-description="description"></sherpa-select-radio>
  </template>
</template>
```
Change html line 4 to: `populate() clones each option from a prototype below into the LIGHT DOM.`

The new `#render`. `#childTag()` stays, because `#children()` and `#onChange` use it.
```ts
  /** One option per item, cloned into the LIGHT DOM. TRAP T-clone-item-is-for-two-destinations */
  #render(): void {
    const tpl = this.$<HTMLTemplateElement>(this.#multiple ? 'template.checkbox-tpl' : 'template.radio-tpl');
    const disabled = this.hasAttribute('disabled');
    const childName = this.#childName;
    for (const prev of this.#stamped) prev.remove();
    this.#stamped = [];
    for (const opt of this.#options) {
      const child = this.cloneItem(tpl, opt);
      if (!child) break;
      if (opt.disabled || disabled) child.setAttribute('disabled', '');
      if (childName) child.setAttribute('name', childName);
      this.appendChild(child);
      this.#stamped.push(child);
    }
    this.#drawPicks();
  }
```
`disabled` and `name` stay in TS, for two reasons:
- They come from the group, not from the item.
- `data-when-x` can only write `data-x`. `data-attr-disabled` would write `disabled="false"`. I checked: the children do not declare `disabled` as a boolean prop, so `T-false-is-off` does not remove it, and it still disables.

**4. Behaviour.**
- **None for valid data.** The tag and the attributes are the same, in the same order: `slot`, `value`, `data-label`, `data-description`, `disabled`, `name`.
  - `clone()` imports the node into the page document, so the child upgrades at once, as with `createElement`.
  - `fieldValue` leaves an absent or null field off. That is the same as the old `!= null` checks.
  - `#multiple` picks the prototype, so toggling `multiple` after populate() swaps radios for checkboxes, as before.
- **One edge case:** an option with no `value` field (or a non-object option) now gets no `value` attribute. Before, it got the string "undefined".
- **On a live reload,** `onRender` ran `#render` before this change too. Now the clones come from the new `.html` file.
- **Consumers with their own template** (`useTemplate`) must carry both prototypes. `checkOwnTemplate` (`templater.ts:217`) reports `.checkbox-tpl` and `.radio-tpl` when they are missing. Today only `test/e2e/reforged-templater.spec.ts:49` uses `useTemplate`, for `sherpa-tag`.

**5. Specs that cover it.** No test asserts the old way.
- `test/e2e/reforged-select-group.spec.ts` (5 tests)
- `test/e2e/reforged-form-controls.spec.ts:26-32` (options with only a `value`, `plan=pro` submitted)
- `test/e2e/reforged-bind-settings.spec.ts:16`
- `test/e2e/reforged-parity.spec.ts:117`
- `test/unit/the-lexicon-holds.test.mjs:30,71`
- the a11y gate (`sherpa-select-group.example.json`)

**[FIXED]** Gaps that touch the moved code. Whether to add specs is Will's call:
- (a) `multiple` toggled after populate() must swap the prototype.
- (b) an option an author wrote in markup must survive populate() (the `#stamped` guard).
- (c) the TODO 318 radio tab stop and arrow keys ("Not run yet").

**6. Docs to change.**
- `docs/PRINCIPLES.md:121-126`, rule 17: delete the "typed child by tag name" exception and update "eight". Make this ONE edit with group 1, because `menuFor()` and `SherpaToast.show` are in the same sentence.
- `docs/TRAPS.md` `T-clone-item-is-for-two-destinations` (line 8130):
  - Extend the third bullet: "…and a select group's options, into its own light DOM".
  - Add `- Site: \`src/components/sherpa-select-group/sherpa-select-group.ts\``.
  - Then run `npm run traps:write`.

**7. Risks.**
- **Regenerate the spec:** `node scripts/generate-component-spec.mjs sherpa-select-group`. The anatomy changes from `root` to `roots`, with the fieldset first. Every reader takes both forms (`generate-component-spec.mjs:823`, `mcp-server/tools/discover.js:190`, `generate.js:280`, `scripts/lib/component-to-def.mjs:98`). Then run `npm run manifest` and `npm run reference`.
- **`check:size`** (pre-commit) counts `.html` files. The html grows by about 10 lines. Record it on purpose.
- **[FIXED] `check:weight`** (in `npm test`): the build inlines the html (without comments) into the JS. So `select-group.js` and every entry that imports it (`index.js`, `components.js`, and others) grow by roughly 300 bytes. Record it on purpose when it runs.
- **No CSP or Trusted Types change.** The prototypes reach the DOM through the stamp's existing `ownHtml` sink, and `importNode` parses no string.

## 4b) Every other place that builds structure (all of `src`, searched again)

| Site | What it is | Verdict |
|---|---|---|
| `sherpa-toast.ts:95`, `:112-114` | a toast per `show()`, the stack div, its className and cssText | Group 1 |
| `core/ui/filter-menu.ts:72`, `:137-138` | the menu, the calendar, `className='qf-calendar'` | Group 1 |
| `sherpa-select-group.ts:128` | the options | 4a |
| `core/ui/sherpa-element.ts:929` `this.root.innerHTML = ownHtml(body)` | the stamp | Fine. The markup IS the `.html` text. A cached `<template>` + `importNode` is a possible later speed-up. Out of scope. |
| `core/ui/mark-text.ts:62-63` + `createTextNode` | `<mark class="match">` around search hits | **Keep.** The text nodes are cut at positions worked out from data, and PRINCIPLES 17 lists this. **[FIXED]** A helper-owned `mark-text.html` does not fit: `markNeedles` is synchronous and runs per cell, and in `build:dev` a helper's `.html` is FETCHED, so the first call could run before it loads. |
| `render-icon.ts:89,102`; `core/browser/view-markup.ts:107` | icon SVG; the allow-list parser | Excluded, as briefed (`T-saved-markup-is-untrusted-input`) |
| `src/components.ts:21` | the tokens `<link>` | Fine. It is page level. |
| `sherpa-element.ts:745` (`writeIcon`) and **[FIXED]** `render-icon.ts:125` (`upgradeIcons`) | `classList.add('sherpa-icon-box')` | Fine. This is the one generic base path for "an element that draws an icon name wears the box". |
| `cloneNode(true)` at `data-grid.ts:1004`, `quick-filter-toolbar.ts:732`, `radial-chart.ts:155`, `line-chart.ts:172`, `menu.ts:575`, `filter-panel.ts:726`, `core/ui/more-menu.ts:73-97` | prototype clones from the `.html` | Fine. Optional follow-up: move the component sites onto base `clone()`, which imports and upgrades icons. `more-menu.ts` is a helper, so it has no `this.clone`. |
| `style.width/left/gridColumn/height`: data-grid `324,386`, layout-canvas `300-303`, calendar `307-308`, prompt-composer `115-116` | sizes and positions from numbers | Fine (calendar `:176` is group 1) |

**[FIXED] The full class-write sweep** (`classList.add/remove/toggle`, `className =`, `setAttribute('class')`) found exactly these 10 sites:
- `render-icon.ts:125`, `mark-text.ts:63`, `filter-menu.ts:138`, `sherpa-element.ts:745`, `toolbar.ts:1827-1828`, `toast.ts:113`, `input-text.ts:444`, `chart-legend.ts:265`, `layout-grid.ts:46`.
- So 5a-5d cover every component site that is left.

**Not in 344's list:**
- `sherpa-input-text.ts:430-431`: the Find field's default glyph `'magnifying-glass'` is set in TS. This is group 2.
- `sherpa-quick-filter-toolbar.ts:1794-1804`: the "Group" and "Sort" labels are set in TS. This is group 3. Their icons come from the shared `ORGANISE_ICONS` (`T-organise-glyphs-are-named-not-inline`), so they stay in TS.
- The toolbar class swap, 5d below.

## 5a) `sherpa-input-text.ts:444`: the icon class list is written again

**1. The code now.** `sherpa-input-text.ts:440-444`:
```ts
    // TRAP T-icon-box-is-not-the-glyph — rewriting className erases the shared
    // box class, so it is restated here; and a NAME must be drawn, never left
    // as classes, which paint nothing now the icons are SVG.
    const side = sel === '.icon-start' ? 'icon-start' : 'icon-end';
    el.className = `icon sherpa-icon-box ${side}`;
```

**2. Why.** It is left over from Font Awesome.
- Up to commit e690d6c9, the code wrote `${base} ${value}`, so the reset wiped the old FA classes.
- Today `renderIcon()` writes no class.
- `upgradeIcons` only touches `[data-icon]`, and these spans have none.
- All templates (`.html:49,51,68,70,90,92,113,138`) already carry exactly `icon sherpa-icon-box icon-start|icon-end`.

So the line writes the same classes again and does nothing.

**3. The change.** Delete lines 440-444, which includes `side`. Keep `replaceChildren()` and the `hasIcon` / `data-glyph` branches.

**4. Behaviour.** None for the shipped templates. **[FIXED]** A consumer's own template (`useTemplate`) now keeps its own classes on the icon span. If it drops `sherpa-icon-box`, the class is no longer forced back, and `checkOwnTemplate` reports the class as missing.

**5. Specs:** `reforged-icon-sizes.spec.ts:101-102`, `reforged-input-find.spec.ts:39`, `reforged-input.spec.ts`, `reforged-variant-restamp.spec.ts`. None assert the class write.

**6. Docs.**
- `docs/TRAPS.md` `T-icon-box-is-not-the-glyph`: delete the paragraph at lines 4225-4228 ("A component that rewrites `className`…"). Delete its Site at line 4241 (`sherpa-input-text.ts`): this was that file's only citation of the trap. Run `traps:write`.
- Optional (old doc text, not caused by this change): `T-input-icon-sink-is-data-glyph` (5851) still says "a Font Awesome CLASS LIST". It should say "an icon NAME (drawn as SVG)".

**7. Risks.** None. `spec:check --staged` checks input-text. Regenerate; no diff is expected. The TS shrinks by 5 lines.

## 5b) `sherpa-chart-legend.ts:265`: `rollup-toggle` is added in TS

**1. The code now.** `sherpa-chart-legend.ts:262-268`:
```ts
      if (!isRollup) return void list.appendChild(cell);
      const wrapper = this.clone('template.rollup-tpl');
      if (!wrapper) return;
      cell.classList.add('rollup-toggle');
      wrapper.prepend(cell);
```
Other places that use the class:
- TS: `:297` (`wrapper.querySelector('.rollup-toggle .entry')`)
- CSS: `sherpa-chart-legend.css:118`
- Tests: `reforged-chart-legend.spec.ts:265,469,810`
- TRAPS: line 5681

Nothing in Demos, Gallery or the MCP uses it.

**2. Why.** The roll-up row reuses `item-tpl` and marks it (`T-rollup-row-has-its-own-prototype`, from c61500a2, TODO 149).

**3. The change. [FIXED] Option B, not A.** The class goes, and the row is found by where it sits. The planner's option A copies `item-tpl`'s whole row into `rollup-tpl`: two copies of one row, which must always be changed together.
- TS: delete `:265`. `wrapper.prepend(cell)` stays.
- TS `:297`: `wrapper.querySelector(':scope > .item .entry')?.toggleAttribute('data-current', on.size > 0);`
- CSS `:118`: `:host([data-orientation="horizontal"]) .rollup > .item { flex: 1 1 auto; }`.
  - Specificity becomes (0,4,0). Its only neighbour, `:host([data-orientation="horizontal"]) .item` (line 71), sets different properties, so nothing conflicts.
- Tests (selectors only; what they check does not change):
  - `:265` → `rollup.querySelector<HTMLElement>(':scope > .item')!`
  - `:469` → `querySelector<HTMLElement>('.rollup > .item')`
  - `:810` → `at('.rollup > .item .value')`

**4. Behaviour.** None visible. The tree is `.rollup > .item + .rollup-menu-btn`, as before, without the class. `.rollup-toggle` is not a `part`, so only a consumer's own sheet (`useTemplate` css) could have used it. `#onClick`'s `closest('.item')` is unchanged.

**5. Specs:** `test/e2e/reforged-chart-legend.spec.ts` (structure ~255-280, the Other toggle ~462-475, horizontal ~800-815), with the 3 selector edits above.

**6. Docs.** TRAPS 5681: "the row — an ordinary `template.item-tpl` clone, placed first in the wrapper (`.rollup > .item`) — goes in front of it".

**7. Risks.** The html does not change, so the spec should not change. Regenerate to confirm, because `spec:check --staged` checks it. The TS shrinks by 1 line, so `check:size` and `check:weight` both fall.

## 5c) `sherpa-layout-grid.ts:46`: the host is given the document class `sherpa-grid`

**1. The code now.** `sherpa-layout-grid.ts:42-47`:
```ts
  override onRender(): void {
    /* The host WEARS the document class, so every projected rule — the tracks,
       the gaps, the named spans on its children — applies with no copy here.
       TRAP T-a-document-class-cannot-reach-a-shadow-root */
    this.classList.add('sherpa-grid');
  }
```

**2. Why.** 59 `.sherpa-grid` selectors come from `scripts/project-tokens.mjs` into `tokens.css`: the tracks, the gaps, the `@container sherpa-context` bands, the media bands with `:where(:not(sherpa-app-shell > …))`, and the child rules `> [data-col-span]` / `> [data-row-span-N]` (81c0b0bd). They cannot move to the shadow `:host`:
- The ancestor checks would need `:host-context()`, which Firefox and WebKit do not support.
- Each child rule would need `::slotted`.
- It would fork the Figma projection.

**3. The change.** The projector also selects the element by its name.
- In `scripts/project-tokens.mjs`, after line 1468, add:
  ```js
  // The element by NAME too, so its host needs no class from TS. TODO 344
  const GRID_SEL = ':is(.sherpa-grid, sherpa-layout-grid)';
  ```
- Set `const GRID = { media: \`${GRID_SEL}:where(:not(${IN_CONTEXT}))\`, container: GRID_SEL };`.
- Change every literal `.sherpa-grid` in the emitted strings to `${GRID_SEL}`, at lines 1531, 1547, 1626, 1663-1675, 1678, 1688 and 1699. (Line 1416 is a comment. You may say "and the element" there.)
- Run `node scripts/project-tokens.mjs`. The `tokens.css` diff must be ONLY that selector swap: 59 sites.
- `:is()` takes its most specific argument, (0,1,0), so the cascade does not move. Inside `& >` nesting, `&` is the same `:is()`, so the specificity is unchanged there too. `tokens.css` has no `:is(` today, and all three engines support it.
- Delete `onRender` from `sherpa-layout-grid.ts`. The base has an empty default, and `onConnect`'s measuring needs nothing from it.
- Header line 4 becomes: "The tracks are CSS: `tokens.css` selects `.sherpa-grid` and this element by name, projected from Figma."

**4. Behaviour.**
- The host no longer carries the class `sherpa-grid`.
- The tracks and spans now apply from the first paint, before the element is defined or rendered. Before, they waited for `onRender`, after an async bootstrap. That is a small fix of a flash.
- A page that links `tokens.css` but never imports the element now gets a grid, with no `data-group` and no handles.
- A framework that owns `class` can no longer wipe the class and break the grid.
- `<div class="sherpa-grid">` works as before.
- A `sherpa-layout-grid` inside another shadow root got no tracks before either. No component template holds one, and `sherpa-outlet` writes Contexts into its LIGHT DOM (`sherpa-outlet.ts:296`).

**5. Specs.**
- `test/e2e/reforged-layout-grid.spec.ts`:
  - **[FIXED]** The block comment at 385-390 and the comment at 421 say "the host WEARS that class". Change them to "the projected rule names the element".
  - Test 427: rename it to `the projected rule names the element, so the tokens reach it with no class`. Rename `wearsClass` to `hasClass` and expect `false` (no class from TS). Keep the display, 12 columns, gap and spans checks: they are the real proof.
  - Optional new proof (Will's call): read `getComputedStyle(g).gridTemplateColumns` right after `appendChild`, before `await g.rendered`. Expect 12 tracks. The old code gives `none` there.
- No change: `reforged-layout-grid-resize.spec.ts`, `reforged-tokens.spec.ts:103`, `reforged-view-markup.spec.ts`, `reforged-app-shell.spec.ts:60`, `reforged-document-reset.spec.ts` (it checks `body` rules only).
- **Sherpa Demos** `test/e2e/reforged-filter-panel-mode.spec.ts:185`: `#context-root .sherpa-grid` → `#context-root sherpa-layout-grid`. (`app/templates/records.html:10` is the one grid there.) Nothing else in Demos, Gallery, Starter or `mcp-server` uses the class.

**6. Docs.**
- `sherpa-layout-grid.html:3-10`: "the host wears that class" → "the projected rule names this element too". Keep the TRAP citation at line 7.
- `sherpa-layout-grid.css:4`: the same change.
- **[FIXED]** `sherpa-layout-grid.css:8-10`: "the document rule lands too late" is now false. Keep the rule, and make the comment one line: `/* The component's own sheet says it too, whatever the page links. */`
- `sherpa-layout-grid.css:26-29`: "`.sherpa-grid` is a DOCUMENT rule" is still true. No change.
- `docs/TRAPS.md` `T-a-document-class-cannot-reach-a-shadow-root` (13084):
  - Add one line: "A host is selected by its TAG in the page rule, never by a class its TS adds: `:is(.sherpa-grid, sherpa-layout-grid)`."
  - Delete the Site at line 13114 (`sherpa-layout-grid.ts`).
- `T-a-document-rule-outranks-an-adopted-host-rule`:
  - Line 15447: "which the host WEARS" → "which names the element".
  - **[FIXED]** Line 15459: "Whenever a component wears a document class" → "Whenever a document rule selects a host".
- Run `traps:write`.
- The spec's curated `$extensions.sherpa.divergence.note` says "the host wears the projected `.sherpa-grid` class". The generator copies it unchanged (`generate-component-spec.mjs:885`). A hand edit of that one field is the only way to change it, and CLAUDE.md says never hand-edit a spec. **Will must OK it.**

**7. Risks.**
- **[FIXED]** `npm run build` runs `project-tokens.mjs` (`build-reforged.mjs:36`). Commit the regenerated `src/styles/tokens/tokens.css` with the projector. If you do not, every build dirties the tree, and Demos (symlinked) sees a different file.
- After the build, check that cssnano and autoprefixer kept the selector: `grep -c ':is(.sherpa-grid,sherpa-layout-grid)' dist/styles/tokens/tokens.css`. Preset-env is gone, so nothing should rewrite it.
- **[FIXED] `check:weight`:** `tokens.css` is a fetched file of `components.js` and `index.js` (`fetched` 213734). The 59 longer selectors add about 1.4 KB. Record it on purpose.
- `tokens.css` is "safe to embed": a tag selector for Sherpa's own element is like the existing `sherpa-app-shell > :not([slot])`.
- `--_grid-fit` and the measuring read computed style, so they see the tracks sooner, never later.

## 5d) `sherpa-quick-filter-toolbar.ts:1827-1828`: `.chip` swapped for `organise-chip`

**1. The code now.**
- `#organiseChip` (`:1825-1828`): `const chip = this.clone('template.qf-tpl');` and the throw, then `chip.classList.remove('chip'); chip.classList.add('organise-chip');`.
- `#renderOrganise` (`:1779`) also looks up `template.qf-tpl` as its guard.

**2. Needed, not dead.** No CSS uses `.organise-chip`, but JS and tests do:
- TS: `:1001,1710,1752,1759,1766,1772,1813,1844,1857`
- Specs: `reforged-quick-filter-toolbar.spec.ts:77-78,1865,2090,2221`, `reforged-organise-chip-never-amber.spec.ts:35-36`, `reforged-chip-tips.spec.ts:64`, `reforged-sort-icons.spec.ts:149`
- Demos: `reforged-filter-coordination.spec.ts:91,203,206`

Dropping `.chip` matters too: `CHIP = '.chips > .chip'`, `classList.contains('chip')` at `:964,1007,1863`, and `T-group-chip-body-toggles-grouping` all expect the organise chips to have no `.chip`. The swap came in with 9f95c197.

**3. The change.** In `sherpa-quick-filter-toolbar.html`, after `qf-tpl` (line 193):
```html
  <!-- A Group or Sort chip: not a `.chip`, so the filter code passes it by. -->
  <template class="organise-chip-tpl">
    <sherpa-quick-filter class="organise-chip"></sherpa-quick-filter>
  </template>
```
**[FIXED]** Named `organise-chip-tpl`, to match the `<class>-tpl` pattern (`more-item-tpl`, `head-cell-tpl`).

In TS:
- `:1779` and `:1825` read `template.organise-chip-tpl`.
- The throw at `:1826` names `template.organise-chip-tpl`.
- Delete `:1827-1828`.

**[FIXED] Note for group 3:** if it moves "Group" and "Sort" into the HTML, it will replace this one prototype with two (one per chip, each with its own `data-label`). The icons stay in TS (`ORGANISE_ICONS`). Do 5d first, or fold both into one change, so nobody edits the same lines twice.

**4. Behaviour.** None. The chip is upgraded at import with `class="chip"` today. It is not connected before the swap, and nothing reads its class at construction.

**5. Specs:** the ones above. None change.

**6. Docs:** none state the swap. The test comment at `reforged-quick-filter-toolbar.spec.ts:2208` stays true.

**7. Risks.**
- Regenerate the spec: `roots` gains `organise-chip-tpl`. No test counts the roots.
- `check:size`: the html grows by 4 lines. Record it.
- `check:weight`: the toolbar's JS, and every entry that imports it, grows by about 80 bytes.

## Found in passing (reading only, not tested). Queue in `docs/TODO.md`; do not fix here

1. **`sherpa-select-group.ts:154-157` `#syncDisabled`** runs `toggleAttribute('disabled', groupDisabled)` on every child. So turning the group's `disabled` off also re-enables an option that its data (`opt.disabled`) or its author disabled.
2. **`data-grouped` inside an app-shell Context probably keeps its gutters.** The projected `@container sherpa-context` bands SET `--sherpa-layout-grid-gap-*` on `.sherpa-grid` (`tokens.css:739` onward). A document rule beats the adopted `:host([data-grouped])` re-point (`T-a-document-rule-outranks-an-adopted-host-rule`). 5c does not change this. No test covers a grouped grid inside a Context. After 5c, a projected `[data-grouped]` rule in `tokens.css` could fix it.
3. **`:host([hidden]) { display: none }`** in `sherpa-layout-grid.css` loses to the document `display: grid`. Today that happens after `onRender`; after 5c it happens from the first paint. Nobody hides a layout grid today.
4. **CLAUDE.md says `onRender()` "fires exactly once".** That is false: a re-stamp or a reload runs it again. 4a's reload note depends on this. Fix that sentence in the same 344 pass, as one of the "other things found".

## For every item: order and gates

- **One commit per item:** 4a, 5a, 5b, 5c (with Demos), 5d.
- **Before staging:** check with ListAgents for a live peer agent. Never stash. Stage only your own files, and only when `git diff --cached` is empty.
- **Per item, in this order:**
  1. `node scripts/generate-component-spec.mjs <name>`
  2. `npm run manifest`, then `npm run reference`
  3. `npm run traps:write` where a TRAP changed
  4. `npm run check:size -- --update-baseline` only where a file grew (4a html, 5d html). It records EVERY file, so run it only when the tree holds just this change.
  5. `npm run map:write <file>` LAST. No exports change.
- **The hook then runs:** type-check, lint, `spec:check --staged`, `check:traps`, `check:mcp`, `check:ownership`, `check:props`, `lint:css`, `check:docs`, `check:map --staged`, `check:size`, `check:bench --staged`, `check:manifest`, `check:reference`.
- **After each item:** run `npm run build`, because Demos symlinks sherpa-ui. For 5c, the build also re-projects `tokens.css`. Never build during a full test run. Then tell Will what to look at in Demos:
  - the records Context (same tracks, no flash on load)
  - a chart with more than 6 legend categories (the Other row)
  - the toolbar's Group and Sort chips
- **Tests that must be EDITED in the same commit:** 5b `reforged-chart-legend.spec.ts:265,469,810`; 5c `reforged-layout-grid.spec.ts:385-438`; Demos `reforged-filter-panel-mode.spec.ts:185`.
- **Will's call (memory 10-15: no test runs until Will says):** running `npm test`, a11y and `check:weight`.
  - Expect `check:weight` to report growth for the select-group entries (4a), the toolbar entries (5d), and the `fetched` bytes of `components.js` and `index.js` (5c). It reports a fall for chart-legend and input-text.
  - Record the growth on purpose with `npm run check:weight -- --update-baseline`.
- **TODO 344:** mark groups 4 and 5 done in its section (a done item keeps its row). Add the four items above as new rows.