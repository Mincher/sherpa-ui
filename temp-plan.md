# Plan: Assess and Improve Component CSS

## TL;DR
Full remediation of all component CSS files against the agreed rules.

Key actions:
- Add layer structure for all component CSS
- Replace component-level `light-dark()` usage with theme-driven semantic tokens
- Audit opacity usage so effect color opacities remain for transitions/visual effects while disabled states use inactive tokens
- Reduce unjustified `!important` usage
- Standardize inactive and status token usage

## Implementation Phases

### Phase 1: Discovery and Audit
- Map all component CSS files.
- Identify rule violations and cleanup opportunities.
- Capture file-level findings with references.

### Phase 2: Remediation
1. Layering
- Create a centralized layer entry strategy.
- Wrap component CSS under the `sherpa` layer consistently.

2. Remove component `light-dark()` usage
- Replace with semantic token references resolved by theme files.

3. Opacity policy
- Keep opacity where it is visual effect behavior (animations, overlays, chart emphasis).
- Replace disabled-state opacity with inactive tokens and pointer/interaction rules.

4. `!important` cleanup
- Keep only justified `!important` usage.
- Remove others by improving selector specificity and rule order.

5. Status and inactive token consistency
- Prefer inherited private status variables and semantic aliases.
- Reduce hardcoded fallback drift across components.

### Phase 3: Verification
- Confirm expected layer usage across components.
- Confirm no component `light-dark()` usage remains.
- Confirm disabled-state opacity is removed where inappropriate.
- Confirm `!important` usage is limited to justified cases.
- Confirm status and inactive token usage consistency.

## Decisions Confirmed
- Full remediation scope.
- Add layering across all component CSS.
- Replace `light-dark()` in components with theme refs.
- Keep effect color opacities for transitions and visual behavior.
- Build an inactive/status consistency pass.

## Deliverables
- Updated component CSS files.
- New/updated utility CSS for layering and status/inactive normalization.
- Verification pass with grep/search checks and summary.
