---
name: playims-info-popover-builder
description: Build, migrate, or refactor PlayIMs helper/info popovers using src/lib/components/InfoPopover.svelte with consistent behavior, accessibility, and styling. Use when replacing ad-hoc info icons/help blocks/details-style helper content, adding explanatory popovers in dashboard flows, or updating InfoPopover internals and consumers under src/routes/dashboard/**.
---

# PlayIMs Info Popover Builder

## Goal
Implement reusable helper popovers with `InfoPopover` so helper text looks and behaves the same across dashboard pages and wizard steps.

## Start Here
Read these files before editing:
- `src/lib/components/InfoPopover.svelte`
- `docs/wizard-system.md`
- Current consumers (search `InfoPopover` in `src/routes/dashboard/**`)
- Nearby ad-hoc helper icon patterns (for migration candidates):
- `src/routes/dashboard/account/+page.svelte`
- `references/qa-matrix.md`

## Component Contract
Treat this API as the baseline:
- Optional props:
- `buttonAriaLabel?: string` (default: `More information`)
- `align?: 'left' | 'right'` (default: `right`)
- `panelWidthClass?: string` (default: `w-72`)
- `buttonClass?: string`
- `panelClass?: string`
- `iconClass?: string`
- Content via default snippet/children:
- `children?: Snippet`

Current default classes:
- `buttonClass`: `cursor-pointer p-1.5 border border-secondary-300 bg-neutral text-secondary-900 hover:bg-secondary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-600`
- `panelClass`: `top-8 z-10 border border-secondary-300 bg-white p-2 text-xs text-neutral-950 shadow-sm`
- `iconClass`: `w-4 h-4`

Behavioral guarantees from current implementation:
- Trigger click toggles open/closed state.
- Closes on outside `pointerdown`.
- Closes on `Escape`.
- `Escape` close uses capture-phase listener and stops propagation, so open popover closes before parent modal handlers.
- Popover panel is only mounted in DOM while open.
- Trigger has `aria-haspopup="dialog"` and `aria-expanded` state.
- Root wrapper is `relative shrink-0`; panel is absolutely positioned with `left-0` or `right-0`.

## Required Integration Pattern
1. Keep helper text short and supplemental.
- Keep decision-critical instructions visible in the main step/body, not only in the popover.
2. Add a specific `buttonAriaLabel` for the exact context.
- Good: `Copy content help`, `Why this step is required`.
- Avoid generic labels like `Info`.
3. Prefer default visual classes for consistency.
- Override `buttonClass`, `panelClass`, or `panelWidthClass` only for concrete layout constraints.
4. Use `align="right"` by default; switch to `align="left"` near right viewport edges to avoid clipping.
5. Use paragraph blocks in popover content.
- For multiple lines/paragraphs, wrap with `space-y-2` container and concise copy.
6. Avoid interactive controls inside the popover panel.
- `InfoPopover` is for explanatory text; it is not a full focus-managed dialog/menu.

Default usage:
```svelte
<InfoPopover buttonAriaLabel="Scheduling help">
	<p>Games auto-schedule only after teams and venue windows are configured.</p>
</InfoPopover>
```

Left-aligned wider panel example:
```svelte
<InfoPopover buttonAriaLabel="Division copy rules" align="left" panelWidthClass="w-80">
	<div class="space-y-2">
		<p>Divisions are copied only when leagues are copied in this step.</p>
		<p>Change this later in season settings if needed.</p>
	</div>
</InfoPopover>
```

## Workflow
1. Ground parity and intent.
- Identify whether existing helper UI is supplemental (popover candidate) or essential inline instruction (keep visible).
2. Implement or migrate to `InfoPopover`.
- Replace ad-hoc icon/help widgets and keep surrounding layout/state unchanged.
3. Standardize affordance and copy style.
- Keep trigger size/icon style aligned with component defaults.
- Keep helper copy concise and paragraph-oriented.
4. Validate interaction parity.
- Run keyboard/pointer checks from `references/qa-matrix.md`.
- Confirm `Escape` behavior with surrounding modal/wizard context.
5. Validate build safety.
- Run `pnpm check`.
- Run `pnpm build` when changing shared component internals or broad consumer sets.

## Guardrails
- Do not create custom outside-click or Escape handlers around `InfoPopover` unless fixing a specific bug.
- Do not put required or compliance-critical instructions exclusively inside popovers.
- Do not introduce one-off info icon/button styles when `InfoPopover` defaults are sufficient.
- Do not use `InfoPopover` for action menus, confirmations, or editable controls.
- Keep `buttonAriaLabel` unique and context-specific for each popover instance.
- Preserve existing route behavior and copy unless explicitly asked to rewrite UX text.

## Delivery Checklist
Always report:
1. Files updated and where popovers were added or migrated.
2. Parity notes (what helper content stayed visible vs moved into popovers).
3. Accessibility and interaction checks performed (pointer, `Escape`, outside click, ARIA label quality).
4. Validation command results.
