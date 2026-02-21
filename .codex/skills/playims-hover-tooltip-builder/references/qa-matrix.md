# HoverTooltip QA Matrix

Use this checklist after adding or refactoring any `HoverTooltip` usage.

## Pointer Behavior
- Hovering the trigger opens the tooltip.
- Moving the cursor while still hovering the trigger moves the tooltip with the cursor.
- Leaving the trigger closes the tooltip.
- Tooltip appears to the lower-right of cursor when space allows.

## Viewport Constraints
- Near right edge: tooltip flips left and remains fully visible.
- Near bottom edge: tooltip flips above and remains fully visible.
- Near corners: tooltip remains fully visible (no cutoff).
- Tooltip width remains readable (minimum width applied) without causing viewport overflow.

## Focus + Accessibility
- Keyboard focus on the trigger opens tooltip.
- Focus leaving the trigger closes tooltip.
- Trigger still has meaningful `aria-label` or visible text.

## Layout Safety
- Tooltip does not alter ancestor width, height, or scrollability.
- In modal/wizard contexts, tooltip may extend beyond modal bounds but stays within viewport.
- Tooltip z-index is sufficient above surrounding controls.

## Content Quality
- Text is concise and action-specific.
- Long text uses sensible max width (`maxWidthClass`) and remains readable.
