# Plan 956: one reference form, `{{kind:id}}`

Will, 2026-11-13: "A", `{{kind:id}}` wins (TODO 956). Plan 960 U5, the text lens, its first half; the Runbook prompt (959)
is its second. Owner: sherpa-ui-e8 (the library), sherpa-demos-67 (Demos' side).

**Status: 956a BUILT 2026-11-14 (sherpa-ui-e8): `references.ts`, its kinds registered (`registerRefKinds`; every entity type by one call in `entity-types.ts`), node text on `{{value:<node>.<name>}}`, the Markdown model and editor on the form, the library's retrofit. The peer agreed pick A. 956b is Demos'. Picks marked ❓ go ahead unless Will says otherwise.**

## 1. What there is now

| Where | Form | What it names | Who reads it |
|---|---|---|---|
| A node's message text (plan 891) | `{node.name}` | a value a node before it sends: a row, a property, or a field of a Source's rows | sherpa-ui `node-messages.ts`: `valuesIn`, `valuesAt`, `unreachedValues`, `filled` |
| A prompt (plan 945) | `{{kind:id}}` | a Runbook, Expert, Coworker or workflow; a store, a field, a customer, an action, a model; an input, an output, a step of the prompt | Demos `app/prompt-refs.js`: `REF_KINDS`, `ref`, `refsOf`, `readRefs` |

Two forms, two readers, one job: a text names a thing, the app reads it, and a name that names nothing is said.

## 2. The build

- **One module in the library**, `src/core/data/references.ts`, DOM-free: `ref(kind, id)`, `refsOf(text)`, `readRefs(text,
  facts)` (each reference read: its name, or why it names nothing, in words), and `refKinds()`.
- **The kinds are registered**, not a fixed list (systems over special cases). The library's own: `value` (below),
  `store`, `field`, `model`, `input`, `output`, `step`, `action` (an Output type). Every entity type is a kind by its id:
  `{{coworker:ada}}`, read through the shelf. An app adds its own (`registerRefKind('customer', …)`): Demos' customer.
- **A node's value is one kind, `value`**: `{{value:<node>.<name>}}`. ❓ Pick A. `node-messages.ts` keeps its rules
  (what a node can name, what no connection gives, the text filled in) and reads them through `refsOf`; only the written
  form changes. Other (B): a kind per thing, `{{field:s.status}}` for a Source's field, `{{output:n.result}}` for a row;
  two kinds for one job, and `output` already means a Runbook's output.
- **The retrofit, in the same change** (Will's rule): every `{node.name}` in the library's fixtures, specs and docs, and,
  in the pair, Demos' workflows, seeds, Coworkers, N-zo's words and tools. The old form is not read: it is plain text
  after (clean system, no legacy). ❓ Pick A. Other (B): read the old form one release, with a warning.
- **Demos' `prompt-refs.js` goes**: its users (`runbook-prompt.js`, `runbook-sync.js`, `coworkers.js`, N-zo's
  `actions.js`) import the library's.

## 3. Phases

| Phase | Builds | Proves | After |
|---|---|---|---|
| 956a | `references.ts`; the kinds registered; `node-messages.ts` on `{{value:…}}`; the library's retrofit | unit: each kind read, a name that names nothing said; a message's values as today in the new form | — |
| 956b | Demos: `prompt-refs.js` deleted, its users on the library's; `customer` registered; its graphs and words retrofitted | Demos' prompt and Coworker specs pass | 956a |
| U5b | The Runbook prompt (959): `runbook-prompt.js` into the library as the text lens of a graph | Demos' `runbook-prompt.js` deleted | 956b |
