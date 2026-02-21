# Wizard QA Matrix

Use this checklist after implementing or migrating a wizard.

## Core Modal Behavior
- Open wizard from trigger.
- Close via `X`.
- Close via backdrop.
- Close via `Escape`.
- Confirm body scroll lock while open and unlock on close.

## Unsaved-Changes Behavior
- Trigger close with unsaved changes.
- Verify `WizardUnsavedConfirm` appears.
- Cancel discard and verify wizard state remains intact.
- Confirm discard and verify wizard resets/closes.

## Step + Validation Behavior
- Verify step title, count, and progress bar.
- Verify back/next/submit buttons and labels by step.
- Verify client validation gating for next/submit.
- Verify server field errors map to correct fields/steps.

## Draft List Behavior (if applicable)
- Add draft item.
- Edit existing item.
- Copy item with unique name/slug behavior.
- Move item up/down and verify ordering.
- Remove item and verify editing index correction.

## Hover Tooltip Behavior (if applicable)
- Hovering action icons shows `HoverTooltip` text.
- Tooltip follows cursor while hover remains on trigger.
- Tooltip remains within viewport at screen edges.
- No native `title` attributes are relied on for wizard action hints.

## Submit Behavior
- Successful submit resets wizard and updates route state.
- Failed submit preserves input and shows field/form errors.

## Non-Wizard Dashboard Modals (if touched)
- Verify modal stack precedence if confirm modals are nested.
- Verify destructive confirm requirements (for example slug entry).
- Verify archive/restore/delete actions still submit correct forms/actions.
