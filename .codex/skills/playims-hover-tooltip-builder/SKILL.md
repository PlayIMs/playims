---
name: playims-hover-tooltip-builder
description: Build, migrate, or refactor PlayIMs hover tooltips using src/lib/components/HoverTooltip.svelte and shared floating positioning in src/lib/components/floating-position.ts. Use when replacing native title tooltips, adding hover hints to dashboard controls, or updating tooltip behavior across routes and wizards while preserving cursor-follow, viewport-safe behavior.
---

# PlayIMs Hover Tooltip Builder

## Goal

Implement consistent hover tooltips across PlayIMs using `HoverTooltip` with cursor-relative placement, viewport clamping, and shared floating-panel logic.

## Start Here

Read these files before editing:

- `src/lib/components/HoverTooltip.svelte`
- `src/lib/components/InfoPopover.svelte`
- `src/lib/components/floating-position.ts`
- Current consumers (search `HoverTooltip` in `src/routes/**` and `src/lib/components/**`)
- `references/qa-matrix.md`

## Component Contract

Treat this API as the baseline:

- Required prop: `text: string`
- Optional props:
- `cursorOffsetXPx?: number` (default: `14`)
- `cursorOffsetYPx?: number` (default: `18`)
- `paddingPx?: number` (default: `8`)
- `minWidthPx?: number` (default: `180`)
- `panelClass?: string`
- `maxWidthClass?: string` (default: `max-w-72`)
- `wrapperClass?: string` (default: `relative inline-flex shrink-0`)
- Content via children snippet:
- `children?: Snippet`

Behavioral guarantees from current implementation:

- Opens while pointer hovers the trigger wrapper or trigger receives focus.
- Follows cursor while hovering the trigger.
- Prefers rendering to the lower-right of the cursor.
- Flips left when right-side space is insufficient.
- Flips up when bottom space is insufficient.
- Clamps to visible viewport with edge padding.
- Applies minimum width for readability (`minWidthPx`) and avoids viewport overflow.
- Uses `position: fixed`, so tooltip panel does not affect ancestor layout/scroll.
- Uses `pointer-events-none` on panel to avoid stealing hover state from the trigger.

## Required Integration Pattern

1. Replace native HTML `title` hover hints with `HoverTooltip` for consistent behavior.
2. Keep tooltip copy concise and action-specific.
- Good: `Edit facility`, `Sign out this session`, `Duplicate league settings`.
3. Wrap the actionable element directly.
- Keep current button/link classes, aria labels, and handlers.
4. Use `wrapperClass` when layout requires block/fill behavior.
- Example: sidebar nav rows should use `wrapperClass="block w-full"`.
5. Keep long helper text constrained with `maxWidthClass` and rely on viewport clamping for edge cases.
6. For persistent click-to-dismiss help content, use `InfoPopover` instead of `HoverTooltip`.
- `InfoPopover` uses the same shared floating-position engine but intentionally does not follow cursor.

Default usage:

```svelte
<HoverTooltip text="Edit season">
	<button type="button" class="button-secondary-outlined p-1.5 cursor-pointer" aria-label="Edit season">
		<IconPencil class="w-4 h-4" />
	</button>
</HoverTooltip>
```

Full-width wrapper example:

```svelte
<HoverTooltip text={isSidebarOpen ? '' : item.label} wrapperClass="block w-full">
	<a href={item.href} class="w-full ...">...</a>
</HoverTooltip>
```

## Workflow

1. Find all hover tooltip candidates.
- Search for `title=` and existing `HoverTooltip` usage.
2. Migrate to shared tooltip component.
- Preserve existing click/focus handlers and aria labels.
3. Keep behavior parity and visual consistency.
- Do not change action semantics while swapping tooltip affordance.
4. Validate interaction.
- Run checks from `references/qa-matrix.md`, including viewport edge cases and modal contexts.
5. Validate build safety.
- Run `pnpm check`.
- Run `pnpm build` when editing shared tooltip internals or many consumers.

## Guardrails

- Do not create ad-hoc tooltip implementations or inline positioning scripts.
- Do not use `InfoPopover` for short hover-only action hints.
- Do not use `HoverTooltip` for long, paragraph-heavy instructional content.
- Do not reintroduce native `title` attributes where `HoverTooltip` is expected.
- Keep tooltip text supplemental; critical required instructions should stay visible inline.
- Preserve route behavior and handlers when migrating tooltip wrappers.

## Delivery Checklist

Always report:

1. Files updated and where tooltip migrations occurred.
2. Parity notes (what stayed hover vs what remained click-persistent popover behavior).
3. Interaction checks performed (cursor follow, viewport clamp, edge flipping, modal behavior).
4. Validation command results.
