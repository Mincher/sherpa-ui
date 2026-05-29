# ADR-001: Web Components + Shadow DOM, No Framework

**Status:** Accepted  
**Date:** 2024 (initial architecture)  
**Deciders:** Design System Team  
**Linked Requirements:** REQ-01, REQ-02, REQ-101, REQ-103

## Context

The library must be usable from any product surface regardless of framework choice. N-able products use a mix of frameworks (React, Vue, Angular, vanilla JS), and forcing a specific framework would limit adoption and create integration friction.

## Decision

Build on the standard **Custom Elements + Shadow DOM + HTML Templates** platform; ship as ES modules.

### Options Considered

**Option A: React Component Library**
- ✅ Rich ecosystem, excellent DX tooling
- ❌ Locks consumers into React
- ❌ Requires transpilation step
- ❌ Larger bundle size

**Option B: Web Components (Chosen)**
- ✅ Framework-agnostic
- ✅ Native browser support
- ✅ Encapsulated styles via Shadow DOM
- ✅ Loadable via plain `<script type="module">`
- ❌ Requires polyfill-free evergreen browsers
- ❌ Limited DX tooling vs framework-specific kits

**Option C: Multi-Framework Wrappers**
- ✅ Framework-specific APIs
- ❌ Maintenance burden (N frameworks × M components)
- ❌ Complexity in keeping wrappers in sync
- ❌ Larger distribution size

## Rationale

- **Zero framework lock-in:** Works in any JavaScript environment
- **Small footprint:** No framework runtime overhead
- **Future-proof:** Based on web standards, not framework trends
- **Encapsulation:** Shadow DOM provides true style isolation
- **Progressive enhancement:** Can work with or without JavaScript

## Consequences

### Positive

- ✅ **Portable:** Usable from React, Vue, Angular, Svelte, or vanilla JS
- ✅ **Small:** No framework dependency, minimal runtime
- ✅ **Future-proof:** Built on web standards that won't be deprecated
- ✅ **Encapsulated:** Shadow DOM prevents style conflicts

### Negative

- ❌ **Browser requirements:** Requires evergreen browsers (no IE11)
- ❌ **Limited tooling:** Fewer dev tools compared to React/Vue ecosystems
- ❌ **Learning curve:** Team needs to learn Web Components API

### Neutral

- ⚪ **SSR complexity:** Declarative Shadow DOM support required for SSR
- ⚪ **Testing:** Requires tools that understand Shadow DOM

## Implementation Notes

- Base class `SherpaElement` extends `HTMLElement`
- All components use Shadow DOM (mode: `open`)
- Distributed as ES modules via `components/index.js`
- No build step required for consumers

## References

- [Web Components Spec](https://www.webcomponents.org/introduction)
- [Custom Elements v1 Spec](https://html.spec.whatwg.org/multipage/custom-elements.html)
- [Shadow DOM v1 Spec](https://dom.spec.whatwg.org/#shadow-trees)
