# InfoPopover QA Matrix

Use this checklist after adding or refactoring any `InfoPopover` usage.

## Trigger + Toggle
- Clicking the trigger opens the popover.
- Clicking the trigger again closes the popover.
- The trigger remains visible and correctly aligned in its row/container.

## Close Behavior
- Clicking outside the popover closes it.
- Clicking inside popover content does not close it immediately.
- Pressing `Escape` closes the popover.
- In modal/wizard contexts, `Escape` closes the popover first before higher-level modal-close behavior.

## Accessibility + Semantics
- Trigger has a context-specific `buttonAriaLabel`.
- Trigger exposes `aria-haspopup="dialog"` and valid `aria-expanded` transitions.
- Helper content remains supplemental; critical required instructions stay visible outside the popover.

## Layout + Visual Consistency
- Trigger styling matches `InfoPopover` defaults unless a documented layout reason requires overrides.
- Panel width (`panelWidthClass`) is appropriate for copy length and responsive layout.
- Panel alignment (`align`) prevents clipping at viewport/container edges.
- Popover stacks correctly with nearby UI (`z-10` context is sufficient).
- Popover remains within viewport edges even inside modal/wizard contexts.
- Positioning behavior stays aligned with shared `floating-position.ts` logic (no one-off overrides).

## Content Quality
- Copy is concise and scannable (short paragraphs, no dense walls of text).
- If multiple points are needed, content uses clear paragraph/group spacing (`space-y-*`).
- No interactive controls (inputs, selects, submit actions) are placed inside helper popovers.
