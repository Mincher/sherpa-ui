# Backlog

Reported issues not yet implemented. Each entry records what is wrong, why it
matters, and what a fix has to cover — enough to pick up cold.

---

## Add Customer does not add a row to the data grid

**Reported** 2026-09-10.

**What happens**: on the records example, the Add customer dialog opens, the form
accepts input, and Save closes the dialog and shows a success toast — but the new
customer never appears in the grid.

**Where**: `examples/views/records.js`, the `#save-btn` handler. It reads the name
field, closes the dialog and raises a toast. It never pushes the record onto the
`customers` array, so `currentRows()` cannot return it and `render()` re-populates
the grid from unchanged data. The toast makes it *look* like it worked.

**What a fix has to cover**, beyond the one-line push:

1. **The whole record, not just the name.** The dialog collects name, email, plan
   and status; only the name is read today. `FormManager` (`components/utilities/`)
   is the intended way to read a named form region rather than querying each field.
2. **Where the row lands.** Appending to the end puts it on the LAST page, which
   the user is not looking at. Either jump to it or insert respecting the active
   sort — a decision, not a detail.
3. **Active filters.** A new row that does not match the current quick-filter or
   column filters will not show. Silently adding an invisible row reads as the
   same bug. Probably: clear the filters, or say so in the toast.
4. **Pagination totals.** `totalPages` is derived in `render()`, so it follows
   automatically — but the page the user is ON may no longer exist if a filter is
   also cleared.
5. **Edit and delete.** The same flow exists for editing and deleting, and both
   have the same gap. `patterns/flows/add|edit|delete.html` are the canonical
   structures, and `FlowManager` owns the dialog lifecycle and the flow events
   (`flow-complete`, `flow-error`) that the toast should be driven from.

**Why it was left**: the components are all behaving correctly — this is missing
wiring in the EXAMPLE app, and doing it properly means picking the insert/filter
behaviour rather than guessing it.
