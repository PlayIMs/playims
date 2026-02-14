# Wizard System Guide

## Goal
Use shared wizard primitives for consistent modal behavior, step framing, and draft-list flows.

## Shared Components
- `ModalShell`: generic modal backdrop/panel wrapper.
- `WizardModal`: standard wizard frame (header, progress, form shell).
- `WizardStepFooter`: shared Back/Next/Submit footer.
- `WizardUnsavedConfirm`: custom unsaved changes confirm modal.
- `WizardDraftCollection`: shared list UI for draft entities.

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

## Migration Checklist
- Replace inline modal overlay markup with `WizardModal`.
- Replace native `window.confirm` unsaved close prompts with `WizardUnsavedConfirm`.
- Extract duplicated slug/error helpers to shared utilities.
- Reuse draft controller helpers for list-state updates where practical.
- Validate with `pnpm check` and manual step-flow QA.
