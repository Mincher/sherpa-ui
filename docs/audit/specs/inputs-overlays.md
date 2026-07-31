# Figma specs — Inputs (Batch 3) + Overlays (Batch 4)

## Input Field (`Input Field` / `Input Area` / `Input Field (minimal)`)
States: **Default / Validation / Inactive / Read-only**.
(Field validation page separately covers error/warning/success validation treatments.)
Input body: min-height ~32px, border container-default #d5d5dc, inactive #f2f2f2, readonly #fafafa.
Label: text-emphasis 14px/600. → maps to input-text/number/password/search/select/tag family + input-base.

## Date & Time (`.date` / `.month` / `.year-range`)
- `.date` states: Inactive, Default, Hover, **Selected**, Day-Disabled, **Today**, Focus.
- `.month` states: Disabled, Default, Hover, Selected, Current-Month.
- `.year-range` states: Disabled, Default, Hover, Selected, Current-Year.
→ maps to sherpa-calendar / input-date / input-date-range / input-time.

## Dialog — ThemeBlock Light/Auto (mode handling). Simple structure: header/body/footer slots.

## Menu (`Menu Item` / `Menu Section`)
Menu Item states: **Default / Hover / Active / Modified / Destructive / Destructive-Hover / Inactive**.
Menu Section: heading + items. → maps to sherpa-container-overlay (menu variant) + sherpa-overlay-item.

## Popover / Tooltip — minimal (few variants). Overlay = popover/menu variants (already audited via QFT work).
