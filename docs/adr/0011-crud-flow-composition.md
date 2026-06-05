# ADR-011: CRUD Flows via Composition, Not a Flow Component

**Status:** Accepted  
**Date:** 2026-06-05  
**Deciders:** Design System Team  
**Linked Requirements:** REQ-11, REQ-13

## Context

Add / Edit / Delete flows are the most common patterns in enterprise UI: open a dialog, fill a form, submit, show a result. The question is whether these should be encapsulated as a `<sherpa-flow>` component or composed at the application level from existing primitives.

A `<sherpa-flow>` component would need to:
- Know what entity it's operating on
- Know which fields to render (their types, validation rules, labels, defaults)
- Know where to submit (API endpoint, store action)
- Know what to do on success and failure (navigation, toast, downstream state updates)

Every one of those concerns is application-level. A component library that reaches into application concerns becomes tightly coupled to every app it's used in, impossible to version independently, and a maintenance trap.

The alternative is to treat flows as composed interactions: `sherpa-dialog` + `sherpa-form` fields + `FlowManager` + `FormManager` from `components/app-utils/`. The library supplies the primitives and the wiring utilities; the application assembles the flow.

## Decision

No `<sherpa-flow>` component exists or will be added. CRUD flows are composed from:

1. **Trigger element** — any `sherpa-button` dispatching a `flow-start` event
2. **`sherpa-dialog`** — contains the form or confirmation content
3. **Form fields** — `sherpa-input-*` components inside the dialog
4. **`FlowManager`** (app-utils) — orchestrates multi-step flow state via events
5. **`FormManager`** (app-utils) — handles validation, dirty tracking, submission
6. **`SherpaToast`** — provides success/error feedback on completion

The interaction contract is event-driven:
- `flow-start` — open the dialog
- `flow-progress` — advance to next step (wizard flows)
- `flow-complete` — submit succeeded; close dialog, show success toast
- `flow-cancel` — user dismissed; close dialog, discard draft
- `flow-error` — submit failed; show error feedback inside dialog

All events are dispatched with `bubbles: true, composed: true` so they cross shadow boundaries and can be handled at any ancestor level.

## Consequences

### Positive

- ✅ **No coupling to application logic:** The component library doesn't know about APIs, stores, or navigation
- ✅ **Composable:** Each step (trigger, dialog, form, feedback) is independently replaceable
- ✅ **Versioned independently:** `FlowManager` and `FormManager` are utility classes, not components — they can be updated without changing the component library version
- ✅ **Testable in isolation:** Each primitive (dialog open/close, form validation, toast) can be tested without a full flow

### Negative

- ❌ **More boilerplate per flow:** The application must wire events and instantiate managers. The `generate_flow` MCP tool mitigates this by generating the boilerplate.
- ❌ **No declarative flow definition:** There's no single `<sherpa-flow entity="device" fields="...">` shorthand. Applications must compose explicitly.

### Neutral

- ⚪ **`generate_flow` and `generate_pattern` MCP tools** generate the boilerplate for common flow shapes — the developer edits the output rather than writing from scratch.

## Alternatives Considered

### Alternative 1: `<sherpa-flow>` Component with Slot-Driven Fields

A component where fields are projected via slots and the component handles state internally.

**Pros:** Single declaration, less boilerplate.  
**Cons:** Application logic (field types, validation, API calls) would have to be passed as attributes or via JS property setters — recreating a mini-framework inside a component. Impossible to support every field shape, validation rule, and submission target in a generic library component.  
**Rejected because:** The surface area required to be genuinely general-purpose is equivalent to writing a form library.

### Alternative 2: Flow Mixin on SherpaElement

A mixin that any component can apply to gain flow-management methods.

**Pros:** Less external code.  
**Cons:** Mixins increase component complexity and make base classes harder to reason about. Flow state is application-level, not component-level.  
**Rejected because:** Same coupling problem as Alternative 1; just packaged differently.

## Implementation Notes

- `FlowManager` source: `components/app-utils/flow-manager.ts`
- `FormManager` source: `components/app-utils/form-manager.ts`
- Use `get_utility` MCP tool to read the source before implementing a flow
- Use `generate_flow` MCP tool to scaffold an add/edit/delete flow for a given entity
- Flow state must never live in DOM attributes — it lives in the `FlowManager` instance

## References

- `components/app-utils/flow-manager.ts`
- `components/app-utils/form-manager.ts`
- [ADR-007: Custom Events Bubble; Cross Shadow Only When Needed](0007-custom-events-bubble.md)
- `patterns/flows/` — Generated flow pattern HTML
