---
name: explain-page
description: Explain how a page of a Sherpa app reaches its rows with the sherpa-ui MCP — draw its Query as nodes, run one act a reader would make, and read that act's spans node by node. Use when asked why a page shows the rows it does, or what a filter, preset or scope does.
---

# Explain a page

A page's rows are its Query's answer: its store, its source, each scope with its
conditions and presets, and its arrangement. Explain it in those terms, each step
one sherpa-ui MCP tool.

1. **Read its page definition** — the file app.json's Context names in
   `definition` — and a real page of its store's rows.
2. **`query_graph`** — that definition and those rows. It gives the Query as
   nodes and connections: its store, its source, each scope with its conditions and
   presets, its arrangement and its components. Its node ids are the ones the
   next steps name.
3. **`query_source`** — the same, and one command a reader would ask: a pick,
   `{ "scope": "data", "field": "<field>", "reading": { "picked": ["<value>"] } }`,
   or a sort or a page. It gives the rows, the total and each field's state.
4. **`watch_trace`** — that act's spans by node: the Source's load, each scope,
   each condition and preset with the rows it left, the arrangement with the
   total.
5. **Say it in the graph's terms**: which node narrows what, and why the total is
   what it is. For the page as drawn: `preview_page`, then `call_component` (the
   pagination, a toolbar's chip) and `watch_trace` again — the page's spans and its
   Node host's, joined by their trace.

A number on the screen is one page of rows: the total is the source's. A command
the Query has no word for moves nothing, and says so.
