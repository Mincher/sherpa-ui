# Group 3b plan (revised): fixed UI text, and rows built from TS data

I only read files. I made no edits, builds, tests or stash. I checked every file:line the first plan cited.

## What the critique found

Each of these is marked [FIXED] where it lands in the plan below.

1. **Missed site.** `sherpa-filter-panel.ts:514` writes `this.dataset['heading'] ?? 'Filters'`. This is default text in TS. G3, extended to `as: 'attr'`, fixes it and deletes `#syncHeading`.
2. **`ALL_LABEL` is dead code.** It does not need `word()`. `sherpa-menu.ts:1793` looks for `.qf-row-label`. The menu's own `menu-all-tpl` uses `.menu-row-label` and already says "Select all". Only `reforged-menu.spec.ts:468` stamps a `.qf-row-label`, and that test must change. The first plan said no test changes.
3. **False reports from G2.** `#onRowsChanged` calls `#refillPicks`, which calls `#valueOptions()`, on every menu (`:1805`). So `word('select')` would report `word-missing` on every `default` menu that has value rows. A guard fixes this.
4. **G3 makes `PropDef.default` dead.** No number prop uses `default`. Its only users are app-header (3b) and transfer-list (3a). Delete it when 3a lands. `T-empty-write-lets-css-collapse` says "ABSENT … write `''`". That stops being true, and the first plan did not list it.
5. **The first plan missed three gates.**
   - `check-traps.mjs` does not scan `src/core/*.html`, and its `AREAS` has no match for that path. A `Site:` line for the family html would fail the hook.
   - `check-size.mjs` `SOURCES` does not count `src/core/sherpa-filter-*.css` or `src/core/*.html`. The moved rules would look deleted.
   - TS growth must be recorded with `check:size --update-baseline`.
6. **Nav type.** Making `NavEntry.label` optional also loosens section and child rows. A missing label there would then draw a blank row with no error. Make only `quickItems` loose.
7. **Nav merge.** `{ ...base, ...e }` lets an explicit `label: undefined` erase the borrowed label.
8. **Provider.** An `await rendered` at the top of `drawBars` could hang `open()` on a provider that is not connected. Await only in the View-chip branch. A View bar there means the provider is connected.
9. **Simpler G1.** Add the family body once, inside `#stamp`, not at three call sites.
10. **G1 has no test.** `npm test` builds with inlining, so the fetched path is never run. The queued test must use fetched URLs, as `reforged-bootstrap-failure.spec.ts` does.
11. **Missed extra finds.**
    - App-header's theme toggle label swap (`:164`).
    - The filter panel's ``Reset ${name}`` / ``Send ${name} to view filters`` / ``Advanced ${name}`` labels (`:828-832`).
    - The input-text constants are at `:41`/`:43`, not `:470`/`:475`.
12. **Not listed before.** `docs/TRAPS.md:1879` says "Limit matching filters", which is out of date. The spec carries no text, so MCP `compile_def` from a spec drops these words.

---

## The generic mechanisms

### G1. A family's markup (`static html` takes a list)

This mirrors `static css`, which already takes a list. The family files come first and the component's own file comes last. A family file holds ONE `<template id="default">`. That template's body is stamped after the component's own body.

**Sites it serves:**
- The ⋮ menu of the bar and of the panel.
- Later: the identical saved-set prototypes (`qf-saved-menu-tpl`/`qf-saved-field-tpl` in the bar, `saved-menu-tpl`/`saved-field-tpl` in the panel).
- Later: the shared words in `shared-constants.ts`.

**`templater.ts`:**
```ts
/** The markup and sheets `tag` is drawn from now: a family's, its own, then a consumer's. */
export function filesFor(
  tag: string, html: URL | readonly URL[] | undefined, css: URL | readonly URL[] | undefined,
): { html?: string; family: string[]; css: string[]; ownHtml?: string } {
  const given = own.get(tag);
  const list = [html ?? []].flat();
  const mine = list.at(-1);
  const markup = given?.html ?? mine?.href;
  return {
    ...(markup ? { html: markup } : {}),
    ...(given?.html && mine ? { ownHtml: mine.href } : {}),
    family: list.slice(0, -1).map((u) => u.href),
    css: [...[css ?? []].flat().map((u) => u.href), ...(given?.css ?? [])],
  };
}

/** A family's markup files, each on its own: one that fails is said and left out. TRAP T-shared-sheets-settle-independently */
export async function loadFamily(urls: readonly string[]): Promise<void> {
  const results = await Promise.allSettled(urls.map(loadTemplates));
  results.forEach((r, i) => {
    if (r.status === 'rejected') report({ code: 'template-failed', message: `A family template did not load: ${String(r.reason)}`, at: { url: urls[i]! } });
  });
}

/** Each family file's first template, in order; one not loaded adds nothing. */
export function familyBody(urls: readonly string[]): string {
  return urls.map((u) => { const t = templateCache.get(u); return t ? templateBody(t.map, t.html, null)[0] : ''; }).join('');
}
```

