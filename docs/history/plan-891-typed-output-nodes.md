# Plan 891 — typed Output nodes

Will, 2026-11-10 (TODO 891, relayed by the Harness session acp-module-d7; its notes:
`acp-module/.working-notes/32-output-nodes.md`; Figma: "OUT-00 · Output node types", CG-05, CG-05b, RB2-E5): "We need
more considered Output nodes. Set the type of output, configure any parameters, and use any properties. Some outputs
need the graph's creator to enter messages into a node property." Build it after 852. A plan, and Will's yes, before
code.

## What is there now

- **Output is one plain kind** (`NODE_KINDS.output`, `src/core/data/node-kinds.ts`): a header input of any type, no
  rows, "End the flow with a result". Demos' stored workflows use it with no type (`"kind": "output"`).
- **There is no Notify kind in sherpa-ui.** The Notify the notes merge in is the Harness's old Graph component.
- **A FAMILY kind already exists** (plan 749): `types`, a Type row first, each type's rows and sockets, `resolveKind`. Math,
  Text, Condition, Time, Value and Portal are families. A type change KEEPS the values and routes of the other types' rows
  (`rowOfOtherType`, `keptRow` in `workflow.ts`): back again, they return.
- **Property rows exist** (`propertyRow`, TODO 835): output only, in the Properties box.
- **An app adds kinds** beside the shipped ones: `{ ...NODE_KINDS, mine }`. It cannot yet add a TYPE to a shipped family.
- **Simulate** writes nothing: each node's light is `lightOf` ("412 → 87 · 3 ms"). Running a graph for real is N4, held.
- **The menu has sections** (`p.menu-section`). There is no Markdown editor in sherpa-ui.
- **The inspector's tabs** are Details, JSON and Data (`contentTabs`, `node-graph.ts`).

## The model

### One Output node, many types

- `output` becomes a family: title Output, the **Type** row first, the description says what it does here. Its look is
  the Output category's. The header icon is the type's (`NodeType.icon`, new; `resolveKind` takes it).
- **The default type is Run result**, which is what Output means today. So every stored graph opens as it is. No
  migration (Will, 11-05: clean system, no legacy).
- `NodeType` gains `group` (its family in the picker: Notification, Content, Response, Request, Run result), `icon`,
  `tags` (search words) and `would` (the words Simulate shows).
- **An app adds types**: `addTypes(NODE_KINDS.output, { ticket: {...} })` gives a family with them. The same works for
  any family.

### The types

What sherpa-ui ships, and what the host adds (D4: sherpa-ui knows no app):

| Family | Type | Ships in | Parameters | Properties (out) |
|---|---|---|---|---|
| Notification | Notification | sherpa-ui | Channels (In app, Email, Mobile push; one or more), To, Title, **Message**, Link, Priority | Sent (boolean), Delivered, Message ID |
| Content | On a view | sherpa-ui | View, Place (widget, card, list row), Content (an object in), Keep until | Content ID, Link |
| Content | Generated file | sherpa-ui | Format (PDF, CSV, XLSX, DOCX, Markdown), Template, **File name**, Data (an object in), Save to | File (an object), Link |
| Content | AI chat artefact | the host | Chat, Shows as, **Title**, Data | Artefact |
| Response | Toast | sherpa-ui | Tone, **Message**, Action | Shown (boolean) |
| Response | Alert (to be defined) | sherpa-ui | Severity, On (device or customer), **Title**, **Message** | Alert ID |
| Response | API response | sherpa-ui | Status, Body (an object in), Format | Sent (boolean) |
| Response | AI chat reply | the host | **Message**, Attach, Suggested actions | Reply ID |
| Request | Another agent | the host | Agent, **Ask**, Inputs, Wait for answer, Timeout | Request ID, Answer |
| Request | Ticket | the host | Connection, Board, Summary, **Details**, Priority, Customer | Ticket ID, Link |
| Run result | Run result | sherpa-ui | Status (succeeded, skipped, failed, deferred), **Summary** | none: it ends the run |

The words in bold are message fields. Demos adds the four host types, so the whole board can be seen and tested there.

