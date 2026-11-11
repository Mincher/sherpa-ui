# Plan 940: A Condition's operations follow what comes in

Will, 2026-11-11: "If only variables (string, integer) are passed into a condition node then we should only allow
condition operations that work those variables. If only objects are passed in then we should show condition operations
that work with data (rows). If it's a mixture of both then we should show all valid operation selections and ignore any
inputs that don't work for the selected condition. We're already handling conditional properties for output based on
input types."

## Today

- **The Operation list is always all of them:** And, Or, the six comparisons, Not, Is empty, then the rest.
- **A Field's column of the wrong type only warns** (plan 783 F2, `opWarning`): "Contains takes a text field; it was
  given the Seats column". Nothing hides.
- **The Query editor already narrows:** a leaf's select lists its field's operators (`OPS_FOR_TYPE`).
- **939 made the Properties follow what comes in:** rows in show Results and Count; counts in show Count.

## The build

1. **What comes in decides the list.** The editor reads each connection into the header, as 924 and 939 do:
   - **A value or a column, of a type** (text, a number, a date): the comparisons `OPS_FOR_TYPE` gives that type, then
     And, Or and Is empty. A boolean: And, Or, Not and Is empty.
   - **Rows or another object:** the operations that work on data: And, Or and Is empty. A comparison needs a Field.
   - **A mixture:** every operation one of them takes, together.
   - **Nothing:** all of them, as today.
2. **One list, one place.** One data-layer function, given the node and the graph, says which operations fit. The Type
   select, the Query editor and the warning all read it. `opWarning` then reads it too.
3. **Off is not gone.** A pick that no longer fits stays the node's own (D1).
4. **An input that does not fit the pick is ignored** (D2). Simulate and the Query's tree skip it.
5. **Words:** the APP-GUIDE's "True and False steer" section and the Logic trap say it once.

## Decisions for Will

**Will, 2026-11-11: D1 A (keep the pick, and warn), D2 A (a dashed connector and a tip; the node does not warn).**

- **D1. A connection changes, and the pick no longer fits.**
  - **A (recommended):** keep the pick. The list still shows it, and the node warns, as 770 does today. The graph stays
    open, and what you set is never changed for you.
  - **B:** switch the pick to the first operation that fits, as an Undo step.
- **D2. How an ignored input looks, in a mixture.**
  - **A (recommended):** its connector draws dashed, and its tip says why: "Ignored: Greater than takes a number". The
    node does not warn. It is fine to connect it.
  - **B:** the node warns, as a wrong input does today.

## Steps

1. The data layer: `operationsFor(node, graph)`; the Type row's choices read it; `opWarning` reads it.
2. The editor: the select lists the choices; an ignored connector's look and tip (D2).
3. Simulate and `nodeFlow` skip an ignored input.
4. Tests in three engines; the Demos graphs still open with no fault.