**`sherpa-element.ts`:**
- `:229` becomes `static html?: URL | readonly URL[];`, with the doc "or a LIST: a family's markup first, its own last."
- `#files()` (`:894`) returns the new shape.
- `#bootstrap` `:845` becomes `[, html] = await Promise.all([styling, markup, loadFamily(files.family)]);`. `loadFamily` never rejects, so `T-rendered-settles-even-when-the-markup-does-not` still holds.
- [FIXED] `#stamp` `:929` becomes `this.root.innerHTML = ownHtml(body + familyBody(this.#files().family));`. Why: one site serves the first stamp, a reload and a variant re-stamp. `:853`, `:920` and `:976` do not change.
- The static `onReload` (`:262`) adds `|| files.family.some((u) => changed.has(u))`.
- `reload()` (`:278`) adds `for (const f of files.family) html.add(f);`. The Demos dev server sends `*` for a change outside `components/sherpa-*/`, so `reload()` with no tag reaches the family file.

**What does not change:**
- `useTemplate(tag, {html})` still replaces only the component's own file.
- `checkOwnTemplate` still checks only the own file.

**Build:** `inlineFiles` (`build-reforged.mjs:99`) inlines `new URL('../x.html', import.meta.url)`. `copyAssets` copies every `.html`. `more-menu.js` gains an import of `templater.js`, which is fine on a server (`T-a-component-imports-anywhere`).

**Gates to update, in the same commit** [FIXED: the hook fails without these]:
- `scripts/check-traps.mjs`: add `'src/core/*.html'` to `SOURCES`. Add `/^src\/core\/sherpa-filter-/` to the Filters entry of `AREAS`. Filters comes before the shared-sheets area, so it wins. Then run `npm run traps:write`.
- `scripts/check-size.mjs` `SOURCES`: add `'src/core/sherpa-filter-*.css'` and `'src/core/*.html'`.
- `scripts/lint-css.mjs:234`: `/^sherpa-(chart|container|filter)-.+\.css$/`.
- `scripts/roundtrip-component.mjs:53`: `/static override html = [^;]*new URL\('(\.\/[^']+\.html)'/`, so a list still finds the own file. This is not a gate, but it would report no html.

### G2. `word(key)`: a word from the markup that TS passes on as data

**In `SherpaElement` only** [FIXED: no templater export is needed]:
```ts
/** Words its markup lacks, said once. */
const MISSING_WORDS = new Set<string>();

/** A word from its markup — a `[data-word]` in a `<template>` of the stamped tree — for
 *  text it hands on as data, or an attribute CSS cannot swap. TRAP T-a-word-is-in-the-markup */
protected word(key: string): string {
  for (const tpl of this.$$<HTMLTemplateElement>('template')) {
    const hit = tpl.content.querySelector(`[data-word="${key}"]`);
    if (hit) return hit.textContent?.trim() ?? '';
  }
  const said = `${this.localName}:${key}`;
  if (!MISSING_WORDS.has(said)) {
    MISSING_WORDS.add(said);
    report({ code: 'word-missing', message: `<${this.localName}>'s markup has no word "${key}".`, at: { tag: this.localName, key } });
  }
  return '';
}
```

**Markup:** `<template class="words"><span data-word="x">…</span></template>`. [FIXED] It is named `words`, not `words-tpl`, because it is never cloned, and `-tpl` means a prototype. A word that already sits in a prototype is tagged where it is.

**`checkOwnTemplate`:** in `anatomy()`, collect `word=<key>` from the content of nested `<template>`s ONLY. Then a consumer's translation that lacks a word is reported. [FIXED] Walking all of a nested template's content would also report missing classes in prototypes, which would be new reports for existing consumer templates.

**Sites it serves:**
- In 3b(c): the filter-panel words, sherpa-menu `select` and provider `view`.
- Outside 3b: the toolbar's `'Group'`/`'Sort'`, nav's `'Settings'`, the star's aria-labels, app-header's theme toggle label, provider-mode's toggle labels and input-text's placeholders.

### G3. A content prop's default is its markup's

**The trap today:** `#syncProp` (`sherpa-element.ts:1047`) writes `''` when the attribute is absent and there is no `default`. That erases the markup's text, so the default has to be typed in TS.

**The change:**
```ts
/** Each content prop's default, as its markup was stamped: the target's text, or its own attribute. */
#markup = new Map<string, string>();

#readMarkup(): void {
  this.#markup.clear();
  for (const [name, def] of Object.entries((this.constructor as typeof SherpaElement).props)) {
    if (def.kind !== 'content' || !def.to || def.type !== 'string' || def.as === 'icon') continue;
    const el = this.$(def.to);
    const said = def.as === 'attr' ? el?.getAttribute(name) : el?.textContent?.trim();
    if (said) this.#markup.set(name, said);
  }
}
```
- In `#stamp`, call `this.#readMarkup()` after the `innerHTML` write and before `#syncAllProps()`. A re-stamp reads its own tree again.
- In `#syncProp`:
  - `const given = raw ?? this.#markup.get(name) ?? null;`
  - The text path uses `given ?? ''`.
  - The `as:'attr'` branch: `if (given == null) el.removeAttribute(name); else el.setAttribute(name, given);`
  - Numbers: `coerceNum(raw, NaN)`.