- **A fixed list** is a row's own `choices` (new on `RowKind`), so a host type needs no new control. An open list (To, View,
  Template, Board) the host gives, through `RowFacts`, by row name.
- **Notify is an alias**: the Nodes panel lists a Notify item that adds an Output of type Notification, and a search for
  "notify" finds it (the type's `tags`).
- **An Output may sit mid-graph**: its properties are output rows, so routes may leave them (File → a Notification's
  Attachments). The lanes' rule that puts an Output at the right edge applies only to an Output that nothing leaves.

### Messages

- A message field takes **text with values**: `{customer.name}`. A value is kept by the node's ID and the row or field
  name, and drawn by the node's heading and the label, so a renamed node keeps its values.
- A message field can take an **input socket** too (an AI node's summary), as any row does.
- **In the node**: the first lines of the message, its values in purple, read only. A press opens the field in the
  Details panel.
- **In the Details panel**: a multiline field, an **Insert value** menu (the values of the nodes before it, a section per
  node, each with its sample value from the last simulation), and a **Preview** (the message with those sample values).
- **A value that no route gives** is a warning on the node (`data-warning`, as a node with no valid input is): "{when}
  has no value on the False path". `node-paths.ts` knows which nodes come before it on each path.

### Simulate, and Send a test

- **Simulate never fires an Output.** Its light says what it WOULD do ("Would send 1 email"), from the type's `would`.
- Its properties send stand-ins (Sent: true; an ID: "(simulated)"), so the nodes after it can be simulated too.
- **Send a test** (the Node tab's footer) fires `output-test` `{ node, type, values }`. The host sends the test. sherpa-ui
  sends nothing (D4; and running for real is N4, held).

### The Details panel

- **Node tab** (today's Details): the Type picker, the fields, Insert value, and Send a test.
- **Output tab** (new, an Output only): the Preview (an Email / In app switch where the type has channels) and each
  property with where it is routed, or "not used".
- **The Type picker** is a menu with a section per family. Each item has its icon and a one-line hint (`help`).

## The steps

1. **The registry** (data layer): `NodeType`'s `group`, `icon`, `tags`, `would`; `RowKind`'s `choices` and the `message`
   control; `addTypes`; Output as a family, default Run result; the sherpa-ui types; `workflow.ts` checks them. Node
   unit tests.
2. **Messages** (data layer): read the values in a text; the values a node can use, by path; the warning for one no route
   gives. Node unit tests.
3. **Simulate**: an Output fires nothing; its light from `would`; its properties' stand-ins. Node unit tests.
4. **The node**: the header icon by type; a message row (its first lines, values purple); the grouped Type picker; the
   Notify alias in the panel. E2e specs in the three engines.
5. **The Details panel**: the Node tab's Insert value and Send a test; the Output tab. E2e specs.
6. **Demos and the docs**: Demos adds the four host types and one graph with typed Outputs (as CG-00 Stage 5). APP-GUIDE
   says how an app adds a type. Then the trap if one is found, the reference and the Map. Tell the Harness session and
   the Figma concept session what to look at.

Each step is its own commit, with its gates. Build after each, so :4200 shows it.

## Will to pick

**D1. A type change and the routes.** The notes say: keep the shared fields, and cut the routes to sockets that go, with
a warning. Every family today KEEPS the other types' values and routes, and back again they return ("off is not gone").

- **A (recommended):** keep them, as every family does. A route to a socket the type has not is drawn as a fault, with a
  warning, and is not run. Change the type back, and it works again.
- **B:** cut them, as the notes say. A type change loses those routes for good, and Output works unlike every other
  family.

**D2. The WYSIWYG Markdown editor.** sherpa-ui has no Markdown editor. A new one is a new component: Figma, its
accessibility, its tests in three engines.

- **A (recommended):** in 891, a message field is a plain multiline field, with Insert value and the Preview. The Markdown
  editor is its own TODO and plan, after 891.
- **B:** build the Markdown editor in 891. 891 gets much bigger, and nothing of it can be seen until the editor is done.

## Not in 891

- Running an Output for real (N4, held).
- The later types in the notes: Write a record, Value Ledger entry, Webhook, a chat channel (Teams, Slack).
- "Ask N-zo to write the first draft": the host's.
