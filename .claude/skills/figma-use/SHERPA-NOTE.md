# Sherpa note

These official Figma skills target Figma's OWN MCP tool `use_figma`.
This project uses the **figma-console** bridge instead. Map the calls:

| Figma skill says        | Use here (figma-console)                    |
|-------------------------|---------------------------------------------|
| `use_figma`             | `mcp__figma-console__figma_execute`         |
| `get_screenshot`        | `mcp__figma-console__figma_take_screenshot` |
| `get_metadata`          | `mcp__figma-console__figma_get_file_data`   |
| `create_new_file`       | (not supported by figma-console)            |
| `search_design_system`  | `mcp__figma-console__figma_search_components` |

The Plugin API rules + `references/*.d.ts` typings are still the source of truth
for what `figma_execute` can do. Also see the local `build-figma-component` skill.
