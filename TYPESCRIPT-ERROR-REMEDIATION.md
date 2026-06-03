# TypeScript Error Remediation & Prevention Plan

## Executive Summary
- **Current State**: 173 @ts-expect-error suppressions (out of 372 budget)
- **Actual Errors**: 30 errors in type-check output (all test-related, not blocking builds)
- **Issue**: Suppressions are PROPHYLACTIC - preventing strict-mode violations that would occur without them
- **Goal**: Eliminate suppressions AND prevent new ones via automated prevention infrastructure

## Phase 1: Immediate Prevention (Hours 1-2)

### 1.1 Fix Test File Type Checking
**Status**: IN PROGRESS
- Add type definitions for @web/test-runner globals (describe, it, suite, test)
- Create a separate tsconfig for tests OR suppress test file errors in main config
- **Action Items**:
  - [ ] Update tsconfig with proper test types OR exclude test files
  - [ ] Verify `npm run type-check` passes with 0 blocking errors
  
### 1.2 Add Pre-Commit Hook (husky)
**Tools**: husky + lint-staged
- Run type-check on staged TypeScript files
- Block commits if new @ts-expect-error added
- **Action Items**:
  - [ ] Install husky: `npm install -D husky`
  - [ ] Set up hook: `npx husky install`
  - [ ] Create .husky/pre-commit hook:
    ```bash
    #!/bin/bash
    npm run type-check
    npm run ts:suppressions
    ```
  - [ ] Test: intentionally add error, verify hook blocks commit

### 1.3 Enhance CI/CD Validation
**File**: .github/workflows/ci.yml
- Add suppression budget regression detection
- Fail if suppression count increases
- **Action Items**:
  - [ ] Update CI to track suppression count change
  - [ ] Add check: `npm run ts:suppressions` must not increase
  
### 1.4 Add ESLint Return-Type Rule
**Rule**: @typescript-eslint/explicit-function-return-types
- Require explicit return types on all public/exported functions
- Prevents future missing-return-type errors
- **Action Items**:
  - [ ] Update .eslintrc.json with return-type rule (public only)
  - [ ] Run eslint to identify files that need fixing
  - [ ] Auto-fix where possible: `eslint --fix`

## Phase 2: Documentation & Guidelines (Hours 2-3)

### 2.1 Create CONTRIBUTING.md Section
**Content**:
- When suppressions are acceptable (with specific criteria)
- How to add a suppression (with required comment explaining why)
- Link to common patterns and how to fix them
- **Action Items**:
  - [ ] Create/update CONTRIBUTING.md
  - [ ] Add examples of good/bad suppressions
  - [ ] Document the suppression budget process

### 2.2 Document Suppression Patterns
**Analysis**: Categorize existing 173 suppressions by type:
- Category 1: Missing parameter types (~40)
- Category 2: Missing return types (~30)
- Category 3: Override signature issues (~20)
- Category 4: Dynamic element access (~15)
- Category 5: Other (~68)

## Phase 3: Systematic Refactoring (Hours 3-5)

### 3.1 Create Safe, Targeted Codemods
- Rewrite existing codemods to be safer (avoid breaking syntax)
- OR create new codemods using TypeScript Compiler API
- Test all codemods before running on source

**Codemod 1**: Fix simple missing parameter types
- Pattern: `setFoo(x)` → `setFoo(x: inferredType)`
- Scope: Components only, validated after each run

**Codemod 2**: Fix missing return types on private methods
- Pattern: `#foo(x)` → `#foo(x: Type): ReturnType`
- Use TS compiler API to infer return types

**Codemod 3**: Fix override signature mismatches
- Pattern: Ensure `onAttributeChanged` matches base class
- Validate against SherpaElement base definition

### 3.2 Manual Refactoring of Complex Cases
- Dynamic element casting patterns (10-15 suppressions)
- Lifecycle method edge cases (5-10 suppressions)
- Generated code patterns (if applicable)

## Phase 4: Validation & Lock-Down (Hours 5-6)

### 4.1 Final Verification
- [ ] `npm run type-check` produces 0 errors (or only non-blocking test errors)
- [ ] `npm run ts:suppressions` shows 0 or single-digit count
- [ ] `npm run build` succeeds
- [ ] All tests pass: `npm test`
- [ ] Pre-commit hook works: commit should fail if introducing new errors

### 4.2 Document Exceptions
- Create EXCEPTIONS.md listing any remaining suppressions with justification
- Ensure each exception has clear technical reason and author signature
- Include date and context for future removal

---

## Implementation Sequence

### Parallel Track A: Prevention (Immediate, blocks no other work)
1. Add husky pre-commit hook
2. Enhance CI/CD validation
3. Add ESLint return-type rule
4. Create CONTRIBUTING.md section
5. Document suppression patterns (analysis only)

### Sequential Track B: Code Remediation (After prevention is locked in)
1. Run analysis to identify top 20 suppressions
2. Create targeted codemod for top patterns
3. Validate and run codemod
4. Manual review and fix remaining cases
5. Final validation and lock-down

---

## Expected Outcomes

**Before**: 173 suppressions (hard to track, easy to add more)  
**After Phase 1** (Prevention): 173 suppressions + guardrails in place (no new errors possible)  
**After Phase 2** (Documentation): 173 suppressions + clear guidelines (team understands strategy)  
**After Phase 3** (Refactoring): 0-5 suppressions (documented exceptions only)  
**After Phase 4** (Lock-down): 0 suppressions + automated validation (future-proof)

---

## Files to Modify

```
tsconfig.json                           (add test types)
.github/workflows/ci.yml                (enhance validation)
.eslintrc.json                          (add return-type rule)
.husky/pre-commit                       (new: add type-check)
CONTRIBUTING.md                         (new: TypeScript section)
scripts/fix-suppressions-*.cjs          (new: safe codemods)
EXCEPTIONS.md                           (new: suppression justifications)
```

---

## Risk Assessment

**Low Risk**:
- Prevention infrastructure (pre-commit, CI) - non-breaking, additive only
- ESLint rule (public functions only) - doesn't affect existing code
- Documentation (CONTRIBUTING.md) - informational only

**Medium Risk**:
- Test file type checking - may require tsconfig restructuring
- Pre-commit hook - could fail if types are not fixable

**High Risk**:
- Running existing codemods without validation - BLOCKED (they break syntax)
- Automated mass refactoring - requires careful review

---

## Decision Points

1. **Test Files**: Should we exclude from main type-check or fix their types?
   - **Recommendation**: Exclude from main tsconfig, create separate test validation script
   - **Reasoning**: Tests use different frameworks (@web/test-runner, @open-wc/testing), harder to type

2. **Existing Codemods**: Should we fix or rebuild?
   - **Recommendation**: Rebuild using TypeScript Compiler API for safety
   - **Reasoning**: Current codemods produce invalid syntax

3. **Suppression Budget**: Should we reduce from 372 to 0?
   - **Recommendation**: Target 0, allow exceptions with documentation
   - **Reasoning**: Clean codebase is more maintainable; exceptions documented

---

## Timeline Estimate

- **Phase 1** (Prevention): 1-2 hours (mostly automation)
- **Phase 2** (Documentation): 30 minutes
- **Phase 3** (Refactoring): 2-3 hours (depends on codemod complexity)
- **Phase 4** (Validation): 30 minutes - 1 hour

**Total**: 4-7 hours of work, heavily automated
