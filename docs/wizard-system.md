# Wizard System Guide

## Goal

Use shared wizard primitives for consistent modal behavior, step framing, and draft-list flows.
Wizard shells should follow the offerings page as the baseline: neutral surfaces, full-width
header strip, shared footer actions, and no broader redesign of the dashboard shell.

## Shared Components

- `ModalShell`: generic modal backdrop/panel wrapper.
- `ModalHeader`: shared title row and title-aligned close X for both modals and wizards.
- `WizardModal`: standard wizard frame (header, progress, form shell).
- `WizardStepFooter`: shared Back/Next/Submit footer.
- `WizardUnsavedConfirm`: unsaved changes confirmation built on `ModalShell`.
- `WizardDraftCollection`: shared list UI for draft entities.
- `InfoPopover`: reusable info/help popover trigger for paragraph-heavy helper text.
- `ToggleField`: shared toggle field with its label above a standard-height bordered control and live state text beside the switch. Use `onLabel`/`offLabel` for states such as Active/Inactive, or `statusText` for a computed state. Supports `bind:checked`, native `onchange`, and existing `on:change` callbacks. Keep descriptions below the control, not inside its height.
- `DayOfWeekButtonGroup`: reusable bordered weekday selector for one-or-more day scheduling fields.
- Compact icon-only wizard actions should reuse shared helpers such as `dashboard-icon-button`
  where they already fit the UI pattern.

## Default Modal Behavior

- `Escape` closes the topmost open modal via shared `ModalShell` behavior, even before any field is focused.
- Wizard close behavior still routes through each wizard's existing `requestClose` handler, so unsaved-change confirmation remains intact.
- Nested controls get first chance to handle keyboard events. Escape closes an open dropdown or date picker before closing its modal.
- `ModalShell` exposes a labeled dialog, keeps Tab/Shift+Tab inside the topmost dialog, and restores focus to the opening control on close. Pass `ariaLabel` when the close label does not describe the dialog.
- Discard confirmations use the same shell, including scroll locking, keyboard handling, and the top-right close button. Closing a confirmation returns to editing rather than discarding.
- `WizardStepFooter` disables Back, Next, and Submit while `isSubmitting` is true to prevent repeated actions during a pending request.
- `ModalShell` renders the top-right `X` by default for direct modal consumers; use that shared close affordance instead of hand-rolling a second header close button.
- `WizardModal` keeps its own header-integrated `X` and disables the `ModalShell` default internally, so wizard callers do not need to manage close-button duplication.
- `WizardModal` auto-focuses the first visible, enabled input, select, textarea, dropdown trigger, or editable field when opened and when step content changes. Unavailable preferred fields are skipped.
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

## Ownership And Overrides

- Supply `title` to `ModalShell` for the inherited header and close button. `WizardModal` uses the same `ModalHeader` with step metadata below the title row.
- Panel borders, backgrounds, viewport limits, title typography, padding, and action spacing belong to the `modal-*` classes in `app.css`. `panelClass` should contain only width/layout exceptions. Use `tone="danger"` for destructive dialogs, not copied border/background classes.
- `WizardModal` owns a non-scrolling form with a scrolling `modal-body` and a fixed `modal-footer`. `formClass` customizes the body, not the outer form. Always use the `footer` snippet for actions.
- Direct modals use `modal-form`, `modal-body`, `modal-footer`, and `modal-actions` instead of locally copying padding/border/scroll styles.
- Enter follows the shared Next button on intermediate steps. Disabled Next/Submit actions also block keyboard form submission; route handlers still own validation and server-side authorization.
- Form selectors with no custom trigger classes automatically inherit `ListboxDropdown` field styling inside `ModalShell`. `variant="field"` explicitly selects it elsewhere; `variant="button"` preserves button appearance. Fields inherit the same `select-secondary` CSS as ordinary selects, including focus and disabled states. Custom/action triggers remain supported.
- Use existing shared SearchInput, date picker, weekday selector, ToggleField, InfoPopover, and HoverTooltip for inner elements. Add reusable variants at their source instead of recreating them inside a wizard.
- Composer dialogs deliberately remain anchored inside the editor to preserve text selection. They reuse shared panel/header styling, while the command palette keeps its search-specific layout and keyboard model.
- When a global UX change is requested, update the shared owner first and check consumers for overrides. A one-time migration removes existing copies; subsequent changes should propagate without route edits.

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

## Stable Field Validation

Hide a field's error while its input is focused, and validate its completed value on blur. Shared DatePicker and TimeInput own this editing state; app.css also suppresses legacy labeled field messages while editing without collapsing their reserved space. Keep validation on Next/Save and on the server as a safety net. Date/time keyboard entry must preserve segment selections: completing two digits advances to the next segment, invalid date pairs restart only that segment, and a selected meridiem completes from A or P.

Modal fields reserve a 16px validation line plus a 2px gap through `src/app.css`, independently of whether an error exists. Standard labeled inputs and selectors inherit this behavior; use `class="modal-field"` for custom field wrappers. Render errors with `FieldError.svelte`, which keeps the full message available to assistive technology and in its title when a long line is visually truncated. DatePicker and TimeInput own their parsing messages, so consumers must not duplicate them below a combined date/time row. Error messages must never change input geometry or move adjacent fields.
