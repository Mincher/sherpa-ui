# Plan 892 — a WYSIWYG Markdown editor

Will, 2026-11-11 (TODO 892; plan 891 D2 A): "Markdown Editor; Ok. We have designs and a plan for this so we can get
another agent to put it together while we do other things." Built in lane 892. Sources: Figma ACP file
`UaNDhhl1fawHB0K9KqJFxA`, "Markdown Editor" `2306:17891` (Components page) and CG-05 (`3191:870179`); Harness notes
`32-output-nodes.md` ("Messages") and `27-vision-runbooks-branch.md` (the Markdown Editor part).

## What the design has

- **A toolbar** of small secondary buttons in groups, a divider between: Undo, Redo · a text style menu ("Normal text"),
  Bold, Italic · bulleted list, numbered list · outdent, indent · link, comment, code, image, table. At its end, the
  view switch: formatted, or the Markdown itself.
- **The box**: a bordered field, 96px high at rest, its placeholder; a fixed help line above and a message below, both
  hidden at rest.
- **"More about markdown"**: a tertiary link, opening outside.
- In CG-05, a message's values `{recipient.first_name}` read purple, and Insert value sits under the editor.

## The model

- **The value is the Markdown text, and the editor never holds another copy.** The formatted view draws that text: each
  line a block, each mark (`**`, `#`, `- `, `[`, `](url)`) its own hidden part. A line's parts joined are the line again,
  so a round trip loses nothing, and a caret is one offset in the text.
- **A mark shows while the caret is in its span** (as Typora does): `**bold**` reads bold, and the caret in it shows the
  `**`. A line's block mark (`#`, `- `, `1. `, `> `) stays hidden: the block's look says it, and the toolbar, Enter,
  Backspace and Tab change it.
- **Every edit is the text's**: typing, Enter, Backspace, paste, a button. The browser's own edits are read back only
  for what cannot be stopped (composition, an IME). Undo and Redo are the editor's own history.
- **The text's reading and edits are DOM-free** (`src/core/data/markdown-text.ts`): node unit tests prove each.
- **A value** `{node.name}` is one part: a purple chip of its words (`valueLabels`, `{Customers › Name}`), the same purple
  as the node row. `insertValue(key)` puts one at the caret.
- **The Markdown view** is a plain text area of the same text.
- **A form control**: `value`, `name`, `required`, `disabled`, `readonly`, `placeholder`; `input` and `change` as a field.

## What it reads

Headings 1 to 6 (the menu offers 1 to 3), paragraphs, bold, italic, strikethrough, inline code, code blocks (fenced),
bulleted and numbered lists, nested, quotes, links, images (their words, no picture), comments `<!-- -->`, tables (a row
a line, its pipes drawn faint), rules, escapes and values.

## Left for later

- A table as a grid of cells, and an image drawn or uploaded.
- A link's own dialog: a link today selects its address to type over.
- Task lists, setext headings, HTML blocks, reference links.
- The Preview's Email / In app switch (plan 891), drawn by this editor read only.
- An icon for the numbered list: the set has none, so it says "1.".

## The steps

1. This plan.
2. `markdown-text.ts`: read the text, and the edits. Node unit tests.
3. `sherpa-markdown-editor`: its five files, its spec, its example. An e2e spec in three engines; the a11y gate reads
   its example.
4. An Output's message field is the editor: `fieldFor`, `fill` and `read` in `node-graph.ts`; Insert value puts a value at
   the caret (`node-output-panel.ts`). `reforged-node-output-types.spec.ts` follows.
5. The maps, the manifest, the reference and the baselines.

## For Will to pick

- **Title and File name are message rows too** (`messageRow` in `node-kinds.ts`), so each is the full editor, toolbar and
  all. CG-05 draws Title as one line with its values. A: a row says it is one line (`RowKind`), and a one-line message is
  the editor with no toolbar and no line breaks. B: leave them as they are.

## Built

- **Step 1** (`d2e90063d`): this plan.
- **Step 2** (`6fa9a876e`): `markdown-text.ts` — the text read as lines, blocks and parts, each a range of the text; and
  each edit, with the selection after it. 11 node unit tests (`a-markdown-text-is-its-own-model`).
- **Step 3** (`5845274c2`): `sherpa-markdown-editor`. Every edit is the text's: a key (`beforeinput`), a paste, a cut, a
  tool; an IME's is read back from the drawn text. Its own Undo and Redo (typing within a second is one step). The caret
  is read from the shadow root's own selection (Chromium) or `getComposedRanges` (Firefox, WebKit); a caret Firefox puts
  inside a value goes after it. State pins as the input field's (`state-pins.yaml`, projected). The a11y gate: no failures. E2e spec, 11
  tests, in Chromium, Firefox and WebKit.
- **Step 4** (`eb8e1c0ac`): an Output's message field is the editor (`messageField`); Insert value names each value by its
  node and label in the field and puts the pick at the caret; the Output tab's Preview draws each message read only.
- The icons are the design's but two: Undo and Redo are Sherpa's own pair (`arrow-rotate-left`, `arrow-rotate-right`),
  as the node toolbar has them; the numbered list says "1.", as the set has no icon for it.
