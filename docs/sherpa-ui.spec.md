---
specKind: sdd
scope: system
status: draft
lastUpdated: 2026-05-01
owners:
  - "Design System Team"
relatedSpecs:
  - "docs/COMPONENT-GUIDELINES.md"
  - "docs/COMPONENT-API-STANDARD.md"
  - ".github/copilot-instructions.md"
intendedAgents:
  - planning
  - implementation
  - test-generation
keywords:
  - web-components
  - design-system
  - design-tokens
  - shadow-dom
  - mcp
  - accessibility
---

# Sherpa UI — Spec

---

## 1. TL;DR

- **What:** Sherpa UI is a framework-agnostic web-component library, design-token system, and Model Context Protocol (MCP) server that together provide the visual language for N-able product surfaces.
- **Who for:** Product engineers composing UIs across N-able apps, AI agents (e.g. Copilot, Claude) authoring those UIs, and library maintainers extending the system.
- **Why now:** The architecture has stabilised through several refactor passes; this spec locks the current contract so future work and AI-assisted code generation can be checked against a single source of truth.
- **Scope boundary:** Library only — components, tokens, utilities, patterns, build artifacts, and the MCP server. Application routing, state management, and product-specific business logic are out of scope.
- **Status:** draft

---

## 2. Document control & conventions

