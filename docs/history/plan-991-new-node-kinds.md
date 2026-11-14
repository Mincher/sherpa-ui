# Plan 991: new node kinds — from n8n, Rewst and Blender's Geometry Nodes

Will, 2026-11-14: "Co-ordinate with another agent to look at the docs for apps like n8n and rewst to determine good
candidates for other types of nodes we should have. Also look at Blender's Geometry Nodes for ideas for other useful
nodes for the types of graphs we will create in Sherpa Demos." He read the merged list and picked **"Write a plan"**.

**Status: Will picked D1 A, D2 A, D3 A (2026-11-14). Nothing built. Owner: sherpa-ui-e8 (node kinds), after 986 and 990. Demos' side: sherpa-demos-67.**
Research by two agents of sherpa-demos-67, from public docs only (sources in section 5).

## 1. Rules every new node keeps

- **Rows come only from a store** (PRINCIPLES 25, Will: "Nothing should ever read a Data Source directly except a Data
  Store"). So no Code node and no HTTP Request node: both read data around a store.
- **One kind, one job; a variant is a TYPE of a kind**, as Condition's and Math's are. A new kind only where no kind does
  the job.
- **Said once** in node-kinds.ts; its words in graphText, its acts and N-zo's words follow from it.
- **A sub-graph is a Custom Node** (plan 942): a node that runs "steps" runs a Custom Node, never a second way to hold
  a graph.

## 2. The list, merged and ranked

What we have already is left out: If and Filter (Condition), Stop and Error (Run result: failed), Split Out (Field),
sub-workflows (Custom Nodes), Schedule and Webhook (Trigger), Sort (Organise), AI Agent and chains (Prompt, Runbook
step), tools and MCP (Skill), Mail and SMS (Notification), Starts/Ends with and Contains (Condition).

### Must

| Node | New kind or type | What it does | From | Demos example |
|---|---|---|---|---|
| **For each** | kind (Flow) | Runs a Custom Node (a Runbook, a Custom Node) once per row, N at a time; Done sends every result on | n8n Loop Over Items; Rewst With Items + concurrency; Blender For Each zone | Run the patch Runbook for each device, 5 at a time |
| **Route** | kind (Logic) | One output per rule (or per named option), plus Otherwise; the first match, or every match | n8n Switch; Rewst Follow First / Follow All; Blender Menu and Index Switch | High risk → ticket, Medium → notify, Otherwise → stop |
| **Merge** | kind (Data) | Joins two row sets: append, or by a field: matched, unmatched, enriched; or waits for every input | n8n Merge; Rewst Merge lists, criteria sensitivity | Customers and devices, by customer |
| **Wait** | kind (Flow) | For a time, until a time, or until an event; always with a time limit | n8n Wait; Rewst Delay, Await Webhook Request | Wait for the maintenance window, then reboot |
| **Approval** | Request type | Asks a person, with buttons; Approved, Declined, Timed out | n8n Send and Wait; Rewst Create Pending Task, Confirmation Email | Ask the account owner before a server reboot |
| **Retry / on error** | a setting on every node, and an Error socket | Try N times with a wait; on error: Stop, Continue, or the Error socket | n8n node settings; Rewst On Failure / Always; Blender Repeat zone | Retry a failed patch twice, then open a ticket |
| **Viewer** | kind (Inspect) | Shows the rows or the value at this point, as a table in the details panel | Blender Viewer and Spreadsheet; n8n node output panel | The devices after "Health < 50" |
| **Statistic** | Math types | Sum, Min, Max, Median, Range, Count unique, Average, by a Group by field | n8n Summarize, Aggregate; Blender Attribute Statistic, Field Min/Max | The highest risk score per customer |

### Should

| Node | New kind or type | What it does | From | Demos example |
|---|---|---|---|---|
| Band | Math type | A value into named steps | Blender Map Range (Stepped) | Risk 0–100 → Low, Medium, High |
| Format | Text type | Fills a template with {column} values | Blender Format String | "{customer}: {offline} offline" |
| Set field | kind (Data) | Adds, renames or works out a column | n8n Edit Fields, Rename Keys; Rewst Data Aliases | Days since last seen, per device |
| Unique | Organise option | One row per key; optionally only keys not seen in earlier runs | n8n Remove Duplicates | Alert once per device |
| Compare | kind (Data) | Two row sets by key: only in A, the same, changed, only in B | n8n Compare Datasets; Rewst Diff lists | Accounts with no User |
| Top N per group | Organise option | Keeps the first N rows, in each group | n8n Limit; Blender Sort Elements | The 3 riskiest devices per customer |
| Running total | Math type | Adds up row by row, per group | Blender Accumulate Field | Failed patches per customer, over time |
| Classify | Prompt answer type | The model puts each row in a named category, an output each, plus Other | n8n Text Classifier | Triage tickets: Patch, Access, Hardware, Other |
| Guardrail | kind (AI) | Finds PII or secrets: Pass or Fail, or masks them | n8n Guardrails | Mask passwords before ticket text reaches a model |
| On failure | Trigger type | Starts when another graph's run fails, with its run, node and words | n8n Error Trigger | Any Coworker fails → an internal ticket |
| Date maths | Time types | Add or subtract, business days between, a time zone | n8n Date & Time; Rewst date transforms | Last seen more than 3 business days ago |
| Warning | kind (Inspect) | Shows the graph's own message on its node, and up to its parent | Blender Warning | "These rows have no Last seen" |

### Could

Form (a Trigger type; its choices from a store), Extract (a Prompt's Data answer with a schema), Log (an Output type: a
line in the run's trace), Generate (a Value type: a password or an id), Run for (a Trigger option: chosen customers, all,
or customers with a tag), Clamp (a Math type), Sample (a stable random subset: a canary group), Previous row (a Field
option), Closure (a step passed as a value).

## 3. How inputs work: ideas to take

- **Drag a value in**: drag a field from the previous node's output into an input; the reference is written for you
  (n8n). Today a reader types {{value:node.name}}.
- **A socket says its shape**: one value, a value per row, a list (Blender's rectangle, diamond, lines; dashed links for
  a value per row).
- **Hover a socket to see its last value**; a value shows beside its socket (Blender inspection).
- **Mute a link or a node**: data passes through unchanged (Blender).
- **A Settings tab per node**: retry, continue on error, notes on the canvas (n8n) — the home of "Retry / on error".
- **Pinned data**: keep a node's output to test the rest again (n8n; Simulate's run could keep it).
- A Wait always has a time limit (n8n); a For each always has a "how many at a time" (Rewst).

