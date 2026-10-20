# Plan 366 — one QueryContext per app Context

Will, 2026-10-20, chose **B**: one QueryContext per app Context holds the ONLY
Query. A data source keeps no Query of its own. It reads its filter from the
QueryContext and loads rows. Controls read their part there too, and send
one-field requests.

This page is the picture of the idea. The detailed design (names, where it
lives, the commits) comes from a read-only design workflow and is added below
when it is done. The map it starts from is
[plan-366-query-context-map.md](plan-366-query-context-map.md).

## 1. Who holds what

```mermaid
flowchart TB
  subgraph CTX["One app Context, for example Records"]
    QC["QueryContext<br/>the ONLY Query:<br/>filters, picks, conditions,<br/>saved filters on/off,<br/>sort, group, search"]
    subgraph SRC["Data sources: rows only, no Query"]
      S1["Source: customers"]
      S2["Source: tickets"]
    end
    subgraph UI["Controls: draw only"]
      BAR["Filter bars"]
      PAN["Filter panel"]
      HEAD["Grid headings"]
      LEG["Chart legends"]
    end
    SHOW["Grid, charts, metrics"]
  end
  KEEP["Session, saved Views, URL"]

  BAR -- "1 request: one field" --> QC
  PAN -- "1 request: one field" --> QC
  HEAD -- "1 request: one field" --> QC
  LEG -- "1 request: one field" --> QC
  QC -- "2 draw: your part" --> UI
  QC -- "3 the filter for your fields" --> SRC
  SRC -- "4 rows" --> SHOW
  SRC -- "5 counts" --> UI
  QC <-- "6 save and restore" --> KEEP
```

1. **Request.** A control never sends its whole answer. It sends one small
   request, for example "Status = Active".
2. **Draw.** The QueryContext tells each control what to show for its own
   fields. A control keeps nothing of its own.
3. **Filter.** Each source reads the Query and uses only the fields it has. A
   source with no "Status" field ignores Status.
4. **Rows.** The source loads the rows and gives them to the grid and the charts.
5. **Counts.** The source counts the matches and gives the numbers to the chips.
6. **Save.** The session, saved Views and the URL save and restore the
   QueryContext. They no longer save each source.

## 2. One click, step by step

```mermaid
sequenceDiagram
  autonumber
  actor R as Reader
  participant BAR as Filter bar
  participant QC as QueryContext
  participant S as Data source
  participant ST as Store
  participant G as Grid and charts
  participant P as Panel and headings
  participant K as Session
  R->>BAR: Ticks "Active" on the Status chip
  BAR->>QC: Request: Status = Active
  QC->>QC: Writes it into the one Query
  QC-->>BAR: Draw: Status = Active
  QC-->>P: Draw: Status = Active
  QC-->>S: Query changed: Status
  S->>ST: Load the page under the new filter
  ST-->>S: Rows
  S-->>G: Rows
  S-->>BAR: Counts for each chip
  QC-->>K: Save the Query
```

1. The reader ticks "Active".
2. The bar sends one request. It does not send its other chips.
3. The QueryContext writes the change. This is the only place a filter changes.
4. and 5. Every control that shows Status draws it, the sender too. This is
   safe: no control ever sends a whole answer back, so nothing is cleared by
   accident.
6. Each source hears what changed. A source that does not use Status does
   nothing.
7. and 8. The source loads the new page of rows.
9. The grid and the charts show the new rows.
10. The chips show their new counts.
11. The session keeps the new Query for the next reload.

## 3. What goes away

- Each source's own copy of the Query.
- The bar sending its whole answer, and the source clearing each field the bar
  did not name.
- The guards that exist only for that loop: the panel's echo check (`#said`),
  the bar's "edited after" check (`#editedAt`, `#pendingAnswers`) and the
  provider's two-frame mute.
- Sort, group and search kept apart from the Query.

## 4. Not decided yet

The design workflow answers these:

- Where the QueryContext lives. Likely the provider, which already holds one
  Context.
- Where the saved-filter library sits.
- How remote Apply and Discard work. Likely the QueryContext holds the draft and
  the applied Query, and the sources load the applied one.
