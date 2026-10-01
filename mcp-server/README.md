# Sherpa UI — MCP Server

Structured access to the Sherpa design system for an AI agent: what a component
IS, what a caller can DO to it, whether your data will fit, and — against a
local page — the live screen itself.

**17 tools · 6 resources · 3 prompts.** Every name below is registered in the
code; if a tool is not listed here it does not exist.

> This file replaced a 752-line version on 2026-09-17 that documented 20 tools,
> **19 of which had never existed** — and omitted 17 of the 18 real ones. It
> shipped in the npm package (`files` includes `mcp-server/`). A README is an
> interface: an agent reads it to decide what to call.

---

## Setup

Node 18+, and this repository.

```bash
npm run mcp      # stdio — no output; it is launched BY a client, not run by you
```

Some tools need the compiled data layer (`dist/`), which is gitignored and which
`npm run mcp` does not build. Run `npm run build` once. A tool that needs it and
cannot find it says so.

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "sherpa-ui": {
      "command": "node",
      "args": ["/absolute/path/to/sherpa-ui/mcp-server/index.js"]
    }
  }
}
```

### VS Code / Cursor

Same shape, in the client's MCP settings — `command: node`, `args:
[<abs path>/mcp-server/index.js]`.

---

## Tools

### Discover — what a component is · `tools/discover.js`

| Tool | Arguments | Answers |
|---|---|---|
| `list_components` | `category?` | Every component, grouped, with its Figma binding |
| `get_component` | `name`, `include?` | One component in full: spec, compiled TS/HTML/CSS, Figma shape |
| `find_token` | `query` | Which token NAMES exist, by fragment. Synonym-aware |

There is no "what is this token FOR" tool. The ontology that carried purpose,
role and caveat was deleted 2026-09-16 for having rotted, and its build scripts
followed on 2026-09-17. `find_token` answers the question that still has a
source — does this name exist — from the generated `tokens.css`.

### Generate — author a new one · `tools/generate.js`

| Tool | Arguments | Answers |
|---|---|---|
| `scaffold_def` | `name`, `category` | A starter spec with the right shape for its category |
| `validate_def` | `def` | Every design-system rule, checked |
| `compile_def` | `def` | Spec → TS + HTML + CSS |
| `token_for` | `property`, `value` | Which token resolves to this pixel value |

### Verify — check a built one · `tools/verify.js`

| Tool | Arguments | Answers |
|---|---|---|
| `audit_component` | `name` | The def rules, plus every `element.property → token` binding |
| `check_bindings` | `name` | Rule 9: does every geometry/colour property bind a token |

Both check token NAMES against the generated `tokens.css`. Neither checks role
or scope: there is no ontology and no plan for one.

### Data — will my data work · `tools/data.js`

Thin wrappers over `sherpa-ui/data`, so their answers are the answers your app
gives — the same `validate()` a Store runs, the same `DataSource` a component
binds to.

| Tool | Arguments | Answers |
|---|---|---|
| `validate_schema` | `schema`, `rows`, `key?` | Which rows map, which are REJECTED, and why |
| `scaffold_schema` | `rows`, `key?` | A draft schema, every inference marked with its evidence |
| `import_schema` | `document`, `path?`, `key?` | A backend's JSON Schema / OpenAPI → a Sherpa schema |
| `run_query` | `rows`, `filter?`, `sort?`, `search?`, `searchFields?`, `group?`, `pageSize?`, `page?`, `key?` | What a bound component actually receives |

They chain: **import or scaffold a schema → validate it against real rows → run
a real query through it.**

`import_schema` maps eight JSON Schema keywords and reports the other ten by
name and field. A converter that quietly ignores `$ref` or `allOf` emits a
schema that looks faithful and enforces half of what the backend promised.

### Drive — the live screen · `tools/drive.js`

The parity rule made reachable: anything a person can do by clicking, a caller
can do by calling, and an agent is a caller with no pointer.

| Tool | Arguments | Answers |
|---|---|---|
| `component_api` | `name` | What is callable: methods with signatures, JS properties and their access, events, attributes. **No browser needed** |
| `call_component` | `selector`, `method`, `args?`, `url?`, `readBack?` | Call it on a real element, then read the state back |
| `read_component` | `selector`, `props?`, `url?` | Where a live screen actually is |
| `browser_close` | — | End the session |

**Scope, deliberately narrow.** This executes in a browser:

- **localhost only** — a remote URL is refused, not fetched
- **no arbitrary script** — you name an element, a method and JSON arguments;
  the page-side code lives in the repo
- **opt-in** — nothing launches until a tool asks, and the page is kept between
  calls on purpose (doing something then looking at what happened needs the same
  page), so close it when you are done

Default page is `http://localhost:4000/test/reforged/harness.html`; serve one
with `npm run preview`.

---

## Resources

| URI | Is |
|---|---|
| `sherpa://data-rules` | What Sherpa expects of your data — the row shape, the filter grammar, where validation belongs |
| `sherpa://rules` | The def→Figma build rules, plus the component spec schema |
| `sherpa://def/{name}` | One component's def, read from its `.component.json` |
| `sherpa://component/{name}/ts` · `/html` · `/css` | The shipped source |

## Prompts

| Prompt | For |
|---|---|
| `generate_component` | The paved path for a new component: scaffold → author → validate → compile |
| `review_component_usage` | Audit HTML that uses Sherpa components |
| `debug_component` | Step-by-step diagnosis when one is not behaving |

---

## The contract it reads

`src/components/<name>/<name>.component.json` — generated by
`scripts/generate-component-spec.mjs`, validated against
`schemas/component.v1.json`, and gated on every commit by `npm run spec:check`
(which checks BOTH that a spec matches the schema and that it regenerates its
own source). Tokens come from `src/styles/tokens/tokens.css`, re-projected from
Figma.

Tools are thin wrappers over `scripts/lib/generation/*` — one implementation,
two surfaces (this server and the `generate-sherpa-component` skill).

To add a tool, edit the module it belongs to and register it there;
`server.js` wires the five modules up.

---

## Keeping this file honest

It is generated from nothing — it is hand-written, which is exactly how the
last one drifted 19 tools out of date. The list above was read out of the code
by registering every module against a capturing stub:

```bash
node -e "
const rows=[];
const cap=(m)=>({registerTool:(n,c)=>rows.push([m,n,Object.keys(c.inputSchema??{}).join('|')])});
(async()=>{ for (const m of ['discover','generate','verify','data','drive'])
  (await import('./mcp-server/tools/'+m+'.js')).register(cap(m));
  rows.forEach(r=>console.log(r.join('\t'))); })();"
```

Run that after changing a tool, and make this file match.
