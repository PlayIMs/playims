# Toast System

## Files

- `src/lib/toasts.ts`: shared store and API
- `src/lib/components/toast/Toaster.svelte`: global viewport
- `src/lib/components/toast/ToastItem.svelte`: single-toast rendering, timers, actions
- `src/routes/+layout.svelte`: global mount point

## API

Use:

- `toast.success(description, options?)`
- `toast.error(description, options?)`
- `toast.warning(description, options?)`
- `toast.info(description, options?)`
- `toast.loading(description, options?)`
- `toast.update(id, patch)`
- `toast.dismiss(id)`
- `toast.dismissAll()`
- `toast.promise(promise, copy)`

Duplicate behavior:

- A new toast with the same variant, title, description, and action labels/style set will refresh the existing toast instead of stacking a duplicate.
- For timed toasts, that duplicate refresh resets the timer to the new toast's configured duration.
- Suppressed duplicates should increment a visible count on the existing toast title, for example `Offering saved (3x)`.
- Set `ignoreDuplicateStack: true` when you intentionally want identical toasts to stack instead of collapsing into one counted toast.

Overflow behavior:

- Each placement keeps a limited visible stack and queues additional non-important toasts once that limit is full.
- The overflow notice should appear at the same edge where the next toast would insert for that placement.
- Important toasts bypass the queue and evict the oldest currently visible toast in that placement so the important toast is shown immediately.
- `Clear existing` should dismiss only visible toasts, while `Clear all toasts` should dismiss both visible and queued items.

Core options:

- `id`: stable identifier for dedupe/update behavior
- `placement`: one of the 9 desktop viewport positions; project default is `bottom-left`
- `mobilePlacement`: one of `top`, `middle`, or `bottom`; mobile toasts are always horizontally centered, and project default is `top`
- `title`: short context label such as `Account`, `Season wizard`, or `Module settings`
- `duration`: milliseconds or `null` for persistent toasts; project default is `4800`, except errors which should default to persistent
- `showProgress`: show by default for toasts with a duration; hide for persistent toasts
- `important`: escalates live-region behavior; default live-region posture is polite when not marked important
- `ignoreDuplicateStack`: bypass duplicate-collapse behavior for this toast instance; default is `false`
- `dismissible`: default is `true`
- `actions`: inline CTA buttons with `label`, `style`, and `onClick`; default is no actions unless the user or the existing UX specifically needs them
- `actions[].style`: `solid` or `outline`; action color should come from the toast variant rather than a per-action tone

Project usage defaults:

- Use toasts for transient success, error, and warning confirmation instead of page banners because toasts do not shift the layout.
- Do not use toasts for input validation; keep validation near the field.
- If a toast has multiple actions, prefer the safe or forward-moving action as `solid`.
- Prefer unsafe, back, cancel, or dismissive actions as `outline`.

## Visual Rules

- Keep the toast on a light tinted surface that matches the semantic variant color.
- Use a thin full border in the same color family instead of a thick edge or banner block.
- Use dark semantic text shades for title/body/close affordances on tinted surfaces; avoid neutral-950 or pure black text on colored toast backgrounds.
- Render toast titles in the shared Bitter serif face, with the title color slightly lighter than the body text but still variant-aware.
- Keep the existing PlayIMs icon chip treatment.
- Use a lifted drop shadow so the toast reads above the page content.
- When enabled, render the progress bar as an internal bottom strip in a related shade.
- Info toasts should stay in the neutral theme family, using a very dark neutral border with neutral-900/950 style text contrast on the light neutral surface.
- Bottom stacks should let new toasts appear at the bottom of the visible stack, with older toasts moving upward rather than newer toasts jumping to the top.
- Stack direction should follow placement intent: bottom stacks grow upward from below, top stacks grow downward from above, middle-left/right stacks insert at the top and push older toasts downward while entering from the side, and middle-center inserts in place while pushing older toasts downward.
- Use ease-out movement for toast entry and stack reflow so additions/removals feel deliberate without an ease-in ramp.
- Toast action buttons should visually belong to the toast itself. Use the toast's own variant color family for both `solid` and `outline` action styles instead of introducing per-action tones.
- Desktop and mobile placement are configured separately; mobile should stay limited to centered top/middle/bottom stacks.

## Usage Patterns

### Replace banner state

If old code did this:

```ts
saveError = 'Unable to save.'
```

Prefer this:

```ts
toast.error('Unable to save.', {
	id: 'module-save-error',
	title: 'Module settings'
});
```

### React to prop-based modal errors

If a modal receives `error` or `formError` from its parent, watch that prop with a local `$effect`, show a toast once per signature, and remove the inline alert block.

### Preserve recovery actions

If the old banner had restore/delete/retry buttons, move them into toast actions instead of dropping the recovery path.

### Persistent state problems

Use `duration: null` and `showProgress: false` for important page-load failures that should remain visible until dismissed.

## Do Not Toast

- Field-level validation text
- Delete confirmation impact summaries
- Review-step content that the user must compare before submitting
