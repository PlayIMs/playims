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
- Option shape: `{ value: string; label: string; statusLabel?: string; disabled?: boolean }`
- Emits: `change` event with `event.detail.value: string`
- Optional props: `placeholder`, `emptyText`, `align`, `disabled`
- Optional class overrides: `buttonClass`, `listClass`, `optionClass`, `selectedOptionClass`, `activeOptionClass`, `disabledOptionClass`
- Optional trigger snippet: `trigger?: Snippet<[open: boolean, selectedOption: Option | null]>`

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
4. Validate accessibility and interaction parity.
- Run keyboard/pointer QA from `references/qa-matrix.md`.
- Confirm screen-reader labels and `aria-expanded` transitions.
5. Validate build safety.
- Run `pnpm check`.
- Run `pnpm build` when changing shared component internals or multiple consumers.

## Guardrails
- Do not mutate `value` inside `ListboxDropdown`; parent state owns selection.
- Do not remove keyboard/typeahead/outside-click behavior when editing component internals.
- Do not use `ListboxDropdown` for action menus (`role="menu"` semantics); keep it for option selection (`role="listbox"`).
- Prefer `statusLabel` for compact contextual tags (CURRENT/PAST/FUTURE) rather than embedding metadata in primary labels.
- Keep option `value` strings stable and unique.
- Preserve existing copy unless explicitly asked to rewrite UX text.

## Delivery Checklist
Always report:
1. Files updated and where dropdowns were added/migrated.
2. Parity notes (state flow, side effects, disabled behavior, ordering).
3. Accessibility checks performed (keyboard + pointer + ARIA label).
4. Validation command results.
