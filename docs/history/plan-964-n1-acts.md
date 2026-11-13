# Plan 964 N1–N2: acts, said once

[Plan 964](plan-964-n-zo-works-with-anything.md) section 2.1 and 2.2: "Every act the app can do is said ONCE: its id,
its words, its input, whether it changes data, where it applies, and the one function that does it. A press, N-zo,
WebMCP and the MCP all go through that one door" (D1 A), and "each type gives its acts by itself, through the one store
door". Owner sherpa-ui-a9 (the library), sherpa-demos-67 (Demos' acts, then N-zo from them, N3). Written 2026-11-13,
after plan 960 U3. The API is agreed with sherpa-demos-67 before it is built.

**sherpa-demos-67, 2026-11-13: "OK" on all five picks, with two notes, both taken: an input field may name another type's rows (`ref`, `many`; a type's `title` names a row), and `actsOf()` with nothing lists every act (the chat runs any act from any page).**

## 1. The shape (the data layer, DOM-free, `sherpa-ui/data`)

```ts
interface Act {
  id: string;                    // 'coworker.run-now'; a type's own: '<type>.<verb>'
  label: string;                 // its words, as a button and a tip say them (PRINCIPLES 24): "Run now"
  description?: string;          // one line, for N-zo and the MCP: what it does
  type?: string;                 // the type it acts on: its rows are its target, by key
  many?: boolean;                // it takes several targets at once (Suspend three users)
  input?: Readonly<Record<string, TypeField>>;   // what it asks, as a type's fields say data (type.v1 fields)
  changes: boolean;              // it changes data: a caller asks first (plan 964 D2 A), and it gives an undo
  where?: { contexts?: readonly string[]; views?: readonly string[] };   // none: wherever its type is
  run(call: ActCall, ctx: ActContext): Promise<ActAnswer>;
}
interface ActCall { keys?: readonly unknown[]; input?: Row }
interface ActContext { stores: Readonly<Record<string, Store>>; entities?: EntityShelf; signal?: AbortSignal }
type ActAnswer = { done: string; result?: unknown; undo?: () => Promise<void> } | { refused: string };
```

- `registerAct(act)` adds one, refused in words if its id is taken or it is not an act; it answers how to take it back.
- `actsOf({ context, view, type })` lists the acts that apply there: an act with no `where` applies wherever its type
  is; one with no type, everywhere.
- `runAct(id, call, ctx)` is the ONE door: it finds the act, checks the call (its keys exist in the type's store, its
  input against `input` by the type's own rules, `typeSchema`), runs it, and answers `done` (in words, for the chat
  and a toast) or `refused` (in words; it never throws). It never asks the reader: the caller does, when `changes`.
- `actSchema(act)` is its input as a JSON Schema (the type's fields → JSON Schema), so the MCP, WebMCP and N-zo's tools
  are made from it (N3).

## 2. A type's own acts (N2)

`typeActs(type)` makes, for every type, through the store door (`ctx.stores[type.id]`, or `storeOf`):

| Act | Takes | Changes | Does |
|---|---|---|---|
| `<type>.find` | `input: { where?, search?, sort? }` | no | the rows that match, a page of them (the store's `load`) |
| `<type>.read` | one key | no | the row (`byKey`) |
| `<type>.add` | the type's stored fields | yes | `insert`; its undo removes it |
| `<type>.change` | keys, and the fields to change | yes | `update` each; its undo puts each row back as it was |
| `<type>.remove` | keys | yes | `remove` each; its undo inserts each again |

A refusal is the store's own words: a rule the type says (`ValidationError`), a graph type's "a Coworker is made in its
editor", a remove the shelf keeps ("Runbook X uses it"). The outlet registers each app.json type's acts with its store,
so N-zo works with a User the day the User type exists.

## 3. Open points, and my picks (sherpa-demos-67: say if one is wrong)

1. **Undo is the act's.** `run` answers `undo` (a closure over what it changed); the store's own history is not used, as
   a remote store has none. N-zo's Undo calls it; a press's toast offers it.
2. **`where` names Contexts and Views by id**; none means wherever its type's rows are shown. `actsOf` takes the
   Context and View on screen; N-zo also asks `actsOf({})` for "elsewhere" (plan 964 N5).
3. **A press runs the act the same way**: a button names its act in its markup, and the outlet runs it through
   `runAct` with the selected rows' keys, asking first when `changes`. HTML first: the button is markup; the act is
   data. The attribute is chosen in N1b against the button's spec (PRINCIPLES 15: a `data-*` its spec declares, or the
   native `command` invoker the button already takes).
4. **An act's input is a type's fields** (type.v1 `fields`), inline, so its words and rules are said once: Schedule's
   input is `{ every: { label: "Runs", values: [...] }, at: { ... } }`. A UX workflow (N4) asks them step by step.
5. **Ids**: `<type>.<verb>` for a type's acts and an app's acts on a type (`coworker.run-now`); `<context>.<verb>` for
   one with no type. Lowercase words and hyphens.

## 4. Steps

| Step | Builds | Proves | Lane |
|---|---|---|---|
| N1a | `registerAct`, `actsOf`, `runAct`, `actSchema` (acts.ts) | unit: an act registered once runs through the one door; a bad call is refused in words; its schema | a9 |
| N2 | `typeActs`; the outlet registers each app.json type's acts | unit: find, read, add, change, remove on a row type and a graph type, each refused in the type's words, each undone | a9 |
| N1b | a button runs an act: the native `command="--<act id>"` with the outlet its `commandfor`, its keys its `value` or the grid's selection; a grid row action whose id is an act's; the toast says it, with Undo (pick A: a press runs at once; Will may say B, ask first) | e2e: a press removes a row, its toast's Undo puts it back, in 3 engines | a9 |
| N1c | Demos' Coworkers' and Users' acts said once; their buttons name them | Demos specs | demos-67 |