- [FIXED] `as: 'attr'` is included. It serves the panel's `'Filters'` (see c). The other two `as:'attr'` props are dialog `:23` and panel `:19`. Their `.heading` targets carry no `data-heading` in markup, so nothing changes for them.
- [FIXED] **Audit, done.** I scanned all 82 string content props in `src/components`. Only app-header's `.ai-label` has markup text. Transfer-list's two targets are empty today; 3a adds their words. Nothing else shows new text.
- [FIXED] **`PropDef.default`.** After app-header (3b) and transfer-list (3a) move, it has no user: no number prop uses it. Delete it (`sherpa-element.ts:73-74`, `:1047`, `:1050`) in the same change as 3a. Until then, keep it. G3 is shared with 3a, so land it once.

---

## a) The ⋮ (more) menu rows

### 1. Current code

- `more-menu.ts:22`: `export type MoreRow = readonly [value: string, label: string, disabled?: boolean];`
- `:34-35`: `[reset, 'Reset filters', …]` and `['reset-default', 'Reset all to default', …]`.
- `:54-55`: `['filters-save', 'Save filters'], ['filters-save-as', 'Save filters as']`, then `['filters-delete', 'Delete filters']` while a set is on.
- `:61`: a page button's row takes the button's `aria-label ?? textContent`. That is page data, and it stays.
- `:72-97`: each row is cloned from `more-item-tpl` and then labelled. The Hide row is a clone of the Limit row: `box.value = 'hide-unmatched'` and `'Hide unmatching filters'` (`:89-91`).
- `sherpa-quick-filter-toolbar.ts:1560-1569`: `['ai','Suggest filters']`, `'Remove from Favorites' : 'Favorite'`, `['save','Save view'], ['save-as','Save view as']`, `['delete-view','Delete view']`, `['refresh','Refresh view']`. The toolbar passes `resetRows(this, 'clear')` (`:1561`).
- `sherpa-filter-panel.ts:1694-1697`: `resetRows(this, 'reset')` and `saveRows(…)`.
- **Prototypes, copied in both hosts:** toolbar html `:179-189` and panel html `:146-154` hold `.more-menu`, `more-item-tpl`, `more-divider-tpl` and `more-check-tpl`.
- **CSS, copied byte for byte:** `.more-item`, `:hover`, `:focus-visible` and `.more-divider` are at toolbar css `:230-255` and panel css `:42-64`. No other host rule touches `.more-*` or `.menu-row`.

### 2. Why it is in TS today

- 196 stage 4 (`5d59b3bd`) made one ⋮ menu for both hosts. The rows travel as `[value, label, disabled]`, so page buttons (whose names are data) and built-in rows share one path.
- 205 (`f163da9a`) added Hide by cloning the Limit row.
- TRAP T-the-more-menu-holds-what-folded asks for the order and for "built on each open". It does not ask for words in TS.
- The tests assert words and order, not where the words live.

### 3. The change

The open ⋮ menu's DOM stays the same: same classes, same order, same dividers.

**New `src/core/sherpa-filter-more.html`:**
```html
<!-- The ⋮ menu a filter bar and the filter panel share; a host lists it first. TRAP T-the-more-menu-holds-what-folded -->
<template id="default">
  <sherpa-menu class="more-menu" data-align="end"></sherpa-menu>
  <!-- A page button's row: its words are the page's. -->
  <template class="more-item-tpl"><button class="more-item" type="button"><span class="more-label"></span></button></template>
  <template class="more-divider-tpl"><hr class="more-divider" /></template>
  <!-- The rows both hosts draw, by value; a host's own are in its own more-rows-tpl. -->
  <template class="more-rows-tpl">
    <button class="more-item" type="button" value="reset"><span class="more-label">Reset filters</span></button>
    <button class="more-item" type="button" value="reset-default"><span class="more-label">Reset all to default</span></button>
    <button class="more-item" type="button" value="filters-save"><span class="more-label">Save filters</span></button>
    <button class="more-item" type="button" value="filters-save-as"><span class="more-label">Save filters as</span></button>
    <button class="more-item" type="button" value="filters-delete"><span class="more-label">Delete filters</span></button>
    <!-- SWITCH rows, as a filter's menu draws one. Will, TODO 178 and 205. -->
    <label class="menu-row more-check"><input type="checkbox" value="limit-options" /><span class="menu-row-label">Limit to matching filters</span></label>
    <label class="menu-row more-check"><input type="checkbox" value="hide-unmatched" /><span class="menu-row-label">Hide unmatching filters</span></label>
  </template>
</template>
```

**New `src/core/sherpa-filter-more.css`:**
- Header: `/* sherpa-filter-more.css — the ⋮ menu's rows, adopted first by the filter bar and the filter panel. */`
- Then the four rules verbatim from toolbar css `:230-255`, with their comment "real <button>s … TRAP T-the-more-menu-holds-what-folded".
- Delete the rules from toolbar css `:230-255` and panel css `:42-64`. Toolbar css still cites the TRAP at `:152`, and panel css at `:18`.

