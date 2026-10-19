# Group 3a plan, checked against the code and improved: default text in TS (a) and labels that swap with state (b)

I made no edits, builds or tests. I wrote one scan script, `/private/tmp/claude-502/-Users-williammincher-Documents-My-synced-vault-Projects-sherpa-ui/38359d93-1fb6-4254-bf7e-d44922d71fbe/scratchpad/to-scan.mjs`, which lists the template text of every `to:` target.

## Critique: what the first plan got wrong or missed

1. **The build changes text whitespace.** `scripts/build-reforged.mjs:94` `lean()` strips indents (`.replace(/\n[ \t]+/g, '\n')`), but only in the inlined build. Without a trim, captured text differs between a dev build and a production build. A blank-but-indented target would also stop matching `:empty`, which TRAP `T-empty-write-lets-css-collapse` depends on.
2. **Spec generator `nodeAt`.** It must skip `<template class>` prototypes, because `this.$()` never matches inside them. It must also return nothing for `as: 'icon'`.
3. **`check:size` scope.** It does not count `scripts/` (`check-size.mjs` SOURCES), so `html-structure.mjs` is not gated. It does count each component `.html`, and five of them grow.
4. **A TRAP that must change.** `T-a-composed-child-takes-an-attribute-not-text` (TRAPS.md:10206) tells the reader to "declare `kind: 'style'` and pass it along in a sync method". The filter-panel change makes that advice wrong, so the TRAP must be reworded too.
5. **Docs missed:**
   - `DEF-TO-FIGMA-BUILD-RULES.md:153-154` says a default is read from the header mark.
   - TRAP `T-a-templater-owns-the-files` (16206) lists what a consumer template is checked for. The new `swap=` key must be added.
   - `sherpa-element.ts:368` says "it fires exactly once". That is not true.
6. **Header parens.** Deleting a paren is not optional. If the generator reads the template, keep one source. Delete the paren only where the prop has a `to`. Notifications' `data-empty` has no `to`, so its paren stays.
7. **Line numbers:**
   - container-header toggle is at `.html:42-44`, not 43-45.
   - filter-panel's `#syncHeading` calls are at 217 and 222, not 223.
8. **`check-usage` placement.** The first plan put `data-swap-*` into `placed`, which means "set by the parent". A separate `directive` flag says what it is.
9. **`swap.ts` gaps:**
   - Nothing stops a target from overwriting another `data-swap-*` attribute.
   - Nothing stops writing `text` on a `<script>`, which is a Trusted Types sink.
   - Text "own" values were not trimmed (same reason as point 1).
   - Writes were not skipped when the value is already the same.
10. **More sites the swap serves, optional:**
    - app-header `#syncOpen` (`data-open` follows `data-notifications-open`).
    - `sherpa-list-item.ts:69` (`aria-expanded` follows `data-expanded`).
11. **One more default-text site, not in this group:** `sherpa-menu.ts:1570` `|| 'Menu'`. I recorded it for the menu group.
12. **Checked and found right:**
    - All six followed attributes are declared props, so they are observed.
    - None of the swapped attributes has a second writer. `sherpa-button` writes none of them itself.
    - No test asserts the old way.
    - The spec round-trip compares structure and attributes, never text.
    - Reference pages and the manifest read parts only.
    - Demos, Gallery and Starter use no `useTemplate`, and no consumer component uses `default:`.

---

# The improved plan

## (a) The template's text is the default; delete `PropDef.default`

### 1. Current code
- `src/components/sherpa-transfer-list/sherpa-transfer-list.ts:27-28`:
  - `'data-source-heading': { type: 'string', kind: 'content', to: '.source .pane-heading', default: 'Available' },`
  - the same with `'Selected'`.
  - The template's `<h3 class="pane-heading" … id="source-heading"></h3>` (line 16) and `id="target-heading"` (line 30) are empty.
- `src/components/sherpa-app-header/sherpa-app-header.ts:55`:
  - `'data-ai-label': { type: 'string', kind: 'content', to: '.ai-label', default: 'Ask N-zo' },`
  - The `.html:64` already holds `<span class="ai-label">Ask N-zo</span>`.
- `src/core/ui/sherpa-element.ts`:
  - 73-74: `default?: string | number | boolean;`
  - `#syncProp` 1043-1062 writes `raw ?? fallback`, and the fallback is `''` when there is no `default`. So any text in a `to` target is erased on every stamp.
  - The `#syncAllProps` comment at 1064 says "Runs once". Line 368 says "it fires exactly once". Both are wrong, because a re-stamp or a reload runs both again.
