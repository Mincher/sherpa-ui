# 369 — Customer Sites: tiered values and a tree menu

Read-only design, 2026-10-20. Check each line number when you build.

## Will's words

*"In the demo app, customers should be able to have sites (e.g. office locations). This makes the menu for the customer filter chip a nested tree select menu (with checkboxes). Both customers and/or sites are selectable. The filter chips for each Customer in the filter panel View Scope will need to now have a menu that lists all site values. This is a new level of value tiering in filters but I think it should be easy to add. It is only for Customers at the moment but the value tiering, and tree menu, implementation should be generic for any potential future scenarios that need this."*

## Will's answers, 2026-10-20 (they override the design below)

- A customer ticked matches ALL its rows, rows with no site too. Every site
  ticked one by one shows the customer box as "some".
- In the panel's View section, a customer with some sites picked shows its chip
  ON. *"a click toggles on/off but doesn't clear value selection"*: a press
  suspends and resumes it, and keeps the picks.
- A chip names it "Northwind: London, Leeds", cut short where long; the tooltip
  holds all of it.
- The sites open IN PLACE, as a tree, under the customer, with a twisty and an
  all/some/none box.
- A remote store reads a customer's sites when its row first opens, then keeps
  them (345).
- Build PARTS NOW: the data, the tree menu, the bar chip and the Demos sites.
  The panel part waits for 366 commit 20, the grid part for commit 23.

## Questions for Will (answered above)

### Q1. You pick a customer. Does that match all its rows, or only rows with one of its sites?

- **A. All its rows**: The pick is the customer value. It also matches rows with no site. If you tick every site, the customer is not picked: its box stays 'some'. The clause is short: customer in [..].
- **B. Only rows with its sites**: The pick means every site under it. Rows with no site do not match. Ticking every site is the same as the customer. The clause lists every site, so it is longer and costs more for each row.

Pick: A

### Q2. In the panel's View scope, some sites of a customer are picked. How does its chip look, and what does a press on the chip do?

- **A. On, and a press clears it**: The chip shows the filter-on look when its customer or any site is picked. A press on the body takes off all picks for that customer. The all, some or none box is only in its menu. No new chip look.
- **B. Half on, and a press picks all**: A new 'some' look for the chip. A press on the body picks the whole customer. The chip gets a third state.

Pick: A

### Q3. How does a chip name a customer that has only some sites picked?

- **A. Northwind: London, Leeds**: The customer, then its picked sites. No new words. A long face is cut short, and the tooltip shows all of it.
- **B. Northwind (2 sites)**: A count. Shorter, but each child field must declare a plural name ('sites'), a new key.

Pick: A

### Q4. A store that is not held (remote): when does it read a customer's sites?

- **A. When its row first opens**: One read of that customer's sites when its row opens, then kept, as in 345. The menu opens fast. Search finds only sites read so far. Demos holds its data, so it reads all sites in one pass.
- **B. All at page open**: One read of every customer and site pair. Search finds every site. A server must answer a new paired read, and every page pays for it, also when no one opens the menu.

Pick: A

### Q5. Your outline said to reuse the menu's child menus. Where does a customer's site list open?

- **A. In place, as a tree**: The sites open under the customer, indented, in the same menu, with a twisty. The customer's all, some or none box is beside its sites. It reuses the nav's tree rows. It is a new part of the menu.
- **B. In a child menu**: A customer row opens a second menu at its side, as a drill does today (T-a-row-opens-its-child-menu). Less new code. You see one customer's sites at a time, and its box is in the first menu.

Pick: A

### Q6. 366 is in progress. When do I build 369?

- **A. Parts now, the rest after 366**: The data, the tree menu, the bar chip and the Demos seed now, because they touch nothing 366 deletes. The panel waits for 366 commit 20 and the grid for commit 23. Demos shows the tree only when all are in.
- **B. All after 366**: Nothing until 366 is done. No line moves to rebase, but Customer Sites comes much later.

Pick: A

## The design

I read the code and changed nothing. Customer Sites is TODO 369. It is still ⬜ (docs/TODO.md:53, section :1626-1647), and no code for it exists. This is the design, revised against every finding of the last check. At the end I list what I rejected and why.

ONE NEW CONCEPT: A VALUE CAN HAVE CHILD VALUES. A field names its child field. A child pick is a PATH object that names both tiers. The kind does not change: a tiered field is still 'multi' (filter-kind.ts:63-74). The tree comes from its options. It is not a new kind of chip.

1. HOW A FIELD DECLARES TIERS (JSON)
- The parent names its child once, in the page definition: "customer": {"label":"Customer","select":"multiple","icon":"buildings","child":"site"}.
- The child is an ordinary field: "site": {"label":"Site"}.
- Add child?: string to FieldDeclaration (data-source-types.ts:41-65), to page.v1.json's field (:51-86, additionalProperties false at :53), to docs/PAGE-DEFINITION.md and to the MCP's validate_page.
- openSource (page-definition.ts:66-111) reports these errors: a child that is not declared; a child on a number or date field; a scope, a set or a column filter that names a child field.
- offers: "all" (page-definition.ts:95) gives every declared field EXCEPT child fields. So Site is never in an Add list.
- A child can have its own child. The code works for any depth. Tests and Demos use 2.
- A child field has no filter of its own (one field, one filter). Its picks live in its parent's reading.

2. THE READING SHAPE (PLAIN JSON, ONE FIELD, FITS 366)
- A pick is a parent value, or a PATH object: customer: {picked: ['Contoso', {customer:'Northwind', site:'London'}]}.
- This is the existing FieldReading.picked (filter-state.ts:152-155). valueKey keys an object by its sorted fields (store.ts:475-486, T-a-value-can-be-an-object). Northwind's London and Contoso's London are two keys.
- It is one field's reading, so it fits 366's setReading(scope, field, reading).
- A Where (and so a saved filter, a View, a kept Query) keeps the PICK LIST, never the compiled clause: customer: {in: [...]} or {notin: [...]}. whereOf (where.ts:41) writes it and readingsOf (:52) reads it back as a list. readingsOf never sees the two-field clause, so the ne form (an or inside an and, which :79-85 rejects) never reaches it.
- Readings hold RAW values (objects), not keys. Every door that takes keys maps them through catalogue.byKey: select (data-source.ts:1125-1126) as today, and apply() with reach 'component' (:679-686), which skips select today. A condition row on a tiered field works on the parent value only; a path is only ever in picked.
- Only saved filters cross tabs, as today.
- Normalising is in ONE place, fieldState (filter-state.ts:307): a path whose parent is picked is dropped, because the parent includes it. That is the only rule. (Fixed: the old rule 'all children picked → the parent' is gone. Under Q1 A a parent also matches rows with no site, so that swap would widen the result.)

