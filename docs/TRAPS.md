# TRAPS

Facts that cost hours, moved out of the source so the code reads as code.

**Every entry here is cited from the code** as `// TRAP T-<id> — <summary>`, and
`npm run check:traps` fails the commit if a pointer and an entry disagree. That
gate is the whole reason this file is allowed to exist: a comment cannot lie
about the line beneath it, a doc can, and this repo has already had a check that
reported 22 failures and exited 0 for three months.

**If you are about to "simplify" something that looks redundant, search this file
first.** Most of what is here is the record of the obvious approach being wrong.

**By area: [TRAPS-INDEX.md](TRAPS-INDEX.md).** `npm run traps:write` makes it from
the `Site:` lines below, and `npm run check:traps` fails when it is stale. So
after you add an entry or change a Site, run `npm run traps:write`. The `##`
headings below are older than the index: most entries are under the last one.

---

## Shadow DOM and the platform

## Where the entries are

**Split by area, 2026-11-03** (Will, D5 A; plan-695 T1): one file per area of
[the index](TRAPS-INDEX.md), in `docs/traps/`. An entry lives in the area of its first
`Site:`; the gate reads the folder and holds every entry in its place.

| Area | Entries |
|---|---:|
| [The data layer](traps/data-layer.md) | 243 |
| [Storage, saved Views and the URL](traps/storage.md) | 36 |
| [The join and the app layer](traps/join-and-app.md) | 44 |
| [Filters](traps/filters.md) | 104 |
| [Menus, tips and overlays](traps/menus-tips-overlays.md) | 92 |
| [The data grid](traps/data-grid.md) | 58 |
| [Charts](traps/charts.md) | 44 |
| [SherpaElement and the shared sheets](traps/element-and-sheets.md) | 83 |
| [Other components](traps/other-components.md) | 73 |
| [Build, tools and the MCP](traps/build-tools-mcp.md) | 38 |
| [Tests only](traps/tests-only.md) | 13 |
| **All** | **828** |