- `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`:
  - 513-515: `this.$('.head')?.setAttribute('data-heading', this.dataset['heading'] ?? 'Filters');`
  - called at 217 and 222. The prop is `kind: 'style'` (128).
- `src/components/sherpa-notifications/sherpa-notifications.ts:136`:
  - `empty.textContent = this.dataset['empty'] ?? 'No notifications';`
  - The prototype at `.html:60` is `<p class="empty" role="status"></p>`.

My scan of all 59 `to:` targets found every target empty in its template except `.ai-label`. (The scan also flagged `app-header .title`, but that hit was `.title-row`; the real `<h1 class="title">` is empty.)

### 2. Why it is in TS
- `fd30d49c` added `static props`. Its write treats absent, empty and missing as `''` (TRAP `T-empty-write-lets-css-collapse`). That erases template text, so a real default had to live in TS (`4171a2dd`).
- Filter-panel follows TRAP `T-a-composed-child-takes-an-attribute-not-text`: text written into a composed child erases that child's children. That TRAP was written before `as: 'attr'` existed, and dialog and panel use `as: 'attr'` now.
- No test asserts any of these defaults.

### 3. Change

**`src/core/ui/sherpa-element.ts`**
- Delete lines 73-74 (`default`).
- Add these members. [FIXED] The capture trims, and blank counts as none, so dev and prod agree and `:empty` still collapses.
  ```ts
  /** Each `content` target's own value as stamped. TRAP T-the-templates-text-is-the-default */
  #own = new WeakMap<Element, string | null>();

  /** Read what the template put in each `content` target, before props write. */
  #readOwn(): void {
    for (const [name, def] of Object.entries((this.constructor as typeof SherpaElement).props)) {
      if (def.kind !== 'content' || !def.to) continue;
      // Trimmed: the build strips indents. Blank is none, so `:empty` still collapses.
      for (const el of this.$$(def.to)) this.#own.set(el, def.as === 'attr' ? el.getAttribute(name) : el.textContent?.trim() || null);
    }
  }
  ```
  - The capture runs eagerly in `#stamp`, not lazily inside `#syncProp`. A lazy capture could take text from an element that is cloned in later.
- In `#stamp`, add `this.#readOwn();` right after `this.#hasRendered = true;` and before `this.#syncAllProps();`.
- Replace the body of `#syncProp`. The doc comment keeps `TRAP T-empty-write-lets-css-collapse`.
  ```ts
  if (def.kind !== 'content' || !def.to) return;
  const raw = this.getAttribute(name);
  // Never a box that holds a <slot>: the text would erase it. TRAP T-slot-guards-only-when-filled
  for (const el of def.all ? this.$$(def.to) : [this.$(def.to)]) {
    if (!el) continue;
    // Absent: the template's own comes back. TRAP T-the-templates-text-is-the-default
    const value = raw ?? this.#own.get(el) ?? null;
    if (def.as === 'attr') {
      if (value == null) el.removeAttribute(name);
      else el.setAttribute(name, value);
      continue;
    }
    const text = raw != null && def.type === 'number' ? String(coerceNum(raw, NaN)) : (value ?? '');
    if (def.as === 'icon') this.writeIcon(el, text);
    else el.textContent = text === 'NaN' ? '' : text;
  }
  ```
- Line 1064: "Write every declared `content` prop. Runs on each stamp."
- Line 368: "Has the first stamp run." [FIXED] The new capture depends on per-stamp runs, so the comment must not say "once".

**Components**
- transfer-list:
  - `.ts:27-28`: delete `, default: 'Available'` and `, default: 'Selected'`.
  - `.html:16`: `<h3 class="pane-heading" part="heading" id="source-heading">Available</h3>`
  - `.html:30`: the same with `Selected`.
- app-header `.ts:55`: delete `, default: 'Ask N-zo'`.
- filter-panel (same break, missed by the sweep):
  - `.ts:124-128` becomes:
    ```ts
    /* An ATTRIBUTE, passed to the composed header: text would replace its children. TRAP T-a-composed-child-takes-an-attribute-not-text */
    'data-heading': { type: 'string', kind: 'content', to: '.head', as: 'attr' },
    ```
  - `.html:78-79`: add `data-heading="Filters"` to `<sherpa-container-header slot="header" class="head" part="head" data-icon="filter">`.
  - Delete `#syncHeading` (512-515), its call at 217, and the `else if (name === 'data-heading')` branch at 222. The chain has no final `else`, so removing a middle branch is safe.
  - This also ends a breach of PRINCIPLES rule 9: a `kind: style` prop with a JS branch.