3. HOW A PICK COMPILES (THE STORE AND A SERVER GET THE SAME CLAUSE)
- A parent pick is the parent value. It matches every row of that customer, also rows with no site (Q1).
- A new tierClause in rowClause (filter-state.ts:466): parents as ['customer','in',P] ('eq' for one); paths grouped by parent as ['and',['customer','eq',p],['site','in',S]]; the parts joined by 'or'.
- Example: ['or',['customer','eq','Contoso'],['and',['customer','eq','Northwind'],['site','in',['London','Leeds']]]]. Only and, or, eq and in, so any server can run it (docs/DATA-SOURCE-RULES.md). 'ne' is De Morgan: notin P and, per parent, (ne p or notin S).
- tierClause splits a path by its OBJECT fields. It never parses a key string.
- FieldFacts (filter-state.ts:135-152) gets child, and parentOf (path key → parent key), and labels for path keys (the child's own label, e.g. 'London'). FieldCatalogue.facts (field-catalogue.ts:85-96) fills them. Every caller that builds its own facts passes them: the walk's each (source-counts.ts:162-167), the grid's #facts (sherpa-data-grid.ts:915-918) and the chip's #state (sherpa-quick-filter.ts:895-925). Without child, a path compiles to customer eq {object} and matches nothing; without labels, a face prints {customer:Northwind,site:London}.
- fieldState's values (:319) hold parents and paths in tree order, each path with parent. A path whose parent is picked shows as picked. 'Everything ticked is no filter' (:351) counts PARENTS only.

4. VALUES: WHERE THE CHILDREN COME FROM
- Children are NOT in the field's domain. They are in a separate children map in the catalogue: parent key → child values, plus path key → path object (so byKey covers paths). (Fixed: putting paths in the domain leaked them to valuesFor, the provider's legend picks (sherpa-provider.ts:824), summariseBanded (:717) and describe's chart parts (data-source.ts:758), and each would get one category per path.)
- The parents still come from the domain. Customer's domain still comes from its schema's oneOf. (Fixed: fromRows skips a field with a domain (field-catalogue.ts:142), and declareFromRows takes the distinct branch first (data-source.ts:983-984). The children map does not use either path, so neither blocks it.)
- A new declareChildren(field) fills the map:
  - Rows in memory (an ArrayStore, a HeldSet, a held source with #rowsCache): ONE load pass reads {[field], [child]} pairs and de-dupes by valueKey. Cost O(R), once.
  - Any other store: one read of one parent's children when that parent first opens, distinct([child], {filter: [field,'eq',p]}), cached, and added to the map (Q4).
- filterDef (field-catalogue.ts:104-117) gives the filter's options: each parent, then its children with parent and the child field's label. Only filterDef does this, so a chart or legend never sees a child.
- Add parent?: string to FieldFilter.options (data-source-types.ts:74), FilterOption (filter-def.ts:17-34) and MenuItem (sherpa-menu.ts:46-69).
- oneChipList (filter-kind.ts:96-99) counts PARENTS only. Else 8 customers and their sites go over 16 and the panel run becomes one chip.

5. COUNTS, GREYS, LIMIT AND THE WALK, AT BOTH TIERS
- The held walk: for a tiered field, keyOf (walk.ts:146) gives two keys per row, the parent key and the path key. The path key is a string built in a sorted field order worked out once per field, so no object is made per row. Then tally, taps and start (walk.ts:170-197), present (greys, 349), offered (serial), per-pick values (172), the set-aside less and ruleOut work at both tiers.
- walkReads (walk.ts:118-120) adds the CHILD to tallied for a tiered step. (Fixed: without it, an edit that moves only site keeps the old walk (data-source.ts:1713 moved(w.reads)), and path counts and greys go stale.)
- walkStepwise (source-counts.ts:225-239) tallies through presentUnder → store.distinct per field (:25-37). It cannot see pairs. So in stepwise mode a PATH is judged by its PARENT key: holdsKey for a path tests its parent. A path is never set aside or ruled out unless its parent is. This only ever keeps a pick on, never drops one (T-a-composed-field-fills-async). (Fixed: before, every path pick was ruled out and dropped through step.less, which changed the reader's filter.) Greys for children under a remote source come from the per-parent read of 4, asked under the scope's walk filter when the row opens.
- A parent is greyed only when no row holds it. A greyed child that is ticked shows an inactive box (361, 362).
- Cost per held walk: one more readField and one string per row, per tallied step on that field. each adds one matchesFilter per row per pick, as today.

6. THE TREE MENU BODY (sherpa-menu, ONE BODY FOR THE BAR, THE PANEL AND THE GRID HEADING)
- menuFor (filter-menu.ts:73-184) passes options through (:183). The toolbar (:831) and the grid (:747-750) spread items, so parent reaches the menu. Two places map only value and label and must also pass parent: the panel's #buildDrillMenu (:1262-1281) and filterDef (:113).
- In #stampItems (sherpa-menu.ts:1399-1480) rows stay ONE flat list in light DOM:
  - A child row gets data-parent and data-depth. A parent row gets a twisty cloned from a new template.menu-twisty-tpl, as #addDrill does (:1061-1076).
  - The indent is ::slotted([data-depth="1"]). A child of a shut parent gets data-shut, and CSS hides it. JS writes only the attribute.
- The hidden rows come from a DOM-free helper, src/core/ui/tree-rows.ts, lifted from sherpa-nav's #syncRowVisibility (sherpa-nav.ts:449-475, T-parent-chain-walk-not-a-selector). It takes parentOf and an open map and gives the hidden ids. The nav and the menu both use it. The lift is for reuse; it is not a speed fix (the nav already uses Maps).
- Open state is the menu's own, kept across items(), as the nav keeps #opened (:446).
- Tick state is DATA: a picked Set and a parent → children Map, built once per items(). Boxes are drawn from it.
  - A parent box is checked when the parent is picked, indeterminate when some children are picked, and clear when none are. Set as a property, as #syncSelectAll does (:1830-1840).
  - Ticking a parent picks the parent; its children show ticked. Unticking one child of a picked parent unpicks the parent and picks the other children as paths.
  - Ticking every child does NOT pick the parent (Q1 A): the parent box stays indeterminate.
  - values (:1171) gives the normalised picks. A tick costs O(children of that parent).
- A read-back getter, itemData, gives each item's value, label and parent from DATA, not from stamped rows. The chip's #state reads it, so unstamped children still have labels and parents.
- Keys: the twisty, ArrowRight and ArrowLeft open and shut a parent (the drill key code, :1928-1941). Space ticks.
- Accessibility: the twisty is a button with aria-expanded and aria-controls (its child row ids). A child row's box gets aria-describedby its parent's label. The parent box's indeterminate is read as 'mixed'. The a11y commit adds a check for these, because axe does not catch a flat list of indented boxes.
- A shut parent's children are stamped the first time it opens. Until then their ticks live in the picked Set.
- Search matches labels in the DATA. A matching child shows with its parent open. The open state comes back when the search clears.
- Select all ticks every parent. In single select a tiered field shows radios, with no tri-state.
- Cost: opening stamps P rows plus the children of open parents. Present and greys loop only stamped rows. No row gets a hover-drill timer.
- This opens children IN PLACE. Will's outline said 'reuse the menu's child menus (T-a-row-opens-its-child-menu)'. That is a real choice, so it is Q5.

7. THE PANEL'S VIEW SCOPE: A SITES MENU ON EACH CUSTOMER CHIP
- State is data. For a tiered field the panel keeps one pick Set per field (parents and paths). #picked (:1332-1337) returns that Set for a tiered field. It does not read data-current.
- #drawField (:856-946) draws PARENT chips only (#valueChip :807-830). Each parent chip with children is data-locked and has data-menu, so it splits into a body and a caret (sherpa-quick-filter.ts:646-660). The panel writes its data-current: on when the customer or any of its sites is picked (Q2).
- The body: the chip is locked, so it only relays quick-filter-click (:620). The panel then clears every pick under that customer if it has one, else picks the customer. Then it draws the chips from the Set.
- The caret: the chip emits a new generic event, quick-filter-open, before it opens. The panel answers by appending the sites menu at once (menuFor, data-commit, the same as #buildDrillMenu); its items come one tick later, as today. When the menu shuts, the panel drops it (as #dropBuilt).
  - So a shut chip has no menu, and the empty-chip rule (quick-filter.ts:615-620, T-an-empty-chip-opens-its-menu) cannot turn a body press into an open. (Fixed.)
  - A sites menu commit lands in #onAddCommit (:1617-1632). For a tiered field it replaces that customer's paths in the Set, and does NOT run chip.toggleAttribute('data-current', picked.length > 0) (:1626). (Fixed: that line read a sites-only pick as the whole customer.)
- #onDrilled (:1288-1305) for a tiered field writes the drilled tree menu's values into the Set, parents and paths, then draws. (Fixed: it mapped onto parent chips only, so path picks were lost.)
- Counts and greys for site rows come from drawValueResults (:472-483) and #markPresent (:524-546), passed to the open menu.
- Cost: at most 16 parent chips (EXPLODE_AT). No sites menu exists until its caret is pressed. A shut panel builds none (367).
- It does not use hangSavedMenu (saved-filter-menu.ts), which 366 S4 deletes.

8. THE BAR CHIP FACE, THE GRID HEADING AND THE 373 CELL CHIP
- Face: filterFace (filter-face.ts:65) groups picks by parent: a whole parent reads as its label; a parent with some children reads 'Northwind: London, Leeds'. So 'Contoso, Northwind: London', and the tooltip says the same (Q3).
- conditionLines and sayReadings are NOT changed: 366 S4 deletes them (plan-366-build.md:248).
- The chip's #state (sherpa-quick-filter.ts:895-925) takes labels and parents from the menu's itemData, and counts all over parents only.
- Grid heading: the Customer heading menu is the same tree (menuFor). It sends its reading, not a clause, because its clause read-back (clauseConditions) cannot say a two-field clause.
- The Site column has NO heading filter: #filterDef (sherpa-data-grid.ts:717-744) returns null for a field the facts mark as a child (childOf). (Fixed: a text column gets one by default at :536.)
- 373 cell chip: on a child-tier cell, #cellValue (:1344) gives the path {customer: row.customer, site: row.site} on the PARENT field. In Demos, Customer is held by the View, so this chip shows inactive (374).

9. DEMOS DATA (../Sherpa Demos)
- seed-lists.js gets customerSites: 2 to 4 office sites per customer (Northwind: London, Leeds, ...).
- records-data.js: site is drawn from the INDEX, not from rnd(): site: customerSites[customer][i % customerSites[customer].length]. (Fixed: a rnd() call at :69 moves every later draw, every email key and every count. From the index, no value, key or count moves.)
- seedVersion 2 → 3 (:141). The keys do not move, so putAll writes the same 100 rows with site added. No old rows stay beside new ones.
- customerSchema gets site: oneOf(allSites), NOT required (:102). oneOf passes an absent value (validate.ts:212-216 whenPresent). (Fixed: required would drop every row Will added, since the schema runs on reads, :89-91.) A row with no site still matches its customer pick (Q1 A).
- The Add/Edit dialog (records.html:117-145, records.js) gets a Site select that lists the picked Customer's sites.
- A Site grid column after Customer.
- records.json gets "child": "site" in a LATER commit, after the panel and grid commits. Until then Site is a plain field. So no Demos page shows a half-built tree.
- The dashboard's alerts have no sites: its Customer chip stays flat. That proves a field without child does not change.
- Demos specs: the seed moves no count, so view-chips, serial-account-set, chip-results, panel-apply and records-persist keep their numbers. limit-options reads the Customer menu rows (:99-110): children are under shut parents, so the visible rows do not change; re-check it.
- The Demos server does not read records (server/index.mjs imports only alertRow). Nothing there changes.

10. GATES
- check:bench: ROWS gets site from the index (no rnd draw), so no existing act moves. A new tiered page fixture and three acts go LAST: pick a parent, pick a child, pick both.
- check:weight, the a11y gate plus the tree check in 6, and spec:check, manifest and reference for sherpa-menu and sherpa-quick-filter.
- PEER GATE on every commit: run git status first. If a file the commit edits has changes I did not make, run ListAgents or ask Will. Never stash. Stage only my paths, and only while git diff --cached is empty.

11. ORDER AGAINST 366 (fixed: the old 'before 366' commits wrote into code that 366 deletes)
- Before 366 (touch nothing 366 deletes or rewrites): the store perf, the declaration, the catalogue, the clause, the walk, tree-rows, the tree menu, the bar face and chip #state, the Demos seed (no child link). 366 edits page-definition.ts and page.v1.json in S2, and source-counts.ts in S3, but other lines. One builder works in one line, so this is line moves, not rework.
- After 366 commit 20: the panel. After 366 commit 23: the grid. After both: the Demos child link. After 345 phase 5: the remote lazy read.
- Q6 asks Will if he wants this order.

WHAT I REJECTED, AND WHY
- None of the findings. All were real. Two I took in part:
  - 'check:bench rows: adding site moves every act': true only if site uses rnd(). From the index nothing moves, so I keep site in ROWS and add a separate fixture for the tiered acts.
  - 'The departure from child menus is silent': I keep in-place expansion as the pick, but it is now Q5, for Will.
- The perf commit no longer claims a lower check:bench baseline. check:bench counts reads and scans, not time (check-bench.mjs:32), so a key Set changes no count. It gets a null guard: null is kept out of the Set and tested by itself, so in [''] and in [null] keep their meanings (looseEqual(null, '') is false, store.ts:440-445).

## Commits

### perf(store): an in-list matches by a key Set

matchesFilter's in and notin (store.ts:414-416) keep each list's lower-case keys as a Set, cached per list in a WeakMap. A null or undefined in the list or in the row is tested by itself, as looseEqual does (:440-445), so in [''] and in [null] keep their meanings. Today looseEqual builds a key per row for each list value.

**Tests:** node unit: in and notin with strings, numbers, case, objects, null, undefined and ''. check:bench IDENTICAL (it counts, not times). A timing note in the commit body from a 10k-row, 40-value node run.

**Gates:** Any time. Touches nothing 366 touches.

### data(369): a field declares its child tier

child on FieldDeclaration (data-source-types.ts:41-65), page.v1.json's field, docs/PAGE-DEFINITION.md and the MCP's validate_page. openSource reports a child that is not declared, a child on a number or date field, and a scope, set or column filter that names a child. offers: 'all' (page-definition.ts:95) leaves out child fields. No other behaviour changes.

**Tests:** node unit: page validation with a good child and each bad case; offers 'all' without the child. check:mcp-pack.

**Gates:** Before 366 (Q6 A). S2 edits other lines of page-definition.ts and page.v1.json; build on HEAD.

### data(369): a tiered field keeps its children apart from its domain

FieldCatalogue gets a children map (parent key → child values, path key → path object) and declareChildren(field): one load pass when the rows are in memory, else nothing yet. The domain does not change, so valuesFor, legends, banded summaries and describe never see a child. filterDef gives parents then children with parent. FieldFilter, FilterOption and MenuItem get parent?. facts() gives child, parentOf and path labels. oneChipList counts parents. The panel's #drawField skips options with parent (a guard until the panel commit).

**Tests:** node unit with a tiered fixture: tree order, de-duping by valueKey, the same site under two parents, a schema domain on the parent still gets children, valuesFor has no paths, oneChipList.

**Gates:** Before 366.

### data(369): a path pick compiles to and/or over two fields

fieldState drops a path whose parent is picked (the only normalising rule), gives each path's ValueEntry parent, and counts 'everything ticked' over parents. tierClause in rowClause gives or(in P, and(eq p, in S)...), De Morgan for ne, split by object fields. whereOf and readingsOf keep a tiered field as an in or notin pick list. apply() with reach 'component' maps keys through byKey as select does. The walk's each passes child.

**Tests:** node unit: clause shapes for in and ne; normalising; round trips through whereOf and readingsOf for in and notin; a Where with path objects; a plain-JSON clause a fake server runs; select and apply map path keys to objects; a condition row on a tiered field works on the parent.

**Gates:** Before 366. Changes no door 366 moves.

### data(369): the walk counts and greys at both tiers

keyOf gives a parent key and a path key from a precomputed field order. walkReads adds the child to tallied. walkStepwise judges a path by its parent key, so it never sets aside a path whose parent is present. check-bench ROWS gets site from the index; a tiered page and three acts go last.

**Tests:** source-counts unit: child greys under a Region pick, per-pick counts for a path, set-aside of a path (held), a stepwise source keeps a path pick, an edit to site alone walks again, a serial chain with a tiered top. check:bench: existing acts IDENTICAL, three new acts recorded.

**Gates:** Before 366. S3 edits other parts of source-counts.ts (the preset steps).

### ui(369): one tree-row helper for the nav and the menu

Lift sherpa-nav's #syncRowVisibility (sherpa-nav.ts:449-475) into a DOM-free src/core/ui/tree-rows.ts: parentOf and an open map in, hidden ids out. The nav uses it. For reuse, not speed.

**Tests:** nav Playwright suite unchanged in 3 engines. A node unit for the helper. map:write.

**Gates:** Any time.

### menu(369): a menu draws a tree of tri-state boxes

Parent rows get a menu-twisty-tpl clone and a tri-state box; child rows get data-parent, data-depth and data-shut, with CSS doing indent and hiding. Ticks are data (picked Set, children Map); all children ticked leaves the parent 'some'. Open state kept across items(). Twisty, ArrowRight, ArrowLeft. Children stamped on first open. Search over data. values gives normalised picks; itemData gives each item from data. aria-expanded and aria-controls on the twisty, aria-describedby on child boxes. Remake spec, manifest, reference. TRAP T-a-tree-menu-keeps-its-ticks-as-data.

**Tests:** Playwright in 3 engines: all, some, none on a parent; ticking a parent; unticking one child of a picked parent; all children ticked stays 'some'; keys; search; greys and inactive ticked rows; open state kept across items(); itemData with unstamped children. a11y gate plus an aria check for the twisty and child rows. check:weight.

**Gates:** Before 366 (Q5 A). Commit 22 later rewrites the TRAP text at sherpa-menu.ts:1163 only.

### filters(369): the bar's tiered chip opens the tree, and its face groups by parent

filterFace says 'Contoso, Northwind: London'; the tooltip is the same. The chip's #state takes labels and parents from the menu's itemData and counts all over parents. conditionLines and sayReadings are not touched (366 S4 deletes them).

**Tests:** node unit for filterFace with paths. Toolbar Playwright on an in-repo tiered fixture: pick a parent, a child and both; the face, the badge and the compiled rows.

**Gates:** Before 366. Does not touch the toolbar emit (366 21) or the lock code (366 22).

### demos(369): customers have sites

seed-lists customerSites. site from the index (no rnd draw), schema site: oneOf(allSites) without required, seedVersion 3. A Site column. The Add/Edit dialog's Site select follows Customer. No child link yet, so Site is a plain field.

**Tests:** Demos suite: no count moves. Old IndexedDB rows are overwritten by key; rows Will added stay valid. sherpa-ui check-usage passes.

**Gates:** After commit 3. Before 366 is fine.

### panel(369): each Customer chip in the View scope opens its sites

The panel keeps one pick Set per tiered field; #picked returns it. Parent chips are data-locked with data-menu; the panel writes data-current (any pick). Body: clear the customer's picks, or pick it. A new quick-filter-open event lets the panel append the sites menu on the caret press and drop it on close. #onAddCommit for a tiered field replaces that customer's paths and skips the data-current line. #onDrilled writes parents and paths into the Set. #buildDrillMenu passes parent. Counts and greys reach the open menu. Drop the commit-3 guard. Spec, manifest and reference for quick-filter.

**Tests:** Panel Playwright in 3 engines: the body toggles the customer, also with no site picked (it does not open the menu); the caret opens its sites; a site pick filters and keeps the chip on; a sites-only pick is not the whole customer; a drilled tree pick keeps paths; greys on site rows; a shut panel builds no menu (367).

**Gates:** WAIT for 366 commit 20 (#report and #readingOf rewritten). Peer gate.

### grid(369): the heading menu is the tree; a Site cell chip picks its path

The Customer heading uses the tree menu and sends its reading. #filterDef returns null for a child field, so Site has no heading filter. #cellValue on a child column gives the path on the parent field. The grid's #facts pass child.

**Tests:** Grid Playwright: tree heading picks; no Site heading filter; a Site cell chip adds and removes a path; inactive when the View holds Customer (374).

**Gates:** WAIT for 366 commit 23. Peer gate (the grid has held peer work).

### demos(369): Customer names Site as its child

records.json: customer gets child: site; site is declared; the dataset declares children. The tree shows in the bar, the panel and the heading.

**Tests:** Demos suite. Re-check limit-options (menu rows), view-chips, serial-account-set, add-customer-form, records-persist. New Demos spec: pick a site in the header chip, see it in the panel's Customer chip menu and in the grid.

**Gates:** After the panel and grid commits.

### data(369): a remote source reads a parent's children when its row opens

declareChildren for a store not in memory: distinct([child], {filter: parent eq p}) on first open of a tree row or a chip's sites menu, cached with 345's cache and added to the children map. Greys from the same read under the scope's walk filter. The menu shows its loading state until the values come.

**Tests:** Data unit with a remote store: one read per opened parent, none again; byKey finds the read paths. Playwright: loading, then rows.

**Gates:** WAIT for 345 phase 5. Follows Q4.

### docs(369): tiered values

TRAPS: T-a-value-holds-child-values, T-a-parent-pick-is-the-parent, T-a-tree-menu-keeps-its-ticks-as-data, T-a-path-is-judged-by-its-parent-when-stepwise. The server clause shape in DATA-SOURCE-RULES. APP-GUIDE and PAGE-DEFINITION. Mark TODO 369 ✅.

**Tests:** check:map, check:reference, check:traps.

**Gates:** Last.

## The check (the revise above answers it)

- **unsafe:** Demos seed (records-data.js:51,58-86): adding `site: pick(...)` at :69 adds an rnd() call to every record. That shifts every later draw (name, email, status, plan, region, seats…) for all 100 rows, not just the counts. Specs the design does not name break: reforged-chip-results.spec.ts:26,34 (total 13) and reforged-panel-apply.spec.ts:112-133 (total 10). Email is the key, so every key changes too. localRecords only putAll()s on a reseed and never deletes (idb-store.ts:72-75: 'a row a person added stays'), so Will's :4200 browser keeps the 100 old rows beside the new ones. Fix: draw site from its own PRNG or from the index. Then no existing value or key moves. check-bench.mjs:114-129 has the same problem: adding site to ROWS moves the baseline of every existing act.
- **unsafe:** Demos schema `site: [required(), oneOf(allSites)]` (design :102): the schema runs on READS (records-data.js:89-91). Every row in IndexedDB without a site is then dropped and reported. That means rows Will added, plus the 100 old-key seed rows from the point above.
- **unsafe:** Panel site menu on a value chip breaks the chip's own rules. (a) With no site picked, a press on the body OPENS the menu. It does not toggle the customer (quick-filter.ts:615-620, T-an-empty-chip-opens-its-menu: `menu && values.length === 0`). (b) A site pick sets the chip data-current: #onAddCommit does `chip.toggleAttribute('data-current', picked.length > 0)` (panel.ts:1626), and the chip's #applySelection does `current = values.length > 0` (quick-filter.ts:420). So '#picked adds paths only for chips that are not data-current' reads a sites-only pick as the WHOLE customer. Q2 A ('on for any pick') makes data-current unable to mean 'customer picked'. The chip needs data-locked, and the panel needs its own per-customer state.
- **unsafe:** walkReads (walk.ts:118,120) adds only step.field / tap.field to `tallied`. The walk is redone only when a field it reads moves (data-source.ts:1713 moved(w.reads)). If keyOf reads the child, a record edit that changes only `site` keeps the old walk, so path counts and greys go stale. The child must be added to tallied.
- **unsafe:** walkStepwise (source-counts.ts:225-239) tallies through presentUnder → store.distinct(fields) per field (:31-33). It cannot produce path keys. The present set then holds only parent keys, so in the set-aside check (:272-279), holdsKey fails for every path pick: path picks are ruled out and dropped from the applied clause through step.less. A remote source not held would change the reader's filter. The design says walkStepwise 'then works at both tiers'. It does not.
- **unsafe:** declareFromRows (data-source.ts:983-984) calls reads.distinct(open) whenever the reads have distinct. ArrayStore (stores.ts:84) and HeldSet (held-set.ts:134) both do. So a held remote source and the check:bench ArrayStore never read pairs. Also, FieldCatalogue.fromRows skips any field that already has a domain (field-catalogue.ts:142), and Customer's domain is set from the schema's oneOf at construction (records-data.js:102 → data-source.ts:273-276). So Demos' customer pairs are never read either.
- **unsafe:** Normalising 'every child picked → the parent replaces them' contradicts Q1 A. A parent pick also matches rows with no site, or with a site outside the list, so the swap WIDENS the result. Under Q4 A (children read lazily) 'every child' is not known.
- **unsafe:** Path labels: fieldState takes a label from facts.labels[key] or falls back to the key (filter-state.ts:335). So filterFace (filter-face.ts:69-72), conditionLines and sayReadings (:172-201) and the grid's #columnFilterLabel all print `{customer:Northwind,site:London}`. The chip's own #state (quick-filter.ts:895-925) builds its facts from STAMPED inputs, with no child. It cannot group by parent, and with lazy stamping the unstamped children are missing from `all` (the 'everything ticked' test). Commit 8 names filterFace/conditionLines only.
- **unsafe:** Key→raw mapping: only `picked` is mapped through catalogue.byKey (data-source.ts:1125-1126). Condition rows' `picked` are not. apply() with reach 'component' (data-source.ts:679-686) bypasses select. Under Q4 A, children read lazily are not in the catalogue, so byKey misses them. In each case a path stays a key string, and tierClause cannot split it into customer and site.
- **unsafe:** The `ne` De Morgan form is notin P AND (ne p OR notin S). That is an or inside an and, which readingsOf rejects with 'unreadable-condition' (where.ts:79-85). So a saved or kept Where with a tiered ne is dropped unless whereOf/readingsOf special-case notin as well as in.
- **unsafe:** Putting paths in the field's domain leaks them to every valuesFor/filterDef consumer: the provider's legend picks (sherpa-provider.ts:824), summariseBanded categories (:717), and describe's chart-part options (data-source.ts:758). A chart or legend on a tiered field gets one category per path. Keep children out of the domain: use a separate children map in the catalogue.
- **unsafe:** Ordering against 366: commits 5, 7 and 8 are 'Before 366', but 366 deletes or rewrites the same code. S4 deletes conditionLines, sayReadings and SaidField (plan-366-build.md:248) and the saved-chip menus (hangSavedMenu, the precedent the panel commit names). S3 rewrites planWalk/answerOrder (:187). Commit 22 reworks the menu's values getter area (:741, sherpa-menu.ts:1163-1177). The work is redone or collides, and after 366 commit 20 the hangSavedMenu precedent no longer exists.
- **wrong:** 'A held source or a loaded store reads the pairs in the one load it already does (data-source.ts:987-993)': false. When the reads have distinct (ArrayStore, HeldSet), :984 takes the distinct branch first, and fromRows skips fields that already have a domain (field-catalogue.ts:142).
- **wrong:** 'Customer's domain still comes from its schema's oneOf' and 'fromRows puts one flat tree-order list' cannot both hold: a schema domain stops fromRows from reading that field.
- **wrong:** 'keyOf gives two keys… then tally, present, offered, aside, walkStepwise… work at both tiers': walkStepwise does not use keyOf. It uses per-field distinct (source-counts.ts:25-37).
- **wrong:** 'replaces the nav's O(rows×depth) walk with a Map': #syncRowVisibility already builds Maps (sherpa-nav.ts:452-474). The walk is Map lookups up a short chain, so the gain is negligible. The real value of the lift is reuse.
- **wrong:** Commit 1 says 'check:bench rows and scans stay the same or fall; record a lower baseline'. check:bench gates loads, counts, distinct, rows, compiles, clones and scans (check-bench.mjs:32), not time. A Set inside matchesFilter changes none of these, so there is no lower baseline to record.
- **wrong:** 'the server can import it' (seed-lists customerSites): Demos server/index.mjs imports only dashboard-data's alertRow, and no server path reads records.
- **wrong:** Against Will's outline (docs/TODO.md:1645-1646, 'Reuse first: the menu's child menus (T-a-row-opens-its-child-menu)'): the design drops the child-menu drill in favour of in-place expansion. That may be right for 'a parent's box showing all, some or none', but it is a departure Will should be told about, not a silent one.
- **missing:** `offers: "all"` hands EVERY declared field to source.offer (page-definition.ts:95), so Site appears in the data scope's Add list (records.json:39). No commit excludes a child field there. openSource should also report a scope that holds a child, or a set that names one.
- **missing:** Grid Site column: every text column gets a heading filter by default (sherpa-data-grid.ts:536 FILTERABLE, #filterDef :717-744 lists #presentValues). That is a second, flat writer on `site`. The design says 'no heading filter' but names no mechanism.
- **missing:** #onDrilled (panel.ts:1288-1305) maps a drilled menu's values onto PARENT chips only (`want.has(chip.dataset.value)`), so path picks made in the drilled tree menu are lost. Commit 10 changes only #buildDrillMenu.
- **missing:** FieldFacts (filter-state.ts:135-152) and FilterState need `child`, and FieldCatalogue.facts (field-catalogue.ts:85-96) must pass it on. Every caller of fieldState/readingClause that builds its own facts needs it too: grid #facts (sherpa-data-grid.ts:915-918), quick-filter #state (:909) and source-counts `each` (:164). Only the walk's `each` is named.
- **missing:** Perf commit 1: looseEqual(null, '') is false (store.ts:440-445), but a Set of text() keys maps null and '' both to '' (store.ts:470-476). Without a null guard, `in ['']` and `in [null]` change meaning. The tests listed do not cover null or empty.
- **missing:** The tree rows need hierarchy semantics: aria-expanded on the twisty, and a level or grouping for child rows. The axe gate will not catch a flat list of indented checkboxes.
- **missing:** The working tree already has uncommitted edits to sherpa-filter-panel.html and reforged-filter-panel-component.spec.ts, maybe a peer's. The panel commit must check for a live peer first.

## The map

READ-ONLY MAP of TODO 369 at HEAD (sherpa-data-layer). Nothing was edited, built or run. The TODO is still ⬜ (docs/TODO.md:53, section :1623-1647). No code holds a parent/child value concept yet: grep of src/core/data for parent/children/tier finds only readField's dotted path (store.ts:268) and filterKey's AND/OR "children" (query.ts:194).

1. HOW A VALUE LIST REACHES A CONTROL
- Declaration. A page JSON field (view-schemas/*.json, `source.fields`) is a `FieldDeclaration` (data-source-types.ts:41-65): type, label, select, advanced, op, min/max/step, thresholds, icon, labels, carryOver. Nothing in it says "parent" or "children". schemas/page.v1.json:51-86 sets `additionalProperties:false` on a field, so a new key must be added to the schema too, and to docs/PAGE-DEFINITION.md and the MCP's validate_page. openSource (page-definition.ts:66-111) calls declareField for each field, then `declareFromRows(fields)` (:77).
- Values come from the data, never from the definition (page-definition.ts:33-35, TRAP T-the-data-says-what-a-field-may-hold, TRAPS.md:17984). DataSource.declareFromRows (data-source.ts:979-995) asks `store.distinct(open)` when the store has it, else does one `load({})` and maps `readField(r,f)`. FieldCatalogue.fromRows (field-catalogue.ts:138-171) de-dupes by valueKey, sorts, and calls declareValues (:43), which keeps each RAW value once per key.
- distinct() is per field and flat (store.ts:240, distinctOf :280). It cannot return (customer, site) PAIRS. A tier read from data needs one of two things: a child value that carries its parent (an object value, `{customer,name}`, which valueKey already keys at store.ts:475), or a paired read.
- FilterDef. catalogue.filterDef (field-catalogue.ts:104-117) builds `options: [{value: valueKey(v), label: labels?.[v] ?? v}]`, a FLAT list. FieldFilter.options is typed `{value,label,swatch?}[]` (data-source-types.ts:74). The UI-side FilterOption (filter-def.ts:17-34) is flat too: value, label, selected, available, note, section, swatch, kind, saved.
- describe(scope) (data-source.ts:751-827) hands every held field to the controls as `{...filterDef(f), state: reading}`. The provider draws it onto the bar, the panel (drawScopes, sherpa-filter-panel.ts:769-791, which maps options and adds `selected`) and the grid (#givenFilters).
- Kind. kindOf (filter-kind.ts:63-74): options plus select:'multiple' gives 'multi'. oneChipList (:96-99, EXPLODE_AT=16 at :93): more than 16 values makes the panel draw ONE chip with the list in its menu, not a run of chips.
- menuFor (filter-menu.ts:73-184) clones `template.filter-menu-tpl` (FILTER_MENU_HTML, :31) and sets data-select, data-commit and data-type="filter". It returns `items = [...def.options]` unchanged (:183). The caller fills the menu with `menu.items(items)`.
  - Bar: toolbar #addMenu (sherpa-quick-filter-toolbar.ts:811-845). Each item is spread (`...item`, :831), so new MenuItem fields would pass through.
  - Grid heading: #buildColumnFilter (sherpa-data-grid.ts:643), #filterDef (:717-745) and #columnItems (:747-750) spread items too.
  - Panel: #giveMenu (sherpa-filter-panel.ts:954-982) builds a menu only for a one-chip field, an arrangement or an inline body. It returns at :959 for a run of value chips: "a run of chips answers it already".
- sherpa-menu draws rows. MenuItem (sherpa-menu.ts:46-69) has value, label, selected, available, note, section, drill, pickable, count and remove. It has no parent and no depth.
  - items() (:1314) records the items, then #stampItems (:1399-1480) clones ONE check or radio prototype per item (sherpa-menu.html:189-209). It adds a section heading where `section` changes, and the menu's own Select-all row (`menu-all-tpl`).
  - The menu prepends every row into its light DOM in one pass, and emits `menu-items`. The rows are slotted, so CSS reaches the row only (::slotted, sherpa-menu.css:366-530).
  - `values` (:1171-1182) is the checked inputs from #inputs() (:1489), as a FLAT string list. The values setter (:1274-1292) ticks by valueSet.
  - `reading` (:415-435) is `{picked: values, conditions?, mode, mirror}`.
- Child menus today mean DRILL, not a tree. `drill:true` gives a row a count badge and a caret (#addDrill :1061-1076). A rest of 500 ms, ArrowRight or a click emits `menu-drill {value}` (#drillInto :1902; hover :1914-1925; keys :1928-1941). The HOST then MOVES the rows of another menu into this card, one level deep (MenuDrill, filters-button.ts:256; TRAP T-drill-moves-not-clones, TRAPS.md:776-801; T-a-row-opens-its-child-menu :10411; T-menu-back-is-a-report :5651).
  - Hosts that do this: the toolbar's Filters menu (toolbar.ts:211-226, :341-343) and the panel's Filters menu (panel.ts:204-206, :1217-1330). The panel BUILDS a menu for a run of values with #buildDrillMenu (:1262-1281), which maps only value, label and selected. On a drilled pick, #onDrilled (:1289-1312) ticks the run's chips.
  - #onChange (:1944) drops events from nested menus (T-a-nested-menu-answers-for-itself, TRAPS.md:18162).
- Tri-state today exists only on Select all. #syncSelectAll (:1830-1840) sets `all.indeterminate = on>0 && on<boxes.length`, and #onSelectAll (:1816-1827) ticks boxes. See T-indeterminate-is-a-property (TRAPS.md:5623) and T-indeterminate-reports-false.

2. HOW A PICK COMPILES
- Bar path. Menu tick → chip.reading (sherpa-quick-filter.ts:335-338: menu.reading plus `suspended` when off) → toolbar `readings` / #answers (toolbar.ts:1170-1200) → `quick-filter-change {readings}`. Then bind-source.ts:205-229 calls source.answerScope (data-source.ts:2290-2316) → answer (:697) → apply (:678) → select(field, picked, reading) (:1121-1137).
- select maps each KEY back to the raw value through catalogue.byKey (:1125-1126; field-catalogue.ts:124), then calls setReading on the draft Query, #recompose (:1437) and #draw(field) (:1149-1167).
- Grid path. A heading's Apply goes through answerColumn (:2320).
- Panel path. #onValueClick (panel.ts:1383-1408) toggles the chip's data-current. #report (:1718-1732) sends `quick-filter-change {scope:'panel', readings:{[scope]:{[field]: #readingOf(held)}}}` → answerScopes. #readingOf (:352-366) returns `{...menu.reading, picked: #picked(held)}`, and #picked (:1332-1337) reads `.value[data-current]` dataset values.
- Compile. #compileNow (:1455) → compile(query) (query.ts:247) → scopeClauses (:212-233) → readingClause (filter-state.ts:408) → fieldState (:307-391) → stateClause (:397) → chainRows (:548) → rowClause (:466) → picksClause (store.ts:518-528). One pick gives `eq`; several give `in`.
- matchesFilter (store.ts:384), `in` case at :414. Each list value goes through looseEqual (:440), which calls text() → valueKey().toLowerCase() (:463, :475). That is PER ROW, PER LIST VALUE, recomputed every time.
- A plain-JSON Where (where.ts:21-35) round-trips through whereOf / readingsOf.
- PITFALL for tiers: fieldState builds `values` ONLY from the declared domain (`declared = facts.values ?? picked`, filter-state.ts:319), and `ends` (:363) only from those entries.
  - A picked key not in the field's declared values compiles to NOTHING, silently.
  - #draw redraws picks from `state.values` (data-source.ts:1158-1159), so the pick is also dropped from every control.
  - filterFace labels picks from state.values (filter-face.ts:65, :172).
  - "Everything ticked is no filter" is `chosen < all.length` (filter-state.ts:351).
  - So child keys must be in that field's declared values, or tiers need their own rule here.

3. COUNTS, GREYS, SET-ASIDE AND THE WALK
- planWalk (source-counts.ts:120-208) makes one step per held field, in answerOrder (:51-88): saved filters first, then fields, sets together, and a serial chain marked top or below.
  - A list field gets `ruler` 'here' (Limit on) or 'start'.
  - A serial lower field gets `offers`.
  - A plain pick gets `each` (:162-167), one clause PER PICKED VALUE, and `picks` / `less` (:168-170) for set-aside.
- walkInOrder / passOver (walk.ts:246-315, :170-197) tally `keyOf(row, field)` (:146: valueKey of readField) into a Set per step and per tap. Each `each` clause runs matchesFilter on every row that reaches its step. Set-aside rescans from step j.
- walkStepwise (source-counts.ts:214-311) is the same plan for a store that is not held: totalCount per count, and distinct batched per filter.
- Outputs:
  - results: a chip's badge.
  - values: per-pick counts (TODO 172).
  - present: greys (349).
  - offered: serial removal.
  - aside.
- Delivery. #drawWalk (data-source.ts:2143-2180) calls each bound control's drawResults, drawValueResults, drawPresent and drawOffered. The control then sets `menu.present` / `menu.offered` (sherpa-menu.ts:1332-1358). #markPresent (:1362-1395) greys or removes rows by ruleOut (filter-state.ts ruleOut, case-insensitive key sets).
  - Bar: toolbar #markPresent (:586-595).
  - Grid: #markPresent (sherpa-data-grid.ts:769-780).
  - Panel: #markPresent (panel.ts:524-546) toggles data-unavailable and data-removed on each `.value` chip.
- Everything is keyed by ONE field's value keys. A child tier needs its own keys tallied, either in the same field's key space or in a child field, or its rows are never greyed or counted.

4. THE PANEL'S VIEW SCOPE: THE CUSTOMER CHIPS
- Demos' records View scope holds customer, region and created (Sherpa Demos/app/view-schemas/records.json:36-37). There are 8 customers, which is not over 16, so #drawField (panel.ts:856-946) EXPLODES them into a run.
- Each option becomes #valueChip (:807-830): a bare `<sherpa-quick-filter class="value">` cloned from `template.value-tpl` (sherpa-filter-panel.html:209-211), with data-value, data-label and data-current. It has NO menu and acts as an on/off toggle.
- Per-chip counts arrive by drawValueResults (:472-483). Greys arrive by #markPresent.
- The only value chip in the panel that carries a menu today is a SAVED chip: #addSavedMenu (:1557-1560) → hangSavedMenu (saved-filter-menu.ts:177-182), which sets `chip.setAttribute('data-menu','')` and appends the menu.
- A chip with data-menu splits into a body (toggle) and a caret (opens the menu): #onCaret (sherpa-quick-filter.ts:648-660), #togglesOnly (:246). A Customer chip with a sites menu fits this: the body toggles the customer, and the caret opens its sites.

**Reuse:**

- Menu rows: one prototype per row type (sherpa-menu.html:189-209). #stampItems (sherpa-menu.ts:1399-1480) already handles a heading per `section`. A tree adds data-depth / data-parent on the row and a caret clone, as #addDrill (:1061-1076) does with `menu-count-tpl` / `menu-drill-tpl`. Indent and visibility must be ::slotted rules on the ROW itself (sherpa-menu.css:366-415), because ::slotted cannot reach children.
- Child menus (T-a-row-opens-its-child-menu): MenuItem.drill / count, the `menu-drill` / `menu-back` events, hover-to-open (500 ms), ArrowRight/ArrowLeft (sherpa-menu.ts:1902-1941) and MenuDrill (filters-button.ts:256). This is ONE-LEVEL drill-in-place that MOVES rows between menus, so it is not a tree. Reuse its key handling and count badge for an expand caret. Do not reuse the move: a tree keeps both tiers in one menu, so `values` and Select all see every box.
- Nav tree rows: sherpa-nav #buildRows (sherpa-nav.ts:324-356) stamps a FLAT list of sibling rows with data-parent and data-depth (max 3). The #opened Map keeps open state across a populate (:446). #syncRowVisibility (:449-475) walks up the parent chain and writes data-hidden, which CSS hides (sherpa-nav.css:390-397; TRAP T-parent-chain-walk-not-a-selector, TRAPS.md:6663). sherpa-nav-item has data-expandable / data-expanded, emits `item-expand {expanded}` (sherpa-nav-item.ts:198-200), and indents by data-tier tokens (sherpa-nav-item.css:63-64). Lift that walk into a shared helper and give it a parent→children Map. Today's walk is O(rows × depth).
- Tri-state boxes: the menu's #syncSelectAll (sherpa-menu.ts:1830-1840) and #onSelectAll (:1816-1827) already compute all / some / none over a box set, and set `.indeterminate` as a PROPERTY (T-indeterminate-is-a-property). The grid's #syncGroupSelects (sherpa-data-grid.ts:2048-2059) does the same for a group heading over its rows, but it is O(groups × rows) because it filters every row per group. A parent box is 'Select all' scoped to its children; generalise that, keyed by a Map. sherpa-select-checkbox exposes `indeterminate` too (sherpa-select-checkbox.ts:63, :103).
- valueKey objects (store.ts:475-486, TRAP T-a-value-can-be-an-object, TRAPS.md:14421): an object value is keyed by its sorted fields, and catalogue.declareValues / byKey (field-catalogue.ts:43, :124) and DataSource.select (data-source.ts:1125-1126) map keys back to raw values. A child value such as `{customer:'Northwind', site:'London'}` therefore already has a stable key, is de-duped and distinct()-able, can carry its parent, and can be told apart from another customer's 'London'. readField follows dots (store.ts:268) if the site is nested.
- menuFor (filter-menu.ts:73) is the ONE body for the bar, the grid heading and the panel. Toolbar #addMenu (toolbar.ts:831) and grid #columnItems (sherpa-data-grid.ts:747-750) spread items, so new MenuItem fields reach the menu without change. Panel #buildDrillMenu (panel.ts:1262-1281) and catalogue.filterDef (field-catalogue.ts:113) map only value and label, and would drop them.
- A value chip with its own menu in the panel already exists: hangSavedMenu (saved-filter-menu.ts:177-182) sets data-menu, appends a menu and draws it. #buildDrillMenu (panel.ts:1262) builds a menuFor menu for a run's values on demand. The chip's body/caret split (sherpa-quick-filter.ts:646-660) gives toggle-the-customer plus open-its-sites with no new chip code.
- Walk machinery: `each` per-pick counts (source-counts.ts:162-167), the ruler / offers tallies (walk.ts:146-197) and set-aside `less` (source-counts.ts:169) are generic over value keys, so they extend to a child tier by tallying the child key. The serial set's `offers` (T-a-filter-set-groups-or-chains, TRAPS.md:1804) already means 'only what the rows at my place hold', which is the shape of 'a parent's children'.
- FieldReading.picked (filter-state.ts:152-155) is already a plain-JSON list that may hold objects, and whereOf / readingsOf (where.ts:41-63) round-trip it. A tiered answer that stays ONE field's reading fits TODO 366's one-field `setReading(scope, field, reading)` request (docs/history/plan-366-design.md:83). Two fields per tree pick would not fit it.

**Demos:** DEMOS: HOW CUSTOMERS ARE DEFINED (../Sherpa Demos, read-only)

Seed data
- app/stores/seed-lists.js:10-13 defines `customerOrgs`, 8 organisation names: Northwind, Contoso, Fabrikam, Tailspin, Adventure Works, Litware, Proseware, Wingtip Toys. It is plain data, and the server imports it in Node.
- app/stores/records-data.js builds 100 seeded people (:58-86), each with `customer: pick(customerOrgs)` (:69). There is no site or location field today.
  - customerSchema (:93-112) has `customer: [required(), oneOf(customerOrgs)]` (:102). oneOf gives the store a FieldDomain (validate.ts:101), so the Customer list comes from the schema.
  - The store is `localRecords({name:'customers', key:'email', time:'created', indexes:['status','plan','tier','region','owner'], version:1, seedVersion:2})` (:132-142). Adding a site field to the seed needs a seedVersion bump. An IndexedDB index on it needs a `version` bump (comment at :124-127).
- app/stores/dashboard-data.js defines a second dataset, 1284 alerts. It re-exports customerOrgs (:29). REGION_ORGS (:31-36) gives each customer some regions, and each alert gets `customer:` (:59) and `oneOf(customerOrgs)` (:78).

Page definitions
- app/view-schemas/records.json:12 declares `"customer": {label:"Customer", select:"multiple", icon:"buildings"}`.
  - View scope at :36-37: `holds:["customer","region","created"]` and a serial set `account` with `fields:["customer","region"]`. So Customer is the TOP of a serial chain, and Region offers only that customer's regions.
  - Grid column at :56: `{field:"customer", header:"Customer", sortable:true}`.
- app/view-schemas/dashboard.json:8 declares the same customer field. Its View holds `["customer","region"]` (:26) and has no set.

Where sites would come from
- Sites belong in seed-lists.js beside customerOrgs, as a per-customer list (customer → sites), so both pages and the server agree.
- Each record then holds its site. To be read from data per T-the-data-says-what-a-field-may-hold, the child value must carry its parent:
  - (a) as an object value such as `{customer, site}`, or
  - (b) as a `site` string in its own field, with the page JSON declaring that `site` tiers under `customer`. distinct() is flat (store.ts:240), so the pairing must come from a paired read or from the object value.
- records-data.js would need `site` in customerSchema, with `oneOf` built from the seed's flattened sites. Without it, the Add dialog saves a record with no site.
- The Add/Edit dialog (app/templates/records.html:117-145; app/contexts/records.js:29, :57, :100, :286, :304, :321) gets its Customer options from `customerOrgs`. It would need a Site select that follows the Customer pick.
- dashboard-data.js would need sites on its alerts too, if the dashboard's Customer chip is to be a tree.

Other app files that name customer
- app/contexts/dashboard.js:9-65 (customer summary over customerStore)
- app/index.html:181, :621-641 (spoofRemote / keepCache over customerStore, registered as store `customers`)
- app/app.json:31 (nav label "Customers")
- app/views/records-views.json:3 (label "All customers")
- app/templates/records.html:15, :37, :74, :90, :117-145
- server/index.mjs does not filter records (it only serves /live/alerts), so the remote case is the client-side spoofRemote.

Demos tests that name customer (count of mentions)
- reforged-view-chips.spec.ts (28): View chip values `customer:['Contoso','Fabrikam']` :97-107. Store inserts need `customer` :215-250.
- reforged-limit-options.spec.ts (24): Customer picks grey Regions. It reads the Customer chip's menu rows by `.chip[data-id="customer"] sherpa-menu` (:99-110), so a tree menu changes the row structure it reads.
- reforged-serial-account-set.spec.ts (11): Customer then Region chain, built from `data.customers` (:27-47).
- reforged-add-customer-form.spec.ts (15)
- reforged-records-persist.spec.ts (12)
- reforged-nav-favorites-recents.spec.ts (10)
- reforged-send-to-view-filters.spec.ts (3)
- reforged-date-conditions.spec.ts (2)
- reforged-nav-view-hierarchy.spec.ts (2)
- 1 mention each: reforged-layout-resize, reforged-delete-is-the-critical-part, reforged-the-view-limits-a-component-scope, reforged-filter-coordination, reforged-view-drafts
- test/unit/*.mjs: none.
- Seed changes move counts. Tests that compute expectations from `data.customers` adapt; any that hard-code counts or row lists must be re-checked.
- ../Sherpa Gallery and ../Sherpa Starter: no mention of customer.
- sherpa-ui's own tests use their own fixtures (35 files mention customer; check:bench uses test/unit/fixtures/records.page.json at 10k rows), so a generic tier needs a fixture of its own.

Performance cost of a tree with many parents (P parents, C children each, R rows)
- Menu
  - #stampItems clones P×(1+C) rows eagerly in one prepend (sherpa-menu.ts:1399-1480).
  - #markPresent (:1362-1395), #syncSelectAll (:1830-1840) and search (:1030-1056) each loop every input on every present/offered draw, so they are O(P·C) per draw.
  - Shut parents' children could be stamped lazily on expand, but `values` reads checked inputs (:1171-1182), so unstamped picks would need the #heldValues/#items path that already exists for not-yet-drawn rows.
  - The panel run is bounded: more than 16 parents gives ONE chip (filter-kind.ts:93-99), so at most 16 per-customer site menus. Build each lazily on the first caret open (the #buildDrillMenu pattern), not in #drawField.
- Compile and match
  - Picking many children makes a long `in` list. matchesFilter's `in` (store.ts:414) runs looseEqual → valueKey().toLowerCase() on every list value for EVERY row (:440-463). Cost is R×k string builds per load and per walk step. Precomputing a key Set per clause fixes it, and helps every list today.
- Walk
  - `each` adds one matchesFilter per row per picked value (source-counts.ts:162-167; walk.ts:183). Ticking 1 parent and 5 sites is 6 more tests per row. A single per-key tally Map in passOver would make per-value counts O(R) whatever the number of picks.
  - Tallying a child key is one more keyOf per row per ruler/tap.
- Gates
  - check:bench (scripts/check-bench.mjs, baseline scripts/bench-baseline.json; e.g. records/pick 2558 rows, 4 compiles) gates loads, rows, compiles, clones and scans, and may only fall. Add a tiered act to it.

