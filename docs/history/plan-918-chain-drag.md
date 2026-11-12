# Plan 918: Chain drag, and node radii

**Will, 2026-11-12: D1 A (a rope), D2 A (every drag).**

Will, 2026-11-11: "a setting, Enable node chain dragging, on by default. On, Ctrl (⌘ on a Mac) held while dragging a
node keeps each connector's length: the nodes joined to it are pulled along behind it, and theirs behind them, like a
rope (follow-the-leader, distance constraints along the routes). Check first what Ctrl already does on a node drag."
Later: "each node has a RADIUS, from its largest side, and no two nodes come closer than their radii as they move."
It should also fix 925: two nodes of one lane overlap, because nothing keeps them apart.

## Today

- **⌘ or Ctrl does nothing on a node drag.** Ctrl or ⌘ with the wheel zooms; with an arrow it moves the picked nodes
  8px (TODO 752); on a resize handle it keeps the aspect. Shift on a drag settles the stages; Alt on a drag copies.
- On a Mac, Ctrl and a click is a right click. So the key is ⌘ on a Mac, Ctrl elsewhere: `primaryKey(event)`.
- **A drag:** `sherpa-node` moves itself and sends `node-move {x, y}`. The editor moves the picked nodes with it, and
  writes them in ONE step (`onMoveMany`, `place`), with the ties and bends between them.
- **A setting** is a session key: `resizeStages` is `/nodes/resizeStages`, on, a switch in Demos Settings › Node
  Editor. A component reads it into an attribute (`static settings`), as `sherpa-node` reads `resizeNodes`.

## The build

1. **The setting.** `chainDrag`, `/nodes/chainDrag`, on. `sherpa-node` reads it into `data-chain-drag`. Demos: a switch
   in Settings › Node Editor, "Enable node chain dragging".
2. **The node reports it.** With `data-chain-drag` and ⌘ (Ctrl) held, a header drag sends `node-move {x, y, chain:
   true}`. ⌘ (Ctrl) and an arrow on its header does too, so a reader with no pointer can chain-move (PRINCIPLES 21).
3. **The chain, in the data layer** (`node-chain.ts`, no DOM): given the nodes, their sizes, the connections and the
   dragged node's new place, the new place of every node the chain moves. Each connector's length is measured at the
   start of the drag, between its two sockets. The dragged node (and every picked one) is held; the rest follow,
   along the connections both ways, by a few passes of distance constraints (they settle a loop too).
4. **Radii.** A node's radius is half its largest side. As nodes move, no two come closer, centre to centre, than
   their two radii added. A spatial grid finds the near ones, so 2,000 nodes stay fast.
5. **One step.** The whole chain is written by `onMoveMany`, as a picked group is: one Undo. A stage a node moves into
   holds it, as for any drag. Lanes on, the lanes fit after, as now.
6. **Tests:** the chain math by node (lengths kept, radii kept, a loop, a held node); in the browser, a ⌘ drag pulls
   the nodes, a plain drag does not, the setting off does not, one Undo puts all back; 925's lane overlap gone.

## Decisions

**D1. When the dragged node moves TOWARD a node it joins, what happens?**

- **A. A rope (recommended).** A connector pulls when it is stretched, and goes slack when pushed. Pull a node away:
  the next one follows. Push it closer: the next one stays, unless the radii push it. This is follow-the-leader, as
  Will said: "pulled along behind it".
- **B. A rod.** Each connector keeps its exact length, both ways. Push a node closer: the next one is pushed away.

**D2. Which nodes do the radii hold apart?**

- **A. Every node, on every drag (recommended).** A moving node pushes any node it comes too close to, and that one
  pushes on. A plain drag too, so no drag puts one node on another, and 925 is fixed for any move.
- **B. Only in a chain drag.** A plain drag stays free, and may put a node on another, as now. 925 is fixed only by a
  chain drag.
