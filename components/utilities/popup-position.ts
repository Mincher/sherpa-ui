/**
 * popup-position.ts — viewport-aware flip positioning for picker popups.
 *
 * Measures the trigger's rect and places the popup below it, flipping above
 * when there isn't room below, and clamps the left edge inside the viewport.
 * Writes `top`/`left` inline styles on the popup (fixed/absolute positioned).
 *
 * Extracted from sherpa-input-date / -time / -date-range, which each had a
 * verbatim `#positionPopup()` differing only in the size fallbacks.
 *
 *   positionPopup(popupEl, triggerEl, { estHeight: 320, estWidth: 280 });
 */

export interface PositionPopupOptions {
  /** Fallback popup height (px) used before layout, when offsetHeight is 0. */
  estHeight?: number;
  /** Fallback popup width (px) used before layout, when offsetWidth is 0. */
  estWidth?: number;
  /** Gap between trigger and popup (px). */
  gap?: number;
}

/** Flip-position `popup` relative to `trigger`, clamped to the viewport. */
export function positionPopup(
  popup: HTMLElement | null,
  trigger: HTMLElement | null,
  { estHeight = 320, estWidth = 280, gap = 4 }: PositionPopupOptions = {},
): void {
  if (!popup || !trigger) return;
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const popupH = popup.offsetHeight || estHeight;
  if (spaceBelow < popupH + gap && rect.top > popupH + gap) {
    popup.style.top = `${rect.top - popupH - gap}px`;
  } else {
    popup.style.top = `${rect.bottom + gap}px`;
  }
  popup.style.left = `${Math.min(rect.left, window.innerWidth - (popup.offsetWidth || estWidth) - 8)}px`;
}