- notifications:
  - `.html:60`: `<p class="empty" role="status">No notifications</p>`
  - `.ts:136`: `empty.textContent = this.dataset['empty'] ?? empty.textContent;` [FIXED] One line instead of a new local and an `if`.

**Generator: the spec reads the default from the template (recommended)**
- `scripts/lib/ts-facts.mjs` `declOf`:
  - Line 185 becomes `else if (key === 'to') { to = true; if (ts.isStringLiteralLike(v)) out.to = v.text; }`
  - Add `else if (key === 'as' && ts.isStringLiteralLike(v)) out.as = v.text;`
  - Delete the `default` branch (190-194).
  - Lines 15, 91 and 99 read "kind, type, values, `to` and `as`", and the `@returns` type matches.
- `scripts/lib/html-structure.mjs`:
  - In `parseNodes`, line 145 becomes `nodes.push({ tag, attrs, children: parseNodes(childSrc), text: textOf(childSrc) });`
  - Add `function textOf(src) { return src.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }`
  - Add this export. [FIXED] It skips prototypes, as `querySelector` does.
    ```js
    /** The first node down a `.a .b` class chain, as `querySelector` finds it — never inside a `<template>` prototype; undefined for any other selector. */
    export function nodeAt(nodes, selector) {
      const chain = selector.trim().split(/\s+/);
      if (!chain.every((s) => /^\.[\w-]+$/.test(s))) return undefined;
      const has = (n, c) => (n.attrs?.class ?? '').split(/\s+/).includes(c.slice(1));
      const walk = (list, i) => {
        for (const n of list) {
          if (n.tag === 'template') continue;
          const j = has(n, chain[i]) ? i + 1 : i;
          if (j === chain.length) return n;
          const hit = walk(n.children ?? [], j);
          if (hit) return hit;
        }
        return undefined;
      };
      return walk(nodes, 0);
    }
    ```
  - `normNode` (158) and `htmlNodeToAnatomy` (generator:102) pick their fields by name, so `text` never reaches a spec.
- `scripts/generate-component-spec.mjs`:
  - Import `nodeAt`.
  - Replace line 741 `let def = decl.default;` with:
    ```js
    // A `to` target's own text, or (`as: 'attr'`) its attribute, is the default. TRAP T-the-templates-text-is-the-default
    const target = decl.to && defaultTree ? nodeAt(defaultTree, decl.to) : undefined;
    let def = (decl.as === 'attr' ? target?.attrs?.[nm] : decl.as === 'icon' ? undefined : target?.text) || undefined;
    if (def !== undefined && mark && !mark.none && defaultValue(mark.value, p) !== def) notes.push(`prop ${nm}: the header says ${mark.paren}, the template says "${def}"`);
    ```
  - Reword the comment at 738-739: "the template's text first, then the header's mark…".
- Header parens, deleted so there is one source [FIXED]:
  - transfer-list `.html:6-7`: drop ` (default "Available")` and `  (default "Selected")`, with their leading spaces, so each line ends at "pane".
  - app-header `.html:9`: drop ` (default "Ask N-zo")`.
  - filter-panel `.html:25`: drop ` (default "Filters")`.
  - Keep notifications' `(default "No notifications")`, because `data-empty` has no `to`.
- The specs stay the same:
  - `"Available"`, `"Selected"`, `"Ask N-zo"` and `"Filters"`, with the same descriptions. The paren is only stripped when it is said, so deleting it changes nothing.
  - The only spec change is filter-panel's `data-heading` kind: style becomes content.
- Fallback, if Will wants no generator change:
  - Keep every header paren.
  - Still delete ts-facts' `default` branch, which is dead code now.
  - Change line 741 to `let def;`.
  - The specs are again the same, but the default lives in two places in the `.html`.

### 4. Behaviour change
- None for the transfer-list headings, `.ai-label`, "Filters" or "No notifications".
- The other targets are all empty, so they still get `''`. A target cloned in later has nothing captured, so it gets `''` as today.
- `data-x=""` still writes `''`.
- Dialog and panel `as: 'attr'`: their templates have no `data-heading`, so an absent attribute still removes it.
- Filter-panel: `.head` gets `data-heading` in `#syncAllProps` (before `onRender`) instead of in `onRender`. Both run before the header renders, so nothing visible changes.
- API: `PropDef.default` is gone from an exported type. A consumer component that uses it fails type-check. Demos, Gallery and Starter have none.
- New: a consumer template given through `useTemplate` can set a target's default text. This is the way in for localisation.

