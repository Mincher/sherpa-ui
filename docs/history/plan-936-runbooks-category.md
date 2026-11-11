# Plan 936: a Runbooks category

Will, 2026-11-11: "We need a Runbooks node category. In the presets tab of the Runbooks category will be preset, read
only, runbook nodes with subgraphs to drop onto the canvas. The Custom tab will show user created Runbook nodes with
either read-only or editable sub graphs based on owner, creator, or permissions. We will need an ability to set a
category when creating a custom node so that we know if a custom node is a Runbook or some other category."

## Today

- **The Nodes panel has two tabs, Preset Nodes and Custom Nodes.** It splits them by CATEGORY: a definition goes to the
  Custom tab only when its category is "Custom Nodes". Any other category puts it in the Preset tab, under that category.
- **A definition (a Custom Node)** has `category` (none: Custom Nodes) and `preset` (read only). A preset opens read only,
  with Copy to my nodes.
- **926's Runbook AI node** picks a runbook from the app's catalog. Each runbook's steps are a preset definition: in Demos,
  an entity of its Runbook type. The panel hides those steps, and a double click on the Runbook node opens them, read only.
- **Save as Custom Node** asks a name and a description, and no category.

## The build

- **The tabs split by WHO made it:**
  - Preset Nodes: the kinds Sherpa and the app ship, and every preset definition.
  - Custom Nodes: the reader's own definitions.
  - In each tab, the items are grouped by category. A Runbooks category can stand in both.
- **A Runbook node is a definition of category Runbooks.** Dropped on the canvas, it is a use, as any Custom Node is: its
  inputs and outputs are its Group Input's and Group Output's. A double click opens its sub-graph, the runbook's steps.
- **Read only or editable:** a preset is always read only. A reader's own node is editable unless the app says no for that
  reader (D2).
- **Save as Custom Node, and Save graph as, ask a Category:** a pick, Custom Nodes by default (D3).
- **Runbooks gets its own panel ink:** an existing token, picked when built.

## Decisions for Will

**Will, 2026-11-11: D1 B (the category replaces the AI node's predefined runbooks; it keeps New runbook), D2 A, D3 A.**


- **D1. 926's Runbook AI node beside the Runbooks category.**
  - **A (recommended):** keep both, from ONE list. The AI node runs a runbook with a model and an expected answer. A
    Runbooks node places the runbook's steps on the canvas. The AI node's Runbook pick lists the Runbooks-category
    definitions, so an app registers its runbooks once, as definitions. The catalog's separate `runbooks` goes.
  - **B:** the Runbooks category replaces the AI node's predefined runbooks. The AI Runbook node keeps only New runbook:
    a prompt that is its instructions.
- **D2. Who may edit a reader's own Runbook (or any Custom Node).**
  - **A (recommended):** the app says, per definition, with a door it gives the editor (`canEdit(definition)`). Sherpa
    knows no users, and an app's own rules (owner, creator, roles) stay the app's.
  - **B:** Sherpa keeps `owner` and `creator` on each definition and compares them with a current user the app gives.
- **D3. What a category may be, when saving.**
  - **A (recommended):** a pick from the categories a Custom Node may take: Custom Nodes, Runbooks, and any the app
    registers.
  - **B:** any words: a new category is made as it is typed.

## Steps

1. The data layer: `category` set on Save as and Save graph as. The panel's tabs by `preset`, then grouped by category.
   The Runbooks category and its ink.
2. The editor: the Category field in the save dialogs, and read only by `preset` or `canEdit`.
3. 926's join (D1), and Demos: its runbooks as Runbooks-category presets, and a Runbook of the reader's own.
4. Tests in three engines, and the APP-GUIDE.
