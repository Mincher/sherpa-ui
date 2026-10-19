# TODO 344, group 1: improved plan for the four "CSS or structure in TS" breaks

Repo: `/Users/williammincher/Documents/My synced vault/Projects/sherpa-ui`. Paths below are relative to it. I edited, built and tested nothing. Every claim comes from reading the code, `docs/TRAPS.md`, `git log`, the tests, and `../Sherpa Demos` and `../Sherpa Gallery`.

## Critique: what the first plan got wrong

1. **(c) does not work.** `sherpa-button.css` has `:host { inline-size: fit-content }`. A grid item with a fit-content width does not stretch into a `1fr` track. The month would stay at its label width and leave a gap before Next, and the seam test in `reforged-menu-calendar.spec.ts` would fail. Today the month fills only because of the inline `flex: 1 1 auto`.
2. **(d) loses the calendar on every Advanced date menu.** `sherpa-menu` has two templates, `default` and `filter`. A date menu with `advanced: true` stamps `filter`, and the plan put the calendar prototype only in `default`. `reforged-date-conditions.spec.ts` L60-74 would fail: `values` written after render go nowhere.
3. **(d) changes when a held date value takes effect.** Holding `values` before render means `#setShape()` no longer runs at once. So `data-range` and `data-commit` stay unset until the menu draws. The chip's reading (`sherpa-quick-filter.ts:924`, `range: !!menu?.hasAttribute('data-range')`) would report a range as a single day for that time. This is the "a composed field fills async" bug class.
4. **(a) breaks the leaving state.** An outer page rule beats the toast's own `:host` rules, `:host(:state(leaving)) { pointer-events: none }` included. So a leaving toast in the stack would stay clickable. It also drops toasts in a `.sherpa-toast-stack` container inside a shadow root.
5. **(a) has a race.** The page sheet was adopted fire-and-forget from `connectedCallback`. In a fetched build the stack could draw without its sheet.
6. **(a) also restyles an app's own container.** The page rule `.sherpa-toast-stack` would force an app's own `options.container` with that class to be fixed at the top right.
7. **(b) would block the commit.** The new `sherpa-nav.ts` comment drops the file's only `TRAP T-nav-search-uses-a-real-highlight` citation, so `check:traps` fails on the Site line.
8. **Things the plan missed:**
   - Adding a prototype root to `sherpa-toast.html` changes the toast spec's anatomy from `root` to `roots`.
   - The Gallery's `sherpa-menu` Body story will now show a calendar for `data-body="date"`.
   - `settled()` runs a fixed 3 passes, and (d) adds one level of render depth.
   - Site lines in `T-projected-slot-content-crosses-two-shadow-boundaries` and `T-nav-search-uses-a-real-highlight` need edits.
   - The `sherpa-group` spec and reference pages need regenerating once (c) uses it.
9. **Overlap with other groups.** `filter-menu.ts:72` (the menu itself) and the toast made per `show()` are group 4's rows in TODO 344. This plan keeps them because they share files with group 1. Group 4 must reuse G1 and must not plan them again.

---

## G1. A helper module owns its own markup file (kept, small fixes)

It serves (d): `menuFor()`, called by the toolbar, the panel, the grid, and saved-filter-menu through the toolbar and panel. Group 3's `src/core/ui/more-menu.ts` can use it too.

`src/core/ui/templater.ts`, add:
```ts
/** Each helper file's parsed prototypes, by URL. */
const protos = new Map<string, Document>();

/** A TOP-LEVEL `<template class>` prototype's first element from a markup FILE, imported
 *  into the page so it upgrades now — `clone()` for a helper with no shadow root. Null until
 *  the file has loaded; text the build carried always has. TRAP T-a-templater-owns-the-files */
export function cloneFromFile<T extends Element = HTMLElement>(url: URL, selector: string): T | null {
  let doc = protos.get(url.href);
  if (!doc) {
    const text = templateCache.get(url.href)?.html ?? inline.get(url.href);
    if (text === undefined) return null;
    doc = new DOMParser().parseFromString(ownHtml(text), 'text/html');
    protos.set(url.href, doc);
  }
  const first = doc.querySelector<HTMLTemplateElement>(selector)?.content.firstElementChild;
  return first ? (document.importNode(first, true) as unknown as T) : null;
}
```
- In `reloadFiles`, html branch (L195-201): add `protos.delete(url);` after `templateCache.set(...)`.
- [FIXED] The doc comment now says "TOP-LEVEL". `querySelector` on the parsed document does not go into a nested template's `content`. A prototype inside `<template id>` cannot be found this way.
- [FIXED] It does not upgrade icons. The base `clone()` does. Say so in the comment. The menu prototype has no icons.

