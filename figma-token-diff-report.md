# Figma Variable vs. Sherpa CSS — Diff Report

_Generated: 2026-06-08. Source: `figma-tokens/figma-variables.json` vs `css/styles/`._
_Run `npm run tokens:diff` to regenerate this file after an extraction._

---

## Overview

| | Count |
|---|---|
| Figma variables mapped to CSS names | 622 |
| CSS custom properties (--core-* + --sherpa-*) | 352 |
| Missing from CSS (High priority) | 192 |
| Missing from CSS (Medium priority) | 85 |
| Missing from CSS (Low priority) | 0 |
| In CSS but not in Figma (non-palette) | 61 |

> **Note:** Theme-collection variables (`surface/*`, `content/*`, `border/*`, `elevation/*`) use
> path transforms that differ from the simple `sanitize()` mapping and are excluded from this
> diff to avoid false positives. Palette and overlay auto-aliases are excluded from the Extra table.

---

## 1. Missing from CSS — High Priority

Semantic alias or status tokens in Figma with no CSS equivalent.

| Figma path | Expected CSS token | Collection | Response |
|---|---|---|---|
| `border/active` | `--sherpa-border-active` | Status | |
| `border/default` | `--sherpa-border-default` | Status | |
| `border/rounding/2xl` | `--sherpa-border-rounding-2xl` | Alias | |
| `border/rounding/base` | `--sherpa-border-rounding-base` | Alias | |
| `border/rounding/full` | `--sherpa-border-rounding-full` | Alias | |
| `border/rounding/lg` | `--sherpa-border-rounding-lg` | Alias | |
| `border/rounding/none` | `--sherpa-border-rounding-none` | Alias | |
| `border/rounding/sm` | `--sherpa-border-rounding-sm` | Alias | |
| `border/rounding/xl` | `--sherpa-border-rounding-xl` | Alias | |
| `border/validation-rounding` | `--sherpa-border-validation-rounding` | Status | |
| `border/width/2xl` | `--sherpa-border-width-2xl` | Alias | |
| `border/width/3xl` | `--sherpa-border-width-3xl` | Alias | |
| `border/width/base` | `--sherpa-border-width-base` | Alias | |
| `border/width/lg` | `--sherpa-border-width-lg` | Alias | |
| `border/width/none` | `--sherpa-border-width-none` | Alias | |
| `border/width/xl` | `--sherpa-border-width-xl` | Alias | |
| `border/width/xs` | `--sherpa-border-width-xs` | Alias | |
| `color/accent/100` | `--sherpa-color-accent-100` | Alias | |
| `color/accent/1000` | `--sherpa-color-accent-1000` | Alias | |
| `color/accent/200` | `--sherpa-color-accent-200` | Alias | |
| `color/accent/300` | `--sherpa-color-accent-300` | Alias | |
| `color/accent/400` | `--sherpa-color-accent-400` | Alias | |
| `color/accent/500` | `--sherpa-color-accent-500` | Alias | |
| `color/accent/700` | `--sherpa-color-accent-700` | Alias | |
| `color/accent/800` | `--sherpa-color-accent-800` | Alias | |
| `color/accent/900` | `--sherpa-color-accent-900` | Alias | |
| `color/accent/base` | `--sherpa-color-accent-base` | Alias | |
| `color/accent/classic/100` | `--sherpa-color-accent-classic-100` | Alias | |
| `color/accent/classic/1000` | `--sherpa-color-accent-classic-1000` | Alias | |
| `color/accent/classic/200` | `--sherpa-color-accent-classic-200` | Alias | |
| `color/accent/classic/300` | `--sherpa-color-accent-classic-300` | Alias | |
| `color/accent/classic/400` | `--sherpa-color-accent-classic-400` | Alias | |
| `color/accent/classic/500` | `--sherpa-color-accent-classic-500` | Alias | |
| `color/accent/classic/600` | `--sherpa-color-accent-classic-600` | Alias | |
| `color/accent/classic/650` | `--sherpa-color-accent-classic-650` | Alias | |
| `color/accent/classic/725` | `--sherpa-color-accent-classic-725` | Alias | |
| `color/accent/classic/750` | `--sherpa-color-accent-classic-750` | Alias | |
| `color/accent/classic/800` | `--sherpa-color-accent-classic-800` | Alias | |
| `color/accent/classic/900` | `--sherpa-color-accent-classic-900` | Alias | |
| `color/accent/classic/base` | `--sherpa-color-accent-classic-base` | Alias | |
| `color/brand/100` | `--sherpa-color-brand-100` | Alias | |
| `color/brand/1000` | `--sherpa-color-brand-1000` | Alias | |
| `color/brand/200` | `--sherpa-color-brand-200` | Alias | |
| `color/brand/300` | `--sherpa-color-brand-300` | Alias | |
| `color/brand/400` | `--sherpa-color-brand-400` | Alias | |
| `color/brand/600` | `--sherpa-color-brand-600` | Alias | |
| `color/brand/700` | `--sherpa-color-brand-700` | Alias | |
| `color/brand/800` | `--sherpa-color-brand-800` | Alias | |
| `color/brand/900` | `--sherpa-color-brand-900` | Alias | |
| `color/brand/base` | `--sherpa-color-brand-base` | Alias | |
| `color/brand/overlay-high` | `--sherpa-color-brand-overlay-high` | Alias | |
| `color/brand/overlay-low` | `--sherpa-color-brand-overlay-low` | Alias | |
| `color/critical/100` | `--sherpa-color-critical-100` | Alias | |
| `color/critical/1000` | `--sherpa-color-critical-1000` | Alias | |
| `color/critical/200` | `--sherpa-color-critical-200` | Alias | |
| `color/critical/300` | `--sherpa-color-critical-300` | Alias | |
| `color/critical/400` | `--sherpa-color-critical-400` | Alias | |
| `color/critical/500` | `--sherpa-color-critical-500` | Alias | |
| `color/critical/600` | `--sherpa-color-critical-600` | Alias | |
| `color/critical/700` | `--sherpa-color-critical-700` | Alias | |
| `color/critical/800` | `--sherpa-color-critical-800` | Alias | |
| `color/critical/900` | `--sherpa-color-critical-900` | Alias | |
| `color/info/100` | `--sherpa-color-info-100` | Alias | |
| `color/info/1000` | `--sherpa-color-info-1000` | Alias | |
| `color/info/200` | `--sherpa-color-info-200` | Alias | |
| `color/info/300` | `--sherpa-color-info-300` | Alias | |
| `color/info/400` | `--sherpa-color-info-400` | Alias | |
| `color/info/500` | `--sherpa-color-info-500` | Alias | |
| `color/info/600` | `--sherpa-color-info-600` | Alias | |
| `color/info/700` | `--sherpa-color-info-700` | Alias | |
| `color/info/800` | `--sherpa-color-info-800` | Alias | |
| `color/info/900` | `--sherpa-color-info-900` | Alias | |
| `color/neutral/0` | `--sherpa-color-neutral-0` | Alias | |
| `color/neutral/100` | `--sherpa-color-neutral-100` | Alias | |
| `color/neutral/1000` | `--sherpa-color-neutral-1000` | Alias | |
| `color/neutral/200` | `--sherpa-color-neutral-200` | Alias | |
| `color/neutral/300` | `--sherpa-color-neutral-300` | Alias | |
| `color/neutral/400` | `--sherpa-color-neutral-400` | Alias | |
| `color/neutral/500` | `--sherpa-color-neutral-500` | Alias | |
| `color/neutral/600` | `--sherpa-color-neutral-600` | Alias | |
| `color/neutral/700` | `--sherpa-color-neutral-700` | Alias | |
| `color/neutral/800` | `--sherpa-color-neutral-800` | Alias | |
| `color/neutral/900` | `--sherpa-color-neutral-900` | Alias | |
| `color/success/100` | `--sherpa-color-success-100` | Alias | |
| `color/success/1000` | `--sherpa-color-success-1000` | Alias | |
| `color/success/200` | `--sherpa-color-success-200` | Alias | |
| `color/success/300` | `--sherpa-color-success-300` | Alias | |
| `color/success/400` | `--sherpa-color-success-400` | Alias | |
| `color/success/500` | `--sherpa-color-success-500` | Alias | |
| `color/success/600` | `--sherpa-color-success-600` | Alias | |
| `color/success/700` | `--sherpa-color-success-700` | Alias | |
| `color/success/800` | `--sherpa-color-success-800` | Alias | |
| `color/success/900` | `--sherpa-color-success-900` | Alias | |
| `color/tones/100` | `--sherpa-color-tones-100` | Alias | |
| `color/tones/1000` | `--sherpa-color-tones-1000` | Alias | |
| `color/tones/200` | `--sherpa-color-tones-200` | Alias | |
| `color/tones/300` | `--sherpa-color-tones-300` | Alias | |
| `color/tones/400` | `--sherpa-color-tones-400` | Alias | |
| `color/tones/500` | `--sherpa-color-tones-500` | Alias | |
| `color/tones/600` | `--sherpa-color-tones-600` | Alias | |
| `color/tones/700` | `--sherpa-color-tones-700` | Alias | |
| `color/tones/800` | `--sherpa-color-tones-800` | Alias | |
| `color/tones/900` | `--sherpa-color-tones-900` | Alias | |
| `color/urgent/100` | `--sherpa-color-urgent-100` | Alias | |
| `color/urgent/1000` | `--sherpa-color-urgent-1000` | Alias | |
| `color/urgent/200` | `--sherpa-color-urgent-200` | Alias | |
| `color/urgent/300` | `--sherpa-color-urgent-300` | Alias | |
| `color/urgent/400` | `--sherpa-color-urgent-400` | Alias | |
| `color/urgent/500` | `--sherpa-color-urgent-500` | Alias | |
| `color/urgent/600` | `--sherpa-color-urgent-600` | Alias | |
| `color/urgent/700` | `--sherpa-color-urgent-700` | Alias | |
| `color/urgent/800` | `--sherpa-color-urgent-800` | Alias | |
| `color/urgent/900` | `--sherpa-color-urgent-900` | Alias | |
| `color/warning/100` | `--sherpa-color-warning-100` | Alias | |
| `color/warning/1000` | `--sherpa-color-warning-1000` | Alias | |
| `color/warning/200` | `--sherpa-color-warning-200` | Alias | |
| `color/warning/300` | `--sherpa-color-warning-300` | Alias | |
| `color/warning/400` | `--sherpa-color-warning-400` | Alias | |
| `color/warning/500` | `--sherpa-color-warning-500` | Alias | |
| `color/warning/600` | `--sherpa-color-warning-600` | Alias | |
| `color/warning/700` | `--sherpa-color-warning-700` | Alias | |
| `color/warning/800` | `--sherpa-color-warning-800` | Alias | |
| `color/warning/900` | `--sherpa-color-warning-900` | Alias | |
| `fonts/context/brand` | `--sherpa-fonts-context-brand` | Alias | |
| `fonts/scale/0` | `--sherpa-fonts-scale-0` | Alias | |
| `fonts/scale/10xl` | `--sherpa-fonts-scale-10xl` | Alias | |
| `fonts/scale/11xl` | `--sherpa-fonts-scale-11xl` | Alias | |
| `fonts/scale/12xl` | `--sherpa-fonts-scale-12xl` | Alias | |
| `fonts/scale/13xl` | `--sherpa-fonts-scale-13xl` | Alias | |
| `fonts/scale/14xl` | `--sherpa-fonts-scale-14xl` | Alias | |
| `fonts/scale/2xl` | `--sherpa-fonts-scale-2xl` | Alias | |
| `fonts/scale/2xs` | `--sherpa-fonts-scale-2xs` | Alias | |
| `fonts/scale/3xl` | `--sherpa-fonts-scale-3xl` | Alias | |
| `fonts/scale/4xl` | `--sherpa-fonts-scale-4xl` | Alias | |
| `fonts/scale/5xl` | `--sherpa-fonts-scale-5xl` | Alias | |
| `fonts/scale/6xl` | `--sherpa-fonts-scale-6xl` | Alias | |
| `fonts/scale/7xl` | `--sherpa-fonts-scale-7xl` | Alias | |
| `fonts/scale/8xl` | `--sherpa-fonts-scale-8xl` | Alias | |
| `fonts/scale/9xl` | `--sherpa-fonts-scale-9xl` | Alias | |
| `fonts/scale/base` | `--sherpa-fonts-scale-base` | Alias | |
| `fonts/scale/lg` | `--sherpa-fonts-scale-lg` | Alias | |
| `fonts/scale/sm` | `--sherpa-fonts-scale-sm` | Alias | |
| `fonts/scale/xl` | `--sherpa-fonts-scale-xl` | Alias | |
| `fonts/scale/xs` | `--sherpa-fonts-scale-xs` | Alias | |
| `icon/control/primary` | `--sherpa-icon-control-primary` | Status | |
| `icon/control/secondary` | `--sherpa-icon-control-secondary` | Status | |
| `icon/control/tertiary` | `--sherpa-icon-control-tertiary` | Status | |
| `icon/control/tertiary-on-color` | `--sherpa-icon-control-tertiary-on-color` | Status | |
| `icon/default` | `--sherpa-icon-default` | Status | |
| `icon/on-color` | `--sherpa-icon-on-color` | Status | |
| `shadow/default` | `--sherpa-shadow-default` | Status | |
| `shadow/status` | `--sherpa-shadow-status` | Status | |
| `size/2xl` | `--sherpa-size-2xl` | Alias | |
| `size/2xs` | `--sherpa-size-2xs` | Alias | |
| `size/3xl` | `--sherpa-size-3xl` | Alias | |
| `size/3xs` | `--sherpa-size-3xs` | Alias | |
| `size/4xl` | `--sherpa-size-4xl` | Alias | |
| `size/5xl` | `--sherpa-size-5xl` | Alias | |
| `size/6xl` | `--sherpa-size-6xl` | Alias | |
| `size/lg` | `--sherpa-size-lg` | Alias | |
| `size/md` | `--sherpa-size-md` | Alias | |
| `size/none` | `--sherpa-size-none` | Alias | |
| `size/sm` | `--sherpa-size-sm` | Alias | |
| `size/xl` | `--sherpa-size-xl` | Alias | |
| `size/xs` | `--sherpa-size-xs` | Alias | |
| `space/2xl` | `--sherpa-space-2xl` | Alias | |
| `space/3xl` | `--sherpa-space-3xl` | Alias | |
| `space/4xl` | `--sherpa-space-4xl` | Alias | |
| `space/5xl` | `--sherpa-space-5xl` | Alias | |
| `space/6xl` | `--sherpa-space-6xl` | Alias | |
| `space/base` | `--sherpa-space-base` | Alias | |
| `space/lg` | `--sherpa-space-lg` | Alias | |
| `space/sm` | `--sherpa-space-sm` | Alias | |
| `space/xl` | `--sherpa-space-xl` | Alias | |
| `space/xs` | `--sherpa-space-xs` | Alias | |
| `surface/color/default` | `--sherpa-surface-color-default` | Status | |
| `surface/color/down` | `--sherpa-surface-color-down` | Status | |
| `surface/color/hover` | `--sherpa-surface-color-hover` | Status | |
| `surface/default` | `--sherpa-surface-default` | Status | |
| `surface/down` | `--sherpa-surface-down` | Status | |
| `surface/hover` | `--sherpa-surface-hover` | Status | |
| `surface/subtle/default` | `--sherpa-surface-subtle-default` | Status | |
| `surface/subtle/down` | `--sherpa-surface-subtle-down` | Status | |
| `surface/subtle/hover` | `--sherpa-surface-subtle-hover` | Status | |
| `text/active` | `--sherpa-text-active` | Status | |
| `text/control/primary` | `--sherpa-text-control-primary` | Status | |
| `text/control/secondary` | `--sherpa-text-control-secondary` | Status | |
| `text/control/tertiary` | `--sherpa-text-control-tertiary` | Status | |
| `text/control/tertiary-on-color` | `--sherpa-text-control-tertiary-on-color` | Status | |
| `text/default` | `--sherpa-text-default` | Status | |
| `text/link` | `--sherpa-text-link` | Status | |
| `text/on-color` | `--sherpa-text-on-color` | Status | |


