# Plan 992: no two nodes do one job — the overlap review, before more of plan 991

Will, 2026-11-14, on plan 991's new nodes: "Make sure there's no overlap between these new nodes' purpose and existing
nodes. We may need to review and refactor existing nodes in places. We will plan for that, though."

**Status: Will's picks are in (section 3, 2026-11-14). Plan 991 goes on as they say; before them, no further new kind of plan 991 was built (991a's
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
| 2 | **Format** (Text: a Template filled per row) | **Text › Append, Prepend** (Format does both); the **message** rows of the Outputs (they fill `{{value:…}}` too) | An Output's message fills `{{value:<node>.<field>}}` from the rows that reach it, by itself. Format earns its place only where a text must feed a NON-Output: a Prompt, a Join, a Value (sherpa-ui-e8). | Append and Prepend go; their graphs become a Format. Split and Join stay (they make and join lists). | O2 |
| 3 | **Route** (rows on by a field's value, an output per value, plus Otherwise) | **Condition** "Is one of" (two outputs), a **chain of Conditions** on one field's values, the **Boolean** gate | Route sends rows on by ONE field's value, to many places. A Condition is one test: Pass and Fail. A Boolean is "only when there is any". | A chain of Conditions that splits one field's values becomes one Route, in the shipped graphs. | — |
| 4 | **Statistic** with **Group by** (Math: one row per group, with its value) | **Organise** › Group (and a chart's axes) | One grouping door: Organise › Group makes the groups; a Statistic reads the groups an Organise made (one row per group, with its value), never a Group by of its own (sherpa-ui-e8). Count unique is its own statistic (how many differ), not a group's count. | Statistic's Group by (991a's D5, not built) is not built. | O8 |
| 5 | **Merge** (two row sets: append, or by a field) and **Compare** (only in A, same, changed, only in B) | each other; and today's rule "a graph has no join: each Source reads one store" | One node, **Merge**: by a field, its outputs Matched, Only in A, Only in B (and Changed, where it compares columns). No Compare node. The rule changes: a graph joins rows by Merge, each side still read by its own Source (its store). | N-zo's rule "a graph has no join" changes. A value every page reads from a related type (a device's customer's region) stays the TYPE's `from` field (plan 960 U2); Merge is for a join one graph makes (sherpa-ui-e8). | O3 |
| 6 | **Tag** (exists: keep rows with chosen tags) | **Condition** "Is one of" on a tags field (a list cell holds a value where any of its values is it, sherpa-ui-a9) | Condition, on the tags field. | **Tag goes**; its graphs become a Field (tags) and a Condition. | O4 |
| 7 | **Viewer** (the rows at a point, as a table) | the details panel's Incoming and Outgoing JSON, Simulate's Data in the inspector (plan 836) and captions, and 991's "hover a socket to see its last value": three ways already (sherpa-ui-e8) | One place: the details panel shows the picked node's rows as a TABLE (beside its JSON), from Simulate's last run; a socket's tip says its last value. No Viewer node. | The details panel gains its Rows tab. | O5 |
| 8 | **Classify** (an AI puts each row in a named category, an output each) | **Route** (an output per value); a **Prompt**'s List answer (sherpa-ui-e8) | Classify is a **Prompt** answer type, "Category" (the model answers one of the named categories, a column on each row); **Route** sends the rows on by it. No second router. | none | O6 |
| 9 | **Retry / on error** (a node's Settings tab and an Error socket, D3 A) | the shipped Runbooks' **wired retry steps** (Patch rollout's "Retry once" and "Installed on retry?") | A step tried again is the step's own Retry setting. A different step on failure (a ticket) stays wired, from the Error socket or a Condition's Fail. | The Runbooks' "retry the same step" routes become the setting; their prompts' RETRIES AND ERRORS read it. | O7 |
| 10 | **On failure** (a Trigger: another graph's run failed) | the **Output Trigger** (run another Coworker when this one ends) | Output Trigger: THIS graph says what runs after it (any end, or only a failure: a new "When" row). On failure: ANY graph's failure starts this one (an app-wide watcher). Both kept, each said. | Output Trigger gains "When: it ends, it fails". | — |
| 11 | **Set field** (add or work out a column on each row) | a type's **status field** and other worked-out fields; a Field and a Math chain; a **Value** node (sherpa-ui-e8) | As Band (1): a column every page shows is the type's; Set field writes a column for the rows of THIS graph only. | none | O1 |
| 12 | **Approval** (a Request type: Approved, Declined, Timed out) | **Request › Another agent** (ask, wait for the answer) | Approval asks a PERSON, with fixed answers; Another agent asks an AI agent for words. Both Request types. | none | — |
| 13 | **For each** (runs a Custom Node once per row, N at a time) | a **use** of a Runbook or Custom Node (it runs once, over all its rows) | A use runs once with every row; For each runs it once per row. Its words say so. | none | — |
| 14 | **Wait** | the **schedule Trigger**; **Time** (a check of a date) | A Trigger starts a run; Wait pauses one running; Time tests a date. | none | — |
| 15 | **Date maths** (Time types) | **Math** on dates | Time types (one kind for dates). | none | — |
| 16 | **Warning** (a graph says its own warning) | the library's node warnings | Kept for the author's own words; the library's stay its own. | none | — |
| 17 | **Guardrail** (finds PII or secrets: Pass or Fail, or masks them) | a **Condition** (Contains); a **Prompt**'s True/false answer (sherpa-ui-e8) | Guardrail checks by NAMED detectors (an email, a card number, a secret key) and can mask them, which neither a Contains (one text) nor a model's answer (no promise) can. | none | — |
| 18 | **Min** and **Max** (D4: Floor and Ceiling renamed) | **Round** | Once renamed, no overlap; the old words ("floor", "ceiling") leave the help texts too (sherpa-ui-e8). | the rename, every graph | — |

## 3. Will's picks (2026-11-14)

- **O1 A:** Band and Set field are kept, for a value worked out inside one graph only; a label or column every page
  shows stays the type's status field.
- **O2 A:** Append and Prepend go; Format does both; every graph retrofitted. Split and Join stay.
- **O3 A:** one Merge (Matched, Only in A, Only in B, and Changed); no Compare. A value every page reads from a related
  type stays the type's `from` field.
- **O4 A:** Tag goes; a Field (tags) and a Condition do it; every graph retrofitted.
- **O5 (Will's own words): "Viewer sounds like a type of presentation node. View as a sherpa-data-grid".** So no
  Viewer kind: the **Presentation** kind (a page's card's, today the Query graph's) gains a type, **Data grid**, that
  shows the rows reaching it as a `sherpa-data-grid`, in a workflow too. One kind says how rows are shown, on a page
  and in a graph. (Where the grid is drawn in a workflow — in the node's body, or the details panel — is the build's
  first question; my pick: the node's body, resizable, as a card's is.)
- **O6 A:** Classify is a Prompt answer type, Category; a Route sends the rows on by it.
- **O7 A:** where a shipped Runbook retries the same step, it becomes that step's Retry setting; its prompt's
  RETRIES AND ERRORS reads it. A different step on failure stays wired.
- **O8 A:** one grouping door, Organise › Group; a Statistic reads the groups it made. No Group by on Math.

## 4. Phases (after the picks)

| Phase | Does |
|---|---|
| 992a | The refactors of what we have: Tag into Condition (O4), Append and Prepend into Format (O2); every library and Demos graph retrofitted, no alias **BUILT 2026-11-14 (sherpa-ui-e8)**: Format's first row is Data (rows or values); Tag's tests are Conditions; no alias |
| 992b | The words: each node's description and help say its one job, and where the other job lives (rows 1, 3, 4, 10–14) |
| 992c | Plan 991 goes on, as the picks say: Route; Merge (O3); Classify as a Prompt type (O6); the Presentation's Data grid type (O5); Retry and the Runbooks' retrofit (O7) |