**Toolbar html:** delete `:179-189` and add:
```html
  <!-- The ⋮ rows only a bar draws; the shared ones are sherpa-filter-more.html's. TRAP T-the-more-menu-holds-what-folded -->
  <template class="more-rows-tpl">
    <button class="more-item" type="button" value="ai"><span class="more-label">Suggest filters</span></button>
    <button class="more-item" type="button" value="favourite"><span class="more-label">Favorite</span></button>
    <button class="more-item" type="button" value="unfavourite"><span class="more-label">Remove from Favorites</span></button>
    <button class="more-item" type="button" value="save"><span class="more-label">Save view</span></button>
    <button class="more-item" type="button" value="save-as"><span class="more-label">Save view as</span></button>
    <button class="more-item" type="button" value="delete-view"><span class="more-label">Delete view</span></button>
    <button class="more-item" type="button" value="refresh"><span class="more-label">Refresh view</span></button>
  </template>
```

**Panel html:** delete `:146-154`. It still cites the TRAP at `:120`.

**`more-menu.ts`:** add `import { report } from '../data/report.js';`, then:
```ts
/** One ⋮ row: the value of its prototype in a `template.more-rows-tpl`, and whether it is off. */
export type MoreRow = readonly [value: string, disabled?: boolean];
/** The ⋮ menu's own markup and sheet: a host lists each FIRST, its own last. */
export const MORE_MENU = {
  html: new URL('../sherpa-filter-more.html', import.meta.url),
  css: new URL('../sherpa-filter-more.css', import.meta.url),
} as const;
export function resetRows(host: HTMLElement): MoreRow[] {
  return [['reset', host.hasAttribute('data-nothing-to-reset')], ['reset-default', host.hasAttribute('data-at-default')]];
}
export function saveRows(host: HTMLElement, setOn: boolean): MoreRow[] {
  if (!host.hasAttribute('data-saveable')) return [];
  return [['filters-save'], ['filters-save-as'], ...(setOn ? [['filters-delete'] as MoreRow] : [])];
}
export function extraRows(host: HTMLElement): MoreRow[] {
  return extras(host).flatMap((extra, i): MoreRow[] => (folded(extra) ? [[`${EXTRA}${i}`]] : []));
}
export function openMore(host: HTMLElement, root: ParentNode, trigger: HTMLElement, groups: readonly MoreRow[][]): void {
  const menu = root.querySelector<SherpaMenu>('.more-menu');
  const divider = cloneFirst(root, 'template.more-divider-tpl');
  if (!menu || !divider) return;
  const drawn = groups.map((rows) => rows.flatMap(([value, disabled]) => {
    const one = value.startsWith(EXTRA) ? pageRow(host, root, value) : row(root, value);
    one?.toggleAttribute('disabled', !!disabled);
    return one ? [one] : [];
  }));
  const limit = host.dataset['limitOptions'];
  if (limit) {
    // …and while Limit is on, whether what it rules out is shown at all. Will, TODO 205.
    drawn.push([check(root, 'limit-options', limit === 'on'),
      ...(limit === 'on' ? [check(root, 'hide-unmatched', host.dataset['hideUnmatched'] === 'on')] : [])]
      .filter((n): n is HTMLElement => !!n));
  }
  menu.replaceChildren(...drawn.filter((g) => g.length)
    .flatMap((g, i) => (i ? [divider.cloneNode(true) as HTMLElement, ...g] : g)));
  menu.show?.(trigger);
}
/** A row's prototype, by value, from any more-rows-tpl: the family's or its host's own. */
function row(root: ParentNode, value: string): HTMLElement | null {
  for (const tpl of root.querySelectorAll<HTMLTemplateElement>('template.more-rows-tpl')) {
    const hit = tpl.content.querySelector(`[value="${value}"]`)?.closest('.more-item, .more-check');
    if (hit) return hit.cloneNode(true) as HTMLElement;
  }
  report({ code: 'more-row-missing', message: `No ⋮ row "${value}" in the markup.`, at: { value } });
  return null;
}
function check(root: ParentNode, value: string, on: boolean): HTMLElement | null {
  const one = row(root, value);
  const box = one?.querySelector('input');
  if (box) box.checked = on;
  return one;
}
function pageRow(host: HTMLElement, root: ParentNode, value: string): HTMLElement | null {
  const extra = extras(host)[Number(value.slice(EXTRA.length))];
  const one = cloneFirst(root, 'template.more-item-tpl');
  if (!extra || !one) return null;
  one.setAttribute('value', value);
  one.querySelector('.more-label')!.textContent = extra.getAttribute('aria-label') ?? extra.textContent?.trim() ?? '';
  return one;
}
function cloneFirst(root: ParentNode, sel: string): HTMLElement | null {
  return (root.querySelector<HTMLTemplateElement>(sel)?.content.firstElementChild?.cloneNode(true) as HTMLElement) ?? null;
}
```
- `folded`, `syncResets`, `hidesUnmatched`, `pickMore` and `askSwitches` do not change.
- The rows are plain HTML with no `sherpa-*` tags, so `cloneNode` is safe, as it is today.

