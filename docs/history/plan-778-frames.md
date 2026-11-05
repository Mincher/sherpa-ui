# Plan 778 — frames: a column of picked nodes, framed, with a header

Will, 2026-11-05: "A toolbar action to union 2 or more nodes. This will align the selected node into a
column (same as grid align but with only 1 column) and then draw a frame around them. This frame will have
a header with a title and description as well as actions to remove the frame and release the contained
nodes. Dragging the frame header will move all nodes inside it together."

## Picks

| | Pick | Why |
|---|---|---|
| Data | `frames?: { id, label?, description?, nodes: [...] }[]` in the workflow, beside `ties`; a Custom Node's body and an entity's graph carry it too | A frame is a graph-level object that is not a node, as a zip tie is. It changes no data: a runner ignores it, a version never counts it |
| Its box | NOT saved. Drawn round its nodes' drawn boxes, `--_pad` clear, its header above | One owner per value: the nodes own their places (PRINCIPLES 21). Nothing to keep in step |
| A node dragged out | Stays in; the frame grows round it | Follows from the box. A node leaves its frame by Release, or by Delete |
| A node in two frames | Never: framing takes a node from the frame it was in; a frame left with no node goes | One owner |
| Module | `src/core/data/node-frames.ts`: the type and its pure helpers. Nothing in `node-kinds.ts` | Lane 783 is in node-kinds; a frame is no kind |
| Edits | `{ frame: { nodes, id?, label?, description? } }` (two or more), `{ unframe: id }` (Release), `{ setFrame: { id, label?, description? } }`; `remove` drops the node from its frame | Each pure, each one Journal step |
| Check | `workflowFaults`: two frames one id; a frame of no node; a node that is not there; a node in two frames. `workflow.v2`, `defs.v1#/$defs/frame`, `entity.v1` | As ties are checked |
| Save | `finalGraph` keeps each frame's nodes still there; none left, it goes | Will's rule: Save writes the final graph |
| Action | Toolbar `frame`, icon `frame` (new), "Frame nodes (F)": on with two or more picked (`data-can-frame`). It lays the picked nodes in ONE column (`arrangeNodes` with `column: true`: flow order, sources first; Arrange's gap, 3 × space-5xl; left edges and the top-left kept, 4px grid) and frames them: ONE step. The frame is then picked | Will's words |
| Look | A component, `sherpa-node-frame`: behind every line and node; a `sherpa-container-header` with the title and description (one line each), and a Release button in its actions. The body takes no pointer: a box or a pan starts on it | COMPOSE. An SVG cannot hold a header's text and buttons |
| Picked | A click, or Enter or Space on its header, picks it: `data-current`, the active pin, as a picked node. A node picked unpicks it, and the other way | Every picked thing looks the same |
| Name and line | In the inspector: Name and Description fields, and Release | One panel for every pick |
| Release | ONE action: the frame goes, its nodes stay where they are. The header's button, the inspector's, or Delete or Backspace on the header | "remove the frame" and "release the contained nodes" are the same act. A second action that deleted the nodes too would be Delete on picked nodes, which there is |
| Drag | A drag on the header reports each move, `frame-move { dx, dy }`, in plane px. The editor moves every node in it (the `{place}` edit, as a group drag; a tie whose routes all join them, and the bends between them, go too): ONE step | The frame owns no place, so it reports a step, never a place |
| Keys | On the header: the arrows move it 8px (Shift 32), Enter or Space picks it, Delete or Backspace releases it. F frames the picked nodes. Escape lets go of the frame | PRINCIPLES 21: a caller with no pointer |
| Box pick | Picks nodes only, never a frame | A frame is picked by its header |
| Delete on nodes | The nodes go, and leave their frames | |
| Arrange | The nodes move; their frames follow | Derived box |
| Save as Custom Node | A frame whose nodes are all picked goes inside the definition; a frame partly picked keeps the rest | As a tie of inner routes goes inside |
| Ungroup | The definition's frames come back out, their ids and nodes renamed as the nodes are | The inverse |
| Read only | Drawn; no drag, no Release, the fields read only | A preset |
| Minimap and Fit | A frame is a canvas child, so the canvas counts it | Nothing to add |
| The Query editor | No frames | Its graph is the Query's, drawn, never kept |

## Questions for Will

1. A node dragged clear of its frame: (A, picked) stays in, the frame grows; (B) leaves it, and a node let go
   inside a frame joins it.