---

## 2. Missing from CSS — Medium Priority

Non-colour primitives, density, or layout tokens in Figma with no CSS equivalent.

| Figma path | Expected CSS token | Collection | Response |
|---|---|---|---|
| `Background/Neutral/Tertiary` | `--sherpa-background-neutral-tertiary` | Theme | |
| `Background/Warning/Tertiary` | `--sherpa-background-warning-tertiary` | Theme | |
| `Black/100` | `--sherpa-black-100` | Color Primitives | |
| `Black/200` | `--sherpa-black-200` | Color Primitives | |
| `Border/Neutral/Default` | `--sherpa-border-neutral-default` | Theme | |
| `Border/Neutral/tertiary` | `--sherpa-border-neutral-tertiary` | Theme | |
| `Border/Warning/Default` | `--sherpa-border-warning-default` | Theme | |
| `Color 1` | `--sherpa-color-1` | Categorical Palette | |
| `Color 2` | `--sherpa-color-2` | Categorical Palette | |
| `Color 3` | `--sherpa-color-3` | Categorical Palette | |
| `color/text/inverse` | `--sherpa-color-text-inverse` | Apex Tokens | |
| `Depth/0` | `--sherpa-depth-0` | Size | |
| `Depth/100` | `--sherpa-depth-100` | Size | |
| `Depth/Negative 025` | `--sherpa-depth-negative-025` | Size | |
| `device` | `--sherpa-device` | Layout | |
| `device-width` | `--sherpa-device-width` | Layout | |
| `font/body/large/line-height` | `--sherpa-font-body-large-line-height` | 4. Screen Size | |
| `font/body/large/size` | `--sherpa-font-body-large-size` | 4. Screen Size | |
| `font/body/medium/line-height` | `--sherpa-font-body-medium-line-height` | 4. Screen Size | |
| `font/body/medium/size` | `--sherpa-font-body-medium-size` | 4. Screen Size | |
| `font/body/small/line-height` | `--sherpa-font-body-small-line-height` | 4. Screen Size | |
| `font/body/small/size` | `--sherpa-font-body-small-size` | 4. Screen Size | |
| `font/body/x-small/line-height` | `--sherpa-font-body-x-small-line-height` | 4. Screen Size | |
| `font/body/x-small/size` | `--sherpa-font-body-x-small-size` | 4. Screen Size | |
| `font/brand/small/letter-spacing` | `--sherpa-font-brand-small-letter-spacing` | 4. Screen Size | |
| `font/brand/small/line-height` | `--sherpa-font-brand-small-line-height` | 4. Screen Size | |
| `font/heading/h1/letter-spacing` | `--sherpa-font-heading-h1-letter-spacing` | 4. Screen Size | |
| `font/heading/h1/line-height` | `--sherpa-font-heading-h1-line-height` | 4. Screen Size | |
| `font/heading/h2/letter-spacing` | `--sherpa-font-heading-h2-letter-spacing` | 4. Screen Size | |
| `font/heading/h2/line-height` | `--sherpa-font-heading-h2-line-height` | 4. Screen Size | |
| `font/heading/h2/size` | `--sherpa-font-heading-h2-size` | 4. Screen Size | |
| `font/heading/h3/letter-spacing` | `--sherpa-font-heading-h3-letter-spacing` | 4. Screen Size | |
| `font/heading/h3/line-height` | `--sherpa-font-heading-h3-line-height` | 4. Screen Size | |
| `font/heading/h3/size` | `--sherpa-font-heading-h3-size` | 4. Screen Size | |
| `font/heading/h4/letter-spacing` | `--sherpa-font-heading-h4-letter-spacing` | 4. Screen Size | |
| `font/heading/h4/line-height` | `--sherpa-font-heading-h4-line-height` | 4. Screen Size | |
| `font/heading/h4/size` | `--sherpa-font-heading-h4-size` | 4. Screen Size | |
| `font/heading/h5/letter-spacing` | `--sherpa-font-heading-h5-letter-spacing` | 4. Screen Size | |
| `font/heading/h5/line-height` | `--sherpa-font-heading-h5-line-height` | 4. Screen Size | |
| `font/heading/h5/size` | `--sherpa-font-heading-h5-size` | 4. Screen Size | |
| `fonts/open sans/weight/200` | `--sherpa-fonts-open-sans-weight-200` | 1. Core | |
| `fonts/open sans/weight/400` | `--sherpa-fonts-open-sans-weight-400` | 1. Core | |
| `height/x-small` | `--sherpa-height-x-small` | Buttons | |
| `Icon/Neutral/On Neutral Secondary` | `--sherpa-icon-neutral-on-neutral-secondary` | Theme | |
| `Icon/Small` | `--sherpa-icon-small` | Size | |
| `layout/icon-size` | `--sherpa-layout-icon-size` | DEPRECATED - Buttons | |
| `nav-width` | `--sherpa-nav-width` | Layout | |
| `Radius/400` | `--sherpa-radius-400` | Size | |
| `Radius/Full` | `--sherpa-radius-full` | Size | |
| `radius/none` | `--sherpa-radius-none` | border | |
| `shadow/blur/lg` | `--sherpa-shadow-blur-lg` | 3. Mode | |
| `shadow/blur/md` | `--sherpa-shadow-blur-md` | 3. Mode | |
| `shadow/blur/sm` | `--sherpa-shadow-blur-sm` | 3. Mode | |
| `shadow/offset/x/lg` | `--sherpa-shadow-offset-x-lg` | 3. Mode | |
| `shadow/offset/x/md` | `--sherpa-shadow-offset-x-md` | 3. Mode | |
| `shadow/offset/x/sm` | `--sherpa-shadow-offset-x-sm` | 3. Mode | |
| `shadow/offset/y/lg` | `--sherpa-shadow-offset-y-lg` | 3. Mode | |
| `shadow/offset/y/md` | `--sherpa-shadow-offset-y-md` | 3. Mode | |
| `shadow/offset/y/sm` | `--sherpa-shadow-offset-y-sm` | 3. Mode | |
| `shadow/spread/lg` | `--sherpa-shadow-spread-lg` | 3. Mode | |
| `shadow/spread/md` | `--sherpa-shadow-spread-md` | 3. Mode | |
| `shadow/spread/sm` | `--sherpa-shadow-spread-sm` | 3. Mode | |
| `size` | `--sherpa-size` | avatar | |
| `size/x-small` | `--sherpa-size-x-small` | icon | |
| `Space/300` | `--sherpa-space-300` | Size | |
| `Space/400` | `--sherpa-space-400` | Size | |
| `stroke/blue` | `--sherpa-stroke-blue` | Tag | |
| `stroke/pink` | `--sherpa-stroke-pink` | Tag | |
| `stroke/violet` | `--sherpa-stroke-violet` | Tag | |
| `TimePeriod` | `--sherpa-timeperiod` | Date Picker | |
| `type/data-lg/line-height` | `--sherpa-type-data-lg-line-height` | Layout | |
| `type/data-lg/size` | `--sherpa-type-data-lg-size` | Layout | |
| `type/data-xl/line-height` | `--sherpa-type-data-xl-line-height` | Layout | |
| `type/data-xl/size` | `--sherpa-type-data-xl-size` | Layout | |
| `type/hero-1/line-height` | `--sherpa-type-hero-1-line-height` | Layout | |
| `type/hero-1/size` | `--sherpa-type-hero-1-size` | Layout | |
| `type/hero-2/line-height` | `--sherpa-type-hero-2-line-height` | Layout | |
| `type/hero-2/size` | `--sherpa-type-hero-2-size` | Layout | |
| `type/hero-3/line-height` | `--sherpa-type-hero-3-line-height` | Layout | |
| `type/hero-3/size` | `--sherpa-type-hero-3-size` | Layout | |
| `type/hero-4/line-height` | `--sherpa-type-hero-4-line-height` | Layout | |
| `type/hero-4/size` | `--sherpa-type-hero-4-size` | Layout | |
| `type/hero-5/line-height` | `--sherpa-type-hero-5-line-height` | Layout | |
| `type/hero-5/size` | `--sherpa-type-hero-5-size` | Layout | |
| `typography/heading/weight/light` | `--sherpa-typography-heading-weight-light` | Apex Tokens | |