**Toolbar TS:**
- `:56` becomes `static override css = [MORE_MENU.css, new URL('./sherpa-quick-filter-toolbar.css', import.meta.url)];`
- `:57` becomes `static override html = [MORE_MENU.html, new URL('./sherpa-quick-filter-toolbar.html', import.meta.url)];`
- `#openMore` (`:1557-1573`):
```ts
    if (folded(act('ai'))) first.push(['ai']);
    if (folded(act('clear'))) first.push(...resetRows(this));
    first.push(...extraRows(this));
    const view: MoreRow[] = [];
    if (this.dataset['type'] === 'view' && folded(this.$('.view-group'))) {
      view.push([this.hasAttribute('data-favourite') ? 'unfavourite' : 'favourite'], ['save'], ['save-as']);
      if (this.hasAttribute('data-custom-view')) view.push(['delete-view']);
    }
    if (folded(act('refresh'))) view.push(['refresh']);
    openMore(this, this.root, trigger, [first, saveRows(this, !!this.#saved.on), view]);
```
- `#act` (`:1509`): add `case 'reset':` beside `case 'clear':`, and `case 'unfavourite':` beside `case 'favourite':`. `#onMenuSelect` (`:970`) ignores both values, because it acts only inside `.view-more`, `.reset-more`, or on `remove`.

**Panel TS:**
- `:108-109` use the same `[MORE_MENU.css, …]` and `[MORE_MENU.html, …]` lists.
- `:1694` becomes `resetRows(this)`.
- `#onMore` (`:1726`) does not change; it already handles `'reset'`.

**Options rejected:**
- "The helper fetches its own file": the open becomes async, and `reload()` never reaches the file.
- "One host's template": two shadow roots cannot share it.
- [FIXED, newly listed] "A new `sherpa-more-menu` component": it needs a spec, an example, a Figma node and an a11y baseline. It must also re-emit every menu event, because an inner event stops at its host. The host-only rows would then need a path into it.

### 4. Behaviour change

Nothing visible.

- The ⋮ menu's internal row values change: the bar's Reset row goes from `clear` to `reset`, and the starred row goes from `favourite` to `unfavourite`. `#act` maps both. The ⋮ menu's `menu-select` stops at the host (T-an-inner-event-stops-at-its-host), so no public event changes.
- Internal API: `resetRows(host)` loses its second parameter, and `MoreRow` loses its label. Both are used only by the two hosts.
- The bar and panel specs lose the ⋮ nodes from their anatomy. A consumer's own template no longer needs the ⋮ markup.
- A consumer cannot replace the shared ⋮ words. It can replace the bar-only ones, which is more than today, when all of them are in TS.
- A consumer template that still holds the old ⋮ markup gets two `.more-menu`s. Theirs comes first and still works.
- New report codes: `more-row-missing` and `template-failed` with `{ url }`.

### 5. Tests

These cover it and do not change:
- `reforged-quick-filter-toolbar.spec.ts:342` (order, words, picks by text) and `:432` (names in the a11y tree; rows inside `<template>` are not in it).
- `reforged-filter-panel-component.spec.ts:841`, `:877`.
- `reforged-provider-saves-filters.spec.ts:175-176`.
- `phone.spec.ts:88`.
- `reforged-reset-to-default.spec.ts`, `reforged-reset-at-default.spec.ts`.
- Demos: `reforged-limit-options.spec.ts:162-205`, `reforged-saved-filter.spec.ts:77`.

Queued. Running tests is Will's call (10-15 rule):
- `reforged-templater.spec.ts`: "a family's markup is stamped after the own, again on a re-stamp and on `reload()`, and a family file that fails is left out and reported". [FIXED] Use a test class with `static html = [new URL('./fam.html', location.href), new URL('./own.html', location.href)]`, as `reforged-bootstrap-failure.spec.ts:34` does. `npm test` builds with inlining, so a real component never fetches.
- [FIXED] "the bar's ⋮ Reset filters row clears, and its ★ row toggles from both states". No test clicks either row today, so the new `case 'reset'` and `case 'unfavourite'` are untested.

### 6. Docs

- CLAUDE.md "A FAMILY sheet is the fourth kind": add family MARKUP and the fifth sheet, `sherpa-filter-more.css`, and say `static html` may be a list.
- `docs/PRINCIPLES.md:53`, `docs/DEF-TO-FIGMA-BUILD-RULES.md:134-136`.
- TRAPS T-the-more-menu-holds-what-folded:
  - Add `Site:` lines for `src/core/sherpa-filter-more.html` and `.css`. Keep the four host sites; each still cites the TRAP.
  - Say its words are markup.
  - [FIXED] Fix "Limit matching filters" at `:1879`.
- TRAPS T-a-templater-owns-the-files: add family markup.
- `npm run traps:write`.
- Code map for `more-menu.ts` (`MoreRow`, `resetRows`, `saveRows`, `extraRows`, new `MORE_MENU`) and `templater.ts` (`filesFor`, `loadFamily`, `familyBody`).
- Regenerate both specs, then run `npm run manifest` and `npm run reference`.

### 7. Risks

- A dev build fetches one more file, in parallel, before the first stamp. A built package fetches nothing.
- The family CSS now comes before the host's own sheet. No host rule touches these classes.
- `check:weight` may move a little for the bar, panel and `sherpa-ui` entries. Record it on purpose.
- [FIXED] `check:size` blocks the growth in `sherpa-element.ts`, `templater.ts` and `more-menu.ts`. Record it with `--update-baseline`, on purpose.
- The spec generator reads `<name>.html` only. That is the intent: family markup is not the component's anatomy.
- [FIXED] MCP `sherpa://component/{name}/html` does not serve the family file. A consumer no longer needs it.
- Possible, not checked in pixels: a disabled `.more-item` may look enabled. The host's `.more-item { color }` beats the menu's `::slotted(:disabled)`. This is an existing bug, not 3b's.