`src/core/ui/sherpa-element.ts`:
```ts
/** Markup files its code CLONES FROM besides its own — a helper's, as `menuFor()`'s.
 *  Loaded with its own, so a clone from `onRender` on finds it. TRAP T-a-templater-owns-the-files */
static clonesFrom: readonly URL[] = [];
```
In `#bootstrap` (L829), before the `try`:
```ts
const Ctor = this.constructor as typeof SherpaElement;
const helpers = Promise.allSettled(Ctor.clonesFrom.map((u) => loadTemplates(u.href)));
const page = Ctor.pageCss ? adoptPageSheet(Ctor.pageCss) : undefined;   // G2
```
After the `try`/`catch`, before `#stamp`:
```ts
for (const r of await helpers) {
  if (r.status === 'rejected') report({ code: 'template-failed', message: `<${this.localName}>'s helper markup did not load: ${String(r.reason)}`, at: { tag: this.localName } });
}
await page;
```
- [FIXED] `Ctor` was not in scope in `#bootstrap`.
- Both legs never reject, so `rendered` always settles (TRAP `T-rendered-settles-even-when-the-markup-does-not`).

In `reload()` (L272-282), inside the loop:
```ts
const Own = el.constructor as typeof SherpaElement;
for (const u of Own.clonesFrom) html.add(u.href);
if (Own.pageCss) css.add(Own.pageCss.href);   // G2
```

## G2. A sheet for what a component puts in the page (reworked)

It serves (a). It belongs in the base class because the bootstrap must WAIT for it. That ordering is the reason, not a count of users.

`templater.ts`, add:
```ts
/** Adopt a sheet into the DOCUMENT, after the page's own — for light DOM a component puts
 *  in the page, which no shadow sheet reaches. Again if the page dropped it. Never rejects.
 *  TRAP T-a-templater-owns-the-files */
export async function adoptPageSheet(url: URL): Promise<void> {
  if (typeof document === 'undefined') return;
  const [sheet] = await loadSheets([url.href]);
  if (!sheet) return;   // loadSheet reported it; the next element asks again
  const have = document.adoptedStyleSheets;
  if (!have.includes(sheet)) document.adoptedStyleSheets = [...have, sheet];
}
```
`SherpaElement`:
```ts
/** A sheet for what it puts in the PAGE's light DOM: adopted into the document, and
 *  awaited with its own sheets before its first stamp. TRAP T-a-templater-owns-the-files */
static pageCss?: URL;
```
- [FIXED] It is awaited in `#bootstrap` (G1 code above), not fired from `connectedCallback`. So the stack's sheet is in place before the toast that makes the stack draws, in fetched builds too.
- [FIXED] It re-adopts if an app replaced `document.adoptedStyleSheets` wholesale. `sheetCache` means nothing is fetched twice. Demos' `sticky-metrics.js` already appends safely.
- [FIXED] No `pageSheetUrls()` export. `reload()` reads `pageCss` off each live element. The stack only exists while a toast is live.

### Notes for G1 and G2
- `scripts/lib/ts-facts.mjs` `isPublic` drops static members, so the specs do not change from the statics.
- The build inlines `new URL('./x.html|css', import.meta.url)` that is not followed by `.href` (`build-reforged.mjs` L105). `copyAssets` walks all of `src/`, so `src/core/ui/filter-menu.html` is copied for `build:dev` and inlined for `build`.
- `check:size` and `code-map` do not scan `src/core/ui/*.html`, and `check-traps` does not either. So `filter-menu.html` cites no TRAP.
- Node import stays DOM-free. `test/unit/import-anywhere.test.mjs` should stay green.

---

## (a) The toast stack

### 1. Current code
`src/components/sherpa-toast/sherpa-toast.ts`:
- L35: prop `'data-stacked'`. L41: a stale comment, `/* Written BY the toast for the duration of its exit animation. */`.
- L101-104: `const host = options.container ?? SherpaToast.#stack(); if (host.classList.contains('sherpa-toast-stack')) toast.dataset['stacked'] = ''; host.appendChild(toast);`
- L109-126 `#stack()`: `document.createElement('div')`, `className = 'sherpa-toast-stack'`, `style.cssText = ['position:fixed', 'top:var(--sherpa-display-mode-space-base, 16px)', …, 'pointer-events:none'].join(';')`, then `document.body.appendChild(stack)`.

`sherpa-toast.css` L25-31: `:host([data-stacked]) { position: static; inset: auto; pointer-events: auto; }`. It comes before `:host(:state(leaving))` (L34), so leaving's `pointer-events: none` wins today.

