# Figma specs — Foundation controls (Batch 2)

## Button (`Button` + `Button (Icon only)`)
Types: **primary, secondary, tertiary, tertiary-on-color** × States: **default, hover, down, active, inactive**.
Sizes (`-> button (size)`): base 32 / large 48 / small 24 / x-small 20 / 2x-small 16; padding 8/12/4/2/2; gap 4/8/4/2/2.

## Tabs (`-> tab (style)`: primary / secondary / product-bar)
| | primary | secondary | product-bar |
|--|--|--|--|
| height | 40 | 32 | — |
| content default | #404047 | #404047 | #18191a |
| content **selected** | **#8500cc** | #8500cc | #8500cc |
| text size/lh | 14/20 | 12/16 | — |
| icon default/selected | #404047/#18191a | (same) | — |
| fill default | #ffffff | #fdfdfd | transparent |
| border default | #d5d5d5 | #d5d5d5 | — |

## Tag (`-> tag (colors)`: 11 colors)
Each: border+solid-fill = same colour; content = dark #18191a (or #fafafa/#ffffff on dark bgs:
purple #7b1ce6→#fafafa, blue #4141ef→#fff, rose #d1105a→#fff); transparent-fill variant = colour@66α.
Colours: purple #7b1ce6, magenta #c046ff, cyan #2bd1c1, light-blue #16abe2, blue #4141ef,
violet #8197f1, orange #ffaa00, pink #f3699d, rose #d1105a, green #20c173, grey #b2b2bf.

## Switch (`-> switch`: default / simple)
| | default | simple |
|--|--|--|
| border/outer | 4 | 999 |
| control size | 16 | 12 |
| track off | #5c5c66 | #5c5c66 |
| track **on** | **#058142** (green) | #058142 |
| control fill | #ffffff | #ffffff |
| label | yes | no |
Variants: State(True/False) × Type(Active/Inactive).

## Checkbox / Radio
States: Default / Hover / Inactive. Variants: standard + **Minimal**. Radio also has **Radio Card**.

## Slider
Type: **Single / Dual** × State: Active / Inactive. Handle sub-control: Default/Hover/Active.
