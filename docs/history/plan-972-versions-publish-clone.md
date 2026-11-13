# Plan 972: versions, Publish and Clone — for every entity

Will, 2026-11-13: "For custom nodes that I, or an agent on my behalf, have created it should be possible to edit the
sub-graph and save it. The JSON definitions should stay in sync with the graph. We will also need, eventually, a method
to publish changes after saving them so that other consumers can take the update. This may require versioning numbers,
and definitions, so that updates can be rolled back to previous versions." And: "Coworkers & Runbooks, and any other
created entity, should support versioning, too. Also the ability to clone, if permitted, to an editable, owned version
for saving."

**Status: Will picked D1 A and D2 A, 2026-11-13** ("Save is a draft", "Takes it at once"). Owner: sherpa-demos-67, with sherpa-ui-bd (measured) and -e8, -a9.

## 1. What works now (sherpa-ui-bd measured it on :4200, 3f388f3fc)

- **Edit and Save a Custom Node's inside: works.** From N-zo (createNode, updateNode) and from the editor (Enter on a
  use, or the node opened as its own graph). After Save and a reload, the entity's graph, its definition and the
  drawn graph agree, through the lens door too. No console error.
- **Uses follow:** each use keeps the `version` it took. After an edit every use says "Update available";
  staleUses lists them; Update (updateInstance) takes the new one, and it survives Save and a reload.

## 2. The gaps

1. **A version is a content hash** (versionOf), not a number. **No earlier version is kept**: no history, no
   Publish, no roll back. An entity's `v` is its schema's version, not its content's.
2. **Only reusable types are followed** (Custom Node, Runbook, Expert, Filter). A Coworker has no uses (plan 949), so
   nothing follows its changes.
3. **Every Save reaches every use at once** as "Update available": there is no draft. The use you edited through says
   "Update available" right after too.
4. **Clone has three doors** for one job: the shelf's duplicate (any type: a preset becomes yours), the library's
   copyToMine ("Copy to my nodes"), and Demos' Save as. A copy keeps no link to what it came from.
5. **Permissions are not checked.** Demos works out a User's Permissions (stores/access.js) only to show them. Nothing
   checks them before an edit, a Save, a Clone or a Publish, and the app has no current User.
6. Small: the editor's keep adds an `icon` that N-zo's createNode does not: two doors, two shapes.

## 3. The plan

1. **A version is a number, and each one is kept.** An entity holds its versions: `{ number, definition, at, by,
   note }`, newest first. The hash stays inside, to tell if anything changed.
2. **Save makes a draft; Publish makes a version.** Save keeps your work, on your entity only. Publish makes the
   next number, and only then do its uses (and other consumers) see "Update available".
3. **Roll back is a Publish of an earlier version.** It makes a new number with the old definition, so nothing is
   lost and the uses can follow it back.
4. **Every entity type has them**, Coworkers too, through the one store door (plan 960 U3): one `versions` part on
   the entity, not per type.
5. **One Clone.** One act for every type (plan 964: `<type>.clone`), shown as Clone (the three doors go). It makes an
   owned, editable copy that remembers its source and version (`from: { id, version }`), so it can tell you when the
   source has a newer one.
6. **If permitted.** An act (Edit, Save, Publish, Clone) asks the current User's access first (accessOf, plan 963),
   and is refused in words where it is not had ("Runbooks · Edit"). Demos gets a current User (a pick in the header,
   for the demo).

## 4. Will's picks

- **D1 Save and Publish.** **A (my pick):** Save is a draft that only you see; Publish makes a numbered version that
  uses can take. **B:** every Save is a new version at once, so uses see it at once (as now, but numbered).
- **D2 The use you edit through.** **A (my pick):** it takes your change at once; only the other uses say "Update
  available". **B:** it says "Update available" like the rest (as now).

## 5. Phases (after Will's picks)

| Phase | Builds | Proves |
|---|---|---|
| 972a | numbered versions kept on every entity; Save and Publish (D1) | a Runbook published twice holds 2 versions; a use takes the second |
| 972b | Roll back; the use edited through (D2) | a roll back is version 3 with version 1's definition |
| 972c | one Clone act for every type, with its `from` | a preset Runbook cloned is the reader's, and says when its source moves |
| 972d | Permissions checked before each act; a current User in Demos | a Read only User cannot Save or Publish, said in words |
