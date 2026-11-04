---
name: review-page
description: Review a page of a Sherpa app with the sherpa-ui MCP — check its files, check its markup against the component specs, then draw it over real rows and read what the data layer says. Use when asked to review, check or fix a Context, or when a page looks wrong.
---

# Review a page

A page is its Context's three files: its template, its page definition and its
Views. Review them in this order, each step one sherpa-ui MCP tool; fix what each
names before the next.

1. **`validate_app`** — the app's `path` and the Context's name, `context`. It
   checks the definition against page.v1 and `checkPage`, the Views against
   views.v1, and each `ui` against the specs, as **`validate_page`** does for
   files given as text. Each problem is in its checker's words: fix the file it
   names.
2. **`check_usage`** — the template, and each View's markup: every sherpa-* tag,
   `data-*` and enum value against the specs. A typo there does nothing in a
   browser, and says nothing.
3. **`preview_page`** — the same `path` and `context`, and `rows`: a real page of
   the store's rows. Read its three answers: the data layer's reports, the usage
   problems and the screenshot. A report names what broke, in the data layer's
   words: fix that, never only what the screen shows.
4. **Where the page looks wrong**, `read_component` the element. Do what a reader
   would with `call_component` — a method its spec lists — then `watch_trace` for
   what that act did, by node.
5. **Fix, and `preview_page` again**, until it has no report and no usage problem.
   `preview_close` when done.

Change the files, never the checkers. A component asks its provider for its
data: a grid bound by hand is reported (`grid-without-provider`).
