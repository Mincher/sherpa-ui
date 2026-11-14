# Plan 992: no two nodes do one job — the overlap review, before more of plan 991

Will, 2026-11-14, on plan 991's new nodes: "Make sure there's no overlap between these new nodes' purpose and existing
nodes. We may need to review and refactor existing nodes in places. We will plan for that, though."

**Status: a review; Will's picks open (section 3). Until they are in, no further new kind of plan 991 is built (991a's
Statistic types, Band and Format are built; D4's rename of Floor and Ceiling to Min and Max is a rename, not a kind).
Owner: sherpa-demos-67 (the review), sherpa-ui-e8 (the node kinds), with each phase's Demos retrofit.**

## 1. The rule

**One job, one node.** Where two nodes, or a node and another part of the system, can do one job, one goes, or each
is given a job the other cannot do, said in its words. A variant is a TYPE of a kind (PRINCIPLES 19). And: a column
every page reads is the TYPE's (a status field, the data layer), never a node's (PRINCIPLES 25: only a store reads the
data).

## 2. Each overlap, and the way out

| # | New (991) | Overlaps | Who does what, after | Refactor of what we have | Pick |
|---|---|---|---|---|---|
| 1 | **Band** (Math: a number into named steps) | a type's **status field** (a column worked out by rules: At risk, Watch, Healthy) | A label every page shows is the type's status field. Band only names a value worked out INSIDE one graph (a Math result, an AI score), never a column a type could hold. Its words say so. | none | O1 |
| 2 | **Format** (Text: a Template filled per row) | **Text › Append, Prepend** (Format does both); the **message** rows of the Outputs (they fill `{{value:…}}` too) | Format builds a text for each row; an Output's message is filled the same way, by one reader (graphText's `{{value:…}}`). | Append and Prepend go; their graphs become a Format. Split and Join stay (they make and join lists). | O2 |
| 3 | **Route** (rows on by a field's value, an output per value, plus Otherwise) | **Condition** "Is one of" (two outputs), a **chain of Conditions** on one field's values, the **Boolean** gate | Route sends rows on by ONE field's value, to many places. A Condition is one test: Pass and Fail. A Boolean is "only when there is any". | A chain of Conditions that splits one field's values becomes one Route, in the shipped graphs. | — |
| 4 | **Statistic** with **Group by** (Math: one row per group, with its value) | **Organise** › Group (and a chart's axes) | Organise says how rows are SHOWN (their order, group headings, axes); Math's Group by MAKES rows, one per group. Both words say it. | none | — |
| 5 | **Merge** (two row sets: append, or by a field) and **Compare** (only in A, same, changed, only in B) | each other; and today's rule "a graph has no join: each Source reads one store" | One node, **Merge**: by a field, its outputs Matched, Only in A, Only in B (and Changed, where it compares columns). No Compare node. The rule changes: a graph joins rows by Merge, each side still read by its own Source (its store). | N-zo's rule "a graph has no join" changes. | O3 |
| 6 | **Tag** (exists: keep rows with chosen tags) | **Condition** "Is one of" on a tags field (a list cell holds a value where any of its values is it, sherpa-ui-a9) | Condition, on the tags field. | **Tag goes**; its graphs become a Field (tags) and a Condition. | O4 |
| 7 | **Viewer** (the rows at a point, as a table) | the details panel's Incoming and Outgoing JSON, Simulate's captions, and 991's "hover a socket to see its last value" | One place: the details panel shows the picked node's rows as a TABLE (beside its JSON), from Simulate's last run; a socket's tip says its last value. No Viewer node. | The details panel gains its Rows tab. | O5 |
| 8 | **Classify** (an AI puts each row in a named category, an output each) | **Route** (an output per value) | Classify is a **Prompt** answer type, "Category" (the model answers one of the named categories, a column on each row); **Route** sends the rows on by it. No second router. | none | O6 |
| 9 | **Retry / on error** (a node's Settings tab and an Error socket, D3 A) | the shipped Runbooks' **wired retry steps** (Patch rollout's "Retry once" and "Installed on retry?") | A step tried again is the step's own Retry setting. A different step on failure (a ticket) stays wired, from the Error socket or a Condition's Fail. | The Runbooks' "retry the same step" routes become the setting; their prompts' RETRIES AND ERRORS read it. | O7 |
| 10 | **On failure** (a Trigger: another graph's run failed) | the **Output Trigger** (run another Coworker when this one ends) | Output Trigger: THIS graph says what runs after it (any end, or only a failure: a new "When" row). On failure: ANY graph's failure starts this one (an app-wide watcher). Both kept, each said. | Output Trigger gains "When: it ends, it fails". | — |
| 11 | **Set field** (add or work out a column on each row) | a type's **status field**; a Field and a Math chain | As Band (1): a column every page shows is the type's; Set field writes a column for the rows of THIS graph only. | none | O1 |
| 12 | **Approval** (a Request type: Approved, Declined, Timed out) | **Request › Another agent** (ask, wait for the answer) | Approval asks a PERSON, with fixed answers; Another agent asks an AI agent for words. Both Request types. | none | — |
| 13 | **For each** (runs a Custom Node once per row, N at a time) | a **use** of a Runbook or Custom Node (it runs once, over all its rows) | A use runs once with every row; For each runs it once per row. Its words say so. | none | — |
| 14 | **Wait** | the **schedule Trigger**; **Time** (a check of a date) | A Trigger starts a run; Wait pauses one running; Time tests a date. | none | — |
| 15 | **Date maths** (Time types) | **Math** on dates | Time types (one kind for dates). | none | — |
| 16 | **Warning** (a graph says its own warning) | the library's node warnings | Kept for the author's own words; the library's stay its own. | none | — |

## 3. Picks for Will (my pick first)

- **O1 Band and Set field vs a status field.** A: keep both, for a value inside one graph only; a label every page
  shows stays the type's status field. B: drop both; any named or worked-out column is a status field on the type.
- **O2 Format vs Append and Prepend.** A: Append and Prepend go; Format does both, every graph retrofitted. B: keep all
  three.
- **O3 Merge and Compare.** A: one Merge, with Matched, Only in A and Only in B (and Changed); no Compare. B: two nodes.
- **O4 Tag.** A: Tag goes; a Condition on the tags field does it. B: keep Tag.
- **O5 Viewer.** A: no Viewer node; the details panel's Rows tab and a socket's last value. B: a Viewer node too.
- **O6 Classify.** A: a Prompt answer type, Category, then a Route. B: a Classify node with an output per category.
- **O7 Retry.** A: the shipped Runbooks' retry-the-same-step routes become the Retry setting. B: keep them wired.

## 4. Phases (after the picks)

| Phase | Does |
|---|---|
| 992a | The refactors of what we have: Tag into Condition (O4), Append and Prepend into Format (O2); every library and Demos graph retrofitted, no alias |
| 992b | The words: each node's description and help say its one job, and where the other job lives (rows 1, 3, 4, 10–14) |
| 992c | Plan 991 goes on, as the picks say: Route; Merge (O3); Classify (O6); the Rows tab (O5); Retry and the Runbooks' retrofit (O7) |
