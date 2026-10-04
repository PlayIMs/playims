---
name: playims-listbox-dropdown-builder
description: Build or migrate PlayIMs selectors and action menus with ListboxDropdown, preserving parent-owned state, keyboard typeahead, footer actions, and disabled options.
---

# PlayIMs Listbox Dropdown Builder

Use `ListboxDropdown` for consistent dashboard selection and action menus.

## Establish context

Follow workspace AGENTS.md and choose its testing tier before editing. Identify the active route, requested behavior, and current props/events. Infer these from code when possible; ask only for missing product decisions. Read `src/lib/components/ListboxDropdown.svelte`, the active consumer, and shared `floating-position.ts` only when placement changes.

Current component APIs and app.css are authoritative. Preserve scope and existing contracts; load companion skills only for components/behavior being changed.

## Preserve these contracts

- Parent state owns `value`; map stable unique values and current labels into options. Preserve ordering, disabled states, loading, and selection side effects.
- Use `mode="select"` for persistent selection and `mode="action"` with empty value for transient commands. Read the live component event API before wiring change/action handlers.
- Closed select triggers support label typeahead without opening; Space opens the menu. Action menus must not gain persistent closed-state selection. Preserve arrows, Home/End, Enter, Escape, Tab, outside click, and disabled-option skipping.
- Start with shared classes and 2px panel borders. Keep trigger, panel, dividers, footer, and focus styling in the same color family. Primary filled states use contrast-aware foreground tokens. Use `dashboard-icon-button` for compact triggers.
- Form selectors without custom trigger classes inherit field styling inside the shared modal shell. Use `variant="field"` explicitly outside that context, or `variant="button"` for a deliberate button-style exception. Field styling belongs to the shared `select-secondary` CSS, not copied route class lists.
- Use trigger snippets for custom icons and existing footerAction/footerSecondaryAction APIs for contextual add/manage actions. Keep split-button action menus on the live offerings recipe.
- Disabled explanations use shared HoverTooltip behavior; searchable panels use SearchInput. Do not add local positioning engines or native title hints.

## Read detail when needed

- [integration contract](references/integration-contract.md): Prop/event shapes and select, icon, footer, neutral, and split-action recipes.
- [qa matrix](references/qa-matrix.md): Keyboard, disabled option, viewport, and pointer checks.

## Done when

Selection/action semantics, closed-trigger typing, disabled options, focus, and panel placement match the affected consumer. Report only verified behavior. Follow AGENTS.md for automated gates and test comments. Record actual checks and unverified browser behavior; a unit/parser pass does not establish a browser pass.
