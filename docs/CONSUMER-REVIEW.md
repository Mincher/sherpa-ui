<!--
  TODO 183 — how a consumer, and an AI agent, builds an app on Sherpa.
  A review, 2026-10-01: five read-only lenses (components, scaffolding, the
  data layer, agents, architecture), then one synthesis. Its plan is items
  187–197 in docs/TODO.md. File:line cites are as of commit 07589cdd.
-->
# TODO 183: how people and agents build an app on Sherpa

## 1. Where we are today

The base is good. A template can ask for its data in markup only. `dashboard.html` has 4 metrics, 4 charts and 4 legends, and no page JS. There is no bundler and no runtime dependency. The Store contract has only 6 methods. Page definitions are JSON, and a test checks them against a schema. The gates are real, and `npm run map` is a strong map of the code.

But Sherpa stops at the page. The library does not supply the part between "I have components" and "I have an app", so the demo writes it by hand. `index.html` is 957 lines, and about 800 of them are script. The agent path does not work outside this repo. The rule docs teach a data model that the code no longer uses. Today, a person who knows the history can build an app. A new person or an agent cannot build one from the docs.

## 2. The biggest problems

**1. Sherpa has no app layer, so each app writes its own. This is why `contexts/` looks like hacks.**
- **What `index.html` writes by hand:** the Context loader (:438-520), the Settings overlay (:696-772), 19 `session.persist` calls (10 of them with the same guard), and 3 reaches into shadow roots (:550, :837, :889).
- **Context names:** they are hand-kept in `index.html:174`, `server/index.mjs:25` and about 10 more places.
- **An unused key:** each definition has a `"template"` key (`records.json:5`) that nothing reads. The loader fetches by Context name (:455).

*The answer to TODO 185:* you are right. `contexts/` has 7 files and 1,115 lines.
- **About 60% is glue that the library should own:**
  - `dashboard.js`: no business logic at all.
  - `settings.js`: 8 copies of one wire.
  - `ask-name.js`: generic dialog prompts.
  - About 250 lines of `records.js`: the CRUD dialog, delete with toasts, the details panel, a bulk bar made with `createElement` (:304), and saving filters.
  - The code that picks a store and seeds it (`records-data.js:118-186`).
- **About 20% is demo seed data and schemas.**
- **Only about 20% is the app's own business:** what Add, Edit and Delete do and say, plus `chat.js`.

So the files are not bad habits. They mark the parts the library is missing.

**2. The agent path breaks outside this repo, and some of what it says is false.**
- **Missing files:** `package.json` `files` (:24-30) leaves out `scripts/`, `schemas/` and the 65 `.component.json` specs. But every MCP module imports `../../scripts/lib/generation/*` (`discover.js:16-17`).
- **Missing dependencies:** the SDK and zod are devDependencies, but `bin: sherpa-mcp` is published.
- **Not registered:** neither project registers the Sherpa MCP. `.mcp.json` has only figma-console, and Sherpa Demos has no `.mcp.json`.
- **False content:** `scaffold_def` suggests 8 token names that do not exist (`generate.js:46-63`). The review prompt's example uses `data-variant` (`prompts/index.js:135`), which 0 components use. Line :179 reads a file that does not exist.
- **Gaps:** the MCP has 0 tools for pages, Views or apps.

**3. The rule docs teach the old model.**
- **The join:** `PRINCIPLES.md:26` says "The join is `DataSource.bind(el, options)` and nothing else." The app joins through `sherpa-provider`. CLAUDE.md, PRINCIPLES.md and DATA-SOURCE-RULES.md name the provider 0 times.
- **A wrong option:** `DATA-SOURCE-RULES.md:185`, which is served to agents, and `TRAPS.md:12371` both say `scope: 'all'`. The real option is `rows: 'all'` (`data-source.ts:275`). `scope` takes a string (:266), so the wrong call passes the type check, and the chart counts only one page with no error.
- **Dead names:** `CLAUDE.md:426` names a `ThemeManager` that does not exist. `README.md:37` links a deleted doc.
- **Size:** the how-to rules are about 700 lines. `TRAPS.md` is 16,007 lines.