### 5. Tests
- No test asserts the old way. I grepped sherpa-ui and Demos for "Available", "Selected", "Ask N-zo", `data-ai-label`, `pane-heading`, "No notifications" and `#syncHeading`.
- Queued, not to run now (Will decides when to test). In `test/e2e/reforged-num-coercion.spec.ts`, next to "props: a declared prop re-syncs", add "props: the template's own text is the default, and comes back when the attribute goes". It checks:
  - A bare transfer-list shows Available and Selected.
  - A set attribute wins.
  - A removed attribute brings Available back.
  - `=""` gives `""`.
  - app-header shows Ask N-zo.
  - filter-panel `.head` has `data-heading="Filters"`.

### 6. Docs
- `CLAUDE.md:281-288`:
  - Delete the `default` row.
  - "Two options exist…" becomes "`all` exists to preserve real behaviour…".
  - Add: "**The template's text is the default.** What a `to` target holds in the `.html` shows while the attribute is absent, and comes back when it is removed (TRAP `T-the-templates-text-is-the-default`)."
- `docs/DEF-TO-FIGMA-BUILD-RULES.md`:
  - 62-64: drop `default` and add the same line.
  - 153-154 [FIXED]: add "A `content` prop's default is its `to` target's text, or with `as: 'attr'` its attribute, in the default template."
- `docs/TRAPS.md`:
  - New `T-the-templates-text-is-the-default`. Its Sites are exactly the citers: `src/core/ui/sherpa-element.ts` and `scripts/generate-component-spec.mjs`, plus the test once it is written.
  - `T-empty-write-lets-css-collapse` (4441): "ABSENT writes the template's own text (none, if blank); EMPTY and a missing target write `''`."
  - `T-a-composed-child-takes-an-attribute-not-text` (10206) [FIXED]: replace "Declare the prop `kind: 'style'` and pass it along in a sync method" with "Declare it `kind: 'content'` with `as: 'attr'`: the base passes the attribute on, and the template's own is its default. Dialog, panel and the filter panel do."
  - Run `npm run traps:write`.

### 7. Risks
- **Async load:** the capture runs in `#stamp` after the markup is in the root and before anything writes, on every stamp and reload.
- **Light and shadow DOM:** `$$` reaches slot fallback content and the light DOM of composed children, never prototypes. That is the same reach as the write.
- **CSP and Trusted Types:** no new sink. The capture only reads the DOM, and the writes use `textContent` and `setAttribute`.
- **Firefox and WebKit:** plain DOM, nothing new.
- **Gates:**
  - `check:size`: `sherpa-element.ts` grows. Record it with `npm run check:size -- --update-baseline`. The scripts are not counted.
  - `check:map`: run `npm run map:write` for `scripts/lib/html-structure.mjs` (new `nodeAt`) and `scripts/lib/ts-facts.mjs`, then edit the lines by hand.
  - `spec:check --staged`: regenerate filter-panel (kind), transfer-list, app-header and notifications with `node scripts/generate-component-spec.mjs <name>`.
  - Run the full `npm run spec:check` once to prove the other specs do not change.
  - Then run `npm run manifest` and `npm run reference`.

## (b) The six labels that swap with state: a swap written in the markup

### 1 and 2. Current code, and why it is in TS
CSS cannot set an attribute or a label's text, so each swap was written in TS.

