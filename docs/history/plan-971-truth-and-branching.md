# Plan 971: truth and branching — what a test passes on, and where the flow goes

Will, 2026-11-13: "We need to rethink truthiness and branching with passing on the data." (He first asked for the
Check node to be named Branch, "as it's purpose is to create 2 routes and direct the graph flow based on the truthiness
of incoming data", then: "Actually ignore that last prompt.") He asked for this write-up with sherpa-ui-e8 ("A").

**Status: Will picked A, 2026-11-13** ("A: tests split, Branch decides"), with sherpa-ui-e8's two changes (section 7): a test's Pass and Fail are rows, And/Or's input counts go; Branch's test takes a test, and When reads its Pass and Fail. Owner: sherpa-ui-e8 (the node kinds), sherpa-demos-67 (Demos' graphs).

## 1. What there is now

| Node | Takes | Gives | What goes on |
|---|---|---|---|
| **Condition** (one test: Equals, Is one of, Greater than…) | a Field's column, or a value, on its header | **Results**: the rows whose value passes; **True**: 1 where it holds, else 0 | only the passing rows; the rows that fail go nowhere |
| **And / Or** | many inputs | **Results**: the rows of the true inputs (Or), the rows in all of them (And); **True**; **Pass** and **Fail**: how MANY inputs pass and fail (counts, already named so: see 7) | the rows of the inputs that are true |
| **Not / Is empty** | one value | **Results**, **True** | — |
| **Check** | a test on its header, and **Data** | **Yes** or **No**: the WHOLE Data, by ONE truth | all of Data goes one way; the other route sends nothing |

**Truth today** is implicit, one rule for every input (`truthOf`): true where it is above zero, true, or not empty. Rows
are true when there is at least one.

## 2. What the shipped graphs mean by it (13 Checks)

| Graph | Check | Test | Data | Means |
|---|---|---|---|---|
| Patch review | Any behind? | a Condition's True | all rows | **split**: the behind rows go to Count; the rest… |
| Device health | Any at risk? | a Condition's True | all rows | **split**: at-risk devices to Fix, healthy to "All healthy" |
| Backup check | Any failed? | a Condition's True | all rows | **split**: failed backups to Run again |
| Patch rollout | Online? | a Condition's True | all rows | **split**: online devices to Install, offline to "Not patched" |
| Patch review | Far behind? | a Condition's True | Yes of the last | **split** |
| Device health, Backup check, Patch rollout | Fixed? · Fixed on retry? · Backed up? · Installed? · Installed on retry? · Verified? | an agent step's True | the rows it worked on | **per row** in the words ("each device"), one truth in the graph |
| Device triage | Attention today? | a Prompt's True | all devices | **one decision** for the run |
| Patch deployment | Any behind? | a Count's number | the behind rows | **one decision** (the rows are already filtered) |

And the **page filter graph** draws a status field (Health: Critical, Warning, Healthy, Offline) as a chain of Checks
whose Yes is "the rows of this status" and whose No is "the rest, to the next status": a **split per row**. That graph is
only DRAWN: it is never simulated; the Query works out each row's status itself (first `when` that holds, per row), and
lights the nodes by its steps. And plan 960 U4.7b already plans to draw a status field as ONE Field node, its rule not
drawn inline, so this chain goes either way (correction, sherpa-ui-e8).

## 3. The faults

1. **The graph does not do what it says.** "Any at risk?" sends ALL the devices to Fix when one is at risk, healthy ones
   too. The words mean a split; the Check gives one truth.
2. **Two meanings, one node.** The page filter graph DRAWS a per-row split with the Check, while a workflow's Check
   (and Simulate) is one truth. A reader cannot tell which one a Check does.
3. **The rows that fail are lost.** A Condition gives only the rows that pass. To send the others somewhere, a graph
   needs a second Condition with the opposite test.
4. **Truth is hidden.** "Rows are true when there is at least one" is a rule in the code, not on the node. "Any",
   "all", "none" and "at least 5" cannot be said.

## 4. Two ways

**A (my pick): two nodes, one job each, the data they pass said on them.**
- **A test splits rows.** A Condition (and And, Or) gives **Pass**: the rows that hold, and **Fail**: the rows that do
  not (Results renamed Pass, Fail added). Filtering stays the Condition's (Will, D3 B); now nothing is lost.
- **Branch decides the flow.** Check is named **Branch** and keeps its job: ONE truth sends ALL its Data on Yes or No.
  Its truth is said on it, a row **When**: *Any* (at least one row, or a value that is true), *All* (every row holds),
  *None*, or *At least N*. No hidden rule.
- So "Any at risk?" becomes: Condition › **Pass** to Fix, **Fail** to "All healthy". "Attention today?" stays a Branch
  on the Prompt's True. The page filter graph's status chain becomes Conditions' Pass and Fail, which is what it means.

**B: one node does both.** Branch has a row **Split**: *Each row* (the rows that pass go on Yes, the others on No) or
*All at once* (one truth sends all the Data). Conditions give only their passing rows, as now.
- One place to branch, but one node with two meanings again, picked by a row; a reader must read the row to know what
  goes on.

## 5. Either way

- One truth rule, said once and on the node (**When**), not inside `truthOf` alone.
- Every graph is retrofitted in the same change (Will's rule): the library's fixtures and specs, Demos' Runbooks,
  workflows, Coworkers, Filters and Custom Nodes; the page filter graph's status chain; N-zo's tool words and the
  Runbook prompt form (its CHECK lines say BRANCH, or a split says which rows go where).
- The words: "Branch" (Will's own word for the routes), "Pass" and "Fail".

## 6. Phases (after Will's pick)

| Phase | Builds | Proves |
|---|---|---|
| 971a | the test's Pass and Fail (A), or Branch's Split (B); the When row | a unit per kind; Simulate splits Device health's devices right |
| 971b | the page filter graph's status chain in the new form | Health's graph reads as its rule |
| 971c | the retrofit: every shipped graph, the prompt form, N-zo's words | every Demos graph passes, and its prompt reads the split |

## 7. Review (sherpa-ui-e8, 2026-11-13)

- **A, with two changes.** One job per node is the system, and it keeps filtering the Condition's (D3 B).
- **The name clash.** And and Or already have rows named **Pass** and **Fail**: COUNTS of inputs (plan 944). A's rows of
  that name would clash. Pick: the tests' row outputs are **Pass** and **Fail** (rows, as A says), and And/Or's counts
  go: a count of rows is Math › Count already (plan 944, D3), and a count of inputs is no reader's question.
- **When needs the test's rows, not only its truth.** "All" and "At least N" cannot be read from a True (1 where ANY row
  holds). So Branch's test input takes a TEST (its Pass and Fail), and **When** reads them: *Any*: Pass has a row;
  *All*: Fail has none; *None*: Pass has none; *At least N*: Pass has N. A plain value (a Prompt's True, a Count) is read
  as today (`truthOf`): true above zero, true, not empty.
- **No third way.** B puts two meanings back in one node, picked by a row: the fault 2 it means to fix.

## 8. 971a, as built (sherpa-ui-e8)

- **Every test gives Pass and Fail.** A comparison, Time, Tag, And, Or, Not and Is empty lead with **Pass** (`pass`: the
  rows that hold) and **Fail** (`fail`: the rows that do not), then their own rows, then **True** (1 where any row
  holds). A comparison's Results (`rows`) is Pass now; And's and Or's input counts go.
- **Branch** (kind `branch`, was `check`): a family whose Type is its **When**: *Any*, *All*, *None*, *At least* (with
  its **N**). Its header takes a test's True, or a plain value; Data in; Yes and No send ALL the Data. When reads the
  joined test's Pass and Fail: Any, Pass has a row; All, Fail has none; None, Pass has none; At least, Pass has N. A
  plain value reads by `truthOf` (At least: a number of N or more).
- **The Outgoing JSON's reader**: a test's Pass carries its condition on, its Fail the condition's NOT.
- **The Query graph**: its status chain draws Branch; U4.7b takes the chain out later.
- **Retrofit**: every library graph, fixture and spec in the same change. Demos': sherpa-demos-67's.
- **"Any X?" is a Branch, not a split** (sherpa-demos-67, 2026-11-13, a correction to section 4's example): "Any at risk?"
  has No → "All healthy", a Notification that says no device is at risk. No means NONE, not "the rest": Fail into it
  would fire it while some device is at risk. So the four "Any X?" Checks become a Branch, When Any, its header the
  Condition's True, its Data the Condition's PASS: Yes sends the matching rows on; No fires only when none match. A true
  per-row split (Patch rollout's "Online?", Patch review's "Far behind?") is a Condition's Pass and Fail, no Branch. An
  agent step's Check and "Attention today?" are a Branch, When Any, on a plain True. The header may join any of a
  test's rows: When reads the test's Pass and Fail whichever joins.
