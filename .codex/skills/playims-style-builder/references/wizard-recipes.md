# Wizard Recipes

## Contents

1. Required primitives
2. Wizard frame recipe
3. Step composition recipe
4. Step footer standards
5. Draft list step standards
6. Review step standards
7. Unsaved changes confirm pattern
8. Destructive modal pattern

## Required Primitives

Use shared components before custom wizard markup:

- `WizardModal`
- `WizardStepFooter`
- `WizardDraftCollection`
- `WizardUnsavedConfirm`
- `ModalShell` (for non-step destructive dialogs)

Architecture baseline:

- Keep data wiring and API actions in route `+page.svelte`.
- Keep wizard UI in route-local `_wizards/*.svelte` components.
- Use runes/snippet pattern (`$state`, `$derived`, `{#snippet ...}`, `{@render ...}`).

## Wizard Frame Recipe

`WizardModal` establishes this frame:

- Panel: `w-full max-w-* border-4 border-secondary bg-neutral-400 overflow-hidden flex flex-col`
- Header: `p-4 border-b border-secondary space-y-3`
- Progress bar shell: `border border-neutral-950 bg-white h-3`
- Form shell default: `p-4 space-y-5 flex-1 min-h-0 overflow-y-auto`

Behavior expectations:

- Escape routes through modal close flow.
- First focus lands on `data-wizard-autofocus` field if present.
- Header drag behavior is supported through `ModalShell`.

## Step Composition Recipe

Standard step layout:

- Root: `space-y-4`
- Field grids: `grid grid-cols-1 lg:grid-cols-2 gap-4`
- Section block: `border-2 border-neutral-950 bg-white p-4 space-y-4`
- Nested helper/informational block: `border border-neutral-950 bg-white p-3`

Required patterns:

- Place critical instruction copy inline and visible.
- Use `InfoPopover` only for supplemental explanatory text.
- Use clear section labels (`Optional`, `Action Required`, `Review`, `Current`).

## Step Footer Standards

Use `WizardStepFooter` pattern:

- Container: `pt-2 border-t border-neutral-950 flex justify-end`
- Secondary/back: `button-secondary-outlined cursor-pointer`
- Next/submit: `button-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`

Rules:

- Validate current step before allowing next.
- Keep CTA text explicit (`Next`, `Review`, `Create`, `Save`).

## Draft List Step Standards

Use `WizardDraftCollection` for add/edit/copy/move/remove flows.

Defaults:

- Container: `border border-neutral-950 bg-white p-3 space-y-3`
- List: scrollable max-height with secondary scrollbar tokens.
- Item row: `border border-neutral-950 bg-neutral p-3 space-y-2`
- Item action icons: `button-secondary-outlined p-1.5 cursor-pointer` inside `HoverTooltip`.

When overriding list height, keep scrollbar style and vertical rhythm.

## Review Step Standards

Recommended review structure:

- Summary wrapper: `border border-neutral-950 bg-white p-3 text-sm text-neutral-950`
- Dense metadata grid: `grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-950`
- Use short label/value spans with `font-semibold` labels.

Keep review steps scannable; split into additional steps if content becomes dense.

## Unsaved Changes Confirm Pattern

Use `WizardUnsavedConfirm`, not `window.confirm`.

Visual pattern:

- Scrim: `fixed ... bg-black/55`
- Panel: `max-w-xl bg-neutral-400 border-4 border-secondary`
- Header/title area: `p-5 border-b border-secondary`
- Action row: right-aligned secondary cancel + outlined danger confirm

Behavior pattern:

- Backdrop click cancels safely.
- Escape closes the confirm first (capture listener).
- Confirm action uses explicit button text tied to data loss intent.

## Destructive Modal Pattern

For delete/leave/archive operations:

- Always use a custom modal implementation (`ModalShell`-based danger modal or shared wizard confirm component).
- Never use browser-native dialogs (`window.confirm`, `confirm()`).
- Use `ModalShell` with error-themed panel:
  - `border-4 border-error-700 bg-error-25`
- Include impact summary block:
  - `border-2 border-error-300 bg-error-50 p-3`
- Require typed confirmation against normalized slug/value.
- Show required typed token in a code-like chip.
- Disable destructive action until confirmation criteria pass.
- Footer actions:
  - Cancel: `button-secondary-outlined`
  - Destructive: `button-error ... disabled:opacity-60`

Do not use single-click irreversible actions for broad data-loss operations.