**4. Mistakes fail silently, and two gates that could catch them do not run.**
- **`populate()` ignores some keys:** `button.populate({ label: 'Save' })` does nothing. `data-label` is in `observed`, not in `props` (`sherpa-button.ts:35-43`), and the default renderData skips keys that are not in props (`sherpa-element.ts:997`).
- **Gaps in the specs:**
  - 0 of 65 specs list their slots.
  - The spec schema has no field for the `populate()` shape, and that shape is different in 26 components.
  - The provider's HTML says "Fires: nothing", but its code emits `filter-mode-change` and `view-change` (:282, :457).
- **Typos are lost:** the provider throws away the list of keys that `applyState` skipped (`sherpa-provider.ts:507`). So a typo in a definition's `ui` block does nothing and says nothing.
- **A double event:** `sherpa-input-text` fires `input` twice per keystroke: the native one, then its own (:502).
- **Bugs I found by reading the code (not run):**
  - `IdbStore.update` with a changed email writes a second row (keyPath at `idb-store.ts:98`, `put` at :181). `ArrayStore` replaces the row in place, so the two stores the app switches between do different things.
  - Edit never sets or saves Plan (`records.js:127-139`, :341).
  - The badge has 3 writers (`index.html:36` and :828, `dashboard.js:51`). Mark all as read, visit Records, return to Dashboard, and the badge shows 4 again.
- **Gates that do not run:** `npm run lint` (rule 13, the boundary that keeps the data layer free of DOM code) and the node tests are in no hook.

**5. The core is heavy. Two parts are too big, the filter UI is built twice, and the library ships whole.**
- **DataSource:** `data-source.ts` is 2,790 lines. Its `#steer` (:2451) branches on 15 component event names (:290).
- **The filter bar and panel:** the bar (1,998 lines) and the panel (1,854) each build the same parts. For example, `#openMore` is at `toolbar.ts:1661` and at `panel.ts:1788`. They also use two scope protocols (`data-source.ts:985-1004`). Your list in `docs/Some things to address.md` (the overflow menu, the column-menu conditions) comes from this split.
- **Size:** `import 'sherpa-ui'` loads 117 JS files, 1.5 MB, not minified. The icons alone are 314 KB (102 KB gzip), and every page loads them.
- **Single imports:** a single-component import loses all 8 shared stylesheets, because only `index.ts:23` sets them.

## 3. The plan, ranked by value for effort

1. **Make the docs and the MCP text true.** S. Fixes 3 and 2.
   - Change `scope:'all'` to `rows:'all'` in DATA-SOURCE-RULES and the TRAPS entry, and make `bind()` call `report()` when it gets `scope:'all'`.
   - Rewrite `PRINCIPLES.md:26`: components ask, the provider answers from a page definition, and `bind()` is the manual way.
   - Fix the ThemeManager line, the `data-variant` names, the README (import map first, no dead link), prompt lines 83, 135 and 179, and `scaffold_def`'s token names.

2. **Fix the bugs I found, and run the gates we already have.** S. Fixes 4.
   - `IdbStore.update` with a new key removes the old row in the same transaction. One contract test runs over every store.
   - Edit saves Plan. The notification source becomes the only writer of the badge. `sherpa-input-text` stops the native `input`, as `sherpa-slider` does.
   - The provider reports skipped `ui` keys, and its Fires block lists what it emits.
   - Add `npm run lint` to the hook and the node tests to `npm test`. Make the Playwright config agree with its comment: all 3 engines run now, but the comment says only one does.

3. **Readiness, real single imports, and a smaller download.** M. Fixes 4 and 5.
   - Ship the test harness's `__settled()` as an exported `settled(root)`.
   - Put the 8 shared sheets in SherpaElement's default, so `sherpa-ui/components/*` styles correctly. Guard each `define`.
   - Strip template comments and minify the JS at build, and keep a debug build. Load icons on demand.
   - Then delete the demo's 30 `whenDefined` calls and its 32 `waitForTimeout` calls.

4. **A Context contract and one `app.json`.** M. Fixes 1.
   - Export `ContextModule { init(root, ctx) → teardown }`, where ctx = `{ source, session, signal, header, panel }`.
   - One `app.json` names the Contexts (template, definition, views, module, chrome), the default Context and the Settings pages.
   - The nav, the router params, the session defaults and the server list come from it. This ends about 12 hand-kept lists and the 6 `document.querySelector` calls in Contexts.

