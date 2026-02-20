# Wizard System Guide

## Goal

Use shared wizard primitives for consistent modal behavior, step framing, and draft-list flows.

## Shared Components

- `ModalShell`: generic modal backdrop/panel wrapper.
- `WizardModal`: standard wizard frame (header, progress, form shell).
- `WizardStepFooter`: shared Back/Next/Submit footer.
- `WizardUnsavedConfirm`: custom unsaved changes confirm modal.
- `WizardDraftCollection`: shared list UI for draft entities.
- `InfoPopover`: reusable info/help popover trigger for paragraph-heavy helper text.

## Default Modal Behavior

- `Escape` closes the topmost open modal via shared `ModalShell` behavior, even before any field is focused.
- Wizard close behavior still routes through each wizard's existing `requestClose` handler, so unsaved-change confirmation remains intact.
- `WizardModal` auto-focuses the first enabled `input`, `select`, or `textarea` when opened and when step content changes.
- To override initial focus for a specific field, add `data-wizard-autofocus` to that element.
- `InfoPopover` helper panels close on `Escape`, outside click, and trigger re-click (toggle behavior).
- `WizardModal` is draggable by grabbing the header area; drag state is temporary for that open modal instance and resets on close.
- Dragging is viewport-bounded so no part of the wizard panel can be moved off-screen.
- `WizardUnsavedConfirm` centers to the active wizard panel (not the viewport) and still uses a full-viewport scrim.

## Shared Utilities

- `slug-utils.ts`: `slugifyFinal`, `slugifyLiveWithCursor`, `applyLiveSlugInput`.
- `wizard-field-errors.ts`: `pickFieldErrors`, `toServerFieldErrorMap`, `isRequiredFieldMessage`.
- `create-draft-collection-controller.ts`: reusable draft list operations.

## Recommended Wizard Pattern

1. Keep route data wiring in `+page.svelte`.
2. Move wizard state and handlers into route-local `_wizards/*.svelte` components.
3. Use `WizardModal` + `WizardStepFooter` for shell consistency.
4. Use `WizardDraftCollection` for add/edit/copy/reorder/remove list steps.
5. Use `WizardUnsavedConfirm` for unsaved-close behavior.

## Step Layout Rule

- Prevent wizard step content from exceeding modal height whenever possible.
- Prefer adding another wizard step/panel over introducing more in-panel scrolling.
- If a step becomes dense (multiple decision blocks), split it into sequential steps.

## Scannability and Action UX

- Prioritize quick scanning over long explanatory paragraphs.
- Put the primary decision or required action at the top of each step.
- Use short section labels such as `Action Required`, `Optional`, `Current`, `Outcome`, or `Preview`.
- Prefer selectable cards/rows for major choices instead of plain stacked radio text.
- Keep helper copy concise; move detailed explanations to an `(i)` info affordance (`details/summary` or tooltip/popover).
- Summarize context with compact stat/summary blocks when possible (counts, status, source, result).
- Keep each step focused on one job; if users must make multiple major decisions, split into more steps.
- Preserve clear affordances for what happens next (e.g., `Next`, `Review`, `Create`) and what each choice changes.

## Migration Checklist

- Replace inline modal overlay markup with `WizardModal`.
- Replace native `window.confirm` unsaved close prompts with `WizardUnsavedConfirm`.
- Extract duplicated slug/error helpers to shared utilities.
- Reuse draft controller helpers for list-state updates where practical.
- Validate with `pnpm check` and manual step-flow QA.
