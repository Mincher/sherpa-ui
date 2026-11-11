# Plan 926: AI nodes

Will, 2026-11-11. This builds the "fuzzy AI nodes" that TODO 556 lists for later.

## The ask

A node category, **AI**, with five nodes:

| Node | What it does |
|---|---|
| **Provider** | Picks a provider: Anthropic, and others. |
| **Model** | Picks a model of the connected provider: Opus, Sonnet, and others. |
| **Runbook** | Picks a predefined runbook, or takes a new runbook prompt. A predefined runbook has a sub-graph, and you can drill into it. A new runbook's sub-graph comes later. |
| **Skill** | Targets an existing skill, or takes a new one. |
| **Prompt** | Takes a custom prompt for the connected model. The user also says what output they expect: true or false, text, data, and others. The sockets change to match. |

An AI answer is fuzzy. So any AI node can say what output it expects, from a dropdown, and its sockets follow.

## What exists to build on

- **The category exists.** `ai` has its ink (`theme-border-active-2`, purple, shared with Presets) and its lane (Agentic). No kind uses it yet.
- **A family's Type picker changes rows and sockets.** Value, Math, Condition and Output work this way (`types`, `typeLabel`, the Type row first). A type can fork (`branches`): True on the header, False on the footer, as a Condition does.
- **The host app adds types.** `registerNodeTypes` (plan 891). Demos adds four Output types this way.
- **A row can need a kind of input.** With `needs` and `gives` (TODO 764), a wrong input reads null, and the node shows a warning. The graph stays open.
- **A preset Custom Node opens read only**, with a trail back. A predefined runbook's sub-graph can be one.
- **Message rows.** These are Markdown with value chips and Insert value (plan 891, 892). A prompt is one.
- **Simulate never acts outside the graph.** An Output says what it `would` do, and its properties send stand-ins.

## The build

### The five kinds

All are in category AI, in workflows only: not in a page's Query. They stand in the Agentic lane.

| Kind | Header input | Rows | Output |
|---|---|---|---|
| `provider` | none | Provider (a pick from the host's providers) | Provider (`gives: 'provider'`) |
| `model` | Provider (needs a provider) | Model (a pick of that provider's models) | Model (`gives: 'model'`) |
| `prompt` | any: the data it reads | Model (needs a model) · Prompt (a message row) | by **Expects** |
| `runbook` | any | Model · Runbook (a pick of the host's runbooks, or New runbook…) · Instructions (a message row, shown for New runbook) | by **Expects** |
| `skill` | any | Model · Skill (a pick of the host's skills, or New skill…) · Instructions (a message row, shown for New skill) | by **Expects** |

- `provider` and `model` are new `Given` words. Their sockets are `object`. A Model row fed by something that is not a model reads null and warns, as any wrong input does.
- With no model joined, an AI node warns: "Join a Model". It still draws, and the graph stays open.

### Expects: the output, and the sockets that follow it

For Prompt, Runbook and Skill, the family's Type picker is **Expects**. It is the first row, as on every family. One helper makes the types, so each AI kind gets the same list:

| Expects | Sockets | Like |
|---|---|---|
| **True/false** | True on the header, False on the footer (`branches`) | a Condition |
| **Text** | one Text output (`value`) | a Value of type Text |
| **Number** | one Number output (`value`, `gives: 'number'`) | Math's Result |
| **Data** | one Data output (`object`, `gives: 'rows'`) | a Source's Rows |
| **List** | one List output (`object`, `gives: 'list'`) | a Value of type List |

When the pick changes, the sockets change. A route that no longer fits is kept, and it warns, as on any family.

### The lists come from the host app

Sherpa ships no providers, models, runbooks or skills: model names change, and Sherpa knows no app. The host registers them once at load, as it does Output types:

```js
registerAiCatalog({
  providers: { anthropic: { label: 'Anthropic', models: { opus: 'Claude Opus 5.5', sonnet: 'Claude Sonnet 5.5', haiku: 'Claude Haiku 5.5' } } },
  runbooks: { 'patch-review': { label: 'Patch review', help: 'Check patches before they deploy', graph: 'runbook-patch-review' } },
  skills: { 'summarise-tickets': { label: 'Summarise tickets', help: 'A short summary of open tickets' } },
});
```

A runbook's `graph` names a definition in the app's node library. Drill in (double click, or Open) opens it read only, with the trail, as a preset Custom Node opens.

Demos registers Anthropic with its current models, three runbooks with small sub-graphs, and three skills.

### Simulate

Simulate calls no model. An AI node's light says what it `would` do, for example "Would ask Claude Opus 5.5". Its output is a stand-in by Expects:

- True/false: True
- Text: "(an answer)"
- Number: 0
- Data: no rows
- List: an empty list

Running a workflow for real (N4) stays held, so nothing is ever sent to a model.

### The Nodes panel

The panel gets an **AI** section, in the AI ink: Provider, Model, Prompt, Runbook and Skill.

## Decisions for Will

**Will, 2026-11-11: A, A, A.**


- **D1. Where the provider, model, runbook and skill lists come from.**
  - **A (recommended):** the host app registers them (`registerAiCatalog`). Sherpa ships none, and Demos registers Anthropic, a few runbooks and a few skills.
  - **B:** Sherpa ships a default Anthropic list, and an app adds more.
- **D2. Expects on Runbook and Skill.**
  - **A (recommended):** all three (Prompt, Runbook, Skill) have Expects as their Type picker, from one list.
  - **B:** only Prompt has Expects, and Runbook and Skill always send Text.
- **D3. A predefined runbook's sub-graph.**
  - **A (recommended):** it is a preset Custom Node definition in the app's library. Drill in opens it read only, with the trail.
  - **B:** a separate runbook view, not the Custom Node one.

## Steps

1. **The data layer.** The five kinds, the Expects types helper, `provider` and `model` in `Given`, `registerAiCatalog` with its picks, warnings, and Simulate stand-ins. Unit tests.
2. **The editor.** The panel's AI section, the pick rows from the catalog, the instructions row shown only for New, and drill into a runbook. End-to-end tests in three engines.
3. **Demos.** The catalog, three runbook definitions, and an example workflow with a Prompt that expects True/false and forks to two Outputs.
4. **Docs.** An APP-GUIDE section "AI nodes", the map, and the traps if any.

## Built (2026-11-11)

- **Step 1, the data layer** (`0f9a0744d`): `ai-catalog.ts` (`registerAiCatalog`, the picks), the five kinds, `expects()`
  for the Type picker, `provider` and `model` in `Given` and `Need`, the two warnings, Simulate's stand-ins.
- **Step 2, the editor** (`6d8e0abf9`, and the commit after it): the panel's AI section, a Runbook's runbook opening read
  only on a double click (no Copy to my nodes), runbook steps never listed as Custom Nodes, a joined provider or model
  said by its words.
- **Step 3, Demos** (`eff77e2`): the catalog, a Runbook entity type with three preset runbooks, a Runbooks View, and
  Device triage, by AI.

Not as planned: the Instructions row always shows. A row cannot hide by another's value yet, so for a predefined
runbook or skill it adds to it.