---

## 3. Missing from CSS — Low Priority

Colour primitive stops in Figma with no CSS equivalent.

_None_

---

## 4. In CSS but not in Figma

CSS tokens with no matching Figma source (stale, hand-authored, or renamed).
Hand-authored platform tokens (font-weight, z-index, breakpoints, etc.) are excluded.

| CSS token | Source file | Response |
|---|---|---|
| `--sherpa-border-context-brand-default` | `css/styles/sherpa-brand-status.css` | |
| `--sherpa-surface-context-info-subtle-default` | `css/styles/sherpa-overrides.css` | |
| `--sherpa-surface-context-warning-subtle-default` | `css/styles/sherpa-overrides.css` | |
| `--sherpa-surface-context-error-subtle-default` | `css/styles/sherpa-overrides.css` | |
| `--sherpa-surface-context-success-subtle-default` | `css/styles/sherpa-overrides.css` | |
| `--sherpa-surface-context-default-subtle-default` | `css/styles/sherpa-overrides.css` | |
| `--sherpa-surface-context-success-subtle-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-success-subtle-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-success-strong-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-success-strong-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-success-strong-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-info-subtle-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-info-subtle-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-info-strong-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-info-strong-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-info-strong-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-default-subtle-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-default-subtle-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-default-strong-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-default-strong-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-default-strong-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-urgent-subtle-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-error-subtle-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-error-subtle-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-error-strong-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-error-strong-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-error-strong-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-warning-subtle-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-warning-subtle-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-warning-strong-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-warning-strong-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-warning-strong-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-urgent-subtle-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-urgent-subtle-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-urgent-strong-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-urgent-strong-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-surface-context-urgent-strong-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-info-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-info-on-color` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-info-on-color-subtle` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-success-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-success-on-color` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-success-on-color-subtle` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-warning-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-warning-on-color` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-warning-on-color-subtle` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-urgent-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-urgent-on-color` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-urgent-on-color-subtle` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-error-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-error-on-color` | `css/styles/sherpa-themes.css` | |
| `--sherpa-content-context-error-on-color-subtle` | `css/styles/sherpa-themes.css` | |
| `--sherpa-border-context-default-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-border-context-default-hover` | `css/styles/sherpa-themes.css` | |
| `--sherpa-border-context-default-down` | `css/styles/sherpa-themes.css` | |
| `--sherpa-border-context-info-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-border-context-success-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-border-context-warning-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-border-context-urgent-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-border-context-error-default` | `css/styles/sherpa-themes.css` | |
| `--sherpa-elevation-tint-error` | `css/styles/sherpa-themes.css` | |


---

## 5. Priority Summary

| Priority | Count | Action |
|---|---|---|
| **High** | 192 | Run `npm run tokens:extract && npm run tokens:generate` once Figma has the token |
| **Medium** | 85 | Add to relevant CSS layer or wait for Figma update |
| **Low** | 0 | Add missing colour stops to Figma Primitives |
| **Extra (non-palette)** | 61 | Review for removal or document as intentional |
