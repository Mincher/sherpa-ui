# Plan 924: Properties by connection

Will, 2026-11-11: "If a property, like Count, is plugged into the header input of a Condition node then the Condition node
should hide the Properties section of the Node as its only valid output will be True (the count is not 0) or False (the
count is 0). We need to check all other nodes connection scenarios and determine which Properties are valid to show or
hide."

## Every node's Properties, checked

I read every kind, and every type, from the registry on 2026-11-11.

| Kind (types) | Its header takes | Its Properties | Valid when |
|---|---|---|---|
| Source | none | Results (rows), Count | always: it reads its store |
| Condition: a comparison (Equals … Between) | a column or a value | Results (rows), Count | rows: a Field's column. One value: never |
| Condition: And, Or, Not | booleans | Results (rows) | its tests are over rows |
| Condition: Is empty | anything | Results (rows) | rows come in |
| Field | rows, or one record | Count | rows come in. One record: never |
| Sort, Group | a Field's column | Results (rows); Group adds Count | rows come in, as a column |
| Tag › Includes | a Field's column | Results (rows) | rows come in, as a column |
| Status, Scope, Arrange, Presentation (Query only) | rows | Results (rows) | always: a Query's rows |
| Math, Text | none | Result | always |
| Prompt, Runbook, Skill | anything | Answer (by Expects) | always: its shape is the reader's pick |
| Output (each type) | anything | Sent, Delivered, Link, File… | always: what the Output does |
| Value, Time, Preset, Saved filter, Portal, Provider, Model | n/a | none | n/a |

**The rule:** **Results** and **Count** are about ROWS, so they show only where rows reach the node's header. That means
rows, or a Field's column, through any chain of tests. Every other property always shows.

- "Rows reach it" is worked out through the chain. An And's or an Or's tests are over rows when any of its inputs are.
- When every row in the Properties box hides, the box hides too.

## Decisions for Will

**Will, 2026-11-11: D1 A.**


- **D1. A Results or Count that hides, but a connection already leaves it.**
  - **A (recommended):** it stays shown while the connection is there, with a warning: "Count has no rows to count: a value
    comes in". The connection reads null, as any wrong input does (the 2026-11-05 rule: no valid input = null + a warning).
    Off is not gone.
  - **B:** it hides, and the connection is cut.

My pick, where Will does not say otherwise: with nothing joined to the header yet, every property shows, as today.

## Steps

1. The data layer: `rowsReach(node)` on the graph, through the chain of tests. A GraphRow says when it has no rows
   (`data-idle`). The warning for a connected one. Unit tests from the table above.
2. The node: CSS hides an idle property, and a box with only idle rows. No JS touches visibility.
3. Tests in three engines, with Will's case: Count into a Condition's header.
