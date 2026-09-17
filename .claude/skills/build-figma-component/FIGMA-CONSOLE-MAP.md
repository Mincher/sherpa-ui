# Figma-console call map

The official Figma skills target Figma's OWN MCP tool `use_figma`. This project
uses the **figma-console** bridge instead, so every call has to be translated.

Read those skills on demand with `mcp__claude_ai_Figma__get_figma_skill`
(`skill://figma/figma-use/SKILL.md` and its `references/*`) — no OAuth needed
for a resource read. They were VENDORED into `.claude/skills/figma-*` until
2026-09-17; that was 23,875 lines of a second copy nothing read from disk, and
the copy had drifted into being wrong (it still said "on error, STOP, do not
retry" where the current skill says "obey `safeToRetryWithoutCanvasRead`").

Map the calls:

| Figma skill says        | Use here (figma-console)                    |
|-------------------------|---------------------------------------------|
| `use_figma`             | `mcp__figma-console__figma_execute`         |
| `get_screenshot`        | `mcp__figma-console__figma_take_screenshot` |
| `get_metadata`          | `mcp__figma-console__figma_get_file_data`   |
| `create_new_file`       | (not supported by figma-console)            |
| `search_design_system`  | `mcp__figma-console__figma_search_components` |

The Plugin API rules + the `references/*.d.ts` typings served by that skill are
still the source of truth for what `figma_execute` can do. `SKILL.md` beside
this file is the project's own build checklist.
