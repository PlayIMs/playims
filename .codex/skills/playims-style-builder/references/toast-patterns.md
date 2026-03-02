# Toast Patterns

## Contents

1. When to use toasts
2. Titles and variants
3. Actions
4. What stays inline

## When To Use Toasts

Use the shared PlayIMs toast system for transient feedback that previously lived in page or wizard banners:

- submit success
- async failure
- role/mode switch failures
- save/reorder confirmations
- retry/restore prompts tied to a failed action
- success confirmation
- error confirmation
- warning confirmation

Prefer toasts over banners for these cases because they do not shift the layout around.
Do not use toasts for input validation; keep that feedback at the field level.

Default files:

- `src/lib/toasts.ts`
- `src/lib/components/toast/Toaster.svelte`
- `src/lib/components/toast/ToastItem.svelte`

## Titles And Variants

- Success: use `toast.success(..., { title: 'Page or workflow name' })`
- Error: use `toast.error(..., { title: 'Page or workflow name' })`
- Warning: use `toast.warning` for non-destructive caution that should still disappear
- Info: keep the toast in the same visual family as the other variants, but use the neutral theme family instead of a primary/secondary accent blend
- Persistent page failure: set `duration: null` and `showProgress: false`

Project defaults:

- Desktop placement: `bottom-left`
- Mobile placement: `top`
- Default duration: `4800`
- Errors: persistent by default
- Progress bar: on by default for toasts with a duration
- Live region: polite by default
- Ignore duplicate stack: `false`
- Dismissible: `true`
- Actions: none by default unless the user explicitly wants them or the existing UX requires recovery actions

Use stable toast ids when the same action can fire repeatedly.
Use dark semantic text shades inside tinted toast surfaces so copy stays readable without falling back to pure black.
Use the shared serif heading face for toast titles, and keep titles a touch lighter than the body copy within the same semantic color family.

## Actions

Toast actions are allowed when the old banner exposed immediate recovery:

- Restore archived record
- Retry save
- Open a follow-up destructive confirm flow

Keep action labels short and direct.
Toast action buttons should use toast-local styling rather than generic page buttons.
Toast action color should come from the active toast variant itself, with only `solid` and `outline` styles exposed per action.
Prefer `solid` for the safe or forward-moving action.
Prefer `outline` for the unsafe, back, cancel, or dismissive action.

## What Stays Inline

Do not replace these with toasts:

- field-level validation text
- destructive impact copy inside confirmation modals
- review-step summaries the user needs to compare while editing