---

## b) The nav's default rows, and outlet-nav

### 1. Current code

- `sherpa-nav.ts:61-65`: `DEFAULT_QUICK` = Home / Recent / Favorites, each with an icon.
- `:277`: `this.#config.quickItems ?? DEFAULT_QUICK`.
- `#buildRows` (`:313-344`) draws every row from `item-tpl`. `:321` is `item.dataset['label'] = entry.label`.
- Rows are drawn only when `#hasContent()` (`:248`) is true. `quickItems: []` means no quick rows. Settings shows none.
- `outlet-nav.ts:173-174` types Recent and Favorites again, so it can hang session `children` on them (`refresh()`, `:97-113`).

### 2. Why it is in TS today

- The nav has one drawing path: NavEntry data goes through `#buildRows`. The defaults were written as the same data.
- outlet-nav repeats two of the rows to hang children on them. Home takes the app's label.

### 3. The change

**`sherpa-nav.html`, after `item-tpl` (`:107`):**
```html
  <!-- The quick rows a nav opens with, unless config.quickItems names its own;
       a quick row given only an id takes its words and glyph from here. -->
  <template class="quick-default-tpl">
    <li data-id="home" data-icon="home">Home</li>
    <li data-id="recent" data-icon="ccw-circle-arrow-w-clock">Recent</li>
    <li data-id="favorites" data-icon="star">Favorites</li>
  </template>
```
In the header comment: `:11` gains "a row of only an id takes its words". [FIXED] `:15` also gains a `quickItems` line: `QuickEntry = NavEntry with label? — left out, the nav's own row of that id`.

**`sherpa-nav.ts`:**
- Delete `:60-65`.
- [FIXED] `NavEntry.label` stays required. Add:
```ts
/** A quick row: a NavEntry whose label may be left out — it is then the nav's own default row of that id. */
export type QuickEntry = Omit<NavEntry, 'label'> & { label?: string };
```
- `NavConfig.quickItems?: QuickEntry[]`.
- Export `QuickEntry` from `src/components.ts` beside `NavEntry`.
- `#renderQuick` (`:277`) becomes:
```ts
    const defaults = this.#defaultQuick();
    // A quick row of only an id takes its default's words and glyph.
    const quick = this.#config.quickItems?.map((e): NavEntry => {
      if (e.label != null) return e as NavEntry;
      const base = defaults.find((d) => d.id === e.id);
      if (!base) report({ code: 'nav-row-unnamed', message: `sherpa-nav: quick row "${e.id}" has no label and no default.`, at: { id: e.id } });
      return { ...e, label: base?.label ?? '', ...(e.icon ?? base?.icon ? { icon: e.icon ?? base?.icon } : {}) };
    }) ?? defaults;
```
[FIXED] The label is set last, so an explicit `label: undefined` cannot erase it. A row with no label and no default is said, not left blank.
- Add the reader:
```ts
  /** The quick rows its markup holds, as data. */
  #defaultQuick(): NavEntry[] {
    const rows = this.$<HTMLTemplateElement>('template.quick-default-tpl')?.content.querySelectorAll<HTMLElement>('[data-id]') ?? [];
    return [...rows].map((r) => ({ id: r.dataset['id']!, label: r.textContent?.trim() ?? '', ...(r.dataset['icon'] ? { icon: r.dataset['icon'] } : {}) }));
  }
```
- `#buildRows` `:321` does not change, because the label is still a string.

**`outlet-nav.ts`:**
- `:173-174` become `{ id: 'recent' }, { id: 'favorites' },`, with the comment `// The nav's own Recent and Favorites rows: their words are its markup's.`
- `#rows()` (`:187`) returns `QuickEntry[]`. NavEntry is assignable to it.
- `#rowFor` returns `QuickEntry | undefined`.
- `#viewRows(row: { id: string }, …)`.
- Each of these reads only `id`, `href` or `children`. `type-check` lists them.

### 4. Behaviour change

Nothing visible.
- API: `NavConfig.quickItems` takes `QuickEntry[]`, which is looser for writers. `NavEntry` does not change.
- New rule: a quick row of only an id borrows the default row's words and glyph.
- New report: `nav-row-unnamed`.

### 5. Tests

These cover it and do not change:
- `reforged-nav.spec.ts:440` (`['Home','Recent','Favorites']`).
- The `quickItems: []` cases.
- `reforged-outlet.spec.ts:105-131`.
- `phone.spec.ts`.
- Demos `reforged-nav-favorites-recents.spec.ts`.

Queued: "a quick row given only an id takes the nav's words and glyph; one with a label keeps its own; one with neither is reported".

### 6. Docs

- The nav html header (`:11`, `:15`).
- Regenerate `sherpa-nav.component.json`, then run `npm run manifest` and `npm run reference`.
- Code map lines for `NavEntry`, `QuickEntry` and `NavConfig`.
- T-the-outlet-keeps-the-nav is still true.

### 7. Risks