| Site | Current code | Why in TS |
|---|---|---|
| `sherpa-container-header.ts:39-45`, called at 28 and 36 | `toggle?.setAttribute('aria-expanded', String(!collapsed)); toggle?.setAttribute('aria-label', collapsed ? 'Expand' : 'Collapse');` | `49933665`, no TRAP |
| `sherpa-overlay-panel.ts:142-148`, called at 59 and 97 | `data-icon-start` fullscreen-exit / fullscreen, `aria-label` Minimise / Maximise | `2507ab82`, TODO 303 |
| `sherpa-app-header.ts:161-164` | `data-icon-start` sun / moon, `aria-label` 'Switch to light mode' / 'Switch to dark mode'. The template's `aria-label="Toggle theme"` (`.html:76`) is overwritten in `onRender`. | `9d5a44dc`, TODO 191 |
| `sherpa-quick-filter.ts:221-229`, called at 116 and 188 | `aria-label` 'Dismiss' / 'Choose values'; removes or sets `aria-haspopup="dialog"` | `0c50068e`, TODO 105 |
| `sherpa-layout-canvas.ts:245-249`, called at 88 only | `row.textContent = … 'Show minimap' : 'Hide minimap'`. Visible text of a menu row. It is a **bug today**: it is never called in `onRender`. | `c016df24`, TODO 25 |
| `sherpa-quick-filter-toolbar.ts:1660-1675`, called at 338-339, 1105 and 1655 | `data-status` active, `data-icon-start` star-filled / star, `aria-pressed`, `aria-label` 'Remove from Favorites' / 'Add to Favorites' | `7a31cb97`, TRAPs `T-favourite-star-swaps-its-glyph`, `T-the-star-reports-it-does-not-decide`, `T-tokens-css-never-reaches-shadow` |

**Why not two spans and CSS:** that works for visible text only, so 1 of the 6. And `sherpa-menu` reads a row's `textContent` for its `menu-select` label and its search (`sherpa-menu.ts:1022, 2066`).

### 3. One generic mechanism: `src/core/ui/swap.ts` (the name is free)
```ts
/**
 * swap.ts — a value in a component's markup that follows a host attribute: a
 * toggle's name, its icon, aria-pressed. TRAP T-a-swapped-label-is-in-the-markup
 *
 * Map:
 * - Swap — one element's swap, read from its markup.
 * - readSwaps — every swap in a stamped tree, with the template's own values.
 * - applySwaps — write each swap for the host's state now.
 */
const ON = 'data-swap-on';
const PREFIX = 'data-swap-';
/** Only text, `title`, ARIA and `data-*` — never a script, a style or a URL. */
const ALLOWED = /^(aria-|data-|title$|text$)/;

/** One element's swap, read from its markup. */
export interface Swap {
  el: Element;
  /** The host attribute it follows; `is`: the value it needs, null for present. */
  attr: string;
  is: string | null;
  /** name, value while on, the template's own; `text` is the element's text. */
  pairs: [name: string, on: string, own: string | null][];
}

/** Every `[data-swap-on]` in a stamped tree, read before anything writes. */
export function readSwaps(root: ParentNode): Swap[] {
  return [...root.querySelectorAll(`[${ON}]`)].map((el) => {
    const spec = el.getAttribute(ON) ?? '';
    const at = spec.indexOf('=');
    const pairs: Swap['pairs'] = [];
    for (const { name, value } of [...el.attributes]) {
      if (name === ON || !name.startsWith(PREFIX)) continue;
      const target = name.slice(PREFIX.length);
      // Never another directive, and never a script's text.
      if (!ALLOWED.test(target) || target.startsWith(PREFIX) || (target === 'text' && el.localName === 'script')) continue;
      pairs.push([target, value, target === 'text' ? (el.textContent ?? '').trim() : el.getAttribute(target)]);
    }
    return { el, attr: at < 0 ? spec : spec.slice(0, at), is: at < 0 ? null : spec.slice(at + 1), pairs };
  });
}

/** Write each swap for `host`'s state now — only those following `changed`, when given. */
export function applySwaps(host: Element, swaps: readonly Swap[], changed?: string): void {
  for (const { el, attr, is, pairs } of swaps) {
    if (changed !== undefined && attr !== changed) continue;
    const now = host.getAttribute(attr);
    const on = is === null ? now !== null : now === is;
    for (const [name, alt, own] of pairs) {
      const want = on ? alt : own;
      if (name === 'text') { if (el.textContent !== (want ?? '')) el.textContent = want ?? ''; }
      else if (want === null) el.removeAttribute(name);
      else if (el.getAttribute(name) !== want) el.setAttribute(name, want);
    }
  }
}
```
[FIXED] Compared with the first draft:
- It cannot overwrite another `data-swap-*` attribute.
- It never writes a script's text (a Trusted Types sink).
- It trims the template's own text (the build strips indents).
- It skips writes that would change nothing, so the menu's observer gets no extra records.

**Base class (`sherpa-element.ts`)**
- `import { applySwaps, readSwaps, type Swap } from './swap.js';`
- Add the field `/** This stamp's swaps. TRAP T-a-swapped-label-is-in-the-markup */ #swaps: Swap[] = [];`
- In `#stamp`, after `this.#readOwn();`: `this.#swaps = readSwaps(this.root);`
- In `#stamp`, after `this.#syncAllProps();`: `applySwaps(this, this.#swaps);`
- In `attributeChangedCallback`, after `if (def) this.#syncProp(name, def);`: `applySwaps(this, this.#swaps, name);`. This is before `onChange`, and a re-stamp re-reads the swaps.

