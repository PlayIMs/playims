---
name: playims-listbox-dropdown-builder
description: Build, migrate, or refactor PlayIMs dashboard dropdowns using src/lib/components/ListboxDropdown.svelte with consistent styling, keyboard behavior, and accessibility. Use when replacing native select controls or ad-hoc custom dropdowns, adding new listbox-style selectors, or updating ListboxDropdown internals and consumers under src/routes/dashboard.
---

# PlayIMs Listbox Dropdown Builder

## Goal

Implement reusable, accessible dropdown selectors with `ListboxDropdown` while preserving route behavior, state flow, and PlayIMs styling conventions.

## Start Here

Read these files before editing:

- `src/lib/components/ListboxDropdown.svelte`
- Current consumers (search `ListboxDropdown` in `src/routes/dashboard/**`)
- `src/app.css` (`button-secondary-outlined` and dropdown-related utility classes)
- `references/qa-matrix.md`

## Component Contract

Treat this API as the baseline:

- Required props: `options`, `value`, `ariaLabel`
- Option shape: `{ value: string; label: string; statusLabel?: string; disabled?: boolean; separatorBefore?: boolean }`
- Emits: `change` event with `event.detail.value: string`
- Optional action event: `action` with `event.detail.value: string` (when `mode="action"`)
- Optional mode: `mode?: 'select' | 'action'` (`select` by default; use `action` for non-persistent button dropdowns)
- Optional props: `placeholder`, `emptyText`, `align`, `disabled`
- Optional panel note: `noteText`, `noteClass`
- Optional focus hook: `autoFocus` (adds `data-wizard-autofocus` to trigger button for wizard autofocus flows)
- Optional class overrides: `buttonClass`, `listClass`, `optionClass`, `selectedOptionClass`, `activeOptionClass`, `disabledOptionClass`
- Optional trigger snippet: `trigger?: Snippet<[open: boolean, selectedOption: Option | null]>`
- Optional footer action: `footerActionLabel`, `footerActionAriaLabel`, `footerActionClass`, `footerActionDisabled`, `footerAction?: Snippet<[]>`
- Optional secondary footer action: `footerSecondaryActionLabel`, `footerSecondaryActionAriaLabel`, `footerSecondaryActionClass`, `footerSecondaryActionDisabled`, `footerSecondaryAction?: Snippet<[]>`
- Optional footer event: `on:footerAction`
- Optional secondary footer event: `on:footerSecondaryAction`

Behavioral guarantees from current implementation:

- Supports keyboard navigation (`ArrowUp/Down`, `Home`, `End`, `Enter`, `Space`, `Escape`, `Tab`).
- Supports 500ms typeahead buffer on option labels.
- Skips disabled options for active navigation and selection.
- Closes on outside pointer down and global `Escape`.
- Focuses listbox when opened; returns focus to trigger after selection or `Escape`.
- Uses module-level unique IDs for `aria-controls`, `aria-activedescendant`, and option IDs.

## Required Integration Pattern

1. Keep source-of-truth selection state in the parent route/component.
2. Compute `options` as derived data from existing entities (never hardcode stale labels if data already exists).
3. Update state in `on:change` and preserve side effects currently tied to selection changes.
4. Provide meaningful `ariaLabel` specific to the domain context.
5. Use trigger snippets for icon-only buttons; otherwise rely on default trigger text + chevron.

Example default usage:

```svelte
<ListboxDropdown
	options={seasonHistoryDropdownOptions}
	value={selectedSeasonId}
	ariaLabel="Season history"
	on:change={(event) => {
		handleSeasonHistoryChange(event.detail.value);
	}}
/>
```

Example icon trigger usage:

```svelte
<ListboxDropdown
	options={seasonHistoryDropdownOptions}
	value={selectedSeasonId}
	ariaLabel="Season history"
	buttonClass="button-secondary-outlined p-1.5 cursor-pointer"
>
	{#snippet trigger(_, selectedOption)}
		<IconHistory class={`w-4 h-4 ${selectedOption ? 'text-secondary-900' : 'text-neutral-700'}`} />
	{/snippet}
</ListboxDropdown>
```

Example footer action usage:

```svelte
<ListboxDropdown
	options={seasonHistoryDropdownOptions}
	value={selectedSeasonId}
	ariaLabel="Season history"
	footerActionLabel="Add New Season"
	on:footerAction={openCreateSeasonWizard}
	on:change={(event) => {
		handleSeasonHistoryChange(event.detail.value);
	}}
/>
```

