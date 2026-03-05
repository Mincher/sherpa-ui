# Component Public API Reference

Complete API surface for all 22 sherpa-* web components.

## Quick Index

---

## Component Details

---

## API Completion Notes

- `TODO` items indicate where JSDoc, manual documentation, or further inspection is needed
- Run `npm run docs` to regenerate component READMEs from this reference
- All public methods should include JSDoc `@param` and `@returns` annotations
- All observed attributes should document their type (boolean, string, enum) and default
- All dispatched events should document their detail object structure

## Next Steps

1. **Fill JSDoc:** Add `@param`, `@returns`, and `@description` tags to all public methods
2. **Document attributes:** Update JSDoc header comments to describe each observedAttribute
3. **Validate events:** Ensure all CustomEvent dispatches include detail structure
4. **Define types:** Create TypeScript definitions (`.d.ts`) for all components
5. **Test coverage:** Add unit tests for all public methods and properties