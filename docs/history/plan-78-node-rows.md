# Plan 78 — a node's header, its rows, and their sockets

Will, 2026-10-29: *"The content that we have in each node, at the moment, is
just the node header. … Nodes will also include, in their content area below the
header, a series of value and condition rows: Input socket - Input field -
Output socket. … The header could also have input and output sockets."*

This round is the UI only. Loading definitions, routing and running a workflow
come next, on the data layer.

## The anatomy

```
┌──────────────────────────────┐
●  ▶ Filter                      ◆   ← HEADER: icon, name, description; the whole node's sockets
│  A rule picks the rows.       │
├──────────────────────────────┤
│  Key        [ status     ▾ ] │   ← a ROW with no sockets: pick a key of the input
│  Condition  [ equals     ▾ ] │   ← a ROW with no sockets: pick an operation
●  Value      [ active       ] │   ← a ROW with an input socket: a value comes in, or is typed
│  Matches                      ●   ← a ROW with no field: an output socket only
└──────────────────────────────┘
```

● a value socket (a circle). ◆ an object socket (a diamond).

## The parts

| Part | What it is |
|---|---|
| `sherpa-node` | The card. Its HEADER is what it shows now: `data-heading`, `data-icon`, `data-description`. Its content area holds rows |
| `sherpa-node-row` | NEW. One row: an input socket, the field, an output socket. Any of the three may be absent |
| The field | A `sherpa-input-text`, slotted: a text field, `data-type="select"`, or `data-type="number"`. It names itself with its own `data-label`, so assistive tech reads the name |
| A socket | Drawn by its host from one family sheet, `src/core/sherpa-node-sockets.css`. Not a component yet: it has no behaviour of its own until routing |

## The API

The SAME two attributes on the node (its header's sockets) and on a row:

| Attribute | Values | What it does |
|---|---|---|
| `data-input-socket` | `value` · `object` | shows the input socket, at the start edge; a value is a circle, an object a diamond |
| `data-output-socket` | `value` · `object` | shows the output socket, at the end edge |

A row also has `data-label`: its name when it has no field. A field names
itself.

`socketRect('input' | 'output')` on the node and on a row returns the socket's
box on the screen, or null when there is none. A connector draws from it, so the
page never reaches into a shadow root.

## The decisions

1. **Sockets sit ON the card's edge**, half outside, as in Blender and Unreal.
   A row spans the card's full width and takes its inset from the node's
   `--_pad-inline`, so a socket at the row's edge is on the card's edge.
2. **A socket lines up with its field's CONTROL, not its label.** The control
   is the last 32px (`--sherpa-display-mode-size-2xl`) of the row. A row with no
   field lines its sockets up with its label.
3. **A row pins no Style mode.** A selected node's active mode reaches its
   rows' sockets, so they turn active with it; each field keeps its own pins.
4. **A drag is not a press** (Will, 2026-10-29): the click a drag ends with
   does not select the node.

## Later, with the data layer

- A socket's NAME, so a route can say `node.row → node.row`: the row's field's
  `name`, or the row's own.
- A CONNECTED input: its field shows the incoming value and cannot be typed in.
- Sockets as handles: a drag from one to another makes a route. Then a socket
  has behaviour, and becomes `sherpa-node-socket`.
- `sherpa-connector`, in place of Demos' stand-in paths.