- The prototype holds plain `<li>`s inside a `<template>`. `upgradeIcons` never enters template content, so `data-icon` there is only read.
- `#defaultQuick` runs inside a render, after the stamp.
- A consumer's own nav template without `quick-default-tpl` draws no default rows. `checkOwnTemplate` reports the missing class.

---

## c) Other fixed English

| Site | Verdict | Change |
|---|---|---|
| `sherpa-filter-panel.ts:562` `'Organise'`, `:566` `'Group by' : 'Sort by'`, `:592` `'Presets'` | Default UI text. Each goes into a section title or a FilterDef as data. | In the panel html default template add `<template class="words"><span data-word="organise">Organise</span><span data-word="group">Group by</span><span data-word="sort">Sort by</span><span data-word="presets">Presets</span></template>`. TS: `this.#drawSection('organise', this.word('organise'))`, `label: this.word(kind)`, `label: this.word('presets')`. |
| [FIXED, missed] `sherpa-filter-panel.ts:514` `this.dataset['heading'] ?? 'Filters'` | Default text in TS: the same pattern as app-header. | Use G3 with `as:'attr'`. Html `:78`: `<sherpa-container-header slot="header" class="head" part="head" data-icon="filter" data-heading="Filters">`. Prop `:128` becomes `'data-heading': { type: 'string', kind: 'content', to: '.head', as: 'attr' }`. Reword the comment at `:124-127` to "passed on as an attribute, never as text" and keep `TRAP T-a-composed-child-takes-an-attribute-not-text`. Delete `#syncHeading` (`:512-515`) and its calls at `:217` and `:223`. |
| `sherpa-menu.ts:591-594` `join?.populate?.([{and,And},{or,Or}])` | A fixed list. | Children as data (`sherpa-input-text.ts:110`, T-a-list-takes-its-children-as-data). At `sherpa-menu.html:335`: `<sherpa-input-text class="join" …><option value="and">And</option><option value="or">Or</option></sherpa-input-text>`. Delete the populate call. `join.value = 'or'` still takes the held-value path: the children are read after render, as populate is. The select template has only `slot name="actions"`, so the options are never slotted or drawn. |
| `sherpa-menu.ts:722` `'Select…'` | Default UI text. | In `<template id="filter">`: `<template class="words"><span data-word="select">Select…</span></template>`. TS: `[{ value: '', label: this.word('select') }, ...values]`. [FIXED] In `#refillPicks` (`:1811`), add `if (!this.#rowEls().length) return;` before `#valueOptions()`. This changes no behaviour, because the loop below only touches rows. It stops a false `word-missing` on every `default` menu with value rows (`#onRowsChanged`, `:1805`). |
| `sherpa-menu.ts:2036` `label: 'Remove'` | A copy of the footer button's own text (`html:249`, `:417`). | `this.emit('menu-select', { value: 'remove', label: this.$('.remove')?.textContent?.trim() ?? '' });` |
| [FIXED, moved from extras] `sherpa-menu.ts:1761` `ALL_LABEL`, `:1793-1794` | Dead code. It writes `.qf-row-label`, but the menu's own `menu-all-tpl` (`html:199`, `:373`) uses `.menu-row-label` and already says "Select all". | Delete `ALL_LABEL` and `:1793-1794`. No `word()` is needed. |
| `provider-page.ts:352` `label: 'View'` | Default UI text. | Add `<template class="words"><span data-word="view">View</span></template>` to `sherpa-provider.html`. [FIXED] `PageHost` gains one member, `word(key: string): Promise<string>`. The host at `sherpa-provider.ts:389` passes `word: async (k) => { await this.rendered; return this.word(k); }`. In `drawBars`, set `data-custom-view` first. Then await the word ONLY in the picker branch: `const picker = scope === VIEW && library ? [{ id: VIEW_CHIP, label: await this.#host.word('view'), … }] : [];`. A View bar asked, so the provider is connected and rendering, and nothing can hang. |
| `sherpa-app-header.ts:55` `default: 'Ask N-zo'`, also in `.html:64` | Default text, written twice. | G3. Drop `default:`. The `.ai-label` text becomes the default. The spec keeps "Ask N-zo" from the header's `(default "Ask N-zo")` mark (`generate-component-spec.mjs:741-748`). |

**Why it is in TS today:**
- Each word goes into something TS builds: a FilterDef, a `populate()` list or an event detail. There was no way to read a word from the markup.
- The app-header used `default`, because a content prop with no attribute erases the markup text.
- The panel kept `data-heading` as `kind:'style'` with a hand sync. Its comment predates `as:'attr'`, which dialog and panel use.
- `ALL_LABEL` outlived a class rename.

**Behaviour change:**
- None visible.
- `SherpaMenu.ALL_LABEL`, a public static, goes away.
- A host-stamped select-all row with an empty `.qf-row-label` is no longer filled. No host does this; I checked src, tests and Demos.
- The panel spec's `data-heading` kind changes from style to content.
- `word()` and G3 are new protected and base behaviour.
- New report: `word-missing`.

**Tests.** These cover it and do not change:
- `reforged-filter-conditions.spec.ts:266-299` (reads the shadow `option`s: `['and','or']`, `['', …]`).
- `reforged-panel-filters-button.spec.ts:230` (`'Sort by'`) and `:255` (`heading: 'Filters'`).
- `reforged-menu-calendar.spec.ts:611` and `reforged-quick-filter-toolbar.spec.ts:929` (`'Remove'`).
- The view-chip cases in `reforged-provider-saves-filters.spec.ts`.
- `reforged-app-header.spec.ts`.