Example dual-footer action usage (primary + square pencil):

```svelte
<ListboxDropdown
	options={seasonHistoryDropdownOptions}
	value={selectedSeasonId}
	ariaLabel="Season history"
	footerActionLabel="Add New Season"
	footerSecondaryActionAriaLabel="Manage seasons"
	footerSecondaryActionClass="button-secondary-outlined w-9 h-9 p-0 cursor-pointer inline-flex items-center justify-center"
	on:footerAction={openCreateSeasonWizard}
	on:footerSecondaryAction={openManageSeasonWizard}
>
	{#snippet footerSecondaryAction()}
		<IconPencil class="w-4 h-4" />
	{/snippet}
</ListboxDropdown>
```

Example action-menu usage (non-persistent):

```svelte
<div class="relative inline-flex items-stretch">
	<button
		type="button"
		class="button-primary-outlined px-2 py-1 text-xs font-bold uppercase tracking-wide cursor-pointer"
		onclick={openCreateWizard}
	>
		+ ADD
	</button>
	<ListboxDropdown
		options={addActionDropdownOptions}
		value=""
		mode="action"
		ariaLabel="Open add menu"
		align="right"
		buttonClass="button-primary-outlined -ml-[2px] px-1 py-1 cursor-pointer"
		listClass="mt-1 w-44 border-2 border-secondary-300 bg-white z-20"
		optionClass="w-full text-left px-3 py-2 text-sm text-neutral-950 cursor-pointer"
		activeOptionClass="bg-neutral-100 text-neutral-950"
		noteText={addEntryOptionCount === 0
			? 'No matching offerings available for this view.'
			: undefined}
		on:action={(event) => {
			handleAddActionDropdown(event.detail.value);
		}}
	>
		{#snippet trigger()}
			<IconChevronDown class="w-4 h-4" />
		{/snippet}
	</ListboxDropdown>
</div>
```

## Workflow

1. Ground behavior parity.

- Capture current selection state, side effects, and empty/loading behavior.
- If migrating from `<select>` or custom menu, preserve current labels, ordering, and disabled semantics.

2. Implement dropdown integration.

- Replace inline markup with `ListboxDropdown`.
- Map domain objects to `{ value, label, statusLabel?, disabled? }`.
- Keep event handlers route-local (avoid introducing global stores unless already used).

3. Standardize styling.

- Start from default classes.
- For compact icon triggers, pass `buttonClass="button-secondary-outlined p-1.5 cursor-pointer"`.
- Override `listClass` width/alignment only when required by layout constraints.

4. Add optional footer actions when needed.

- Use footer action for contextual CTA items (for example: `Add New Season`) that should be visually distinct from selection options.
- Keep footer action labels action-oriented verbs, and wire `on:footerAction` in the parent route/component.

5. Add secondary footer admin actions when needed.

- Use `footerSecondaryAction*` for compact admin utilities (for example: pencil/manage) beside the primary footer CTA.
- Keep primary CTA as the main action and secondary action icon-first for discoverability and compact layout.

6. Use action mode for non-persistent button dropdowns.

- Set `mode="action"` and `value=""` when options should trigger actions rather than persist a selected value.
- Handle option clicks with `on:action`.
- Keep the current split-button styling when migrating existing add/action menus.

7. Validate accessibility and interaction parity.

- Run keyboard/pointer QA from `references/qa-matrix.md`.
- Confirm screen-reader labels and `aria-expanded` transitions.

8. Validate build safety.

- Run `pnpm check`.
- Run `pnpm build` when changing shared component internals or multiple consumers.

## Guardrails

- Do not mutate `value` inside `ListboxDropdown`; parent state owns selection.
- Do not remove keyboard/typeahead/outside-click behavior when editing component internals.
- For transient action menus, use `mode="action"` and keep actions non-persistent.
- Prefer `statusLabel` for compact contextual tags (CURRENT/PAST/FUTURE) rather than embedding metadata in primary labels.
- Use the optional footer action only for secondary contextual actions, not for replacing primary option selection.
- Keep option `value` strings stable and unique.
- Preserve existing copy unless explicitly asked to rewrite UX text.

## Delivery Checklist

Always report:

1. Files updated and where dropdowns were added/migrated.
2. Parity notes (state flow, side effects, disabled behavior, ordering).
3. Accessibility checks performed (keyboard + pointer + ARIA label).
4. Validation command results.