| Field | Value |
| --- | --- |
| Spec kind | **SDD** — Spec-Driven Design (requirements + acceptance + contracts; **not** the implementation plan) |
| Scope | system |
| Source of truth | This file is the source of truth for **what must be true** of the Sherpa UI library. |
| Plan boundary | Implementation plans **SHALL** translate IDs from [section 9](#9-normative-requirements), [section 11](#11-acceptance-criteria), and [section 10](#10-contracts) into file-level *how* without re-authoring product intent. |

### 2.1 ID conventions

| Prefix | Used for | Defined in |
| --- | --- | --- |
| `GLO-NN` | Glossary entry | [Section 4](#4-glossary--acronyms) |
| `SC-NN`  | Success criterion | [Section 6](#6-goals-non-goals--success-metrics) |
| `ADR-NN` | Architectural Decision Record | [Section 8](#8-architectural-decisions-adrs) |
| `REQ-NN` | Functional requirement | [Section 9.1](#91-functional-requirements-req-nn) |
| `NFR-NN` | Non-functional requirement | [Section 9.2](#92-non-functional-requirements-nfr-nn) |
| `REQ-1NN`| Engineering constraint | [Section 9.3](#93-engineering-constraints-req-1nn) |
| `CON-NN` | Contract | [Section 10](#10-contracts) |
| `AC-NN`  | Acceptance criterion | [Section 11](#11-acceptance-criteria) |
| `RISK-NN`| Risk | [Section 13](#13-risks-assumptions--open-questions) |

### 2.2 Normative language (RFC 2119)

Capitalised RFC 2119 keywords (**MUST**, **SHALL**, **MUST NOT**, **SHALL NOT**, **SHOULD**, **MAY**) apply from [section 8](#8-architectural-decisions-adrs) onward.

### 2.3 Uncertainty markers

`[NEEDS CLARIFICATION: <question>]` markers are tracked in [section 13.3](#133-open-questions). Status **MUST NOT** move from `draft` to `active` while any remain.

---

## 3. Reading order for AI agents *(informative)*

1. [Section 1 — TL;DR](#1-tldr)
2. [Section 2 — Conventions](#2-document-control--conventions)
3. [Section 4 — Glossary](#4-glossary--acronyms)
4. [Section 6 — Goals & non-goals](#6-goals-non-goals--success-metrics)
5. [Section 8 — ADRs](#8-architectural-decisions-adrs)
6. [Section 9 — Requirements](#9-normative-requirements)
7. [Section 11 — Acceptance criteria](#11-acceptance-criteria)
8. [Section 10 — Contracts](#10-contracts)
9. Appendices as needed

Agents working through MCP can also call `get_architecture` for a condensed view of §8–§9.

---

## 4. Glossary & acronyms

| ID | Term | Definition |
| --- | --- | --- |
| GLO-01 | Sherpa UI | This library — components, tokens, utilities, patterns, MCP server. |
| GLO-02 | RFC 2119 | IETF standard defining MUST / SHALL / SHOULD / MAY in specs. |
| GLO-03 | TDD | Test-Driven Development — failing test first, then code. |
| GLO-04 | ADR | Architectural Decision Record. |
| GLO-05 | NFR | Non-Functional Requirement. |
| GLO-06 | BDD | Behaviour-Driven Development — Given / When / Then. |
| GLO-07 | E2E | End-to-end test through the user-facing surface. |
| GLO-08 | i18n | Internationalisation. |
| GLO-09 | a11y | Accessibility (per WCAG). |
| GLO-10 | MCP | Model Context Protocol — the JSON-RPC protocol AI agents use to call tools and read resources. |
| GLO-11 | Web Component | A custom HTML element built on the Custom Elements + Shadow DOM + HTML Templates browser standards. |
| GLO-12 | Shadow DOM | Encapsulated DOM tree attached to a host element; styles inside do not leak out. |
| GLO-13 | `SherpaElement` | The base class every component extends. Provides template loading, shadow root, slot detection, lifecycle hooks, and `this.$()`/`this.$$()` query helpers. |
| GLO-14 | `SherpaInputBase` | Base class for all form inputs. Builds the label/control/help wrapper and bridges native input events to the host. |
| GLO-15 | `data-*` attribute pattern | Public component API uses `data-` prefixed HTML attributes (e.g. `data-variant`, `data-size`); CSS reads them via `:host([data-*])`. |
| GLO-16 | Cloning prototype | A `<template class="*-tpl">` declared inside a component's HTML file and cloned at runtime to instantiate repeating structure (rows, segments, items). |
| GLO-17 | Semantic token | A `--sherpa-*` CSS custom property that names *intent* (e.g. `--sherpa-surface-default`). Components consume only these. |
| GLO-18 | Core token | A `--sherpa-core-*` CSS custom property that names a raw value (e.g. `--sherpa-core-blue-500`). Components **MUST NOT** consume them directly. |
| GLO-19 | Constructable stylesheet | A `CSSStyleSheet` instance shared across multiple shadow roots via `adoptedStyleSheets`. Sherpa caches one per `cssUrl`. |
| GLO-20 | Flow | A composed CRUD interaction (add / edit / delete / export) coordinated by `FlowManager`, not a component. |
| GLO-21 | Pattern | A static HTML snippet under `patterns/<category>/` showing how to compose components for a recognisable layout or interaction. |
| GLO-22 | Schema | A generated JSON description of one component's public API (attributes, events, slots, methods, properties, CSS parts, CSS custom properties). |
| GLO-23 | Status mixin | The cascade by which a `[data-status]` ancestor sets `--_status-*` private custom properties that components consume via fallback chains. |
| GLO-24 | Container query | A CSS `@container` query that styles based on a containing element's size rather than the viewport. |

---

## 5. Background & problem *(informative)*

N-able products historically diverged visually because each app team owned its own primitives. Sherpa UI consolidates those primitives into a single token-driven web-component library that any product can adopt without buying into a JavaScript framework or build pipeline.

The library has been refactored in passes — first to enforce a strict three-file split per component (HTML / CSS / JS), then to push all visual state into CSS via `data-*` attributes, then to expose the entire surface to AI agents through an MCP server. The result is a deterministic library shape: every component looks the same, behaves the same way, and is discoverable by both humans and machines.

This spec exists because the next wave of work (new components, AI-driven flows, design-token migrations) needs a stable contract to plan against. Without it, drift between the architecture rules in `.github/copilot-instructions.md`, the build artifacts, and what AI agents actually emit will accumulate silently.

---

## 6. Goals, non-goals & success metrics

### 6.1 Goals

- A framework-agnostic component library usable from any HTML page via `<script type="module">`.
- A consistent visual language driven by Figma-sourced semantic tokens.
- Deterministic component shape (three files, one base class, one attribute pattern) so both humans and AI agents can author safely.
- Full discoverability of every component, token, utility, and pattern through the MCP server.
- Composable interactions: CRUD flows, exports, and dialogs assembled from existing components, never bespoke.

### 6.2 Non-goals *(anti-speculation guard)*

- Application-level concerns: routing, global state, data fetching, auth.
- Framework wrappers (React, Vue, Angular).
- Server-side rendering or build-time CSS extraction.
- A bundled JavaScript distribution; consumers bring their own bundler if they want one.
- Visual-regression infrastructure or a dedicated test runner.
- Animation / motion library beyond simple CSS transitions.
- Shipping an icon font; consumers load Font Awesome themselves.

### 6.3 Success criteria

| ID | Outcome |
| --- | --- |
| SC-01 | A new component can be added by following [`docs/COMPONENT-TEMPLATE.md`](COMPONENT-TEMPLATE.md) without modifying any other file beyond the build-artifact regeneration. |
| SC-02 | `npm run build` regenerates schemas, READMEs, the API index, and the patterns index without manual edits. |
| SC-03 | Every component documented in [`components/COMPONENT-API.md`](../components/COMPONENT-API.md) has a corresponding JSON schema accessible via MCP `sherpa://schema/{tag}`. |
| SC-04 | An AI agent connected to the MCP server can discover any component's full surface (schema + html + css + js + readme) without reading workspace files. |
| SC-05 | The library has zero runtime third-party dependencies in [`package.json`](../package.json). |
| SC-06 | The MCP server boots cleanly (no thrown errors) on `node mcp-server/index.js`. |

---

## 7. Personas & user journeys

### Persona A — Product Engineer

Goals: compose a feature view quickly using stable primitives. Pains: re-implementing the same layout each time. Frequency of use: daily.

#### Story P1.1 — Compose a view from existing components

**Why this priority:** This is the dominant use case; the whole library exists for it.
**Independently testable by:** Engineer drops `<sherpa-view-header>`, `<sherpa-filter-bar>`, and `<sherpa-data-grid>` into a page and the result is visually consistent without writing custom CSS.

1. **Given** a blank HTML page importing `components/index.js`, **When** the engineer adds three components with `data-*` attributes, **Then** the page renders with correct layout, tokens, and accessibility roles.
2. **Given** the engineer needs a CRUD flow, **When** they wire `FlowManager` + `FormManager` to a `<sherpa-dialog>`, **Then** the flow lifecycle events fire with the documented `detail` shapes.

### Persona B — AI Agent

Goals: generate or modify UIs without hallucinating attribute names. Pains: outdated training data and silent API drift. Frequency of use: per request.

#### Story P1.2 — Generate a flow via MCP

**Why this priority:** AI-assisted authoring is a first-class consumer.
**Independently testable by:** Calling `generate_flow` produces HTML that passes `validate_usage`.

1. **Given** an MCP-connected agent, **When** it calls `query_component` for a tag, **Then** the response includes attributes, events, slots, and source URIs.
2. **Given** the agent needs library rules, **When** it calls `get_architecture`, **Then** it receives `.github/copilot-instructions.md` and `docs/COMPONENT-GUIDELINES.md` concatenated.

### Persona C — Library Maintainer

Goals: add or refactor a component without breaking downstream consumers. Pains: inconsistency between components written at different times. Frequency of use: weekly.

#### Story P2.1 — Add a new component

**Why this priority:** Sustains the library.
**Independently testable by:** New component passes the §11 audit ACs and is picked up by `npm run schemas`.

#### Story P3.1 — Switch theme at runtime

**Why this priority:** Required for product theming but not on the critical path.

1. **Given** a host page using `ThemeManager`, **When** the user toggles theme/mode/density, **Then** all components restyle without re-mounting and the choice persists in `localStorage`.

### Edge cases

- A consumer omits required `data-*` attributes — components render their default state without throwing.
- Constructable stylesheets fail to load (offline / 404) — components still render content, only styling is missing.
- An AI agent requests a non-existent component via MCP — the server returns a clear "unknown component" message rather than throwing.

---

## 8. Architectural decisions (ADRs)

### ADR-01 — Web Components + Shadow DOM, no framework

| Field | Value |
| --- | --- |
| Status | accepted |
| Context | The library must be usable from any product surface regardless of framework choice. |
| Options considered | A: React component library · B: Web Components · C: Multi-framework wrappers |
| **Decision** | Build on the standard Custom Elements + Shadow DOM + HTML Templates platform; ship as ES modules. |
| Rationale | Zero framework lock-in; encapsulated styles; loadable via plain `<script type="module">`. |
| Consequences | + portable + small + future-proof · − requires polyfill-free evergreen browsers · − limited DX tooling vs framework-specific kits |
| Linked requirements | REQ-01, REQ-02, REQ-101, REQ-103 |

### ADR-02 — Three-file split per component

| Field | Value |
| --- | --- |
| Status | accepted |
| Context | Mixing structure, presentation, and behaviour in one file invites layer leakage. |
| **Decision** | Each component lives in `components/<tag>/<tag>.{html,css,js}`. |
| Rationale | Forces single responsibility per file; makes layer-violation reviews trivial. |
| Consequences | + clear ownership · − three files to keep in sync per component |
| Linked requirements | REQ-01, REQ-21 |

### ADR-03 — CSS owns visibility via `:host([data-*])`

| Field | Value |
| --- | --- |
| Status | accepted |
| Context | Toggling `.hidden` or `.style.display` from JS scattered visibility logic across layers. |
| **Decision** | Visibility of internal shadow elements **SHALL** be driven by `:host([data-*])` selectors; JS only sets/removes attributes on the host. |
| Rationale | One place to read the visual contract; no JS-driven flicker. |
| Consequences | + declarative · − requires every conditional element to exist in the template up front |
| Linked requirements | REQ-04, REQ-05 |

### ADR-04 — `data-*` attribute prefix mandatory

| Field | Value |
| --- | --- |
| Status | accepted |
| Context | Bare custom attributes (`variant`, `size`) collide with future native HTML attributes and are invisible to standard CSS attribute selectors. |
| **Decision** | All public component attributes **SHALL** use the `data-` prefix, except native semantics (`hidden`, `disabled`, `role`, `aria-*`, `id`, `slot`). |
| Rationale | Future-proof; consistent attribute selectors; readable from JS via `dataset`. |
| Consequences | + safe + consistent · − slightly more verbose markup |
| Linked requirements | REQ-06 |

### ADR-05 — Semantic tokens only in component CSS

| Field | Value |
| --- | --- |
| Status | accepted |
| **Decision** | Component CSS **SHALL** consume only semantic tokens (`--sherpa-*`). Core tokens (`--sherpa-core-*`) are reserved for the alias layer. |
| Rationale | Theming and rebranding happen at the alias layer; components stay theme-agnostic. |
| Consequences | + theme-portable · − requires alias layer for every visual concept |
| Linked requirements | REQ-07, REQ-08 |

### ADR-06 — Cloning template prototypes over `createElement` / `innerHTML`

| Field | Value |
| --- | --- |
| Status | accepted |
| Context | Building structural DOM in JS hides the rendered shape from reviewers and AI agents. |
| **Decision** | Repeating structure **SHALL** be authored as `<template class="*-tpl">` in the component HTML and cloned per use. |
| Rationale | Template is the single source of truth for shape. |
| Consequences | + reviewable · − an extra clone step in JS |
| Linked requirements | REQ-04 |

### ADR-07 — Custom events bubble; cross shadow only when needed

| Field | Value |
| --- | --- |
| Status | accepted |
| **Decision** | All custom events **SHALL** set `bubbles: true`. Events that must reach application code outside the host's shadow tree **SHALL** also set `composed: true`. |
| Rationale | Predictable event propagation; flow events reach app handlers reliably. |
| Linked requirements | REQ-09 |

### ADR-08 — Constructable stylesheets cached per `cssUrl`

| Field | Value |
| --- | --- |
| Status | accepted |
| **Decision** | `SherpaElement` fetches each component's CSS once, builds a `CSSStyleSheet`, and shares it via `adoptedStyleSheets` across all instances. |
| Rationale | Avoids per-instance style parsing; single network fetch per component. |
| Linked requirements | NFR-01 |

### ADR-09 — MCP server is the AI-facing contract

| Field | Value |
| --- | --- |
| Status | accepted |
| **Decision** | The MCP server in `mcp-server/` is the canonical surface AI agents use to discover components, tokens, utilities, patterns, and architecture rules. |
| Rationale | Agents working without filesystem access still get full library understanding. |
| Linked requirements | REQ-13, REQ-14, REQ-15 |

### ADR-10 — Container queries for component-internal responsiveness

| Field | Value |
| --- | --- |
| Status | accepted |
| **Decision** | Components that adapt to available width **SHALL** use `@container` queries; viewport media queries are forbidden inside component CSS. |
| Rationale | Components must work the same regardless of viewport; only the container they sit in matters. |
| Linked requirements | REQ-24 |

### ADR-11 — CRUD flows composed from existing components

| Field | Value |
| --- | --- |
| Status | accepted |
| **Decision** | Add / edit / delete / export flows **SHALL** be assembled from `<sherpa-button>` + `<sherpa-dialog>` + form components, orchestrated by `FlowManager` and `FormManager`. No `<sherpa-flow>` component exists. |
| Rationale | Avoids monolithic flow components; reuses tested primitives. |
| Linked requirements | REQ-11 |

### ADR-12 — Status cascade via inheritable `--_status-*` properties

| Field | Value |
| --- | --- |
| Status | accepted |
| **Decision** | A `[data-status]` ancestor sets `--_status-*` custom properties that components consume via fallback chains. Components do not declare per-status blocks. |
| Rationale | One status definition, many consumers; status changes do not require touching component CSS. |
| Linked requirements | REQ-23 |

---

## 9. Normative requirements

### 9.1 Functional requirements (`REQ-NN`)

| ID | Statement |
| --- | --- |
| REQ-01 | Each component **SHALL** ship as exactly three files in `components/<tag>/`: `<tag>.html`, `<tag>.css`, `<tag>.js`. |
| REQ-02 | Component JS **SHALL** extend `SherpaElement` and declare `static get cssUrl()` and `static get htmlUrl()` getters. |
| REQ-03 | Component HTML files **SHALL** wrap rendered content in `<template id="default">`; additional variants **SHALL** use further `<template id="...">` blocks. |
| REQ-04 | Repeating structure **SHALL** be authored as `<template class="*-tpl">` cloning prototypes in HTML; component JS **MUST NOT** build structural DOM via `document.createElement` or `innerHTML = '<markup>'`. |
| REQ-05 | Visibility of internal shadow elements **SHALL** be controlled by `:host([data-*])` CSS selectors; component JS **MUST NOT** toggle `.hidden`, `.style.display`, or `classList` for visual state on shadow internals. |
| REQ-06 | Public component attributes **SHALL** use the `data-` prefix. Native semantics (`hidden`, `disabled`, `role`, `aria-*`, `id`, `slot`, `tabindex`) are exempt. |
| REQ-07 | Component CSS **SHALL** consume only semantic tokens (`--sherpa-*`); core tokens (`--sherpa-core-*`) **MUST NOT** appear in any `components/**/*.css` file. |
| REQ-08 | Every semantic token reference in component CSS **SHALL** include a hardcoded fallback value (e.g. `var(--sherpa-space-sm, 12px)`). |
| REQ-09 | Custom events dispatched by components **SHALL** set `bubbles: true`. Events intended for application-level handlers outside the host's shadow tree **SHALL** also set `composed: true`. |
| REQ-10 | Form input components **SHALL** extend `SherpaInputBase` and use the shared label/control/help wrapper. |
| REQ-11 | CRUD flows (add / edit / delete / export) **SHALL** be composed from existing components and orchestrated by `FlowManager`, `FormManager`, `refreshDataset`, and `initExportFlow`. No dedicated flow component **SHALL** be created. |
| REQ-12 | Disabled state **SHALL** be expressed using inactive tokens applied to individual properties; opacity-based dimming for disabled state is forbidden. |
| REQ-13 | Every component **SHALL** be discoverable through MCP at `sherpa://schema/{tag}`. |
| REQ-14 | Every component's source files **SHALL** be readable through MCP at `sherpa://component/{tag}/{kind}` for `kind` in `html`, `css`, `js`, `readme`. |
| REQ-15 | Every pattern under `patterns/<category>/` **SHALL** be readable through MCP at `sherpa://pattern/{id}`. |
| REQ-16 | A generated component-API index **SHALL** be produced at `components/COMPONENT-API.md` by `npm run docs`. |
| REQ-17 | Each component directory **SHALL** contain a generated `README.md` produced by `npm run component-docs`. |
| REQ-18 | Patterns **SHALL** be authored as standalone HTML files under `patterns/<category>/<id>.html` and indexed by `npm run patterns`. |
| REQ-19 | Shadow DOM `:host` selectors **SHALL** use the functional `:host(:not(...))` form; the chained form `:host:not(...)` is forbidden. |
| REQ-20 | `SherpaElement.onSlotChange` **SHALL** set `data-has-{slotName}` on the host whenever a named slot has assigned nodes, so CSS can style based on slot occupancy. |
| REQ-21 | Component file headers **SHALL** follow the JSDoc tag conventions defined in [`docs/COMPONENT-API-STANDARD.md`](COMPONENT-API-STANDARD.md) so the schema and README extractors can parse them. |
| REQ-22 | Theme, mode, and density selection **SHALL** be managed through `ThemeManager` and persisted in `localStorage` under the `sherpa-` key prefix. |
| REQ-23 | Status visuals **SHALL** consume `--_status-*` private custom properties cascaded from a `[data-status]` ancestor; per-component status colour blocks are forbidden. |
| REQ-24 | Component-internal responsive behaviour **SHALL** use `@container` queries; viewport media queries (`@media (max-width: ...)`) **MUST NOT** appear in `components/**/*.css`. |
| REQ-25 | Public-API artifacts (schemas, READMEs, `COMPONENT-API.md`, `patterns/index.json`) **SHALL** be regenerated by `npm run build` from the source files alone, without manual edits. |

### 9.2 Non-functional requirements (`NFR-NN`)

| ID | Category | Statement |
| --- | --- | --- |
| NFR-01 | Performance | Components **SHOULD NOT** perform synchronous layout-blocking work in `onConnect`; expensive setup belongs in lazy paths or microtasks. |
| NFR-02 | Security | Component JS **MUST NOT** assign user-supplied content to `innerHTML`; text content **SHALL** be set via `textContent`. |
| NFR-03 | Accessibility | Interactive components (button, input family, dialog, menu, nav, tabs) **SHALL** be operable by keyboard alone and meet WCAG 2.2 AA for contrast and focus visibility. |
| NFR-04 | i18n | Components **MUST NOT** hard-code user-visible strings in JS; text **SHALL** come from attributes or slots controlled by the host application. |
| NFR-05 | Observability | Custom events are the library's observability surface; every user-meaningful interaction **SHALL** emit a documented custom event. |
| NFR-06 | Browser support | The library targets evergreen Chromium, Firefox, and Safari; legacy browser polyfills are out of scope. |
| NFR-07 | Reliability | Components **SHALL** render their default markup even if their stylesheet fails to load. |
| NFR-08 | Discoverability | Every public surface (component, token namespace, utility, pattern, architectural rule) **SHALL** be reachable through the MCP server. |

### 9.3 Engineering constraints (`REQ-1NN`)

| ID | Statement |
| --- | --- |
| REQ-101 | The library **SHALL** ship as ES modules with no required bundler step. |
| REQ-102 | The library **SHALL** have zero runtime third-party dependencies declared in [`package.json`](../package.json). |
| REQ-103 | Components **SHALL** be loadable via a single `<script type="module" src="components/index.js">` in any HTML host. |
| REQ-104 | The full build pipeline **SHALL** run via `npm run build`. |
| REQ-105 | Generated artifacts (schemas, READMEs, `COMPONENT-API.md`, `patterns/index.json`) **SHALL** be reproducible from source; manual edits to generated files are forbidden. |
| REQ-106 | The Figma token export pipeline (`npm run tokens:extract` → `npm run tokens:generate`) is the source of truth for `--sherpa-core-*` values. |

---

## 10. Contracts

### 10.1 Contract index

| ID | Contract | Serves | Detail location |
| --- | --- | --- | --- |
| CON-01 | Persistence (theme/mode/density) | REQ-22 | [10.2](#102-persistence-contract) |
| CON-02 | UI / interaction (`data-*` API) | REQ-04, REQ-05, REQ-06, REQ-20 | [10.3](#103-ui-contract) / Appendix C |
| CON-03 | API / event | REQ-09, REQ-11, NFR-05 | [10.4](#104-api--event-contract) / Appendix C |
| CON-04 | Gating / composition (status & theme cascade) | REQ-22, REQ-23 | [10.5](#105-gating--composition-contract) |
| CON-05 | Observability (MCP surface) | REQ-13, REQ-14, REQ-15, NFR-08 | [10.6](#106-observability-contract) |

### 10.2 Persistence contract

- **Shape:** `ThemeManager` reads/writes `theme`, `mode`, and `density` keys.
- **Storage:** `localStorage`, keys prefixed with `sherpa-` (e.g. `sherpa-theme`, `sherpa-mode`, `sherpa-density`).
- **Default value:** when no record exists, the defaults defined by `ThemeManager` apply.
- **Scope:** per-origin; no cross-device sync.

### 10.3 UI contract

- **Public surface:** `data-*` attributes on the host element; named `<slot>` elements; CSS parts where exposed (`::part(...)`); CSS custom properties prefixed `--sherpa-*` for theming and `--_*` for component-private knobs.
- **Auto-set host attributes:** `data-has-{slotName}` is added by `SherpaElement` when a named slot has assigned nodes.
- **States:** visible / hidden / loading / error / disabled — all driven by host `data-*` attributes consumed by `:host([data-*])` selectors.
- **Stable selectors for tests:** internal class names documented in each component's CSS file header; consumers **SHOULD** use `data-e2e="..."` on host elements rather than reaching into shadow internals.

### 10.4 API / event contract

- **Naming:** custom event types are kebab-case `<verb>-<noun>` (e.g. `button-click`, `selection-change`, `row-action`, `flow-start`).
- **Propagation:** `bubbles: true` always; `composed: true` for events that must escape the host's shadow tree (flow events, form value changes).
- **Detail shape:** documented per component in JSDoc `@fires` blocks; flow events use `{ flow, entity, data?, error? }`.
- **Idempotency:** dispatched events do not retry; consumers debounce / dedupe as needed.
- **Inputs:** components read from `data-*` attributes, slot content, and (for inputs) value setters; no global event bus.

### 10.5 Gating / composition contract

- **Theme cascade:** `ThemeManager` writes `data-theme`, `data-mode`, `data-density` on the document element; tokens defined for those attribute selectors flow through shadow boundaries via inheritable custom properties.
- **Status cascade:** any ancestor with `[data-status="success|info|warning|critical"]` defines `--_status-*` custom properties that components inherit and consume through fallback chains.
- **Truth table (status):** `data-status="warning"` on an ancestor → all descendant components that consume `var(--_status-surface, ...)` etc. render with warning visuals, no per-component override needed.

### 10.6 Observability contract

- **MCP tools:** schemas, sources, tokens, utilities, patterns, and architecture rules are queryable through registered tools.
- **MCP resources:** `sherpa://schema/{tag}`, `sherpa://template/{tag}`, `sherpa://component/{tag}/{kind}`, `sherpa://utility/{id}`, `sherpa://pattern/{id}`, `sherpa://guidelines/{slug}`.
- **Custom events** are the runtime observability surface (see CON-03).
- **Generated artifacts:** [`components/COMPONENT-API.md`](../components/COMPONENT-API.md), `schemas/components/*.json`, `patterns/index.json`, per-component `README.md`.

---

## 11. Acceptance criteria

| ID | Given | When | Then | Maps to |
| --- | --- | --- | --- | --- |
| AC-01 | Any directory under `components/` matching `sherpa-*` | listing its files | exactly one `<tag>.html`, one `<tag>.css`, and one `<tag>.js` exist | REQ-01 |
| AC-02 | Any component JS file | parsing its class declaration | the class extends `SherpaElement` and declares `cssUrl` + `htmlUrl` getters | REQ-02 |
| AC-03 | Any component HTML file | parsing top-level templates | a `<template id="default">` is present | REQ-03 |
| AC-04 | Any component JS file | grepping for `innerHTML\s*=\s*[`'\"]<` or `document\.createElement\(['\"](?!template)` | no matches for structural DOM creation are found | REQ-04 |
| AC-05 | Any component JS file | grepping for `\.hidden\s*=`, `\.style\.display`, or `classList\.(add\|remove\|toggle)` on `this.$(...)` results | no matches that gate visual state are found | REQ-05 |
| AC-06 | Any component HTML template | inspecting host attributes used in selectors | every public attribute uses the `data-` prefix or is a recognised native attribute | REQ-06 |
| AC-07 | Any component CSS file | grepping for `--sherpa-core-` | no matches are found | REQ-07 |
| AC-08 | Any `var(--sherpa-...)` reference in component CSS | inspecting the call | a fallback argument is present | REQ-08 |
| AC-09 | Any `dispatchEvent(new CustomEvent(...))` call in component JS | inspecting the options object | `bubbles: true` is set | REQ-09 |
| AC-10 | Any `sherpa-input-*` JS file | parsing its class declaration | the class extends `SherpaInputBase` | REQ-10 |
| AC-11 | A view that performs add/edit/delete | inspecting its wiring | it imports `FlowManager` and `FormManager` rather than declaring a custom flow component | REQ-11 |
| AC-12 | Any disabled-state CSS rule | inspecting it | the rule changes per-property tokens (text/border/surface) rather than `opacity` | REQ-12 |
| AC-13 | The MCP server | calling `sherpa://schema/{tag}` for any tag returned by `list_components` | a JSON schema is returned | REQ-13 |
| AC-14 | The MCP server | calling `sherpa://component/{tag}/{kind}` for `kind` in `html`/`css`/`js`/`readme` | the source file content is returned | REQ-14 |
| AC-15 | The MCP server | calling `sherpa://pattern/{id}` for any id in `patterns/index.json` | the pattern HTML is returned | REQ-15 |
| AC-16 | The repository | running `npm run docs` | [`components/COMPONENT-API.md`](../components/COMPONENT-API.md) is regenerated and lists every component | REQ-16, REQ-25 |
| AC-17 | Any component directory | running `npm run component-docs` | a `README.md` is generated | REQ-17 |
| AC-18 | Any HTML file under `patterns/` | running `npm run patterns` | the file is indexed in `patterns/index.json` | REQ-18 |
| AC-19 | Any component CSS file | grepping for `:host:not(` | no matches are found (only `:host(:not(` appears) | REQ-19 |
| AC-20 | A component declaring named slots | adding slotted content to one slot | the host element gains a `data-has-{slotName}` attribute | REQ-20 |
| AC-21 | Any component JS file | parsing its file header | the JSDoc block conforms to `docs/COMPONENT-API-STANDARD.md` and the schema extractor parses it without warnings | REQ-21, REQ-25 |
| AC-22 | A page using `ThemeManager` | calling `setTheme`, `setMode`, or `setDensity` | the choice is written to `localStorage` under a `sherpa-` prefixed key and components restyle without re-mounting | REQ-22 |
| AC-23 | A page with `[data-status="warning"]` on a wrapper | inspecting descendant components that consume `--_status-*` | they render with warning visuals without per-component status CSS | REQ-23 |
| AC-24 | Any component CSS file | grepping for `@media` | no matches for viewport-based media queries are found (only `@container` may appear) | REQ-24 |
| AC-25 | A clean checkout | running `node mcp-server/index.js` | the process boots without thrown errors | SC-06, NFR-08 |
| AC-26 | The Sherpa core token layer | inspecting `css/styles/sherpa-primitives.css` provenance | values match the latest Figma token export | REQ-106 |
| AC-27 | A consumer page | importing `components/index.js` via `<script type="module">` only | every component registers as a custom element without a bundler step | REQ-101, REQ-103 |
| AC-28 | The repository | inspecting [`package.json`](../package.json) `dependencies` | the field is empty or absent | REQ-102 |

---

## 12. Out of scope *(normative negative requirements)*

The implementation **SHALL NOT** include:

- Framework-specific wrappers (React, Vue, Angular, Svelte).
- Server-side rendering, build-time CSS extraction, or a bundled distribution.
- Application concerns: routing, global state managers, authentication, data fetching.
- Visual-regression test infrastructure or a dedicated test runner.
- An animation / motion library beyond CSS transitions on tokens.
- A bundled icon font; consumers load Font Awesome themselves.
- Polyfills for browsers that do not support Custom Elements, Shadow DOM, or Constructable Stylesheets.
- A `<sherpa-flow>` component (flows are composed — see ADR-11).

---

## 13. Risks, assumptions & open questions

### 13.1 Risks

| ID | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| RISK-01 | Schema extractor drifts from JSDoc conventions, breaking MCP responses. | med | high | CI runs `npm run build` clean; AC-16/AC-21 cover the regeneration path. |
| RISK-02 | Shadow DOM styling limitations force consumers to fork components. | low | med | Expose `--_*` private vars + CSS parts; document escape hatches per component. |
| RISK-03 | AI agents invent components or attributes instead of calling MCP. | med | med | `get_architecture` tool + `validate_usage` provide strong guardrails. |
| RISK-04 | No automated test suite means regressions slip through review. | med | med | Verification (§14) leans on source-tree audits + MCP smoke tests + manual QA until a runner is adopted. |
| RISK-05 | Component count drift between docs (`53` / `62` / `66`) confuses readers. | low | low | Treat the live filesystem as the source of truth; let `npm run docs` update the inventory. |

### 13.2 Assumptions

- Consumers run evergreen Chromium, Firefox, or Safari.
- Consumers bring their own bundler if they want one; native ESM is the default delivery.
- Font Awesome is loaded by the host page; the library declares classes and unicode constants but does not ship glyphs.
- Figma token exports are the canonical source for `--sherpa-core-*`; CSS edits in the primitives layer are not the source of truth.

### 13.3 Open questions

| Marker | Question | Owner | Needed before |
| --- | --- | --- | --- |
| *(none)* | — | — | — |

---

## 14. Verification matrix

| AC | Evidence type | Notes |
| --- | --- | --- |
| AC-01 | source-tree audit | `find components -mindepth 1 -maxdepth 1 -type d -name 'sherpa-*'` then assert three files |
| AC-02 | source-tree audit | grep for `extends SherpaElement` and `static get cssUrl` per JS file |
| AC-03 | source-tree audit | grep for `<template id="default">` per HTML file |
| AC-04 | source-tree audit | regex grep for `innerHTML\s*=\s*[`'"]<` and structural `createElement` |
| AC-05 | source-tree audit | regex grep for forbidden visibility toggles |
| AC-06 | source-tree audit | parse host attributes from each `.html` |
| AC-07 | source-tree audit | grep `--sherpa-core-` under `components/**/*.css` |
| AC-08 | source-tree audit | regex check `var(--sherpa-...)` includes a comma |
| AC-09 | source-tree audit | grep `new CustomEvent` and inspect options |
| AC-10 | source-tree audit | grep `extends SherpaInputBase` under `components/sherpa-input-*` |
| AC-11 | manual QA | review of consumer view code |
| AC-12 | source-tree audit | grep for `opacity:` near `:disabled` / `[disabled]` |
| AC-13 | MCP smoke test | issue a resource read for each tag |
| AC-14 | MCP smoke test | issue a resource read for each `(tag, kind)` |
| AC-15 | MCP smoke test | issue a resource read for each pattern id |
| AC-16 | build artifact | re-run `npm run docs` and diff is empty |
| AC-17 | build artifact | re-run `npm run component-docs` and diff is empty |
| AC-18 | build artifact | re-run `npm run patterns` and diff is empty |
| AC-19 | source-tree audit | grep `:host:not(` |
| AC-20 | manual QA / E2E | inspect host attribute after slot assignment |
| AC-21 | build artifact | extractor runs without warnings |
| AC-22 | manual QA | toggle theme/mode/density and inspect storage + computed styles |
| AC-23 | manual QA | wrap a fixture in `[data-status]` and inspect computed styles |
| AC-24 | source-tree audit | grep `@media` under `components/**/*.css` |
| AC-25 | MCP smoke test | `node mcp-server/index.js` exits cleanly when killed |
| AC-26 | manual QA | compare core token file against latest Figma export |
| AC-27 | manual QA | load `index.html` in a browser without a bundler |
| AC-28 | source-tree audit | inspect `package.json` |

---

## 15. Traceability matrix

| REQ / NFR | AC(s) | Contract(s) | ADR(s) | Tracker ticket |
| --- | --- | --- | --- | --- |
| REQ-01 | AC-01 | CON-02 | ADR-02 | <…> |
| REQ-02 | AC-02 | CON-02 | ADR-01, ADR-02 | <…> |
| REQ-03 | AC-03 | CON-02 | ADR-02 | <…> |
| REQ-04 | AC-04 | CON-02 | ADR-06 | <…> |
| REQ-05 | AC-05 | CON-02 | ADR-03 | <…> |
| REQ-06 | AC-06 | CON-02 | ADR-04 | <…> |
| REQ-07 | AC-07 | CON-02 | ADR-05 | <…> |
| REQ-08 | AC-08 | CON-02 | ADR-05 | <…> |
| REQ-09 | AC-09 | CON-03 | ADR-07 | <…> |
| REQ-10 | AC-10 | CON-02 | — | <…> |
| REQ-11 | AC-11 | CON-03 | ADR-11 | <…> |
| REQ-12 | AC-12 | CON-02 | — | <…> |
| REQ-13 | AC-13 | CON-05 | ADR-09 | <…> |
| REQ-14 | AC-14 | CON-05 | ADR-09 | <…> |
| REQ-15 | AC-15 | CON-05 | ADR-09 | <…> |
| REQ-16 | AC-16 | CON-05 | — | <…> |
| REQ-17 | AC-17 | CON-05 | — | <…> |
| REQ-18 | AC-18 | CON-05 | — | <…> |
| REQ-19 | AC-19 | CON-02 | — | <…> |
| REQ-20 | AC-20 | CON-02 | — | <…> |
| REQ-21 | AC-21 | CON-05 | — | <…> |
| REQ-22 | AC-22 | CON-01, CON-04 | — | <…> |
| REQ-23 | AC-23 | CON-04 | ADR-12 | <…> |
| REQ-24 | AC-24 | CON-02 | ADR-10 | <…> |
| REQ-25 | AC-16, AC-17, AC-18, AC-21 | CON-05 | — | <…> |
| REQ-101 | AC-27 | — | ADR-01 | <…> |
| REQ-102 | AC-28 | — | ADR-01 | <…> |
| REQ-103 | AC-27 | — | ADR-01 | <…> |
| REQ-104 | AC-16, AC-17, AC-18 | — | — | <…> |
| REQ-105 | AC-16, AC-17, AC-18 | CON-05 | — | <…> |
| REQ-106 | AC-26 | — | — | <…> |
| NFR-01 | manual review | — | ADR-08 | <…> |
| NFR-02 | AC-04 | CON-02 | — | <…> |
| NFR-03 | AC-22 (focus visibility) + manual a11y | CON-02 | — | <…> |
| NFR-04 | manual review | CON-02 | — | <…> |
| NFR-05 | AC-09 | CON-03 | ADR-07 | <…> |
| NFR-06 | manual QA | — | ADR-01 | <…> |
| NFR-07 | manual QA | — | ADR-08 | <…> |
| NFR-08 | AC-13, AC-14, AC-15, AC-25 | CON-05 | ADR-09 | <…> |

---

## 16. Compliance & cross-cutting specs *(by reference)*

| Topic | Spec |
| --- | --- |
| Component authoring rules | [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) |
| Component guidelines | [`docs/COMPONENT-GUIDELINES.md`](COMPONENT-GUIDELINES.md) |
| Component API standard (JSDoc) | [`docs/COMPONENT-API-STANDARD.md`](COMPONENT-API-STANDARD.md) |
| Component starter template | [`docs/COMPONENT-TEMPLATE.md`](COMPONENT-TEMPLATE.md) |
| Token usage guide | [`css/TOKENS-USAGE-GUIDE.md`](../css/TOKENS-USAGE-GUIDE.md) |
| Text styles | [`css/TEXT-STYLES.md`](../css/TEXT-STYLES.md) |
| MCP server reference | [`mcp-server/README.md`](../mcp-server/README.md) |
| Generated component API index | [`components/COMPONENT-API.md`](../components/COMPONENT-API.md) |

---

## 17. Implementation plan handoff

The plan is a **separate** document. It translates IDs from this spec into file-level changes and tasks. Plans **SHALL** cite REQ / NFR / AC IDs and **SHALL NOT** restate sections [5](#5-background--problem-informative), [6](#6-goals-non-goals--success-metrics), or [12](#12-out-of-scope-normative-negative-requirements) in prose.

- **Plan location:** `plans/sherpa-ui-<slug>.md`
- **Inputs the plan must record:** path to this spec + revision (`lastUpdated` value or git SHA).
- **Plan must contain:** task list mapped to AC IDs, file list per task, commit message convention, and any cross-cutting flags it touches.

Section 17.1 (embedded mini-plan) is intentionally omitted — system scope expects multiple plans authored over time.

---

## 18. Self-review checklist

- [x] No `[NEEDS CLARIFICATION]` markers remain.
- [x] Every `REQ-` and `NFR-` has at least one `AC-` (or a manual-review entry) in §11/§15.
- [x] Every `AC-` maps to at least one `REQ-` or `NFR-`.
- [x] Sections 5–9 contain no implementation file paths in normative text (paths only appear in references and appendices).
- [x] Every acronym used appears in §4 before its first use.
- [x] Non-goals are stated explicitly in §6.2 and §12.
- [x] No speculative requirements; each REQ traces to a story or non-functional driver.
- [x] Verification evidence is chosen for every AC in §14.
- [x] Traceability matrix §15 is up to date.
- [x] Cross-cutting concerns are linked, not duplicated, in §16.
- [x] Plan handoff §17 points to the conventional plan path.

---

## 19. Changelog

### 2026-05-01 — initial AS-IS draft

- Initial draft codifying the current Sherpa UI architecture as the source of truth.

---

## 20. Appendices

### Appendix A — Module catalog

> Snapshot taken 2026-05-01 from a live filesystem scan. Treat the filesystem as the source of truth; this table is informative.

#### Inputs (10)

| Tag | Notes |
| --- | --- |
| `sherpa-input-text` | Single-line text input |
| `sherpa-input-password` | Password input with reveal toggle |
| `sherpa-input-number` | Numeric input with step controls |
| `sherpa-input-date` | Date picker |
| `sherpa-input-date-range` | Date-range picker |
| `sherpa-input-time` | Time picker |
| `sherpa-input-search` | Search input |
| `sherpa-input-select` | Select / combobox |
| `sherpa-switch` | Boolean switch |
| `sherpa-slider` | Range slider |

#### Layout & structure (≥6)

`sherpa-panel`, `sherpa-card`, `sherpa-section-header`, plus layout primitives consumed by patterns. Refer to the live filesystem.

#### Navigation (9)

`sherpa-nav`, `sherpa-nav-item`, `sherpa-nav-promo`, `sherpa-breadcrumbs`, `sherpa-pagination`, `sherpa-tabs`, `sherpa-menu`, `sherpa-menu-item`, `sherpa-section-nav`.

#### Data visualisation (7)

`sherpa-barchart`, `sherpa-line-chart`, `sherpa-donut-chart`, `sherpa-gauge-chart`, `sherpa-sparkline`, `sherpa-chart-legend`, `sherpa-metric`.

#### Data display (≥3)

`sherpa-data-grid`, `sherpa-key-value-list`, `sherpa-list-item`.

#### Feedback & status (6)

`sherpa-callout`, `sherpa-toast`, `sherpa-message`, `sherpa-empty-state`, `sherpa-loader`, `sherpa-progress-tracker`.

#### Node-graph (5)

`sherpa-node`, `sherpa-node-canvas`, `sherpa-node-header`, `sherpa-node-row`, `sherpa-node-socket`.

#### Other primitives & containers

`sherpa-button`, `sherpa-dialog`, `sherpa-popover`, `sherpa-tooltip`, `sherpa-progress-bar`, `sherpa-stepper`, `sherpa-tag`, `sherpa-toolbar`, `sherpa-view-header`, `sherpa-footer`, `sherpa-filter-bar`, `sherpa-container-pdf`, `sherpa-data-viz-container`, `sherpa-product-bar`, `sherpa-product-bar-v2`, `sherpa-file-upload`, `sherpa-accordion`.

> Authoritative per-component documentation lives in `components/<tag>/README.md` and the generated [`components/COMPONENT-API.md`](../components/COMPONENT-API.md).

### Appendix B — Data model

#### B.1 Token namespaces

| Namespace prefix | Purpose | Source files |
| --- | --- | --- |
| `--sherpa-core-*` | Raw value primitives (colour scales, spacing scale). Components **MUST NOT** consume directly. | `css/styles/sherpa-primitives.css` |
| `--sherpa-color-*` | Semantic colour aliases. | `css/styles/sherpa-alias.css`, `sherpa-components.css`, theme files |
| `--sherpa-surface-*` | Background / surface colours. | `sherpa-components.css`, theme files |
| `--sherpa-text-*` | Typography colours and sizes. | `sherpa-components.css`, theme files |
| `--sherpa-icon-*` | Icon colours. | `sherpa-components.css`, theme files |
| `--sherpa-border-*` | Border colours and widths. | `sherpa-alias.css`, `sherpa-components.css`, theme files |
| `--sherpa-elevation-*` | Shadow / elevation. | `sherpa-components.css`, theme files |
| `--sherpa-space-*` | Spacing scale. | `sherpa-components.css` |
| `--sherpa-fonts-*` | Font scales. | `sherpa-fonts.css` |
| `--sherpa-typeface-*` | Font families and weights. | `sherpa-primitives.css` |
| `--sherpa-motion-*` | Duration and easing. | `sherpa-primitives.css` |
| `--sherpa-data-viz-*` | Categorical data-viz colours. | `sherpa-data-viz-classes.css` |

#### B.2 Schema shape (per component)

```json
{
  "tagName": "sherpa-button",
  "summary": "...",
  "category": "...",
  "attributes":   [{ "name": "data-variant", "type": "enum", "values": ["primary","secondary"], "description": "..." }],
  "events":       [{ "name": "button-click", "bubbles": true, "composed": true, "detail": "..." }],
  "slots":        [{ "name": "default", "description": "..." }],
  "methods":      [{ "name": "focus", "description": "..." }],
  "properties":   [{ "name": "value", "type": "string" }],
  "cssParts":     [{ "name": "label" }],
  "cssProperties":[{ "name": "--sherpa-button-radius" }]
}
```

#### B.3 Flow lifecycle (`FlowManager`)

```
idle → started → in-progress → complete
                             → cancelled
                             → error
```

State is held in JS memory (not in DOM attributes). Each transition emits a custom event (`flow-start`, `flow-progress`, `flow-complete`, `flow-cancel`, `flow-error`) with `bubbles: true, composed: true` and a `{ flow, entity, ... }` detail.

### Appendix C — API / event contracts

#### C.1 Attribute conventions

- Public attributes: `data-<name>` kebab-case (`data-variant`, `data-icon-start`).
- Slot occupancy markers: `data-has-<slotName>` (set by `SherpaElement`).
- Status cascade: `data-status` on any ancestor.
- PDF / export modes: `data-pdf-mode` for components with print-specific layouts.

#### C.2 Event naming

- `<verb>-<noun>` kebab-case: `button-click`, `selection-change`, `row-action`, `filter-change`, `flow-start`.
- Always `bubbles: true`; add `composed: true` when crossing shadow boundaries.
- Detail shapes documented per component via JSDoc `@fires`.

#### C.3 Flow event detail shapes

| Event | Detail |
| --- | --- |
| `flow-start` | `{ flow: "add"\|"edit"\|"delete", entity: string }` |
| `flow-progress` | `{ flow, entity, data: object }` |
| `flow-complete` | `{ flow, entity, data: object }` |
| `flow-cancel` | `{ flow, entity }` |
| `flow-error` | `{ flow, entity, error: string }` |

### Appendix D — Implementation file order

For new contributors and AI agents extending the library:

1. **Tokens** — Figma export → `figma-tokens/` → `css/styles/sherpa-primitives.css` → alias / theme layers.
2. **Base classes** — `components/utilities/sherpa-element/`, then `components/utilities/sherpa-input-base/`.
3. **Cross-cutting utilities** — `flow-manager`, `form-manager`, `theme-manager`, `status-mixin`, `stylesheet-cache`, formatters.
4. **Primitives** — `sherpa-button`, `sherpa-input-*`, `sherpa-dialog`, `sherpa-tooltip`, `sherpa-popover`, `sherpa-tag`, `sherpa-loader`.
5. **Composites** — `sherpa-data-grid`, `sherpa-nav`, `sherpa-view-header`, `sherpa-filter-bar`, `sherpa-toolbar`, `sherpa-section-nav`.
6. **Visualisation** — chart family.
7. **Patterns** — `patterns/<category>/<id>.html`.
8. **MCP** — `mcp-server/index.js` (tools / resources / prompts).
9. **Build artifacts** — re-run `npm run build` to regenerate schemas, READMEs, indices.

### Appendix E — Foundational reference *(informative)*

- MDN Web Components — Custom Elements, Shadow DOM, HTML Templates.
- Constructable Stylesheets specification (`adoptedStyleSheets`).
- CSS Containment Module — `@container` queries.
- RFC 2119 — normative keywords.
- WCAG 2.2 AA — accessibility baseline.
- Model Context Protocol (`@modelcontextprotocol/sdk`) — JSON-RPC over stdio.
- Figma Variables JSON — token export schema feeding `figma-tokens/`.
