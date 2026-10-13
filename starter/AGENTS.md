# This app, for an agent

A Sherpa UI app: plain files, no build. `npm start` serves this folder.

| file | holds |
|---|---|
| `index.html` | the page: the shell, and `outlet.start()` — change it rarely |
| `app.json` | THE list: every Context, the default, the nav, the Settings pages |
| `templates/<context>.html` | a Context's markup: components that ASK for data |
| `view-schemas/<context>.json` | its page definition: the store, fields, scopes, saved filters |
| `views/<context>-views.json` | its Views: each scope's `where`, sort and group |
| `stores/*.js` | the app's stores, and their seed rows |
| `contexts/<context>.js` | a Context's own behaviour, if it has any — `init(root, ctx)` |

To add a Context: a template, a page definition and maybe Views, then a line
in `app.json` — its label, icon and files — and a row for it in `sections`.

Rules that hold everywhere:
- A condition is written ONE way: `{ "seats": { "gte": 50 } }`, numbers as numbers.
- A component asks its provider for data; nothing binds by hand.
- A Context reaches the header and panels through `ctx`, never `document`.

Read the guide before you build: `node_modules/sherpa-ui/docs/APP-GUIDE.md`,
or `sherpa://app-guide` from the Sherpa MCP, which `.mcp.json` registers. Its
`validate_page` tool checks `app.json` and every page definition.
