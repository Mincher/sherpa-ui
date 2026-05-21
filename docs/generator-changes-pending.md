# Pending Generator Changes

> **File:** `scripts/generate-css-tokens.js`
>
> These changes need to be applied to the generator so that a fresh
> `sherpa-themes.css` regeneration produces output that matches the
> hand-maintained state introduced in the session that renamed the app-chrome
> and component-specific tokens.

---

## 1 · Remove `emitAppChrome()` / app-chrome token section

The generator currently emits a dedicated block of tokens named after specific
UI regions (product-nav, product-bar). These are being replaced by generic
semantic tokens already present in the container/surface groups.

### Tokens to **stop emitting**

| Old token | Replacement | Notes |
|-----------|-------------|-------|
| `--sherpa-surface-app-product-nav-bg` | `--sherpa-surface-container-secondary-default` | Consumed by nav :host override |
| `--sherpa-surface-app-product-nav-sub-bg` | `--sherpa-surface-container-secondary-sub-default` | NEW — added to base block |
| `--sherpa-surface-app-product-nav-hover` | `--sherpa-surface-container-secondary-hover` | |
| `--sherpa-surface-app-product-nav-active` | `--sherpa-surface-container-secondary-active` | |
| `--sherpa-surface-app-product-nav-down` | _(deleted, no consumer)_ | |
| `--sherpa-surface-app-product-nav-sub-active` | _(deleted, no consumer)_ | |
| `--sherpa-surface-app-product-nav-base-text` | _(deleted, no consumer)_ | |
| `--sherpa-surface-app-product-nav-text` | _(deleted, no consumer)_ | |
| `--sherpa-surface-app-product-nav-base-icon` | _(deleted, no consumer)_ | |
| `--sherpa-surface-app-product-nav-active-icon` | _(deleted, no consumer)_ | |
| `--sherpa-surface-app-product-bar-bg` | `--sherpa-surface-container-tertiary-default` (v1) / `--sherpa-surface-container-default` (v2) | v1 product-bar pins the token on :host to dark |
| `--sherpa-surface-app-product-bar-product-block` | _(deleted, no consumer)_ | |
| `--sherpa-surface-app-product-bar-product-text` | _(deleted, no consumer)_ | |
| `--sherpa-surface-app-background-default` | `--sherpa-surface-container-app` | Renamed — emit under new name |
| `--sherpa-surface-product-bar-default` | _(deleted, no consumer)_ | |
| `--sherpa-icon-active-test` | _(deleted — was a test token)_ | |
| `--sherpa-surface-container-elevated-overlay` | _(deleted, no consumer)_ | |

### Action

- Remove the `emitAppChrome()` function (or equivalent generator section) that
  produces these tokens.
- Ensure `--sherpa-surface-container-app` is emitted in the base/surface block
  (it may already be; verify the alias source file includes it).
- Ensure per-theme and per-mode overrides for `container-app` are emitted in
  place of `app-background-default` overrides.

---

## 2 · Remove `emitComponentTokens()` / component-specific token section

The generator currently emits `--sherpa-component-*` tokens for per-component
overrides. These are being replaced by generic design-system tokens.

### Tokens to **stop emitting**

| Old token | Replacement |
|-----------|-------------|
| `--sherpa-component-accordion-border-rounding` | `--sherpa-border-container-rounding` |
| `--sherpa-component-accordion-border-width` | `--sherpa-border-width-container` |
| `--sherpa-component-accordion-border-color` | `--sherpa-border-container-default` (existing) |
| `--sherpa-component-banner-border-rounding` | `--sherpa-border-rounding-base` (used directly in component CSS) |

### New tokens to **start emitting** (base block)

```
--sherpa-border-container-rounding: var(--sherpa-border-rounding-base);
--sherpa-border-width-container:    var(--sherpa-border-width-base);
```

### Classic theme overrides to **start emitting**

In the `:where(:root[data-theme="classic"])` block:

```
--sherpa-border-container-rounding: var(--sherpa-border-rounding-none);
--sherpa-border-width-container:    0;
```

This replaces the Classic-theme accordion-specific overrides (border-rounding=0,
border-color=transparent).

---

## 3 · Remove `emitPlatformProductBarIcon()`

The token `--sherpa-surface-app-product-bar-icon` was removed from
`sherpa-platform.css`. If the generator writes platform tokens, remove this
entry. The product-bar component now falls back directly to
`--sherpa-surface-control-primary-default`.

---

## 4 · Update codemod alias map

`scripts/codemod-compat-aliases.js` already updated: the dead
`surface-app-product-nav-secondary` → `surface-app-product-nav-base-icon`
entry was removed, and `surface-app-product-bg-default` was updated to map
to `surface-container-app`.

If the generator auto-generates the codemod alias map, update the template
accordingly.

---

## 5 · Add `--sherpa-surface-container-secondary-sub-default` to the alias source

The new token `--sherpa-surface-container-secondary-sub-default` was added
manually to the base block in `sherpa-themes.css`:

```css
--sherpa-surface-container-secondary-sub-default: var(--sherpa-surface-container-secondary-default);
```

It needs to be added to the Figma variables / alias source JSON so the
generator can emit it going forward. The Figma token path would be:
`surface/container/secondary/sub-default`.