### 2. Why it is in TS
- The stack is light DOM in `body` ("so the app can target it", L108). No shadow sheet reaches it, and no mechanism put a sheet in the document.
- `data-stacked` exists because `:host` cannot see its parent (`:host-context` is not in Firefox).
- `show()` is static and has no shadow root to clone from.
- PRINCIPLES §17 sanctioned both ("the toasts' shared stack in `document.body`", "`SherpaToast.show`").

### 3. The change
New file `src/components/sherpa-toast/sherpa-toast-stack.css` (the name is free):
```css
/**
 * sherpa-toast-stack.css — the static helpers' shared stack, in the PAGE: adopted into the
 * document by `static pageCss`. In a layer, so the page's own CSS wins.
 */
@layer components {
  body > .sherpa-toast-stack {
    position: fixed;
    top: var(--sherpa-display-mode-space-base, 16px);
    right: var(--sherpa-display-mode-space-base, 16px);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: var(--sherpa-display-mode-space-xs, 8px);
    pointer-events: none; /* the stack never blocks the page */
  }
}
```
- [FIXED] `body >`: only the stack Sherpa appends to `body` is styled. An app's own `.sherpa-toast-stack` container elsewhere keeps its own layout.
- [FIXED] No rule for the toast here. That stays in the toast's own sheet, below.

`sherpa-toast.css`: replace L25-31 with the same declarations on a custom state, in the same place:
```css
/* In a stack the stack owns the corner. The stack is pointer-events:none so it
   never blocks the page — each toast turns interaction back on for its own box. */
:host(:state(stacked)) {
  position: static;
  inset: auto;
  pointer-events: auto;
}
```
- [FIXED] Same specificity as `:host(:state(leaving))` and earlier in the file, so a leaving toast is unclickable again.
- [FIXED] It works in any tree, a shadow-root container included.
- It follows the rule that private host state is a custom state, never a public `data-*`.

`sherpa-toast.html`, inside `<template id="default">`, after the `.toast` div:
```html
  <!-- The helpers' shared stack, cloned once by the first toast that draws; its CSS is sherpa-toast-stack.css. -->
  <template class="toast-stack-tpl">
    <div class="sherpa-toast-stack"></div>
  </template>
```

`sherpa-toast.ts`:
- Delete prop `'data-stacked'` (L35), the stale L41 comment, `#stack()`, and L101-103.
- Header L4: `The static helpers share one stack, cloned from the template; its CSS is sherpa-toast-stack.css, in the page.`
- Add:
```ts
static override pageCss = new URL('./sherpa-toast-stack.css', import.meta.url);

/** Made by a helper with no container: it joins the shared stack once it has drawn. */
#joinsStack = false;

override onRender(): void {
  this.$('.close')?.addEventListener('button-click', () => this.dismiss());
  this.$('.action')?.addEventListener('click', () => this.emit('toast-action'));
  // LAST: the move disconnects it, which aborts `this.signal`.
  if (this.#joinsStack && this.isConnected) this.#joinStack();
}

override onConnect(): void {
  // :host cannot see its parent, so the state says it.
  this.toggleState('stacked', this.parentElement?.classList.contains('sherpa-toast-stack') === true);
  const duration = this.num('data-duration', DEFAULT_DURATION);
  if (duration > 0) this.#timer = setTimeout(() => this.dismiss(), duration);
}

/** Into the page's shared stack, cloned from this template by the first toast that draws. */
#joinStack(): void {
  this.#joinsStack = false;
  const stack = document.querySelector('body > .sherpa-toast-stack') ?? this.clone('template.toast-stack-tpl');
  if (!stack) return;
  if (!stack.isConnected) document.body.appendChild(stack);
  stack.appendChild(this);
}
```
- In `show()`, replace L101-104 with:
```ts
toast.#joinsStack = !options.container;
(options.container ?? document.body).appendChild(toast);
```

What the base does on the move (checked in `sherpa-element.ts`):
- `#stamp` sets `#hasRendered = true` before `onRender`.
- So the move runs `disconnectedCallback` (it aborts `#ac` and calls `onDisconnect`, with no timer yet), then `connectedCallback`, which runs `onConnect` once: the state is set and the timer starts.
- `#bootstrap` then skips its own `onConnect`, because `#connected` is true.
- `#wireSlots()` runs after `onRender`, so it uses the new signal.
- `#joinsStack` is reset because a re-stamp or a reload runs `onRender` again.

