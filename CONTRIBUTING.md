# Contributing to Sherpa UI

Thank you for contributing to Sherpa UI! This document provides guidelines for development practices, with a particular focus on TypeScript type safety.

## Table of Contents

- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [TypeScript & Type Safety](#typescript--type-safety)
- [Component Development](#component-development)
- [Testing](#testing)
- [Commit Process](#commit-process)

---

## Development Setup

### Prerequisites

- Node.js 20+ (check `.nvmrc` for exact version)
- npm 10+

### Installation

```bash
npm install
npm run build:ts    # Compile TypeScript
npm run build       # Full build with assets, tokens, schemas
```

### Available Commands

```bash
# Development
npm run build:ts:watch    # Watch mode compilation
npm run type-check        # TypeScript validation (no emit)
npm run lint              # ESLint validation
npm run lint:fix          # Auto-fix ESLint violations
npm test                  # Run unit tests
npm test:watch            # Watch mode testing

# Building
npm run build              # Full build (recommended)
npm run build:serial       # Serial build (for debugging)

# Validation
npm run ts:suppressions    # Check @ts-expect-error budget
npm run ts:check-regression  # Detect suppression regressions
npm run validate:jsdoc     # Validate JSDoc comments
npm run lint:css           # CSS linting
```

---

## Code Style

### General Guidelines

- **Formatting**: CSS files use Prettier. Run `npm run format` before committing.
- **Naming**: Use camelCase for variables/methods, PascalCase for classes/components
- **Comments**: Prefer self-documenting code, but use JSDoc for public APIs
- **Imports**: Use absolute imports from component/utility folders

### CSS Grid & Spacing

**Strict compliance required** — all sizes and spacing must align to the **8px primary grid**:

- Allowed: 1 (borders), 2 (edges), 4, 8, 12, 16, 20, 24, 32, 40, 48, ...
- Forbidden: 3, 5, 6, 7, 9, 10, 11, 13, ...

**Tokens**: Use `--sherpa-space-*` tokens and verify underlying values match grid:
- `--sherpa-space-2xs` = 4px
- `--sherpa-space-xs` = 8px
- `--sherpa-space-sm` = 12px
- `--sherpa-space-default` = 16px

---

## TypeScript & Type Safety

### Overview

Sherpa UI uses **strict TypeScript mode** to catch errors at compile-time. All code must pass `npm run type-check` with **zero errors**.

### Type Checking Process

1. **Pre-Commit Hook**: Runs `npm run type-check` automatically
   - Blocks commits if TypeScript errors are found
   - Blocks commits if suppression budget is exceeded

2. **CI/CD Validation**: 
   - `npm run type-check` — full validation
   - `npm run ts:suppressions` — budget check
   - `npm run ts:check-regression` — detects if suppressions increased

3. **ESLint Validation**:
   - Run `npm run lint` to check for violations
   - Run `npm run lint:fix` to auto-fix where possible

### Error Suppression Policy

#### When Suppressions Are Acceptable

Suppressions (using `@ts-expect-error`) are **allowed ONLY** in these cases:

1. **Third-party library type issues**: Library lacks types or has incomplete types
   ```typescript
   // @ts-expect-error - @some-library/foo doesn't export TypeScript types
   import { bar } from '@some-library/foo';
   ```

2. **DOM element type assertions**: Accessing typed properties on dynamically selected elements
   ```typescript
   // @ts-expect-error - Element resolved from DOM query is untyped
   (btn as HTMLElement).customMethod?.();
   ```

3. **Framework/platform limitations**: Framework patterns that don't map cleanly to TypeScript
   ```typescript
   // @ts-expect-error - Web Components lifecycle hooks have implicit typing
   override connectedCallback(): void { }
   ```

#### When Suppressions Are NOT Acceptable

❌ DO NOT suppress:
- Missing parameter types on your own code
- Missing return types on public methods
- Untyped function parameters
- Any error that can be fixed by adding explicit type annotations

#### Adding a Suppression

When you must add a suppression, **always include a comment explaining why**:

```typescript
// ✅ GOOD
// @ts-expect-error - MenuButton type from @sherpa-ui/menu doesn't include custom method
this.menu.customToggle?.();

// ❌ BAD
// @ts-expect-error
this.menu.customToggle?.();
```

### Common Patterns & How to Fix Them

#### Missing Parameter Type

**Problem**:
```typescript
setData(rows) {  // ❌ Implicit any
  // ...
}
```

**Solution**:
```typescript
setData(rows: GridRow[]): void {  // ✅ Explicit type
  // ...
}
```

#### Missing Return Type

**Problem**:
```typescript
#getConfig() {  // ❌ Inferred from code, but not explicit
  return { ... };
}
```

**Solution**:
```typescript
#getConfig(): Config {  // ✅ Explicit return type
  return { ... };
}
```

#### Untyped Event Handlers

**Problem**:
```typescript
this.addEventListener('click', (e) => {  // ❌ e has implicit any
  console.log(e.target);
});
```

**Solution**:
```typescript
this.addEventListener('click', (e: Event) => {  // ✅ Explicit type
  const target = (e.target as HTMLElement);
  console.log(target);
});
```

#### Override Without Explicit Return Type

**Problem**:
```typescript
override onAttributeChanged(name, oldValue, newValue) {  // ❌ Missing return type
  // ...
}
```

**Solution**:
```typescript
override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null): void {  // ✅
  // ...
}
```

### Strict Mode Compiler Options

All of these are **enabled** and enforced:

| Option | Impact |
|--------|--------|
| `noImplicitAny` | Must type all parameters and variables |
| `strictNullChecks` | null/undefined must be explicitly handled |
| `strictFunctionTypes` | Function parameter types must be contravariant |
| `noUnusedLocals` | Unused variables are errors |
| `noUnusedParameters` | Unused parameters are errors |
| `noImplicitReturns` | All code paths must return a value |
| `noImplicitOverride` | All overrides must use `override` keyword |

**Note**: Violations are caught at type-check time, not at build time. Fix them early!

### Tools & Commands

```bash
# Check for type errors
npm run type-check

# Add explicit return types to exported functions
npm run lint:fix -- --rule '@typescript-eslint/explicit-function-return-types:warn'

# View current suppression count
npm run ts:suppressions

# Check if suppressions increased (regression)
npm run ts:check-regression

# Validate new code follows strict types
npm run build  # Includes type-check
```

---

## Component Development

### File Structure

Each component follows this 3-layer structure:

```
components/sherpa-mycomponent/
├── sherpa-mycomponent.ts       (Component class)
├── sherpa-mycomponent.css      (Styles)
└── sherpa-mycomponent.test.ts  (Unit tests)
```

### Template

Use the Sherpa UI component template when creating new components:

```typescript
/**
 * @fileoverview Short description of component.
 * @category Components
 * @category Layout
 * @example
 *   <sherpa-mycomponent>Content</sherpa-mycomponent>
 */

import { SherpaElement, html, css } from '../base/sherpa-element.js';

/**
 * SherpaMyComponent — description
 * @slot default - Description of slot
 * @csspart part-name - Description
 * @fires mycomponent-event - When action occurs
 */
export class SherpaMyComponent extends SherpaElement {
  // --- Properties ---
  #privateField: string = 'initial';

  // --- Lifecycle ---
  connectedCallback(): void {
    super.connectedCallback();
    // Initialization code
  }

  // --- Public API ---
  /**
   * Public method description
   * @param param - Parameter description
   * @returns Description of return value
   */
  public myMethod(param: string): boolean {
    return true;
  }

  // --- Private ---
  #privateMethod(): void {
    // Implementation
  }

  // --- Rendering ---
  override render() {
    return html`<div>...</div>`;
  }

  static override styles = css`
    :host {
      display: block;
    }
  `;
}

customElements.define('sherpa-mycomponent', SherpaMyComponent);
```

### Type Safety in Components

1. **Private methods**: Always add explicit return types
2. **Event listeners**: Type event parameters explicitly
3. **DOM queries**: Cast query results to specific types
4. **Attributes**: Use typed getters/setters when possible

---

## Testing

### Running Tests

```bash
npm test                  # Run all tests once
npm test:watch           # Watch mode
npm test:coverage        # Generate coverage report
npm test:visual          # Run visual regression tests
npm test:visual:update   # Update visual baselines
```

### Writing Tests

- Use `@web/test-runner` for unit tests
- Use Playwright for visual regression tests
- Mock external dependencies
- Aim for >80% coverage on components

### Type Safety in Tests

Tests are excluded from strict type-check requirements, but should still be well-typed:

```typescript
import { expect } from '@open-wc/testing';
import { SherpaMyComponent } from './sherpa-mycomponent.js';

describe('SherpaMyComponent', () => {
  it('should initialize with default values', () => {
    const el = document.createElement('sherpa-mycomponent') as SherpaMyComponent;
    expect(el).to.exist;
  });
});
```

---

## Commit Process

### Pre-Commit Validation

The pre-commit hook automatically runs:
1. `npm run type-check` — TypeScript validation
2. `npm run ts:suppressions` — Budget check

**If validation fails**, the commit is blocked. To fix:

```bash
# Fix type errors
npm run type-check        # See errors
# Fix the issues in your code

# Then retry the commit
git add .
git commit -m "..."
```

### Commit Messages

Follow conventional commits format:

```
type(scope): short description

Longer explanation of changes if needed.

Fixes #123
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

### Pull Requests

1. Ensure all checks pass
2. Include description of changes
3. Reference related issues
4. Request review from maintainers

---

## TypeScript Suppression Budget

The project tracks suppression count to prevent accumulation of technical debt:

- **Budget**: 372 total suppressions allowed
- **Current**: See `npm run ts:suppressions` output
- **Policy**: New suppressions require justification

To update the budget after legitimate changes:

```bash
npm run ts:suppressions:write
```

This updates `.ts-suppression-budget` file. Use sparingly—prefer fixing code over adding suppressions.

---

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Sherpa UI Component Library Docs](./README.md)
- [ESLint Rules Reference](https://eslint.org/docs/rules/)
- [Web Components Best Practices](https://web.dev/web-components/)

---

## Questions?

- Open an issue on GitHub
- Check existing discussions
- Review component examples in `/demo`

---

**Thank you for maintaining Sherpa UI's code quality!** 🎉
