# Plan 939: True and False steer; an Or takes values

Will, 2026-11-11: "The 'Or' Condition node takes in a boolean but it should be able to take in multiple values or objects.
If any of the input values is greater than zero/null then that input assesses as true and gets added to the results of
the condition node for output. If any of the inputs are true then the true output socket steers the graph logic down the
true route. The opposite if false. (Might be good to state that True and False sockets on nodes are 'If True then do
this' or 'If False then do this'. They steer but they don't pass on any row data. Properties, like Results, contain row
data to pass on but gets wired up separately.)"

## Today

- **And and Or take booleans only:** `input: 'boolean'`, several. A value or an object into one reads null, and the node
  warns.
- **A fork's True and False SEND ROWS.** In Simulate, True sends the rows that pass (`kept`) and False the rows that fail
  (`lost`). A node fed by a True gets those rows on its header, as its data.
- **Results, a property, sends the passing rows too.** So the rows that pass go out twice: on True, and on Results.
- **924's rows check reads a test's True as rows**, where its own header hears rows.
- **The words (934):** a Route is a path from a Start node to an End node, and a Branch is one Route leaving a fork.

## The build

1. **True and False STEER, and carry no rows.** True says "if true, do this", and False says "if false, do this". Each
   sends one boolean. Rows go out only through a property: Results, the rows that pass. The rows that fail have no
   property (D2 B): a reader uses a Not, or a second Condition.
2. **Steering:** a node down a Branch that was not taken does not run. Simulate draws it "Not taken", and its outputs send
   nothing (D1).
3. **And and Or take anything, several:** a value, a boolean, an object, rows.
   - An input is TRUE where it is above zero, true, or not empty. It is false where it is 0, false, null or empty.
   - Or is true where any input is true; its Results are the rows of the true inputs, together.
   - And is true where every input is true (D3).
4. **924** follows: a test's True is no longer rows. A node's Results show where rows reach its header, by a property or
   by rows.
5. **Words:** PRINCIPLES 19 and the APP-GUIDE say it once: "True and False steer; a property carries the rows."

## Decisions for Will

**Will, 2026-11-11: D1 A (the steer goes into the header), D2 B (no property for the rows that fail), D3 A (And: the rows in every input).**


- **D1. Where a steer goes in.** A node's header input is its DATA today (D1 of plan 713).
  - **A (recommended):** the header takes a steer beside its data. A True or a False connected to it gates the node: it
    runs only where the Branch was taken. Its rows come from a property connected to the same header or to a row. No new
    socket.
  - **B:** a new "Run if" socket on each node takes the steer, and the header stays data only. It is clearer, but every
    node gets one more socket.
- **D2. The rows that fail.**
  - **A (recommended):** a second property, "Others": the rows that did not pass, beside Results.
  - **B:** none. A reader who wants them uses a Not, or a second Condition.
- **D3. And's Results.**
  - **A (recommended):** the rows that are in EVERY true input (their overlap). Or's are all of them (their union).
  - **B:** the same as Or: the rows of every input, together.

## Steps

1. The data layer: And and Or types (input any, several; truth by value), Results, and Simulate: True and
   False send a boolean, and a not-taken Branch does not run. 924's walk follows.
2. The editor: Not taken drawn, the tips, the words.
3. Demos' shipped workflows: any that read rows from a True move them to Results.
4. Tests in three engines; APP-GUIDE and PRINCIPLES 19.
