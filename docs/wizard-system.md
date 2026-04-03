# Wizard System Guide

## Goal

Use shared wizard primitives for consistent modal behavior, step framing, and draft-list flows.
Wizard shells should follow the offerings page as the baseline: neutral surfaces, full-width
header strip, shared footer actions, and no broader redesign of the dashboard shell.

## Shared Components

- `ModalShell`: generic modal backdrop/panel wrapper.
- `WizardModal`: standard wizard frame (header, progress, form shell).
- `WizardStepFooter`: shared Back/Next/Submit footer.
- `WizardUnsavedConfirm`: custom unsaved changes confirm modal.
- `WizardDraftCollection`: shared list UI for draft entities.
- `InfoPopover`: reusable info/help popover trigger for paragraph-heavy helper text.
- `ToggleField`: reusable bordered toggle row for wizard checkbox/switch fields with label content.
- `DayOfWeekButtonGroup`: reusable bordered weekday selector for one-or-more day scheduling fields.
- Compact icon-only wizard actions should reuse shared helpers such as `dashboard-icon-button`
  where they already fit the UI pattern.

## Default Modal Behavior

- `Escape` closes the topmost open modal via shared `ModalShell` behavior, even before any field is focused.
- Wizard close behavior still routes through each wizard's existing `requestClose` handler, so unsaved-change confirmation remains intact.
- `ModalShell` renders the top-right `X` by default for direct modal consumers; use that shared close affordance instead of hand-rolling a second header close button.
- `WizardModal` keeps its own header-integrated `X` and disables the `ModalShell` default internally, so wizard callers do not need to manage close-button duplication.
- `WizardModal` auto-focuses the first enabled `input`, `select`, or `textarea` when opened and when step content changes.
- To override initial focus for a specific field, add `data-wizard-autofocus` to that element.
- `InfoPopover` helper panels close on `Escape`, outside click, and trigger re-click (toggle behavior).
- `WizardModal` and `ModalShell` should stay neutral and offerings-style rather than page-specific
  or heavily branded.
- Wizard headers use a full-width strip style that matches the offerings page shell; keep the
  header, progress area, and footer visually consistent across routes.
- `WizardModal` is draggable by grabbing the header area; drag state is temporary for that open modal instance and resets on close.
- Dragging is viewport-bounded so no part of the wizard panel can be moved off-screen.
- `WizardModal` and `ModalShell` panels stay capped to the viewport with `max-height` so the frame never grows beyond the available screen height.
- `WizardModal` form content uses the thin scrollbar treatment by default when vertical scrolling is needed.
- Do not change wizard scrollbar treatment as part of the UI consistency cleanup; keep the current thin treatment unchanged.
- `WizardUnsavedConfirm` centers to the active wizard panel (not the viewport) and still uses a full-viewport scrim.
- Save-only wizards and modal forms should enable the shared `Ctrl/Cmd+S` shortcut through `saveShortcutEnabled` on `WizardModal` or `ModalShell`.
- Only enable that shortcut for save/edit flows; do not enable it for create, delete, archive, or other non-save actions.
- If the only footer action would be a pure dismiss control such as `Close` or `Done`, omit that footer action and rely on the top-right `X` as the single close affordance.

## Shared Utilities

- `slug-utils.ts`: `slugifyFinal`, `slugifyLiveWithCursor`, `applyLiveSlugInput`.
- `wizard-dirty-state.ts`: capture an open-time baseline and compare against real data changes for unsaved-close prompts.
- `wizard-field-errors.ts`: `pickFieldErrors`, `toServerFieldErrorMap`, `isRequiredFieldMessage`.
- `create-draft-collection-controller.ts`: reusable draft list operations.

## Recommended Wizard Pattern

1. Keep route data wiring in `+page.svelte`.
2. Move wizard state and handlers into route-local `_wizards/*.svelte` components.
3. Use `WizardModal` + `WizardStepFooter` for shell consistency.
4. Use `WizardDraftCollection` for add/edit/copy/reorder/remove list steps.
5. Use `WizardUnsavedConfirm` for unsaved-close behavior.
6. Keep the shell neutral and offerings-aligned unless a route has a documented exception.
7. Capture wizard dirty baselines after any open-time prefill/defaulting so unchanged seeded data does not trigger an unsaved confirmation.

## Step Layout Rule

- Prevent wizard step content from exceeding modal height whenever possible.
- Prefer adding another wizard step/panel over introducing more in-panel scrolling.
- If a step becomes dense (multiple decision blocks), split it into sequential steps.
- When a dense step still needs lists, previews, or tables, keep the overall wizard form `overflow-hidden` and make the inner panels or sections the scroll containers with `min-h-0` plus `overflow-y-auto`.
- Avoid making the entire modal or wizard form the primary scroll container for split-panel layouts; keep the header and footer anchored while the overflowing section scrolls inside the viewport-capped panel.
- Keep the shell consistent with the offerings page instead of inventing a separate wizard visual system.

## Scannability and Action UX

- Prioritize quick scanning over long explanatory paragraphs.
- Put the primary decision or required action at the top of each step.
- Use short section labels such as `Action Required`, `Optional`, `Current`, `Outcome`, or `Preview`.
- Prefer selectable cards/rows for major choices instead of plain stacked radio text.
- Keep helper copy concise; move detailed explanations to an `(i)` info affordance (`details/summary` or tooltip/popover).
- Do not duplicate supplemental helper copy inline when the same guidance already lives in an `InfoPopover`.
- Do not add helper banners or extra explanatory paragraphs by default when a label-level `InfoPopover` can carry that non-critical guidance.
- Keep inline helper text only when it is state-specific, blocking, or otherwise action-critical in the current step.
- Summarize context with compact stat/summary blocks when possible (counts, status, source, result).
- Keep each step focused on one job; if users must make multiple major decisions, split into more steps.
- Preserve clear affordances for what happens next (e.g., `Next`, `Review`, `Create`) and what each choice changes.

## Migration Checklist

- Replace inline modal overlay markup with `WizardModal`.
- Replace native `window.confirm` unsaved close prompts with `WizardUnsavedConfirm`.
- Extract duplicated slug/error helpers to shared utilities.
- Reuse draft controller helpers for list-state updates where practical.
- Validate with `pnpm check` and manual step-flow QA.