**The toast element itself (group 4's row): ❓ for Will.** My pick is Option A: keep `document.createElement('sherpa-toast')`. Once `data-stacked` is gone, `show()` writes only the caller's data, so a `<template class="toast-tpl"><sherpa-toast></sherpa-toast></template>` would hold nothing. Option B (`cloneFromFile`) is synchronous only in an inlined build. It makes `show()` return a Promise, which changes `reforged-toast.spec.ts` L149-150, L178 and L200, and every TypeScript caller.

### 4. Behaviour changes
- Right after `show()`, `toast.parentElement` is `body`. It is the stack once drawn, which is before `rendered` resolves and before any paint in the inlined build. Only the tests read it, after `rendered`.
- The page's own unlayered CSS now wins over the stack. Before, it needed `!important`. A page-wide unlayered rule such as `div { position: relative }` would win too, which is rare.
- `data-stacked` is no longer a public prop. It was never in the Public API block.
- A container with the class still gets the stacked look, in any tree.
- `top`/`right` are kept, so RTL pages behave as today.
- The toast spec's anatomy changes from `root` to `roots`, because the prototype is a second root. Regenerate it.
- Risk: the move removes and re-inserts a `role="alert"` subtree in one task. Check it with VoiceOver once.

### 5. Tests (listed for Will; none run)
- `reforged-toast.spec.ts` L212/L222: `stacked: toast.hasAttribute('data-stacked')` becomes `toast.matches(':state(stacked)')`, expected true.
- L143-193 should pass: they `await rendered`, and the stack is a direct child of `body`.
- Add:
  - the stack has no `style` attribute;
  - one `document.adoptedStyleSheets` entry after two `show()` calls;
  - two toasts shown in one task land in one stack, in order;
  - a page rule `body > .sherpa-toast-stack { top: 80px }` wins;
  - a dismissed toast in the stack reads `pointer-events: none` while leaving;
  - a container with the class gets `:state(stacked)`.
- `reforged-strict-csp.spec.ts`: also show a toast. Expect no violations and a stacked toast. This proves document-adopted sheets under the strict CSP.
- Demos `reforged-add-customer-form.spec.ts` L100 and `reforged-view-chips.spec.ts` L345 query `sherpa-toast`, so they are unaffected. Gallery toast stories use only `data-status`.

### 6. Docs
- PRINCIPLES §17: drop "the toasts' shared stack in `document.body`" (coordinate the sentence with group 4).
- TRAPS `T-a-templater-owns-the-files`: add bullets for `pageCss`/`adoptPageSheet`, `clonesFrom` and `cloneFromFile`. No new Site, because toast.ts cites no TRAP.
- TRAPS `T-tokens-are-safe-to-embed`: one line. The only Sherpa rule a component adds to a host page is `body > .sherpa-toast-stack`, in `@layer components`, and only when a helper shows a toast.
- CLAUDE.md (SherpaElement section) and `DEF-TO-FIGMA-BUILD-RULES.md` L76-78: one line each for `static pageCss` and `static clonesFrom`.
- `scripts/lint-css.mjs`: lint the page sheet, as `sherpa-button-look.css` is at L238-240. The component loop only reads `<name>.css`.
- Not visible to agents: the MCP serves only `<name>.css`.

### 7. Risks
- In a fetched build, a failed page sheet (reported by `loadSheet`) leaves the stack unstyled. The shipped build inlines it.
- Not in scope: `popover="manual"` for toasts over `showModal()`.

---

## (b) The nav-item `::highlight()` rule

### 1. Current code
`src/components/sherpa-nav-item/sherpa-nav-item.ts`:
- L22 `let uid = 0;` and L52-55 `#highlightName`, `#highlightStyled`.
- L164-168: `registry.set(name, new Highlight(...ranges)); this.#ensureHighlightStyle(name);`
- L178-185: `sheet.replaceSync(\`::highlight(${name}){background-color:var(--_match-surface);color:var(--_match-ink)}\`); this.shadowRoot.adoptedStyleSheets = [...];`. It also uses `this.shadowRoot` directly, where the rule is `this.root`.

### 2. Why it is in TS
- TRAPS L8350-8353: "a single SHARED `Highlight` … paints nothing", from ddaa7a05 (2026-09-10).
- The same TRAP (L8356-8358) says Chromium 153 paints no custom highlight in a shadow root, however it is registered. The `<mark>` is what readers see.
- `sherpa-nav.css` L401 has said "in sherpa-base.css" since ddaa7a05, and that was never true: `git log -S'highlight(' -- src/core/sherpa-base.css` is empty.
- There is a reload bug. `#redraw()` → `#adoptStyles()` assigns a new array, which drops the per-row sheet, and `#highlightStyled` stays true, so it is never added back.

### 3. The change
One shared Highlight. Each row adds and removes its own ranges, and the rule is static. The `ts` diff is as in the first plan:
- Delete `uid`, `#highlightName`, `#highlightStyled` and `#ensureHighlightStyle`.
- Add module const `MATCH = 'sherpa-nav-match'` and field `#ranges: Range[] = []`.
- Replace L164-168 with `#clearHighlight(); …get or create shared…; for (const range of ranges) shared.add(range); this.#ranges = ranges;`.
- `#clearHighlight()` deletes this row's ranges, and deletes the entry when it is empty.
- `Highlight extends Set<AbstractRange>` is in the TS lib (DOM + DOM.Iterable in `tsconfig.reforged.json`), so `add`, `delete` and `size` type-check.

`sherpa-nav-item.css`:
- L114-115 comment: `/* The search tint, ONCE: the <mark> paints it, and so does the shared ::highlight() below. TRAP T-custom-highlight-not-painted-in-shadow */`
- After `.label mark.match`, outside the tokens region (which is the only `@layer` in the file, so the test's per-rule `cssText` stays free of `#`):
```css
::highlight(sherpa-nav-match) {
  background-color: var(--_match-surface);
  color: var(--_match-ink);
}
```

Stale comments:
- `sherpa-nav.css` L400-401: `Match highlighting is the row's: a <mark>, and ::highlight(sherpa-nav-match) in sherpa-nav-item.css.`
- `sherpa-nav.ts` L496-497: `// Each row marks its OWN label; the highlight is one, shared. TRAP T-nav-search-uses-a-real-highlight.`
- [FIXED] The citation is kept. It is the file's only one, and dropping it fails `check:traps` on that TRAP's Site line.

### 4. Behaviour changes
- No visible change. The `<mark>` paints the tint in every engine, whether the highlight paints or not.
- One registry entry instead of one per row. The reload bug is fixed.

### 5. Tests
- `reforged-nav-item.spec.ts` L221-239 still passes: it finds the static rule, which has no `#`.
- Add:
  - two highlighted rows give one `CSS.highlights` entry;
  - clearing one row keeps the other's ranges;
  - disconnecting every row removes the entry;
  - after `SherpaElement.reload('sherpa-nav-item')` the rule is still adopted.
- [FIXED] The three-engine pixel check is NOT a gate. The `<mark>` makes both forms look the same. Queue it for when Will allows tests.

### 6. Docs
- TRAPS `T-custom-highlight-not-painted-in-shadow`: rewrite point 1: one shared `sherpa-nav-match`; its rule is in `sherpa-nav-item.css`, so it is in every row's tree; a per-row name never painted either. Delete the "built in the TS because its name is per row" sentence. `onDisconnect` takes the row's ranges out, and the last row out deletes the entry.
- TRAPS `T-nav-search-uses-a-real-highlight`: "No marker elements are injected" is false. It becomes "each match is a `<mark class="match">` and a range in the shared highlight". "Registered and styled INSIDE that same tree" becomes "its `::highlight()` rule is in that tree's own sheet".

---

## (c) The calendar header's corners and margins [FIXED: reworked]

### 1. Current code
`src/components/sherpa-calendar/sherpa-calendar.ts` L159-181 `#projectHeader`. It sets these properties through the CSSOM, by `style.setProperty`:
- `.cal-prev`: left corners, `var(--sherpa-display-mode-border-rounding-base, 4px)`;
- `.cal-label`: `margin-inline-start: var(--sherpa-structure-space-snapped, 0px)` and `flex: 1 1 auto`;
- `.cal-next`: the lap, and the right corners.

It also clones and styles even when a header already exists.

### 2. Why it is in TS
- The clone (`div.cal-header.cal-header-projected[slot=header]`) lands in the menu's light DOM. That is the toolbar's, panel's or grid's shadow tree, or the document.
- `::slotted(.cal-header)` in `sherpa-menu.css` reaches the wrapper but not its buttons.
- History: inline `style=""` in 72e026e0 (2026-09-11), moved to the CSSOM in fc8bffcd (2026-10-12), and `data-group` started working in be4be1ee (2026-09-21).
- The corners repeat what `[data-group]` already sets. The lap is `space-none` in all six mode blocks (`tokens.css` L1305-1365). So the only live effect is the month's `flex: 1 1 auto`, which no rule outside the button's tree can set. `sherpa-button.css` has `:host { inline-size: fit-content }`. That is why the first plan's grid version fails.

### 3. The change: compose `<sherpa-group>`, the repo's own component for this
`sherpa-group`'s `::slotted()` rules live in its own shadow sheet. They shape its direct children in ANY tree:
- corners by position;
- halved shared edges;
- the snapped lap.

`sherpa-calendar.html` L80-90:
```html
  <!-- The stepper as a LIGHT-DOM clone for data-embedded: a sherpa-group, so its corners,
       edges and lap are the group's in any tree. Same three classes as the shadow header. -->
  <template class="cal-header-tpl">
    <sherpa-group class="cal-header cal-header-projected" slot="header">
      <sherpa-button class="cal-nav cal-prev" data-type="icon"
                     data-icon-start="chevron-left" aria-label="Previous"></sherpa-button>
      <sherpa-button class="cal-label" data-grow aria-live="polite"></sherpa-button>
      <sherpa-button class="cal-nav cal-next" data-type="icon"
                     data-icon-start="chevron-right" aria-label="Next"></sherpa-button>
    </sherpa-group>
  </template>
```
- No `data-group` attributes: the group derives position.

`sherpa-calendar.ts`:
- Add `import '../sherpa-group/sherpa-group.js';`.
- `#projectHeader` becomes:
```ts
/** Stepper into the HOST's header, not this element, or the slot never assigns it. Its shape is the group's. */
#projectHeader(): void {
  const host = this.parentElement ?? this;
  if (host.querySelector(':scope > .cal-header-projected')) return;
  const header = this.clone('template.cal-header-tpl');
  if (header) host.appendChild(header);
}
```
- The `TRAP T-sherpa-runs-under-a-strict-csp` citation goes with the deleted block.
- `#headerEls` (`:scope > .cal-header-projected ${sel}`) still works.

`sherpa-group.css`, after the lap rules:
```css
/* A child marked `data-grow` takes the spare room — a stepper's month. */
::slotted([data-grow]) { flex: 1 1 auto; }
```
- `data-grow` is already shared vocabulary for "read by the parent": it is in `scripts/check-usage.mjs` EVERYWHERE, and `sherpa-stack` and `sherpa-layout-grid` use it.
- No `min-inline-size: 0`, to match today exactly.

`sherpa-group.html`: say it in the header prose ABOVE `Public API:`: "A child marked `data-grow` takes the spare room." Do not put it inside the Public API block. The spec generator turns any `data-*` there into a prop of the group. It already did that wrongly for `sherpa-stack`'s `data-grow` (`sherpa-stack.component.json` L91).

`sherpa-menu.css` L299-320: replace the block with:
```css
/* ── A slotted stepper is a sherpa-group: its corners and lap are its own ──
 * Block-level here, so the month fills the card. */
.header ::slotted(.cal-header) { display: flex; }
```
- The menu's shadow tree comes before the group's in shadow-including order, so this beats the group's `:host { display: inline-flex }`. The group's own `:host` already gives `align-items: center; gap: 0`.

Comments:
- `sherpa-calendar.css` L216-217: drop "See #projectHeader()".

Optional, not needed: the calendar's own shadow header could become `<sherpa-group>` too, so both headers have one shape.

### 4. Behaviour changes
- [FIXED] Nothing visible changes. Prev and next are 32, the month fills, the seams are ≤ 0, the corners are the same, and the snapped lap is KEPT (it was lost in the first plan).
- The wrapper is `sherpa-group`, not `div`. Every selector uses the `.cal-header-projected` class.
- The buttons lose `data-group`. No test reads it.
- The stepper shows once the group has stamped its `<slot>`: within the same task in the inlined build, one fetch later in `build:dev`.
- The calendar now imports `sherpa-group` (small).

### 5. Tests
- `reforged-menu-calendar.spec.ts` L85: `'flex'` stays. L80-102 (tags, boxes, seams, corners) should pass unchanged. Rewrite the header comment L13-17: the stepper is a `<sherpa-group>`, whose own sheet shapes it in any tree. Add `stepper.localName === 'sherpa-group'`.
- `reforged-strict-csp.spec.ts` L31-43: `corner` becomes `getComputedStyle(prev).getPropertyValue('--sherpa-border-rounding-top-left').trim()`, expected `'4px'`. Add `prev.getAttribute('style') === null`.
- Add: the same boxes and corners when the menu is in a toolbar chip (a shadow root).
- `reforged-quick-filter-toolbar.spec.ts` L1028 queries `.cal-header-projected`, so it still works.

### 6. Docs
- TRAPS `T-sherpa-runs-under-a-strict-csp` L17070-17073: "A template must carry no `style=""`, and nothing needs one: the calendar's projected stepper is a `sherpa-group`, shaped by its own sheet in any tree." Delete the Site line `src/components/sherpa-calendar/sherpa-calendar.ts`.
- TRAPS `T-grouping-is-an-attribute-and-a-class`: one line. A row that lands in another component's light DOM is a `<sherpa-group>`, because its `::slotted` rules travel with it.

### 7. Risks
- The group's `--sherpa-border-*` values match `[data-group]` (start: left sm, right xs; mid: xs; end: right sm). Top and bottom come from the button's default instead of `[data-group]`'s `sm`. Read pixels once.

---

## (d) `filter-menu.ts`: the date body's calendar, and the menu itself

### 1. Current code
`src/core/ui/filter-menu.ts`:
- L72 `document.createElement('sherpa-menu')`; L76 `slot`; L98 `data-clearable`; L99 `data-search`.
- L137-144: `createElement('sherpa-calendar')`, `className = 'qf-calendar'` (read by nothing), `data-embedded`, `data-type="range"` and `data-available`, then `menu.appendChild(cal)`.

`sherpa-menu.html` L171-176: "NO CALENDAR HERE". The menu has two templates: `default` (L115) and `filter` (L257).

### 2. Why it is in TS
- A helper has no template, and `menuFor()` is synchronous for its 6 callers: toolbar L816, grid L472, panel L890/L1021/L1194, and `saved-filter-menu.ts` L106.
- TRAP `T-a-menu-owns-its-own-bodies` made the calendar "the exception": it must be a light-DOM child of the menu.
- `set values` (menu.ts L1245-1263) writes a date before render "because a date's calendar is light DOM".

### 3. The change
**Menu from a file (group 4's row; G1).** New `src/core/ui/filter-menu.html` (the name is free):
```html
<!-- filter-menu.html — the menu ONE filter def is drawn from. menuFor() clones it and writes what the def says. -->
<template class="filter-menu-tpl">
  <sherpa-menu slot="menu" data-search data-clearable></sherpa-menu>
</template>
```
`filter-menu.ts`:
```ts
import { cloneFromFile } from './templater.js';
/** The menu every filter def is drawn from. A host lists it in `static clonesFrom`. */
export const FILTER_MENU_HTML = new URL('./filter-menu.html', import.meta.url);
…
  const menu = cloneFromFile<SherpaMenu>(FILTER_MENU_HTML, 'template.filter-menu-tpl');
  if (!menu) throw new Error("menuFor(): filter-menu.html has not loaded — list FILTER_MENU_HTML in the host's static clonesFrom");
```
- Delete L76 and L99. L98 becomes `if (def.persistent) menu.removeAttribute('data-clearable');`. The number and date branches keep `removeAttribute('data-search')`.
- The throw can only fire in a fetched build when a host forgets `clonesFrom`. `menuFor` is not in any public entry, and the tests import the inlined `dist`. ❓ for Will if he prefers `report()`.
- Hosts `sherpa-quick-filter-toolbar.ts`, `sherpa-filter-panel.ts` and `sherpa-data-grid.ts` each add `static override clonesFrom = [FILTER_MENU_HTML];`. Saved-filter-menu is reached only through the toolbar and the panel.

**The calendar from the menu's own template.** `filter-menu.ts` date branch: delete L134-144 and write:
```ts
    // The menu stamps its own calendar; this is what it hands on. TRAP T-a-menu-owns-its-own-bodies
    if (def.availableDates?.length) menu.setAttribute('data-available', def.availableDates.join(','));
```
- `#syncBody` (L1496-1513) passes on `data-range` as `data-type="range"`, and `data-available`.
- Keep the `sherpa-calendar.js` import. The menu deliberately does not import the bodies (TRAP `T-menu-composes-real-components`).

`sherpa-menu.html`, replace L171-176 in `default` with:
```html
    <!-- THE DATE BODY. Stamped into this menu's LIGHT DOM on data-body="date", as its rows
         are: the calendar projects its stepper into the header slot.
         TRAP T-a-menu-owns-its-own-bodies
         TRAP T-projected-slot-content-crosses-two-shadow-boundaries -->
    <template class="menu-calendar-tpl">
      <sherpa-calendar data-embedded></sherpa-calendar>
    </template>
```
- [FIXED] Add the same prototype to the `filter` template, beside its other copied prototypes (after L360), with a one-line comment: `<!-- The date body, as in the default template. -->`. An Advanced date menu stamps `filter`.

`sherpa-menu.ts`:
```ts
  /** A DATE body's calendar, stamped once into the light DOM — never beside a page's own. TRAP T-a-menu-owns-its-own-bodies */
  #stampDateBody(): void {
    if (this.dataset['body'] !== 'date' || this.#own('sherpa-calendar').length) return;
    const cal = this.clone('template.menu-calendar-tpl');
    if (cal) this.append(cal);
  }
```
- Call it first in `onRender` (L189), before `#syncInline()`/`#sync()`.
- In `onChange` (L1070), add `if (name === 'data-body') this.#stampDateBody();` before `#sync()`.
- A re-stamp to `filter` keeps the calendar it has.
- [FIXED] Do NOT change the `set values` guard. Change `#setBodyValues`'s date branch (L1193-1195) instead:
```ts
      const cal = this.#own<HTMLElement>('sherpa-calendar')[0];
      // Not stamped yet: HELD, and the shape above is said NOW. TRAP T-a-value-before-the-first-render-is-held
      if (!cal) { this.#heldValues = [...next]; return true; }
```
  - `#setShape()` still runs before this line, so `data-range` and `data-commit` are set at once, as today.
  - `get values` returns the held values while there is no calendar (L1149-1151).
  - `onRender` replays them after the stamp (L245-247).

### 4. Behaviour changes
- Every menu gets the same attributes. The calendar appears when the menu draws, not when `menuFor` returns.
- A date's values and its range shape read back the same before render.
- `.qf-calendar` is dropped.
- [FIXED] A hand-written `<sherpa-menu data-body="date">` with no calendar child now stamps one. The Gallery's `sherpa-menu` Body story shows it. It needs `sherpa-calendar` imported, as the number body needs `sherpa-slider` today.
- A `data-type="calendar"` menu with its own child (`reforged-menu-calendar.spec.ts`) stamps nothing.
- [FIXED] One more level of render depth. `settled()` runs a fixed 3 passes (`settled.ts` L28). For bar → menu → calendar → cells, one call made straight after a mount can return before the calendar's cells and buttons have drawn. Watch for that in the first full run. If it shows, make `settled()` repeat until no new pending render appears (a separate item).

### 5. Tests
Should pass (each reads after `rendered` or `__settled`):
- `reforged-date-conditions.spec.ts` (L60-74 needs the `filter`-template prototype);
- `reforged-advanced-rows.spec.ts`;
- `reforged-filter-panel-component.spec.ts` ~L494;
- `reforged-quick-filter-toolbar.spec.ts` L1015, L1331, L1686;
- `reforged-a-calendar-pick-wakes-the-footer.spec.ts`;
- `reforged-chip-tips.spec.ts` ~L150;
- `reforged-data-grid.spec.ts` ~L1700;
- `reforged-menu-calendar.spec.ts` (by hand: unchanged).

Fix the stale comment at `reforged-quick-filter-toolbar.spec.ts` L1015-1017: "the menu stamps its calendar as it renders".

Add:
- `reforged-menu-state-first.spec.ts`: a DATE menu given two days before render has `data-range` at once, and the stamped calendar gets both ends;
- an Advanced date menu has a calendar;
- `reforged-templater.spec.ts`: `cloneFromFile` returns null until loaded; `clonesFrom` loads before `onRender`; a reload re-parses;
- `menuFor` attributes are unchanged for list, number, date and persistent.

### 6. Docs
- TRAPS `T-a-menu-owns-its-own-bodies` L2205-2213: "THE CALENDAR IS THE EXCEPTION" becomes "the calendar is the menu's too, stamped into its LIGHT DOM as its rows are, because only a light-DOM child can fill the header slot".
- TRAPS `T-projected-slot-content-crosses-two-shadow-boundaries`: "the menu stamps it into its light DOM". [FIXED] Delete Site `src/core/ui/filter-menu.ts`: its only citation (L136) goes.
- TRAPS `T-a-value-before-the-first-render-is-held`: `sherpa-menu` holds a date's values until its calendar is stamped, and its shape is said at once.
- TRAPS `T-a-templater-owns-the-files`: the `clonesFrom`/`cloneFromFile` bullet (see G2).
- PRINCIPLES §17: delete "A typed child by tag name is not structure — `menuFor()` building a `<sherpa-menu>` is that", and drop "`menuFor()`'s menu and calendar". Recount together with group 4.
- CLAUDE.md, Template rules: "A helper that draws markup owns an `.html` beside it; its hosts list it in `static clonesFrom`."

---

## Order and gates
1. G1 + (d)
2. (c)
3. (b)
4. G2 + (a)

After the edits:
- Specs: `node scripts/generate-component-spec.mjs sherpa-toast sherpa-menu sherpa-calendar sherpa-nav-item sherpa-group`, then `npm run manifest` and `npm run reference`. [FIXED] `sherpa-group` added; the toast anatomy becomes `roots`.
- TRAPS Site lines, by hand:
  - remove `sherpa-calendar.ts` from `T-sherpa-runs-under-a-strict-csp`;
  - remove `filter-menu.ts` from `T-projected-slot-content-crosses-two-shadow-boundaries`;
  - keep `sherpa-nav.ts` in `T-nav-search-uses-a-real-highlight`.
  
  Then `npm run traps:write`.
- `npm run map:write` for `templater.ts` (`cloneFromFile`, `adoptPageSheet`) and `filter-menu.ts` (`FILTER_MENU_HTML`). Then hand-edit the lines.
- `check:size -- --update-baseline` (new and grown files) and `check:weight -- --update-baseline`: calendar → group, the page sheet, two prototypes, the helper file.
- `type-check`, `lint`, `lint:css` (with the new page-sheet line).

Will says when tests run (memory, 10-15). The tests above are queued, not run.

In Demos, look at:
- a toast after Records → Save: top right, stacked;
- a date chip's calendar menu, Simple and Advanced: stepper corners, the month fills;
- nav search: tint unchanged.