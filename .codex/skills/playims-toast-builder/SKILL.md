---
name: playims-toast-builder
description: Build or refactor PlayIMs toast notifications using the shared toast system in `src/lib/toasts.ts` and `src/lib/components/toast/**`. Use when replacing transient success/error banners, wiring async page or wizard feedback into toasts, adding toast actions like restore/retry, or extending PlayIMs notification behavior without introducing a third-party toast UI.
---

# PlayIMs Toast Builder

## Goal

Ship transient feedback through the shared PlayIMs toast system so success/error notices do not shift layout, linger in-page, or drift away from the app's existing dashboard styling.

## Start Here

Read these files before editing toast behavior:

- `src/lib/toasts.ts`
- `src/lib/components/toast/Toaster.svelte`
- `src/lib/components/toast/ToastItem.svelte`
- `src/routes/+layout.svelte`
- `src/routes/dashboard/offerings/+page.svelte`
- `src/routes/dashboard/facilities/+page.svelte`
- `src/routes/dashboard/account/+page.svelte`
- `src/routes/dashboard/settings/modules/+page.svelte`
- `references/toast-system.md`

## Required Workflow

1. Classify the feedback:
   - Use a toast when the user needs confirmation of a success, error, warning, or other transient status that would otherwise become a banner.
   - Prefer toasts over banners because they do not shift the page layout around.
   - Keep inline field errors and input validation under the field instead of moving them into toasts.
   - Keep destructive impact copy inside the confirmation modal body.
2. Prefer the existing custom system over adding a dependency.
3. Use `toast.success`, `toast.error`, `toast.warning`, `toast.info`, `toast.loading`, or `toast.promise` instead of rendering page banners.
4. Give repeated actions a stable toast `id` so retries update or replace the same notification instead of stacking duplicates.
5. The shared store also suppresses duplicate toasts with the same variant and copy; if you intentionally need a distinct toast, change the title/content, use an explicit id strategy, or opt into `ignoreDuplicateStack`.
6. When a duplicate toast is suppressed, the existing toast should surface the running duplicate count next to the title, such as `Offering saved (3x)`, and timed toasts should restart from the newest duration.
7. When the old banner included recovery actions, move them into toast `actions`.
8. Trigger wizard/modal top-level failures with toasts, but leave field-level validation in place.
9. Mount new toast behavior through `src/routes/+layout.svelte`; do not create route-local toast viewports.
10. Re-check the nearest route for any remaining transient banner markup and remove it.
11. Once a placement reaches the shared toast limit, queue new non-important toasts instead of showing them immediately. The overflow notice should sit at the same edge where the next toast would have appeared.
12. Important toasts should bypass that queue and appear immediately by evicting the oldest currently visible toast in the same placement.

## Design Rules

- Match the live toast visuals in `src/lib/components/toast/ToastItem.svelte`.
- Default new toasts to `bottom-left` on desktop and `top` on mobile unless the user asks for a different placement.
- Default toast duration to `4800` ms.
- Default errors to persistent behavior unless the user asks otherwise.
- Default `showProgress` to on for toasts that have a duration.
- Default live-region behavior to polite unless a toast is explicitly important.
- Default `ignoreDuplicateStack` to `false`.
- Default `dismissible` to `true`.
- Default `actions` to none unless the user explicitly asks for toast actions or the existing banner already had recovery actions that must be preserved.
- Use a thin, even full-border toast shell instead of heavy banner-style framing.
- Keep the toast body on a very light tint of the semantic color, with the border using the stronger semantic edge color.
- Use dark semantic text shades on tinted toast surfaces; do not fall back to neutral-950 or pure black body text on colored backgrounds.
- Toast titles should use Bitter/the shared serif heading face and sit a step lighter than the body copy while staying in the same semantic color family.
- Keep the icon chip treatment already established in `ToastItem.svelte`; do not redesign the icon style unless the user asks.
- Use a bottom progress bar inside the toast shell when `showProgress` is enabled; it should read as a related shade of the same toast color.
- Keep a visible drop shadow so the toast feels lifted off the page instead of glued to the layout.
- Info toasts should use the neutral theme family throughout, with a very dark neutral border and dark neutral title/body text rather than a primary or secondary emphasis treatment.
- Default unspecified desktop placement to `bottom-right`; mobile should support only centered `top`, `middle`, or `bottom` placement.
- If mobile placement is omitted, derive it from the desktop placement row so top/middle/bottom intent carries across sensibly.
- Bottom-anchored stacks should place new toasts at the bottom of the visible list so existing toasts shift upward naturally.
- Use a queue once the placement limit is full. Keep current visible toasts on screen, show a `# more notifications` overflow notice at the insertion edge, and let queued toasts appear automatically as visible slots open.
- Motion should be placement-aware: bottom stacks rise in from fully off-screen below, top stacks drop in from fully off-screen above, middle-left and middle-right stacks slide in from their respective sides, and middle-center should appear in place while pushing existing toasts downward.
- Top and middle placements should render newest toasts first so existing items get pushed downward, while bottom placements should keep newer toasts arriving beneath older ones.
- Use ease-out motion for toast entry and reflow; avoid ease-in or ease-in-out stack movement.
- When overflow exists, provide both `Clear existing` for only visible toasts and `Clear all toasts` for visible plus queued notifications.
- Use toast titles for context such as page or workflow name.
- Use persistent toasts (`duration: null`) only for important state that would otherwise be lost after auto-dismiss.
- Use actions sparingly and only for immediate follow-up operations such as restore, retry, or delete.
- Toast action buttons should be rendered with toast-scoped styling, not generic page button classes.
- Toast action color is controlled by the toast variant itself. Do not add per-action tones; only expose `solid` and `outline` action styles.
- If a toast has actions, prefer the safe or forward-moving action as `solid` and the unsafe, cancel, back, or dismissive action as `outline`.
- Do not use toasts as a substitute for required persistent content like delete warnings or review summaries.

## Guardrails

- Do not add a third-party toast package unless the user explicitly asks for it.
- Do not reintroduce transient success/error banners inside dashboard pages, auth pages, or wizards.
- Do not put long-form instructional copy into a toast.
- Do not use toast actions to hide destructive confirmation requirements; destructive confirmation still belongs in the modal flow.

## Validation

Run these checks after changes:

1. `pnpm check`
2. `pnpm build` for shared component or cross-route changes
3. `python "C:\Users\Jake\.codex\skills\.system\skill-creator\scripts\quick_validate.py" ".codex/skills/playims-toast-builder"`