5. **Library parts that empty `contexts/` (the answer to 185).** M. Fixes 1.
   - Add `SherpaDialog.prompt()` and `.confirm()`, which delete `ask-name.js` and 5 hand-written dialogs.
   - The provider owns saved filters, as it already owns saved Views.
   - `data-setting="/pointer"` binds a control to the session, and `persist()` takes its guard from the default value.
   - Stores take `seed`, `seedVersion`, `fallback` and a schema `default`.
   - Add public APIs for the 3 shadow-root reaches.
   - Then sort Demos by kind: `stores/`, `contexts/` (page behaviour only), `views/`, `view-schemas/`. `loadViewLibrary` (uncommitted, `src/core/browser/view-files.ts`) already reads views as JSON with their templates found by id.

6. **Ship the agent path.** M. Fixes 2.
   - Publish the MCP with real dependencies and the files it reads: the generation lib, the specs, the schemas and the served docs.
   - Add an `npm pack` smoke test that starts the server and calls every tool, resource and prompt.
   - Register it in both projects, and add `validate_page` first.

7. **One app guide, served to agents.** M. Fixes 3 and 2.
   - `docs/APP-GUIDE.md`, about 300 lines, written as steps with no history. It covers the page skeleton, the shell, stores, a page definition, a template that asks, a Context module, Views and the session, and ends with the 10 or so traps an app meets.
   - Serve it as `sherpa://app-guide`.
   - Tag each TRAPS entry by who meets it: app, component or tooling.
   - Write it after item 4, so it teaches the contract.

8. **A Context loader beside `sherpa-router`.** L. Fixes 1.
   - A `<sherpa-outlet>` reads `app.json`. On each route change it fetches the template, opens the provider, runs the module, and tears it down with the NavigateEvent's signal.
   - It also owns the Settings overlay, the header title taken from the nav row, keeping the View and the URL in step, Views as nav rows, and favourites and recents.
   - `index.html` drops from about 800 lines of script to config. After that, a `scaffold_app` tool can emit a starter.

9. **The spec becomes the whole contract.** L. Fixes 4 and 2.
   - One way to declare an attribute: every observed `data-*` moves into `static props`, and `check:props` checks membership of props.
   - The generator reads types from props, fills `slots`, records the `populate()` shape and types event details.
   - Emit `HTMLElementTagNameMap` and `custom-elements.json`.
   - Add a `check:usage` gate that checks the Demos markup against the specs.

10. **One filter surface and a smaller DataSource.** XL. Fixes 5.
    - Move `bind()` and `#steer` out of DataSource into a UI-side binder, so the data layer stops knowing component event names.
    - Use one imported helper for the bar and the panel, one FilterDef type and one scope protocol.
    - Move the filter editor out of `sherpa-menu`.
    - Each parity bug is then fixed once, not twice.

## 4. Choices only you can make

**1. Where does the app layer live? (items 4, 5 and 8)**
- **A:** In sherpa-ui's utility layer, beside `sherpa-router`.
- **B:** In a separate starter or package. sherpa-ui keeps only components and data.
- **Context:** CLAUDE.md already ratifies the app rules (Settings on top, the header title comes from the nav row, the first View is left out of the URL). But only the demo's code does them. With B, the rules and the code are in different places again.
- **My pick:** A.

**2. How does the MCP ship? (item 6)**
- **A:** As its own package, `sherpa-ui-mcp`, with real dependencies.
- **B:** Inside sherpa-ui, with the SDK and zod as optional dependencies.
- **Context:** TODO 184 found that sherpa-ui has no runtime dependency. A keeps that. B keeps the install to one step.
- **My pick:** A.

**3. What comes first after items 1-3?**
- **A:** The app layer (items 4, 5 and 8). Meanwhile, fix your filter list in place.
- **B:** The filter merge (item 10) first, then the app layer.
- **Context:** Item 10 is XL. If two items on your list (the overflow menu and the column-menu conditions) are fixed before the merge, they are fixed in two places. The app layer is what 183 asks for.
- **My pick:** A. Do the quick filter fixes now. Keep the two parity bugs for item 10 only if they turn out to be hard.

**4. One way to write a filter condition**
- **A:** Keep `readings` as the stored form in definitions and Views.
- **B:** Use a plain form, `{ "openTickets": { "gt": 0 }, "status": { "in": ["active"] } }`, with numbers as numbers. Readings stay internal.
- **Context:** Today an agent must learn two grammars. One is `[field, op, value]` (DATA-SOURCE-RULES §2). The other is readings with numbers as strings, `{"op":"gt","text":"0"}` (`records.json:38`). B changes the stored format, so saved Views need a migration.
- **My pick:** B, and decide it before item 7 so the guide teaches one grammar.