[FIXED] **One test must change:** `reforged-menu.spec.ts:468`. Stamp `<span class="menu-row-label">Select all</span>` in place of the empty `.qf-row-label`, and read `.qf-all .menu-row-label` at `:477`. The expectations at `:506-519` stay. They now prove the label never moves.

Queued:
- "a content prop with no attribute shows its template's text or attribute, and again once removed".
- "a word its markup lacks is reported once".
- "the panel heading: none → Filters; set → given; removed → Filters".

**Docs:**
- CLAUDE.md "Declared attributes":
  - The `default` row becomes "a string prop's default is its template's text, or with `as:'attr'` its target's attribute".
  - "Two options exist" becomes one (`all`) once 3a lands.
  - Its 'Available' and 'Ask N-zo' examples go.
- CLAUDE.md "Template rules": add the `words` / `this.word()` line.
- `DEF-TO-FIGMA-BUILD-RULES.md:64` (drop `default`).
- [FIXED] TRAPS T-empty-write-lets-css-collapse: an ABSENT attribute now writes the markup's default; only a target with none is written `''`.
- New TRAPs T-a-word-is-in-the-markup and T-a-content-prop-defaults-to-its-markup, then run `npm run traps:write`.
- T-select-all-is-not-a-value (`:4759`): "`ALL_LABEL` is 'Select all'" becomes "the row's words are its template's, and nothing rewrites them".
- T-a-composed-child-takes-an-attribute-not-text: say that `as:'attr'` is the declared form.
- Regenerate the panel, menu, provider and app-header specs, then run `npm run manifest` and `npm run reference`.
- Code map for `sherpa-element.ts` and `templater.ts`.

**Risks:**
- `word()` reads the stamped root. The provider path awaits `rendered`. The panel and menu call it inside renders.
- A word must sit in a template of the stamped variant. The menu's `select` word goes in `filter`, and the guard stops the false report in `default`.
- G3 touches every string content prop. The scan shows only app-header and the panel heading have a markup default. Transfer-list gets one in 3a.
- [FIXED] The spec carries no text, so MCP `compile_def` from a spec drops these words. The source html is the truth.
- The menu's `<option>` children are never slotted. Input-text's `<option>` markup path already ships, so the a11y gate sees this shape today.

---

## Also found in the same files (not 3b)

- `sherpa-quick-filter-toolbar.ts:1794`, `:1803`: `'Group'`, `'Sort'`. Use `this.word()`.
- `:1674`: the star's aria-label swap. Use `this.word()`.
- `sherpa-nav.ts:197` (`#applyState`): `'Settings'`. Use `this.word()`.
- [FIXED, missed] `sherpa-app-header.ts:164`: the theme toggle's `'Switch to light mode' / 'Switch to dark mode'` uses `this.word()`. Its sun/moon `data-icon-start` swap (`:163`) could be a CSS-driven pair.
- [FIXED, missed] `sherpa-filter-panel.ts:828-832`: the aria-label templates ``Reset ${name}``, ``Send ${name} to view filters`` and ``Advanced ${name}``. They need a word with a slot for the name.
- `provider-mode.ts:114`, `:120`: `'View as filter panel'` and `'Filter in the toolbars instead'`, with icons. Use two prototypes in `sherpa-provider.html`.
- `sherpa-input-text.ts:41`, `:43` [FIXED: not `:470`/`:475`]: `NUMBER_PLACEHOLDER`, `FIND_PLACEHOLDER`.
- `shared-constants.ts`: `RULED_OUT`, `SET_ASIDE`, `NOT_AVAILABLE`, `movedTo()`. Later these can go in a family words file through G1 and G2.
- `OP_LABELS` in `core/data/store.ts` is the DOM-free data layer's own vocabulary. Leave it.
- `#drawSection` (`filter-panel.ts:708-719`) clones `field-tpl`, then removes three parts. `#drawField` does the same at `:817-822`. That is structure built by removal; a `section-tpl` would fix it. Optional.

## Order of work

One commit each. Run `npm run build` after each, so Demos sees it. Update the code map last.

1. G3, with app-header and the panel heading.
2. G2 and c), with the menu test change.
3. b), the nav.
4. G1 and a), with the gate edits.

Record `check:size` growth on purpose. Tests wait for Will.

## Questions for Will

1. Some ⋮ words repeat words in the same host's markup: "Reset all to default", "Save view as", "Delete view", "Save filters as", "Delete filters" (the ▾ menu rows), and "Suggest filters" (the AI button's name).
   - **A (my pick):** keep them. Your ⋮ words stay exactly as they are.
   - **B:** a ⋮ row reads its folded control's own name. Nothing repeats, but four ⋮ words change: Reset filters → Reset all filters, Favorite → Add to Favorites, Save view → Save, Refresh view → Refresh data.
2. The bar's organise chips say "Group" / "Sort". The panel says "Group by" / "Sort by".
   - **A (my pick):** keep both as they are.
   - **B:** use one pair of words in both.