## 4. Will's picks (2026-11-14: A, A, A)

- **D1 For each: A** (picked) — a node that runs a Custom Node once per row: one system, a sub-graph is a Custom Node.
  B a framed zone on the canvas (Blender), its steps inside it.
- **D2 Approval: A** (picked) — a Request type with three outputs. B a kind of its own.
- **D3 Retry / on error: A** (picked) — a Settings tab on a node that can fail (AI steps, Requests, Outputs), and an
  Error socket that shows when "on error" is "go to Error". B a Retry node placed before the step.

## 5. Phases (after Will's picks)

| Phase | Builds |
|---|---|
| 991a | Route; Statistic (Math types); Band; Format |
| 991b | For each; Wait; Retry / on error (D1, D3) |
| 991c | Merge; Compare; Unique; Top N per group |
| 991d | Approval (D2); Viewer; hover to see a socket's last value |
| 991e | Classify; Guardrail; On failure |
| 991f | The rest of Should, then Could, one by one, each asked |

Each phase: the kinds in node-kinds.ts, their words, Simulate, graphText's words, N-zo's rule words, a unit per kind,
and the Demos graphs that use them (sherpa-demos-67), in three engines.

## 6. Sources

n8n: docs.n8n.io — llms.txt; core nodes merge, switch, splitinbatches, wait, comparedatasets, summarize,
removeduplicates; langchain guardrails, text-classifier; Slack approvals; workflows/components/nodes; flow-logic/
error-handling; data/data-mapping/data-mapping-ui; data/data-pinning; data/data-mapping/data-item-linking.
Rewst: docs.rewst.help — documentation/workflows; task-transitions; advanced-workflow-operations-menu; data-aliases;
input and context variables; core-actions; transform-actions; rewst-actions; intro-to-triggers; trigger-criteria; the
Jinja filters list; intro-to-forms; task approval; and rewst.canny.io "built-in task retry" (a feature request: no retry
built in).
Blender 5.3 manual: docs.blender.org/manual/en/latest/modeling/geometry_nodes/ — attribute_statistic,
capture_attribute, named_attribute, evaluate_at_index, evaluate_on_domain, accumulate_field, field_min_max, map_range,
compare, menu_switch, index_switch, random_value, sort_elements, list nodes, format_string, match_string,
repeat_zone, for_each_geometry_zone, simulation_zone, closure, viewer, warning, import csv; and interface/controls/
nodes/ parts, groups, editing; geometry_nodes/fields and inspection.
