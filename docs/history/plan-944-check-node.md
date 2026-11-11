# Plan 944: A Check node branches; a True property; a Count node

Will, 2026-11-11: "I think that we're making nodes harder to work with by having True and False sockets on nodes. We can
handle True and False by just having a True property that outputs a 1 or 0. Then we can have a new 'Check' node that has
property sockets for Yes or No. This node now controls the branching of logic in graphs. Instead of a Count property, we
should have a Count (or Total) type of Math node. Rows (Results) are passed into this node and output as a count value
variable."

## Today

- **A Condition forks** (`branches`): its header sends True, its footer False. Since 939 each sends true or false and no
  rows, and it STEERS: a node it joins runs only where its Branch was taken.
- **An AI node** (Prompt, Runbook, Skill) whose Expects is True/false forks the same way (926).
- **The Query editor draws with them too:** a test's True joins its And, Or or scope row; a status field's rules are
  chained by False, in the order the first match is taken (plan 783 D6). A Preset Filter's graph ends `True → #out/where`.
- **Count is a property** on a Source, a Field, a Group, each comparison, And and Or (Count is the true counts' sum
  there, 939). And and Or also have Pass and Fail.
- **The words** (PRINCIPLES 19): a Branch is a Route that leaves a fork, "a Condition that forks (`branches`)".

## The build

1. **No node has a True or a False socket.** `branches` goes from every kind. A Condition, and an AI node that expects
   True/false, has a **True property**: 1 where it holds, 0 where not. Results stays: the rows that pass.
2. **A Check node, in Logic.** Its header takes anything; it is true where what comes in is above zero, true, or not
   empty (939's truth). It has two property sockets, **Yes** and **No**. Only the Check node branches: it is the one
   fork, and a Branch starts there (PRINCIPLES 19). What Yes and No send is D1.
3. **A Count type of Math.** Rows in (Results, a Source's rows), how many out. The Count property goes from every kind.
   Its name is D3. Pass and Fail are D4.
4. **The Query** joins by the True property, as it joins by Results since 939: a test's True says its tree. A status
   chain is D2.
5. **Clean system:** a saved graph with a True or False connection, or a Count property, reads with a fault in words;
   nothing converts it. Demos' shipped graphs and N-zo's words (the peer's) move to Check, True and Count.
6. **Words:** PRINCIPLES 19 (Branch: "a Check node starts two"), APP-GUIDE, the traps.

## Decisions for Will

**Will, 2026-11-11: D1 A (Yes and No send what came in), D2 A (a Check per status value), D3 A (Count), D4 A (keep Pass and Fail).**

- **D1. What Yes and No send.**
  - **A (recommended):** **what came in**, on the one taken. A Check takes a Data input beside its test; Yes sends that
    data where the test holds, No where it does not, and the other sends nothing, so nothing after it runs. One line
    carries both the branch and the rows: fewer lines than 939's True plus Results.
  - **B:** **a steer only**, as 939's True and False do: 1 or 0, gating the node it joins. The rows are wired apart.
- **D2. A status field's rules in the Query** (the first one that matches wins).
  - **A (recommended):** **a Check per value**: its rules into it, Yes into its value's row, No into the next value's
    rules. The same node branches everywhere.
  - **B:** **no chain**: each value's rules into its row, and the order is said in words ("the first that matches").
- **D3. The new Math type's name.**
  - **A (recommended):** **Count**: how many rows come in. "Total" reads as a sum of numbers, which is another type.
  - **B:** **Total**.
- **D4. And's and Or's Pass and Fail** (how many inputs pass and fail).
  - **A (recommended):** **keep them**: they count inputs, not rows, so a Count node cannot say them.
  - **B:** **remove them**, with the Count property.

## Steps

1. The data layer: no `branches`; the True property; the Check kind; the Count type; Simulate (the Check steers, D1);
   `nodeFlow` (True says the tree); the Query (D2); faults in words for old graphs.
2. The editor: no True tab or False footer; the Check node's look; tips in few words.
3. Demos: the shipped graphs, and a note to the N-zo peer.
4. Tests in three engines; PRINCIPLES 19, APP-GUIDE, traps.