**Gates**
- `scripts/check-props.mjs`: a swap must follow a declared, variant or observed attribute, or it never swaps. Strip comments first, so prose in a header is not read.
  ```js
  /* A swap follows a host attribute; one it does not hear never swaps. TRAP T-a-swapped-label-is-in-the-markup */
  for (const file of globSync('src/components/*/*.html', { cwd: ROOT })) {
    const tsPath = join(ROOT, file.replace(/\.html$/, '.ts'));
    let ts; try { ts = readFileSync(tsPath, 'utf8'); } catch { continue; }
    const heard = new Set([...declaredIn(ts, tsPath), ...parseObserved(ts, tsPath)]);
    const html = readFileSync(join(ROOT, file), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    for (const m of html.matchAll(/\sdata-swap-on="([^"=]+)/g)) {
      if (!heard.has(m[1])) problems.push(`${file}  data-swap-on="${m[1]}" follows an attribute ${file.split('/')[2]} does not observe`);
    }
  }
  ```
- `scripts/check-usage.mjs:66`. [FIXED] A directive is not something a parent places, so it gets its own flag.
  ```js
  const placed = /^data-col-span-\d+$/.test(name);
  // A template directive the base class reads, on a copied template. TRAP T-a-swapped-label-is-in-the-markup
  const directive = name.startsWith('data-swap-');
  if (!placed && !directive && !EVERYWHERE.includes(name) && !(own[tag] ?? []).includes(name)) {
  ```
  This also covers `check:docs`, which runs `markupProblems` over the ```html blocks in CLAUDE.md and the shipped docs.
- `src/core/ui/templater.ts` `anatomy()` (245-255): add `const swap = el.getAttribute('data-swap-on'); if (swap) out.add(\`swap=${swap}\`);`
  - Its doc and `checkOwnTemplate`'s doc (213-215) then say "part, slot name, class and swap".
  - So a consumer template that loses a swap is reported. That is a warning, never a throw.

**Per site: new markup, and what the TS loses**
1. **container-header** `.html:42-44` [FIXED: the line numbers]
   ```html
   <sherpa-button class="toggle" part="toggle" data-type="icon" data-size="sm"
                  data-look="transparent" data-icon-start="chevron-up"
                  aria-expanded="true" aria-label="Collapse"
                  data-swap-on="data-collapsed" data-swap-aria-expanded="false"
                  data-swap-aria-label="Expand"></sherpa-button>
   ```
   TS: delete `this.#syncCollapsed();` (28), the whole `onChange` (35-37) and `#syncCollapsed` (39-45). `#onToggle` stays.
2. **overlay-panel** `.html:58-59`
   ```html
   <sherpa-button class="expand" part="expand" data-type="icon" data-size="sm"
                  data-icon-start="fullscreen" aria-label="Maximise"
                  data-swap-on="data-maximised" data-swap-data-icon-start="fullscreen-exit"
                  data-swap-aria-label="Minimise"></sherpa-button>
   ```
   TS:
   - Delete line 59 and `#syncMaximise` (142-148).
   - `onChange` becomes `if (name === 'open') this.#surface.follow(); else if (name !== 'data-maximised') this.#syncHeader();`
   - The button is light DOM of the panel's `sherpa-container-header`, inside the panel's shadow root, so `readSwaps` finds it.
3. **app-header** `.html:74-76`
   ```html
   <sherpa-button class="theme-toggle" part="theme-toggle" data-type="icon" data-size="sm"
                  data-look="transparent" data-icon-start="moon" aria-label="Switch to dark mode"
                  data-swap-on="data-theme-mode=dark" data-swap-data-icon-start="sun"
                  data-swap-aria-label="Switch to light mode"></sherpa-button>
   ```
   TS: delete lines 161-164. The doc at 158 becomes "Write the badge and the open state."
4. **quick-filter caret** `.html:114-115`
   ```html
   <button class="caret" part="caret" type="button" aria-haspopup="dialog" aria-expanded="false"
           aria-label="Choose values"
           data-swap-on="data-dismiss" data-swap-aria-label="Dismiss" data-swap-aria-haspopup="false">
   ```
   TS: delete line 116, line 188 and `#syncDismiss` (221-229).
5. **layout-canvas** `.html:47`
   ```html
   <button type="button" class="minimap-toggle" value="minimap"
           data-swap-on="data-no-minimap" data-swap-text="Show minimap">Hide minimap</button>
   ```
   TS:
   - Delete line 88 (keep `this.#drawMinimap();` in that branch) and `#syncMinimapToggle` (245-249).
   - The row holds text only, so the `text` write erases nothing. The menu watches its children and reads `textContent` live, as it does today.
6. **toolbar star** `.html:154-156`
   ```html
   <!-- Two drawings, so the star fills: TRAP T-favourite-star-swaps-its-glyph. "active" is a Style mode: TRAP T-tokens-css-never-reaches-shadow -->
   <sherpa-button class="act" data-size="sm" data-act="favourite" data-type="icon"
                  data-group="start" data-icon-start="star"
                  aria-label="Add to Favorites" aria-pressed="false"
                  data-swap-on="data-favourite" data-swap-data-icon-start="star-filled"
                  data-swap-aria-label="Remove from Favorites" data-swap-aria-pressed="true"
                  data-swap-data-status="active"></sherpa-button>
   ```
   TS:
   - Delete `#syncFavouriteFromAttr` (1660-1675), lines 338-339 (comment and call), and the calls at 1105 and 1655.
   - `#toggleFavourite` becomes `if (!this.hasAttribute('data-locked')) this.set('data-favourite', on);` and then the same `emit`. `set` fires `attributeChangedCallback`, which applies the swap.
   - When off, `data-status` goes back to the template's own (none), so it is removed.
   - The TS still cites `T-the-star-reports-it-does-not-decide` at 97 and 1649.

All six followed attributes are already declared props. Their kinds do not change: a swap belongs to the template, not to the prop.

**Optional, same mechanism, behaviour identical** [FIXED: the first plan did not list these]
- app-header `.notif-btn` gets `data-swap-on="data-notifications-open" data-swap-data-open=""`. That deletes `#syncOpen` (77-89) and its call at 160. The TS still cites `T-a-trigger-shows-what-it-opened` at 59.
- `sherpa-list-item.ts:66-69` `#syncExpanded`: `.expand` gets `data-swap-on="data-expanded" data-swap-aria-expanded="true"`.

**The swap does not serve these:**
- data-grid group toggle (`:1257`, `:1503`) and nav-item expand (`:123`). They build the name into the text (`Expand ${key}`).
- The ⋮ menu's favourite row (toolbar `:1565`). That belongs to the ⋮ menu group.
- Canvas `.pan` `aria-pressed` (`:234`). It follows a custom state, not an attribute.
- `sherpa-menu.ts:1570` `|| 'Menu'`. This is default text for the menu group to handle. [FIXED: the first plan did not record it]

### 4. Behaviour change
- **Canvas:** a canvas born with `data-no-minimap` now reads "Show minimap" from the first render. This fixes a bug.
- **Quick-filter:** a dismissing caret gets `aria-haspopup="false"` instead of no attribute. In ARIA 1.2, `false` is the default, so it means the same thing. No CSS or TS reads `haspopup` (I grepped `src/`), and no test does.
- **App-header:** the stale "Toggle theme" goes. No one ever saw it.
- **New in the live DOM:** these elements now carry `data-swap-*` attributes. `read_component` and DevTools show them. No selector matches `data-swap-`.
- Everything else is the same. The writes are synchronous in `attributeChangedCallback`, as `onChange` was.
- New: a consumer's template can retext or localise all six.

### 5. Tests
- Already covered. They assert results, not TS internals, so none must change:
  - `test/e2e/reforged-app-header.spec.ts:360-377`
  - `reforged-overlay-panel.spec.ts:247-276`
  - `reforged-layout-canvas.spec.ts:126-151` (reads `textContent`)
  - `reforged-quick-filter-toolbar.spec.ts:439` and `445-475` (icon, pressed, name, path `d`)
  - `reforged-container-header.spec.ts:164-184` reads only `data-collapsed`.
  - Demos tests read only host attributes (`data-favourite`, `data-maximised`).
- Queued, not to run now:
  - container-header: the toggle's label and `aria-expanded` follow `data-collapsed`.
  - quick-filter: `data-dismiss` caret, both ways.
  - A canvas born with `data-no-minimap`.
  - A reload re-reads swaps (`reforged-variant-restamp.spec.ts`).

### 6. Docs
- `CLAUDE.md`:
  - In "Template rules", add: "A value that follows a host attribute is written in the markup: `data-swap-on="data-x"` (or `data-x=value`) and `data-swap-<name>="…"` (`text` for its text). The base writes it while the host matches, and puts the template's own back after (TRAP `T-a-swapped-label-is-in-the-markup`)."
  - In Key rules, add a row: ❌ `setAttribute('aria-label', on ? 'A' : 'B')` / ✅ `data-swap-*` in the template.
- `docs/PRINCIPLES.md:200-209`, the doors table, add a row: "`data-swap-on` / `data-swap-<name>` in the template | A toggle's name, icon or pressed state that follows a host attribute. The base writes it; the TS writes nothing."
- `docs/DEF-TO-FIGMA-BUILD-RULES.md`: add the same bullet under the template rules.
- `docs/TRAPS.md`:
  - New `T-a-swapped-label-is-in-the-markup`. It says:
    - When swaps are read and written, before `onChange`.
    - One followed attribute per element.
    - `text` replaces the children, so use it only on a text-only element.
    - Which targets are allowed.
    - There is no "remove": use the ARIA token `false`.
    - The TS must never also write a swapped attribute.
    - It follows any observed attribute, whatever the kind.
    - Its gates.
    - Sites, exactly the citers: `src/core/ui/swap.ts`, `src/core/ui/sherpa-element.ts`, `scripts/check-props.mjs`, `scripts/check-usage.mjs`, and `src/core/ui/templater.ts` if its line cites it.
  - `T-favourite-star-swaps-its-glyph` (7551): its snippet becomes the markup, and its Site moves from the toolbar `.ts` to the `.html`.
  - `T-tokens-css-never-reaches-shadow` (82): its Site moves from the toolbar `.ts` to the `.html`.
  - `T-the-star-reports-it-does-not-decide`, table row 7595: "observed, and the star's `data-swap-*` paint it."
  - `T-a-templater-owns-the-files` (16206) [FIXED]: "each template id, part, slot name, class and swap".
  - Run `npm run traps:write`. `check:traps` scans the component `.html` files, so the template citations count.

### 7. Risks
- **Async load:** swaps are read and applied in `#stamp`. A change before the first render is caught there, because `attributeChangedCallback` returns early until then.
- **Light and shadow DOM:**
  - `querySelectorAll` on the root reaches slot fallback and the light DOM of composed children. It never reaches a prototype or a child's own shadow root.
  - Each component reads only its own swaps (container-header's toggle belongs to container-header).
  - The swap holds an element reference, so a re-parented menu row is still found.
- **One writer:** I checked that none of the six swapped attributes has a second writer, including `sherpa-button` (it writes only `aria-disabled` and its trigger).
- **CSP and Trusted Types:** the values come from markup that already passed `ownHtml()`. Only `aria-*`, `data-*`, `title` and `text` are written, never a script's text.
- **Firefox and WebKit:** plain DOM.
- **Server import:** `swap.ts` has no top-level DOM use.
- **Spec generator:**
  - The six specs' anatomy gains the `data-swap-*` attributes, and app-header's `aria-label` changes. Regenerate those six (plus the two optional sites if you take them).
  - The round-trip compares attributes on both sides, and `parseAttrs` keeps the `=` inside a quoted value, so it passes.
  - Reference and manifest read parts only. Run `npm run manifest` and `npm run reference` anyway, because the hook checks both.
- **Hook gates:**
  - `check:size`: it fails on growth in `sherpa-element.ts` and in the container-header, overlay-panel, app-header, quick-filter and toolbar `.html` files. It reports `swap.ts` as new, and the TS files shrink. Record once, on purpose: `npm run check:size -- --update-baseline`.
  - `check:map`: run `npm run map:write src/core/ui/swap.ts`, then edit the lines.
  - `check:weight` is not in the hook. After the build, `swap.js` joins every entry's graph. Record it with `npm run check:weight -- --update-baseline` when Will next allows the check.

**After building:** Demos uses none of these markup attributes. Run `npm run build` so Demos picks the change up. To check by eye:
- the app header's theme button
- an overlay panel's maximise button
- the ★ in a View toolbar
- a canvas's Options › Hide minimap

**TODO:** when this group is done, mark the transfer-list, Ask N-zo and "labels that swap" parts of 344's item 3 as done, and add "Filters", "No notifications" and the menu's "Menu". The ⋮ menu rows and the nav's default rows stay open for their own groups.