# Plan 986: Every node row offers what makes sense

**Status: a plan (sherpa-ui-e8, 2026-11-14). D1 is Will's; the rest needs no pick.**

Will, 2026-11-14 (by sherpa-demos-67, from a screenshot: Contoso patching, Source `user` › Field `name` › Condition
"Is one of"): "the values in the condition node should be showing all unique values from the 'user' sources 'name'
field as per the ancestor node configuration. I worry that there is something up with the logic around what these
menus should show. We should check all node input rows across all nodes to make sure their options, or input type,
makes sense."

## Measured (sherpa-demos-67 on main 36d6cfa42; the rows listed from the registry)

1. **Choices come only from DECLARED values.** A row's choices are the reaching field's `values`
   (`workflow.ts`, `here`/`known`), and only a type or a page declares them. Status (declared): a Condition's
   Equals is a select of 4. Name (none declared; 42 users, 42 unique): Is one of is free tags with no choices, Equals
   plain text. The same for every undeclared field (Name, Email, Owner, Site, Last seen), in a Condition's Value B and
   Values, Tag › Includes, and a Field's own Values.
2. **The input ignores the value's type.** Value › Integer, Decimal, Date and Boolean: the Value row is text. A
   Condition's Greater than, At least, Less than, At most, Between and Not between: Value B, Start and End are text,
   whatever the joined field's type (Seats: a number; Last seen: a date).
3. **Free text where the app has a list.** Content › On a view: `view` is text (the app's Views). Demos' own kinds:
   Request › Ticket's `customer` and `integration`, Response › Reply's `actions`.
4. **Not seen yet:** Notification › Channels and Tag › Includes showed one empty option in a probe that cannot open a
   multi-select's menu.

The registry has 244 rows with a control or an input (`NODE_KINDS`, every type resolved): 72 type picks, 25 text,
23 message, 17 number, 12 pick, 11 values, 7 field, 4 tags, 3 switch, 3 datetime, and the app's own controls.

## The design

**Part 1, the data's values.** Where a field declares no values, its choices are the values its store holds: each
distinct value (`store.distinct`), read through the editor's `storeOf`, at most 500, the menu's own search finding
among them. Declared values still lead, with their words and looks. One door in the data layer fills `fieldsOf`'s
`values` from the stores (`withStoreValues`); the editor calls it as it opens a graph and when a store changes, and
every row that reads a field's values (`here`) has them, as declared values are today.

**Part 2, the value's type.** A row takes its value in its type's control:

| Row | Today | After |
|---|---|---|
| Value › Integer, Decimal | text | number |
| Value › Date | text | a date (`datetime`, with its picker) |
| Value › Boolean | text | a switch |
| A Condition's Value B, Start, End, on a number field | text | number |
| … on a date field | text | a date |

The Condition's rows follow the field that reaches them, in the data layer where `here` is read, so the Query graph
and a workflow agree.

**Part 3, the app's lists.** One door: a row may name a list (`of: 'views'`), and the app gives its lists in the
editor's facts (`lists: { views: […] }`), as it gives `stores` and `entities` today. The library's Content › On a view
names `views`; Demos' kinds name theirs (customers, integrations, actions).

**Part 4, the menus.** Open Notification › Channels and Tag › Includes in a test, and say what each lists.

**A sweep, so it stays so.** A unit test walks every kind's every row and checks its control against the value it
takes: a number row is a number, a date a date, a row that names a list has the list. A new row that breaks the rule
fails it.

## D1 (for Will): where a field's values come from, when it declares none

- **A (my pick): the whole store's distinct values**, at most 500, searchable. The same list whatever was fetched.
- **B: only the rows a Fetch read** (the sample Simulate uses). Small and fast, but a value the sample missed is not
  offered.

## Steps

| Step | Builds | Proves |
|---|---|---|
| 986a | Part 2 and the sweep (data layer: `node-kinds.ts`, `workflow.ts`) | unit: each Value type and each Condition row on a number or a date field takes its type's control; the sweep |
| 986b | Part 1 (`withStoreValues`, and the editor's call) | e2e: Source › Field Name › Is one of lists the store's names |
| 986c | Part 3 (`of`, `lists`), Content › On a view | e2e: On a view picks a View |
| 986d | Part 4 | e2e: each menu lists its choices |

986b's editor call is in `node-graph.ts`, which sherpa-demos-b2's lane for TODO 970 holds open: it goes after 970 is
in. Demos (sherpa-demos-67): its own kinds name their lists in 986c, and its specs follow each step.
