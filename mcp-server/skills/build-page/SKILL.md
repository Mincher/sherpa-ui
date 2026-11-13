---
name: build-page
description: Build a page of a Sherpa app from its data with the sherpa-ui MCP — describe the data, pick a pattern, generate the page's files, check them and see them. Use when asked to make a list, a records page, a form or a Settings page for an app on Sherpa UI.
---

# Build a page

An agent never invents a layout. It picks a PATTERN — for this need, this layout
and these components — and the MCP writes the page from it and the data. Each
step below is one sherpa-ui MCP tool; take its answer into the next.

1. **`describe_data`** — the rows (a real page of a real answer), a JSON Schema,
   or a page's own `fields`, with the type's `id`, the `task` (browse, find,
   triage, edit, settings…) and whether the reader `writes`. It gives the TYPE
   (type.v1: each field's data, said once — save it as `types/<id>.json` and
   make the store from it), the page's own part of its `source` (what it
   searches, each field's control) and the NEED. Give `status` for the status
   fields the store works out, and the page's `fields` for its children: a
   sample shows neither. `validate_rows` checks the type against more rows.
2. **`pick_pattern`** — the need. It gives the patterns that fit, highest rank
   first, with each part of each `when` and whether it held. Take the first,
   unless the reader asked for another. An app's own patterns, in a `patterns/`
   folder beside its `app.json`, are picked with Sherpa's; one of the same id
   replaces Sherpa's. `sherpa://patterns` lists them all.
3. **`generate_page`** — the pattern's id, the page's `id`, the `type` and the
   page's own `source` from step 1.
   It gives the Context's three files — its template, its definition and its
   first View — and its `app.json` entry, each already checked by
   `validate_page`. A pattern with no data source gives a Settings page: its
   template, and its entry under `settings.pages`.
4. **Write the files** at the paths it names, in the app's folder, and add the
   entry to `app.json`. Then **`validate_page`** on what you wrote, or
   **`validate_app`** on the app, after every change you make to them.
5. **`preview_page`** — the page drawn over the rows and their `type`, its reports and its usage
   problems (the see tier). Where the MCP has no `preview_page`, say so, and
   run the app (`npm start`) to look.
6. **The module** — the pattern's `use` says what its Context's module does:
   generate_page names each element it hears and the events it fires. Write it
   as `sherpa://app-guide` §7 says.

Change only what the pattern's `agent.may` names. Keep every role in its
`agent.keeps`. A component asks its provider for its data: never bind one by
hand. A problem is said in its checker's own words; fix the files, not the
checker.
