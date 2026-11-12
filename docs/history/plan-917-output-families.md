# Plan 917: one Output node per family

Will, 2026-11-11: "1 output node per Type Category (Notification, Content, Response, Result, Request), ditch existing
Notification output node." This undoes plan 891's one Output node of many types.

## Today (plan 891)

- **One kind, `output`.** Its Type picker lists seven types in five groups:
  - Notification: Notification
  - Content: On a view, Generated file
  - Response: Toast, Alert, API response
  - Run result: Run result (the default)
  - Request: none shipped; Demos adds Another agent and Ticket
- **The Nodes panel** lists Output, and also "Notify": an Output of type Notification.
- **The host app adds types** with `registerNodeTypes('output', { … })`. Each type says its `group`.

## The build

Five kinds in the Output category, one per family. Each family's types stay as they are.

| Kind | Heading | Types shipped | Demos adds |
|---|---|---|---|
| `notify` | Notification | Notification | none |
| `content` | Content | On a view, Generated file | AI chat artefact |
| `response` | Response | Toast, Alert, API response | AI chat reply |
| `result` | Run result | Run result | none |
| `request` | Request | none | Another agent, Ticket |

- **The panel** lists the five, and no Notify.
- **The Type row**: a family with one type shows no Type row; its rows come first. A host type joins a family, and the row
  shows from two types on.
- **The host adds a type to its family:** `registerNodeTypes('content', { artefact })`. The `group` word is gone.
- **What stays the same:** each node's look (its `output` category: fill, ink, radius), its lane (Output), Simulate's `would`
  and stand-ins, Send a test (`output-test` names the kind and the type), and the message rows.
- **A family with no type of its own** (Request, before a host adds one) is not listed in the panel.

## Decisions for Will

**Will, 2026-11-11: D1 A.** **Built 2026-11-12**, as planned. `alias` (Notify) and a type's `group` went with the one node.


- **D1. Graphs saved with the old `output` kind** (Demos' shipped workflows, and the copies a reader saved).
  - **A (recommended):** no reader for the old kind, as Will said for old Custom Nodes on 2026-11-05 ("clean system, no
    legacy"). I rewrite Demos' shipped workflows. A reader's old copy shows a fault until they use Reset all.
  - **B:** a reader maps an old `output` node to its family's kind, by its type, on load.

My picks, where Will does not say otherwise:
- `registerNodeTypes` per family kind.
- No Type row for a family with one type.

## Steps

1. The data layer: the five kinds from 891's `OUTPUTS` table, each family its own `types`. `NODE_CATEGORIES` stays.
   The registry tests and the Output tests follow.
2. The editor: the panel, the Output tab, Send a test, all by kind.
3. Demos: `output-types.js` registers per family, and the five shipped workflows are rewritten.
4. Docs: APP-GUIDE's Outputs section, and the MCP's node list.
